"""History, read-only cache evidence, auth and bounded-query opportunities."""
from contextlib import ExitStack
from datetime import datetime, timedelta
import os
from pathlib import Path
import sys
from types import SimpleNamespace
import unittest
from unittest.mock import patch

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import event

BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_DIR))
os.environ.setdefault("DATABASE_URL", "sqlite:///./fortcordis.db")
os.environ.setdefault("SECRET_KEY", "agenda-opportunities-test-secret-key-1234567890")

from app.api.v1.endpoints import agenda
from app.models.agendamento import Agendamento
from app.models.clinica import Clinica
from app.models.clinica_deslocamento import ClinicaDeslocamento
from app.models.servico import Servico
from app.services import agenda_day_opportunities as opportunities
from tests import test_agenda_sugestao_janela_operacional as fixtures


class _DateTimeMeta(type):
    def __instancecheck__(cls, value):
        return isinstance(value, datetime)


class _FixedDateTime(datetime, metaclass=_DateTimeMeta):
    @classmethod
    def now(cls, tz=None):
        return cls(2026, 10, 22, 12).replace(tzinfo=tz)


class AgendaDayOpportunitiesTest(unittest.TestCase):
    _build_session = fixtures.AgendaSugestaoJanelaOperacionalTest._build_session
    _seed_config = fixtures.AgendaSugestaoJanelaOperacionalTest._seed_config

    def setUp(self):
        self.tmpdir, self.db, self.engine = self._build_session()
        ClinicaDeslocamento.__table__.create(self.engine, checkfirst=True)
        self._seed_config(self.db, excecoes=[], regras_rota={
            "thresholds": {"max_neighbor_travel_min": 30, "safe_margin_min": 5,
                "max_insertion_detour_min": 30},
            "route_policy": {"regional_transition_enabled": True,
                "regional_transition_max_travel_min": 50, "regional_transition_margin_min": 15,
                "regional_transition_max_legs_per_day": 1, "recurrent_clinic_history_days": 60},
        })
        self.anchor = self.clinic("Synthetic anchor")
        self.service = Servico(nome="Synthetic 30-minute service", duracao_minutos=30, ativo=True)
        self.db.add(self.service)
        self.db.commit()
        self.book(self.anchor, "2026-10-23 09:00", "Agendado")
        self.user = SimpleNamespace(id=1, nome="Synthetic staff", tem_papel=lambda role: role == "recepcao")

    def tearDown(self):
        self.db.close()
        self.engine.dispose()
        self.tmpdir.cleanup()

    def clinic(self, name, **kwargs):
        clinic = Clinica(nome=name, latitude=-3.73, longitude=-38.52,
            cidade="Fortaleza", estado="CE", bairro="Synthetic district", ativo=True, **kwargs)
        self.db.add(clinic)
        self.db.commit()
        return clinic

    def book(self, clinic, instant, status="Realizado", origin="clinica_parceira"):
        start = datetime.fromisoformat(instant)
        booking = Agendamento(clinica_id=clinic.id, inicio=start, fim=start + timedelta(minutes=30),
            data=start.date().isoformat(), hora=start.strftime("%H:%M"), status=status,
            origem_atendimento=origin, paciente="Synthetic patient PRIVATE",
            tutor="Synthetic tutor PRIVATE", telefone="PRIVATE-phone")
        self.db.add(booking)
        self.db.commit()
        return booking

    def route(self, origin, destination, duration=40, *, trusted=True):
        row = ClinicaDeslocamento(origem_clinica_id=origin.id, destino_clinica_id=destination.id,
            perfil="comercial", duracao_min=duration, distancia_km=10,
            fonte="manual" if trusted else "heuristica_haversine", manual_override=trusted)
        self.db.add(row)
        self.db.commit()
        return row

    def call(self, *, limit=50, user=None, count_queries=False):
        statements = []
        def collect(_conn, _cursor, statement, _parameters, _context, _many):
            if statement.lstrip().lower().startswith("select"):
                statements.append(statement)
        if count_queries:
            event.listen(self.engine, "before_cursor_execute", collect)
        try:
            with ExitStack() as stack:
                stack.enter_context(patch.object(opportunities, "datetime", _FixedDateTime))
                stack.enter_context(patch.object(agenda, "datetime", _FixedDateTime))
                for name in ("_obter_deslocamento_primeira_saida", "estimar_deslocamento",
                             "geocodificar_endereco_google", "_obter_duracao_deslocamento_operacional"):
                    stack.enter_context(patch.object(agenda, name,
                        side_effect=AssertionError(f"Opportunities must not call {name}")))
                result = opportunities.buscar_oportunidades_dia(
                    agenda.OportunidadesDiaPayload(data="2026-10-23", servico_id=self.service.id, limite=limit),
                    self.db, user or self.user)
            return (result, statements) if count_queries else result
        finally:
            if count_queries:
                event.remove(self.engine, "before_cursor_execute", collect)

    def test_history_counts_realized_days_and_volume_only_inside_60_days(self):
        clinic = self.clinic("Synthetic recurring")
        self.route(self.anchor, clinic)
        self.book(clinic, "2026-08-23 10:00")
        self.book(clinic, "2026-08-23 11:00")
        self.book(clinic, "2026-10-21 10:00")
        for date, status, origin in (
            ("2026-08-22 10:00", "Realizado", "clinica_parceira"),
            ("2026-10-22 10:00", "Realizado", "clinica_parceira"),
            ("2026-10-24 10:00", "Realizado", "clinica_parceira"),
            ("2026-10-20 10:00", "Agendado", "clinica_parceira"),
            ("2026-10-19 10:00", "Cancelado", "clinica_parceira"),
            ("2026-10-18 10:00", "Realizado", "domiciliar"),
        ):
            self.book(clinic, date, status, origin)
        result = self.call()
        item = next(item for item in result["items"] if item["clinica_id"] == clinic.id)
        self.assertEqual(result["historico"], {"inicio": "2026-08-23", "fim": "2026-10-21", "dias": 60})
        self.assertEqual(item["dias_realizados_60d"], 2)
        self.assertEqual(item["atendimentos_realizados_60d"], 3)
        self.assertEqual(item["ultimo_atendimento"], "2026-10-21")
        self.assertEqual(item["inicio"], "2026-10-23 10:30")
        self.assertEqual(result["consultas_google"], 0)
        serialized = str(result)
        for private in ("PRIVATE", "tutor_id", "paciente_id", "telefone", "address", "zip_code"):
            self.assertNotIn(private, serialized)

    def test_history_ignores_clinics_with_only_future_or_cancelled_bookings(self):
        future = self.clinic("Synthetic future only")
        cancelled = self.clinic("Synthetic cancelled only")
        self.book(future, "2026-10-24 10:00", "Agendado")
        self.book(cancelled, "2026-10-20 10:00", "Cancelado")
        result = self.call()
        self.assertEqual(result["total_clinicas_recorrentes"], 0)
        self.assertEqual(result["items"], [])

    def test_unknown_or_heuristic_route_cannot_appear_as_zero_minutes(self):
        unknown = self.clinic("Synthetic missing route")
        heuristic = self.clinic("Synthetic heuristic only")
        for clinic in (unknown, heuristic):
            self.book(clinic, "2026-10-20 10:00")
        self.route(self.anchor, heuristic, trusted=False)
        result = self.call()
        self.assertEqual(result["items"], [])
        self.assertEqual(result["sem_estimativa"], 2)
        self.assertEqual(result["consultas_google"], 0)

    def test_history_distinct_days_precedes_volume_in_equal_cost_band(self):
        volume = self.clinic("Synthetic concentrated volume")
        days = self.clinic("Synthetic repeated days")
        for clinic in (volume, days):
            self.route(self.anchor, clinic, 40)
        for hour in (9, 10, 11):
            self.book(volume, f"2026-10-20 {hour:02d}:00")
        self.book(days, "2026-10-19 10:00")
        self.book(days, "2026-10-20 10:00")
        result = self.call()
        self.assertEqual([item["clinica_id"] for item in result["items"]], [days.id, volume.id])

    def test_query_count_does_not_grow_per_recurring_clinic(self):
        first = self.clinic("Synthetic first")
        self.book(first, "2026-10-20 10:00")
        self.route(self.anchor, first)
        one, one_queries = self.call(count_queries=True)
        for number in range(6):
            clinic = self.clinic(f"Synthetic extra {number}")
            self.book(clinic, "2026-10-20 10:00")
            self.route(self.anchor, clinic)
        many, many_queries = self.call(count_queries=True)
        self.assertEqual(len(one["items"]), 1)
        self.assertEqual(len(many["items"]), 7)
        self.assertLessEqual(len(many_queries), len(one_queries) + 1,
            f"SELECT count grew from {len(one_queries)} to {len(many_queries)}")
        self.assertLessEqual(len(many_queries), 12)

    def test_endpoint_requires_auth_and_rejects_non_team_role(self):
        app = FastAPI()
        app.include_router(agenda.router, prefix="/api/v1/agenda")
        app.dependency_overrides[agenda.get_db] = lambda: self.db
        with TestClient(app) as client:
            response = client.post("/api/v1/agenda/oportunidades-dia", json={"data": "2026-10-23"})
        self.assertEqual(response.status_code, 401)
        app.dependency_overrides[agenda.get_current_user] = lambda: SimpleNamespace(
            id=2, tem_papel=lambda _role: False)
        with TestClient(app) as client:
            response = client.post("/api/v1/agenda/oportunidades-dia", json={"data": "2026-10-23"})
        self.assertEqual(response.status_code, 403)


if __name__ == "__main__":
    unittest.main()
