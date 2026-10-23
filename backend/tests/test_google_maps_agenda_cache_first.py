"""Real Agenda transactions, separate test ledger, zero external Google traffic."""
import json
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock, patch
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
import test_agenda_maps_budget_atomicity as fixtures
from app.api.v1.endpoints import agenda, google_maps_cost_control as control_api
from app.core.security import get_current_user
from app.models.agendamento import Agendamento
from app.models.clinica_deslocamento import ClinicaDeslocamento
from app.models.google_maps_cost_control import COST_TABLES
from app.services import google_maps_cost_control as guard, google_maps_cost_middleware as middleware
from app.services import logistica_service as routes

class GoogleMapsAgendaCacheFirstTest(unittest.TestCase):

    def setUp(self):
        fixtures.AgendaMapsBudgetAtomicityTest.setUp(self)
        self.ledger = getattr(self, '_isolated_engine', None)
        if self.ledger is None:
            self.ledger = create_engine('sqlite:///' + str(Path(self.temp.name) / 'ledger.db'), connect_args={'check_same_thread': False})
        self.addCleanup(self.ledger.dispose)
        for table in COST_TABLES:
            table.create(self.ledger, checkfirst=True)
        for p in (patch.object(guard.database, 'engine', self.ledger), patch.object(guard.settings, 'GOOGLE_MAPS_AGENDA_CACHE_FIRST', True), patch.object(guard.settings, 'GOOGLE_MAPS_COST_EMERGENCY_RELEASE', False), patch.object(guard.settings, 'SECRET_KEY', 'cache-first-synthetic-secret-not-real-123456789'), patch.object(routes.settings, 'GOOGLE_ROUTES_CACHE_MAX_AGE_DAYS', 7), patch.object(middleware, '_authenticate', return_value=7), patch.object(routes, 'urlopen', side_effect=AssertionError('Real network forbidden')), patch.object(routes, '_http_get_json', side_effect=AssertionError('Unexpected fallback'))):
            p.start()
            self.addCleanup(p.stop)
        p = patch.object(routes, '_http_post_json', return_value={'routes': [{'distanceMeters': 1000, 'duration': '600s'}]})
        self.outbound = p.start()
        self.addCleanup(p.stop)
        self.app = FastAPI()
        self.app.include_router(agenda.router, prefix='/api/v1/agenda')
        self.app.include_router(control_api.router, prefix='/api/v1/google-maps-control')
        self.app.add_middleware(middleware.GoogleMapsCostMiddleware)

        def db_dependency():
            with self.sessions() as db:
                yield db
        self.app.dependency_overrides[agenda.get_db] = db_dependency
        self.app.dependency_overrides[get_current_user] = lambda: SimpleNamespace(id=7, nome='Synthetic reception', tem_papel=lambda _: True)
        self.client = TestClient(self.app)
        self.client.__enter__()
        self.addCleanup(self.client.__exit__, None, None, None)
        self.addCleanup(guard._execution.set, None)
        self.path = f'/api/v1/agenda/{self.id}'
        self.body = {'inicio': '2099-05-25T11:30:00', 'fim': '2099-05-25T12:00:00'}

    def tearDown(self):
        fixtures.AgendaMapsBudgetAtomicityTest.tearDown(self)

    def configure(self, day_calls=20, monitor=False):
        cfg = guard.CostConfiguration.model_validate({'enabled': True, 'limits': {'action': {'calls': 4, 'estimated_brl': 1}, 'day': {'calls': day_calls, 'estimated_brl': 5}, 'month': {'calls': 100, 'estimated_brl': 20}}, 'prices_usd': {sku: '0.01' for sku in guard.SKUS}, 'fx_brl_per_usd_upper': 6, 'price_multiplier': 1, 'pricing_valid_until': (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat(), 'opening_usage': {'day': {'calls': 0, 'estimated_brl': 0}, 'month': {'calls': 0, 'estimated_brl': 0}}, 'opening_usage_as_of': guard._periods(guard._now())[0], 'opening_usage_basis': 'synthetic_stage'})
        if monitor:
            data = cfg.model_dump(mode="json")
            data["agenda_budget_mode"] = "monitor"
            data["limits"]["action"]["estimated_brl"] = 0
            data["limits"]["day"] = data["limits"]["month"] = {"calls": 0, "estimated_brl": 0}
            data["automatic_policies"] = {"synthetic_job": {"enabled": True, "limits": {key: {"calls": 5, "estimated_brl": 1} for key in ("action", "day", "month")}, "skus": ["routes_essentials"]}}
            cfg = guard.CostConfiguration.model_validate(data)
        return guard.update_configuration(7, cfg, 0)

    def seed_cache(self, age_days=0, source='google_routes_api'):
        with self.sessions() as db:
            for a, b in ((1, 2), (2, 3)):
                for profile in ('comercial', 'plantao'):
                    db.add(ClinicaDeslocamento(origem_clinica_id=a, destino_clinica_id=b, perfil=profile, distancia_km=1, duracao_min=10, fonte=source, updated_at=datetime.utcnow() - timedelta(days=age_days)))
            db.commit()

    def test_proposed_monitor_config_keeps_reception_above_references_and_extras_closed(self):
        proposal = Path(__file__).resolve().parents[2] / 'docs/specs/google-maps-enforced-budget/proposed-monitor-config.json'
        data = json.loads(proposal.read_text())
        self.assertFalse(data['enabled'])
        data.update(enabled=True, opening_usage_as_of=guard._periods(guard._now())[0],
                    opening_usage_basis='synthetic_stage',
                    pricing_valid_until=(datetime.now(timezone.utc) + timedelta(hours=1)).isoformat(),
                    opening_usage={'day': {'calls': 651, 'estimated_brl': 26},
                                   'month': {'calls': 13001, 'estimated_brl': 501}})
        guard.update_configuration(7, guard.CostConfiguration.model_validate(data), 0)
        quote = self.preview(paid=True).json()
        self.assertFalse(quote['blocked'])
        self.assertFalse(quote['financial_limit_enforced'])
        self.assertEqual(quote['max_calls'], 64)
        self.assertEqual(quote['estimated_cost_max_brl'], 4.608)
        self.assertTrue(quote['alerts'])
        self.outbound.assert_not_called()  # Displaying/cancelling the quote is unpaid.
        token = self.client.post('/api/v1/google-maps-control/confirm', json={'quote_id': quote['quote_id']}).json()['token']
        result = self.client.put(self.path, json=self.body, headers={'X-Google-Maps-Action': token})
        self.assertEqual(result.status_code, 200, result.text)
        self.assertEqual(self.outbound.call_count, 2)
        replay = self.client.put(self.path, json=self.body, headers={'X-Google-Maps-Action': token})
        self.assertEqual(replay.status_code, 409)
        for path in ('/api/v1/logistica/recalcular', '/api/v1/tutores/geocode-endereco'):
            extra = self.client.post('/api/v1/google-maps-control/preview', json={'method': 'POST', 'path': path, 'body': {}}).json()
            self.assertTrue(extra['blocked'])
        with self.assertRaises(guard.GoogleMapsCostBlocked) as denied:
            with guard.automatic_action('whatsapp_agenda', 'synthetic-proposal-job'):
                guard.authorize_google_call('routes_essentials')
        self.assertEqual(denied.exception.reason, 'automatic_policy_required')
        self.assertEqual(self.outbound.call_count, 2)

    def preview(self, paid=False):
        return self.client.post('/api/v1/google-maps-control/preview', json={'method': 'PUT', 'path': self.path, 'body': self.body, 'paid_call_required': paid})

    def test_local_preview_and_cached_booking_work_with_unavailable_ledger(self):
        self.seed_cache()
        broken = Mock()
        broken.connect.side_effect = AssertionError('Local Agenda accessed ledger')
        with patch.object(guard.database, 'engine', broken):
            preview = self.preview()
            self.assertEqual(preview.status_code, 200, preview.text)
            self.assertEqual(preview.json()['operation_mode'], 'cache_first')
            self.assertFalse(preview.json()['required'])
            self.assertFalse(preview.json()['paid_calls_allowed'])
            response = self.client.put(self.path, json=self.body)
        self.assertEqual(response.status_code, 200, response.text)
        self.outbound.assert_not_called()
        broken.connect.assert_not_called()
        with self.sessions() as db:
            self.assertEqual(agenda._to_local_naive(db.get(Agendamento, self.id).inicio), datetime(2099, 5, 25, 11, 30))

    def test_unpaid_probe_rolls_back_then_one_confirmed_execution_succeeds(self):
        self.configure()
        probe = self.client.put(self.path, json=self.body)
        self.assertEqual(probe.status_code, 409, probe.text)
        self.assertEqual(probe.json()['detail']['reason'], 'confirmation_required')
        self.assertTrue(probe.json()['detail']['can_retry_with_confirmation'])
        self.outbound.assert_not_called()
        agenda._notificar_agenda_update.assert_not_called()
        agenda.registrar_auditoria.assert_not_called()
        with self.sessions() as db:
            self.assertEqual(db.get(Agendamento, self.id).inicio, self.original_start)
            self.assertEqual(db.query(ClinicaDeslocamento).count(), 0)
        quote = self.preview(paid=True).json()
        self.assertTrue(quote['required'])
        token = self.client.post('/api/v1/google-maps-control/confirm', json={'quote_id': quote['quote_id']}).json()['token']
        result = self.client.put(self.path, json=self.body, headers={'X-Google-Maps-Action': token})
        self.assertEqual(result.status_code, 200, result.text)
        self.assertEqual(self.outbound.call_count, 2)
        replay = self.client.put(self.path, json=self.body, headers={'X-Google-Maps-Action': token})
        self.assertEqual(replay.status_code, 409, replay.text)
        self.assertEqual(replay.json()['detail']['reason'], 'invalid_grant')
        self.assertEqual(self.outbound.call_count, 2)
        self.assertEqual(guard.get_status()['consumption']['day']['calls'], 2)

    def test_cache_continues_after_daily_budget_exhaustion(self):
        self.configure(day_calls=0)
        self.seed_cache()
        self.assertTrue(self.preview(paid=True).json()['blocked'])
        r = self.client.put(self.path, json=self.body)
        self.assertEqual(r.status_code, 200, r.text)
        self.outbound.assert_not_called()

    def test_missing_policy_only_blocks_lookup_not_normal_form_validation(self):
        r = self.client.post('/api/v1/agenda', json={})
        self.assertEqual(r.status_code, 422, r.text)
        r = self.client.put(self.path, json=self.body)
        self.assertEqual(r.status_code, 409, r.text)
        self.assertEqual(r.json()['detail']['reason'], 'unconfigured')
        self.outbound.assert_not_called()
        with self.sessions() as db:
            self.assertEqual(db.get(Agendamento, self.id).inicio, self.original_start)

    def test_cold_cache_and_unavailable_ledger_never_send_or_commit(self):
        broken = Mock()
        broken.connect.side_effect = RuntimeError('private connection details')
        with patch.object(guard.database, 'engine', broken):
            r = self.client.put(self.path, json=self.body)
        self.assertEqual(r.status_code, 503, r.text)
        self.assertEqual(r.json()['detail']['reason'], 'ledger_unavailable')
        self.assertNotIn('private connection', r.text)
        self.outbound.assert_not_called()
        with self.sessions() as db:
            self.assertEqual(db.get(Agendamento, self.id).inicio, self.original_start)

    def test_expired_or_heuristic_cache_requires_consent_without_renewal(self):
        self.configure()
        for source, age in (('google_routes_api', 8), ('heuristica_haversine', 0)):
            with self.subTest(source=source):
                with self.sessions() as db:
                    db.query(ClinicaDeslocamento).delete()
                    db.commit()
                self.seed_cache(age_days=age, source=source)
                # Legacy expiry remains an explicit opt-in, never the default.
                with patch.object(routes.settings, 'GOOGLE_ROUTES_CACHE_EXPIRE_BY_AGE', True):
                    r = self.client.put(self.path, json=self.body)
                self.assertEqual(r.status_code, 409, r.text)
                self.assertEqual(r.json()['detail']['reason'], 'confirmation_required')
                with self.sessions() as db:
                    self.assertEqual(db.get(Agendamento, self.id).inicio, self.original_start)
        self.outbound.assert_not_called()

    def test_old_cached_routes_complete_agenda_without_finance_or_google(self):
        self.seed_cache(age_days=3650)
        with self.sessions() as db:
            before = {row.id: row.updated_at for row in db.query(ClinicaDeslocamento).all()}
        broken = Mock()
        broken.connect.side_effect = RuntimeError('Ledger must not be needed for cached routes')
        with patch.object(guard.database, 'engine', broken):
            response = self.client.put(self.path, json=self.body)
        self.assertEqual(response.status_code, 200, response.text)
        self.outbound.assert_not_called()
        with self.sessions() as db:
            start = db.get(Agendamento, self.id).inicio
            self.assertEqual((start.astimezone(agenda.LOCAL_TZ) if start.tzinfo else start).hour, 11)
            self.assertEqual({row.id: row.updated_at for row in db.query(ClinicaDeslocamento).all()}, before)

    def test_old_cache_with_new_geocode_still_requires_consent_and_never_commits(self):
        from app.models.clinica import Clinica
        self.seed_cache(age_days=3650)
        self.configure()
        with self.sessions() as db:
            db.get(Clinica, 2).geocode_at = datetime.utcnow()
            db.commit()
        response = self.client.put(self.path, json=self.body)
        self.assertEqual(response.status_code, 409, response.text)
        self.assertEqual(response.json()['detail']['reason'], 'confirmation_required')
        self.outbound.assert_not_called()
        with self.sessions() as db:
            self.assertEqual(db.get(Agendamento, self.id).inicio, self.original_start)

    def test_old_heuristic_does_not_become_valid_by_disabling_age_expiry(self):
        self.seed_cache(age_days=3650, source='heuristica_haversine')
        self.configure()
        response = self.client.put(self.path, json=self.body)
        self.assertEqual(response.status_code, 409, response.text)
        self.assertEqual(response.json()['detail']['reason'], 'confirmation_required')
        self.outbound.assert_not_called()

    def test_missing_key_never_invents_new_route(self):
        with patch.object(routes.settings, 'GOOGLE_MAPS_API_KEY', ''):
            r = self.client.put(self.path, json=self.body)
        self.assertEqual(r.status_code, 409, r.text)
        self.assertEqual(r.json()['detail']['reason'], 'route_unavailable')
        self.outbound.assert_not_called()
        with self.sessions() as db:
            self.assertEqual(db.query(ClinicaDeslocamento).count(), 0)

    def test_authentication_and_background_boundaries_preserved(self):
        with patch.object(middleware, '_authenticate', side_effect=HTTPException(401, 'Unauthorized')):
            self.assertEqual(self.client.put(self.path, json=self.body).status_code, 401)
        self.configure()
        execution = guard.claim_execution(7, None, 'PUT', self.path, None, self.body)
        guard.finish_execution(execution)
        context = guard.bind_execution(execution)
        try:
            with self.assertRaises(guard.GoogleMapsCostBlocked) as exc:
                guard.authorize_google_call('routes_essentials')
            self.assertEqual(exc.exception.reason, 'invalid_grant')
        finally:
            guard.reset_execution(context)
        self.outbound.assert_not_called()

    def test_create_booking_with_cache_succeeds_without_financial_policy(self):
        self.seed_cache()
        with self.sessions() as db:
            source = db.get(Agendamento, self.id)
            payload = {'paciente_id': source.paciente_id, 'tutor_id': source.tutor_id, 'clinica_id': source.clinica_id, 'servico_id': source.servico_id, 'inicio': '2099-05-25T12:30:00', 'fim': '2099-05-25T13:00:00', 'status': 'Agendado'}
        broken = Mock()
        broken.connect.side_effect = AssertionError('Cached create accessed ledger')
        with patch.object(guard.database, 'engine', broken):
            response = self.client.post('/api/v1/agenda', json=payload)
        self.assertEqual(response.status_code, 201, response.text)
        self.outbound.assert_not_called()
        broken.connect.assert_not_called()
        with self.sessions() as db:
            self.assertEqual(db.query(Agendamento).count(), 4)

    def test_new_booking_stops_before_google_and_requires_single_use_consent(self):
        self.configure()
        with self.sessions() as db:
            row = db.get(Agendamento, self.id)
            payload = {"paciente_id": row.paciente_id, "tutor_id": row.tutor_id, "clinica_id": row.clinica_id,
                       "servico_id": row.servico_id, "inicio": "2099-05-25T12:30:00", "fim": "2099-05-25T13:00:00", "status": "Agendado"}
        path = "/api/v1/agenda"
        first = self.client.post(path, json=payload)
        self.assertEqual(first.status_code, 409, first.text)
        self.assertTrue(first.json()["detail"]["can_retry_with_confirmation"])
        self.outbound.assert_not_called()
        agenda._notificar_agenda_update.assert_not_called()
        with self.sessions() as db:
            self.assertEqual(db.query(Agendamento).count(), 3)
        quoted = self.client.post("/api/v1/google-maps-control/preview", json={"method": "POST", "path": path, "body": payload, "paid_call_required": True}).json()
        token = self.client.post("/api/v1/google-maps-control/confirm", json={"quote_id": quoted["quote_id"]}).json()["token"]
        created = self.client.post(path, json=payload, headers={"X-Google-Maps-Action": token})
        self.assertEqual(created.status_code, 201, created.text)
        self.assertEqual(self.outbound.call_count, 1)
        replay = self.client.post(path, json=payload, headers={"X-Google-Maps-Action": token})
        self.assertEqual(replay.status_code, 409, replay.text)
        with self.sessions() as db:
            self.assertEqual(db.query(Agendamento).count(), 4)

    def test_monitor_allows_new_booking_above_references_but_keeps_consent_and_replay_guard(self):
        original = self.configure
        self.configure = lambda: original(monitor=True)
        self.test_new_booking_stops_before_google_and_requires_single_use_consent()
        status = guard.get_status()
        self.assertEqual(status["agenda_budget_mode"], "monitor")
        self.assertEqual(status["consumption"]["day"], {"calls": 1, "estimated_brl": 0.06})
        self.assertEqual(status["remaining"]["day"], {"calls": 0, "estimated_brl": 0})
        self.assertEqual(len([event for event in status["history"] if event["kind"] == "budget_alert"]), 2)
        self.assertEqual(len(status["alerts"]), 2)

    def test_monitor_quote_and_cancel_do_not_send_and_extras_automatics_still_stop(self):
        self.configure(monitor=True)
        q = self.preview(paid=True).json()
        self.assertFalse(q["blocked"])
        self.assertEqual(q["budget_policy"], "agenda_monitor")
        self.assertEqual(q["max_calls"], 4)
        self.assertEqual(q["estimated_cost_max_brl"], 0.24)
        self.assertEqual(len(q["alerts"]), 2)
        # Discard/cancel the quote. Neither a provider reservation nor send.
        self.assertEqual(guard.get_status()["consumption"]["day"]["calls"], 0)
        self.outbound.assert_not_called()
        extras = guard.create_preview(7, "POST", "/api/v1/logistica/recalcular")
        self.assertTrue(extras["blocked"])
        self.assertEqual(extras["budget_policy"], "enforced")
        self.assertEqual(extras["reason"], "day_limit")
        data = guard.get_status()["config"]
        data["limits"]["action"]["estimated_brl"] = 1
        guard.update_configuration(7, guard.CostConfiguration.model_validate(data), 1)
        with guard.automatic_execution("synthetic_job", "one-stable-run"):
            with self.assertRaises(guard.GoogleMapsCostBlocked) as caught:
                guard.authorize_google_call("routes_essentials")
            self.assertEqual(caught.exception.reason, "day_limit")
        with guard.automatic_execution("no_policy", "another-run"):
            with self.assertRaises(guard.GoogleMapsCostBlocked) as caught:
                guard.authorize_google_call("routes_essentials")
            self.assertEqual(caught.exception.reason, "automatic_policy_required")
        self.outbound.assert_not_called()

    def test_monitor_parallel_grants_remain_finite_and_durable(self):
        from concurrent.futures import ThreadPoolExecutor
        from threading import Barrier
        self.configure(monitor=True)
        executions = []
        for i in range(2):
            q = self.preview(paid=True).json()
            token = guard.confirm_preview(7, q["quote_id"])["token"]
            executions.append(guard.claim_execution(7, token, "PUT", self.path, None, self.body))
        barrier = Barrier(2)
        def reserve(execution):
            context = guard.bind_execution(execution)
            try:
                barrier.wait(timeout=10)
                for _ in range(4): guard.authorize_google_call("routes_essentials")
                with self.assertRaises(guard.GoogleMapsCostBlocked) as caught:
                    guard.authorize_google_call("routes_essentials")
                self.assertEqual(caught.exception.reason, "action_limit")
                guard.finish_execution(execution)
            finally: guard.reset_execution(context)
        with ThreadPoolExecutor(max_workers=2) as pool:
            list(pool.map(reserve, executions))
        self.ledger.dispose() # Reopen connections: the ledger survives restart.
        status = guard.get_status()
        self.assertEqual(status["consumption"]["day"], {"calls": 8, "estimated_brl": 0.48})
        self.assertEqual(len([e for e in status["history"] if e["kind"] == "budget_alert"]), 4)
        self.outbound.assert_not_called()

    def test_agenda_tutor_geocode_uses_one_confirmed_unit_above_references(self):
        from app.services import geocoding_service
        self.configure(monitor=True)
        path = "/api/v1/agenda/geocode-endereco-tutor"
        body = {"endereco": "Synthetic address", "numero": "1", "cidade": "Synthetic city", "estado": "CE"}
        response = {"status": "OK", "results": [{"geometry": {"location": {"lat": -3.7, "lng": -38.5}}, "formatted_address": "Synthetic address", "place_id": "synthetic"}]}
        with patch.object(geocoding_service, "_http_get_json", return_value=response) as transport:
            empty = self.client.post(path, json={})
            self.assertEqual(empty.status_code, 422, empty.text)
            transport.assert_not_called()
            probe = self.client.post(path, json=body)
            self.assertEqual(probe.status_code, 409, probe.text)
            self.assertTrue(probe.json()["detail"]["can_retry_with_confirmation"])
            transport.assert_not_called()
            quote = self.client.post("/api/v1/google-maps-control/preview", json={"method": "POST", "path": path, "body": body, "paid_call_required": True}).json()
            self.assertFalse(quote["blocked"])
            self.assertEqual(quote["max_calls"], 1)
            self.assertEqual(quote["services"], ["geocoding"])
            self.assertEqual(quote["budget_policy"], "agenda_monitor")
            # Cancel/discard without confirming: no provider request.
            transport.assert_not_called()
            token = self.client.post("/api/v1/google-maps-control/confirm", json={"quote_id": quote["quote_id"]}).json()["token"]
            result = self.client.post(path, json=body, headers={"X-Google-Maps-Action": token})
            self.assertEqual(result.status_code, 200, result.text)
            self.assertEqual(result.json()["item"]["latitude"], -3.7)
            self.assertEqual(transport.call_count, 1)
            replay = self.client.post(path, json=body, headers={"X-Google-Maps-Action": token})
            self.assertEqual(replay.status_code, 409)
            self.assertEqual(transport.call_count, 1)
        self.assertTrue(guard.create_preview(7, "POST", "/api/v1/tutores/geocode-endereco", body=body)["blocked"])
        self.assertEqual(guard.get_status()["consumption"]["day"]["calls"], 1)

    def review_date(self, seconds=-5):
        status = guard.get_status()
        data = status["config"]
        data["pricing_valid_until"] = (datetime.now(timezone.utc) + timedelta(seconds=seconds)).isoformat()
        return guard.update_configuration(7, guard.CostConfiguration.model_validate(data), status["revision"])

    def test_expired_monitor_prices_warn_and_complete_booking_without_freeing_extras(self):
        self.configure(monitor=True)
        status = self.review_date()
        self.assertFalse(status["blocked"])
        self.assertTrue(status["paid_calls_allowed"])
        self.assertTrue(status["pricing_review_due"])
        self.assertIn(guard.REASONS["pricing_review_due"], status["alerts"])
        unpaid = self.client.put(self.path, json=self.body)
        self.assertEqual(unpaid.status_code, 409, unpaid.text)
        self.assertTrue(unpaid.json()["detail"]["can_retry_with_confirmation"])
        self.outbound.assert_not_called()
        quote = self.preview(paid=True).json()
        self.assertFalse(quote["blocked"])
        self.assertTrue(quote["pricing_review_due"])
        self.assertEqual(quote["max_calls"], 4)
        self.assertEqual(quote["estimated_cost_max_brl"], 0.24)
        self.assertIn(guard.REASONS["pricing_review_due"], quote["alerts"])
        self.outbound.assert_not_called()  # Cancelling the warning sends nothing.
        confirmed = self.client.post('/api/v1/google-maps-control/confirm', json={'quote_id': quote['quote_id']})
        self.assertEqual(confirmed.status_code, 200, confirmed.text)
        token = confirmed.json()['token']
        result = self.client.put(self.path, json=self.body, headers={'X-Google-Maps-Action': token})
        self.assertEqual(result.status_code, 200, result.text)
        self.assertEqual(self.outbound.call_count, 2)
        self.assertEqual(self.client.put(self.path, json=self.body, headers={'X-Google-Maps-Action': token}).status_code, 409)
        events = [event for event in guard.get_status()['history'] if event['reason']=='pricing_review_due']
        self.assertEqual(len(events), 1)
        self.assertEqual(events[0]['kind'], 'budget_alert')
        self.assertEqual(events[0]['estimated_brl'], 0)
        for path in ('/api/v1/logistica/recalcular', '/api/v1/tutores/geocode-endereco'):
            extra = guard.create_preview(7, 'POST', path)
            self.assertTrue(extra['blocked'])
            self.assertEqual(extra['reason'], 'pricing_expired')
        with guard.automatic_execution('synthetic_job', 'expired-explicit-policy'):
            with self.assertRaises(guard.GoogleMapsCostBlocked) as denied:
                guard.authorize_google_call('routes_essentials')
            self.assertEqual(denied.exception.reason, 'pricing_expired')

    def test_monitor_quote_survives_review_date_but_not_its_own_expiry_or_cap(self):
        self.configure(monitor=True)
        self.review_date(seconds=3)
        quote = self.preview(paid=True).json()
        now = guard._now()
        with patch.object(guard, '_now', return_value=now+6):
            token = guard.confirm_preview(7, quote['quote_id'])['token']
            execution = guard.claim_execution(7, token, 'PUT', self.path, None, self.body)
            context = guard.bind_execution(execution)
            try:
                for _ in range(4): guard.authorize_google_call('routes_essentials')
                with self.assertRaises(guard.GoogleMapsCostBlocked) as limit:
                    guard.authorize_google_call('routes_essentials')
                self.assertEqual(limit.exception.reason, 'action_limit')
            finally:
                guard.reset_execution(context)
                guard.finish_execution(execution)
            with self.assertRaises(guard.GoogleMapsCostBlocked):
                guard.claim_execution(7, token, 'PUT', self.path, None, self.body)
        self.outbound.assert_not_called()
        fresh = self.preview(paid=True).json()
        with patch.object(guard, '_now', return_value=now+guard.QUOTE_TTL_SECONDS+10):
            with self.assertRaises(guard.GoogleMapsCostBlocked) as expired:
                guard.confirm_preview(7, fresh['quote_id'])
            self.assertEqual(expired.exception.reason, 'invalid_grant')

    def test_expired_monitor_prices_keep_tutor_geocode_single_use(self):
        configure = self.configure
        def expired_configure(*args, **kwargs):
            configure(*args, **kwargs)
            return self.review_date()
        self.configure = expired_configure
        self.test_agenda_tutor_geocode_uses_one_confirmed_unit_above_references()

    def test_expired_monitor_parallel_confirmations_remain_finite(self):
        from concurrent.futures import ThreadPoolExecutor
        from threading import Barrier
        self.configure(monitor=True)
        self.review_date()
        executions=[]
        for _ in range(2):
            quote=self.preview(paid=True).json()
            token=guard.confirm_preview(7,quote['quote_id'])['token']
            executions.append(guard.claim_execution(7,token,'PUT',self.path,None,self.body))
        barrier=Barrier(2)
        def reserve(execution):
            context=guard.bind_execution(execution)
            try:
                barrier.wait(timeout=10)
                for _ in range(4):guard.authorize_google_call('routes_essentials')
                with self.assertRaises(guard.GoogleMapsCostBlocked) as denied:guard.authorize_google_call('routes_essentials')
                self.assertEqual(denied.exception.reason,'action_limit')
            finally:
                guard.reset_execution(context)
                guard.finish_execution(execution)
        with ThreadPoolExecutor(max_workers=2) as pool:list(pool.map(reserve,executions))
        self.ledger.dispose()
        status=guard.get_status()
        self.assertEqual(status['consumption']['day']['calls'],8)
        self.assertEqual(len([event for event in status['history'] if event['reason']=='pricing_review_due']),2)
        self.outbound.assert_not_called()

    def test_expired_monitor_date_does_not_override_admin_suspension(self):
        self.configure(monitor=True)
        status=self.review_date()
        data=status['config'];data['enabled']=False
        guard.update_configuration(7,guard.CostConfiguration.model_validate(data),status['revision'])
        quote=self.preview(paid=True).json()
        self.assertTrue(quote['blocked'])
        self.assertEqual(quote['reason'],'disabled')
        self.outbound.assert_not_called()

    def test_cache_only_rejects_monitor_exception(self):
        with self.assertRaises(ValueError):
            guard.CostConfiguration.model_validate({"operation_mode": "cache_only", "agenda_budget_mode": "monitor", "enabled": True, "limits": {p: {"calls": 0, "estimated_brl": 0} for p in ("action", "day", "month")}})

import test_google_maps_postgres_integration as pg_fixtures

class GoogleMapsCacheFirstPostgresTest(pg_fixtures.GoogleMapsPostgresIntegrationTest):

    def setUp(self):
        super().setUp()
        p = patch.object(guard.settings, 'GOOGLE_MAPS_AGENDA_CACHE_FIRST', True)
        p.start()
        self.addCleanup(p.stop)

    def _execute_update(self):
        original = control_api.create_preview

        def paid_quote(*args, **kwargs):
            kwargs['paid_call_required'] = True
            return original(*args, **kwargs)
        with patch.object(control_api, 'create_preview', side_effect=paid_quote):
            return super()._execute_update()

    def test_unpaid_phase_reaches_provider_but_sends_nothing_and_rolls_back(self):
        self._configure(action_calls=2)
        with patch.object(routes, '_http_post_json', side_effect=AssertionError('Unpaid transport')) as outbound, TestClient(self.app) as client:
            response = client.put(f'/api/v1/agenda/{self.appointment_id}', json={'inicio': '2099-05-25T11:30:00-03:00', 'fim': '2099-05-25T12:00:00-03:00'})
        self.assertEqual(response.status_code, 409, response.text)
        self.assertTrue(response.json()['detail']['can_retry_with_confirmation'])
        outbound.assert_not_called()
        with self.sessions() as db:
            self.assertEqual(db.get(Agendamento, self.appointment_id).inicio, self.original_start)
            self.assertEqual(db.query(ClinicaDeslocamento).count(), 0)
        self.assertEqual(guard.get_status()['consumption']['day']['calls'], 0)
