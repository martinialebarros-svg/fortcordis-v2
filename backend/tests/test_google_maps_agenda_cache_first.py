"""Real Agenda transactions, separate test ledger, zero external Google traffic."""
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

    def configure(self, day_calls=20):
        cfg = guard.CostConfiguration.model_validate({'enabled': True, 'limits': {'action': {'calls': 4, 'estimated_brl': 1}, 'day': {'calls': day_calls, 'estimated_brl': 5}, 'month': {'calls': 100, 'estimated_brl': 20}}, 'prices_usd': {sku: '0.01' for sku in guard.SKUS}, 'fx_brl_per_usd_upper': 6, 'price_multiplier': 1, 'pricing_valid_until': (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat(), 'opening_usage': {'day': {'calls': 0, 'estimated_brl': 0}, 'month': {'calls': 0, 'estimated_brl': 0}}, 'opening_usage_as_of': guard._periods(guard._now())[0], 'opening_usage_basis': 'synthetic_stage'})
        return guard.update_configuration(7, cfg, 0)

    def seed_cache(self, age_days=0, source='google_routes_api'):
        with self.sessions() as db:
            for a, b in ((1, 2), (2, 3)):
                for profile in ('comercial', 'plantao'):
                    db.add(ClinicaDeslocamento(origem_clinica_id=a, destino_clinica_id=b, perfil=profile, distancia_km=1, duracao_min=10, fonte=source, updated_at=datetime.utcnow() - timedelta(days=age_days)))
            db.commit()

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
            self.assertEqual(db.get(Agendamento, self.id).inicio.replace(tzinfo=None), datetime(2099, 5, 25, 11, 30))

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
                r = self.client.put(self.path, json=self.body)
                self.assertEqual(r.status_code, 409, r.text)
                self.assertEqual(r.json()['detail']['reason'], 'confirmation_required')
                with self.sessions() as db:
                    self.assertEqual(db.get(Agendamento, self.id).inicio, self.original_start)
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
