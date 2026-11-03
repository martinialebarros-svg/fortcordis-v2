"""HTTP regression: only an admin may waive first departure for a past correction."""
import json
import unittest
from datetime import datetime, timedelta
from types import SimpleNamespace
from unittest.mock import patch

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy.orm import sessionmaker

from tests import test_agenda_primeira_saida as fixtures
from app.api.v1.endpoints import agenda
from app.models.agendamento import Agendamento
from app.models.configuracao import Configuracao
from app.models.paciente import Paciente
from app.models.tutor import Tutor


class AgendaAlteracaoRetroativaAdminTest(unittest.TestCase):
    _build_session = fixtures.AgendaPrimeiraSaidaTest._build_session
    _seed_config = fixtures.AgendaPrimeiraSaidaTest._seed_config
    _seed_clinicas = fixtures.AgendaPrimeiraSaidaTest._seed_clinicas
    _criar_agendamento = fixtures.AgendaPrimeiraSaidaTest._criar_agendamento

    def setUp(self):
        self.tmpdir, self.db, self.engine = self._build_session()
        self.addCleanup(self.tmpdir.cleanup)
        self.addCleanup(self.engine.dispose)
        self.addCleanup(self.db.close)
        self._seed_config(self.db, excecoes=[{
            "data": "2026-11-03", "ativo": True, "inicio": "06:00", "fim": "16:00",
        }])
        self.clinica, self.outra = self._seed_clinicas(self.db)
        Paciente.__table__.create(self.engine, checkfirst=True)
        tutor = Tutor(nome="Tutor sintetico", telefone="85911110001")
        self.db.add(tutor)
        self.db.flush()
        paciente = Paciente(nome="Paciente sintetico", tutor_id=tutor.id)
        self.db.add(paciente)
        self.db.flush()
        self.alvo = self._criar_agendamento(
            self.db, clinica_id=self.clinica.id, data="2026-11-03", hora="08:00",
            duracao_minutos=90,
        )
        self.alvo.tutor_id = tutor.id
        self.alvo.paciente_id = paciente.id
        self.db.commit()
        self.app = FastAPI()
        self.app.include_router(agenda.router, prefix="/agenda")
        sessions = sessionmaker(bind=self.engine, autocommit=False, autoflush=False)

        def isolated_db():
            with sessions() as db:
                yield db

        self.app.dependency_overrides[agenda.get_db] = isolated_db
        for mock in (
            patch.object(agenda, "datetime", fixtures._relogio_fixo(2026, 11, 3, 12, 0)),
            patch.object(agenda, "estimar_deslocamento", return_value=(10.0, 30, "google_distance_matrix_traffic")),
            patch.object(agenda, "registrar_auditoria"),
            patch.object(agenda, "_notificar_agenda_update"),
        ):
            started = mock.start()
            self.addCleanup(mock.stop)
            if mock.attribute == "registrar_auditoria":
                self.audit = started

    def put(self, *, admin=True, confirmar=False, inicio="2026-11-03T07:00:00", **extra):
        self.app.dependency_overrides[agenda.get_current_user] = lambda: SimpleNamespace(
            id=42, nome="Admin sintetico", tem_papel=lambda papel: admin and papel == "admin",
        )
        fim = datetime.fromisoformat(inicio.replace("Z", "+00:00")) + timedelta(minutes=90)
        with TestClient(self.app) as client:
            return client.put(f"/agenda/{self.alvo.id}", json={
                "inicio": inicio, "fim": fim.isoformat(),
                "confirmar_alteracao_retroativa": confirmar, **extra,
            })

    def assert_unchanged(self):
        self.db.refresh(self.alvo)
        self.assertEqual(self.alvo.inicio, datetime(2026, 11, 3, 8))
        self.assertEqual(self.alvo.fim, datetime(2026, 11, 3, 9, 30))
        self.audit.assert_not_called()

    def test_admin_confirms_past_first_appointment_and_audits_saved_interval(self):
        blocked = self.put()
        self.assertEqual(blocked.status_code, 409, blocked.text)
        self.assertEqual(blocked.json()["detail"]["codigo"], "PRIMEIRA_SAIDA_INVIAVEL")
        self.assertTrue(blocked.json()["detail"]["confirmavel"])
        self.assertEqual(blocked.json()["detail"]["confirmacao"], "confirmar_alteracao_retroativa")
        self.assert_unchanged()

        saved = self.put(confirmar=True)
        self.assertEqual(saved.status_code, 200, saved.text)
        self.db.refresh(self.alvo)
        self.assertEqual(self.alvo.inicio, datetime(2026, 11, 3, 7))
        self.assertEqual(self.alvo.fim, datetime(2026, 11, 3, 8, 30))
        self.assertEqual((self.alvo.data, self.alvo.hora), ("2026-11-03", "07:00"))
        self.assertFalse(agenda._excecao_deslocamento_ativa(self.alvo))
        event = next(call.kwargs for call in self.audit.call_args_list
                     if call.kwargs.get("acao") == "AGENDAMENTO_HORARIO_RETROATIVO_CONFIRMADO")
        self.assertEqual(event["current_user"].id, 42)
        self.assertEqual(event["entidade_id"], self.alvo.id)
        self.assertEqual(event["detalhes"]["validacao_dispensada"], "primeira_saida")
        self.assertEqual(event["detalhes"]["antes"]["inicio"], "2026-11-03 08:00:00")
        self.assertEqual(event["detalhes"]["inicio"], "2026-11-03 07:00:00")

    def test_non_admin_cannot_forge_confirmation(self):
        response = self.put(admin=False, confirmar=True)
        self.assertEqual(response.status_code, 403, response.text)
        self.assert_unchanged()

    def test_non_admin_without_flag_remains_blocked_and_cannot_confirm(self):
        response = self.put(admin=False)
        self.assertEqual(response.status_code, 409, response.text)
        self.assertFalse(response.json()["detail"]["confirmavel"])
        self.assertNotIn("confirmacao", response.json()["detail"])
        self.assert_unchanged()

    def test_no_auth_cannot_update(self):
        with TestClient(self.app) as client:
            response = client.put(f"/agenda/{self.alvo.id}", json={
                "inicio": "2026-11-03T07:00:00", "confirmar_alteracao_retroativa": True,
            })
        self.assertEqual(response.status_code, 401, response.text)
        self.assert_unchanged()

    def test_future_or_unchanged_start_cannot_use_retroactive_flag(self):
        for inicio in ("2026-11-03T12:15:00", "2026-11-04T08:00:00", "2026-11-03T08:00:00"):
            with self.subTest(inicio=inicio):
                response = self.put(confirmar=True, inicio=inicio)
                self.assertEqual(response.status_code, 422, response.text)
                self.assert_unchanged()

    def test_future_first_departure_still_blocks_admin_without_confirmation_offer(self):
        response = self.put(inicio="2026-11-03T12:15:00")
        self.assertEqual(response.status_code, 409, response.text)
        self.assertFalse(response.json()["detail"]["confirmavel"])
        self.assert_unchanged()

    def test_existing_route_override_does_not_implicitly_confirm_retroactive_edit(self):
        response = self.put(confirmar_conflito_deslocamento=True)
        self.assertEqual(response.status_code, 409, response.text)
        self.assertEqual(response.json()["detail"]["codigo"], "PRIMEIRA_SAIDA_INVIAVEL")
        self.assert_unchanged()

    def test_retroactive_flag_preserves_slot_overlap(self):
        self._criar_agendamento(self.db, clinica_id=self.clinica.id, data="2026-11-03", hora="07:30")
        response = self.put(confirmar=True)
        self.assertEqual(response.status_code, 409, response.text)
        self.assertIn("Horario indisponivel", response.json()["detail"])
        self.assert_unchanged()

    def test_retroactive_flag_preserves_closed_day_validation(self):
        config = self.db.query(Configuracao).first()
        config.agenda_excecoes = json.dumps([{"data": "2026-11-03", "ativo": False}])
        self.db.commit()
        response = self.put(confirmar=True)
        self.assertEqual(response.status_code, 422, response.text)
        self.assertIn("Agenda fechada", response.json()["detail"])
        self.assert_unchanged()

    def test_retroactive_flag_preserves_travel_conflict_with_next_appointment(self):
        self._criar_agendamento(self.db, clinica_id=self.outra.id, data="2026-11-03", hora="09:00")
        with patch.object(agenda, "_obter_duracao_deslocamento_operacional", return_value=(75, "mock")):
            response = self.put(confirmar=True)
        self.assertEqual(response.status_code, 409, response.text)
        self.assertEqual(response.json()["detail"]["codigo"], "CONFLITO_DESLOCAMENTO")
        self.assert_unchanged()

    def test_create_cannot_use_retroactive_flag_to_bypass_first_departure(self):
        self.app.dependency_overrides[agenda.get_current_user] = lambda: SimpleNamespace(
            id=42, nome="Admin", tem_papel=lambda papel: papel == "admin",
        )
        with TestClient(self.app) as client:
            response = client.post("/agenda", json={
                "clinica_id": self.clinica.id, "inicio": "2026-11-03T06:00:00",
                "fim": "2026-11-03T06:30:00", "status": "Reservado",
                "confirmar_alteracao_retroativa": True,
            })
        self.assertEqual(response.status_code, 409, response.text)
        self.assertEqual(response.json()["detail"]["codigo"], "PRIMEIRA_SAIDA_INVIAVEL")
        self.assertEqual(self.db.query(Agendamento).count(), 1)
        self.assert_unchanged()

    def test_utc_timestamp_is_checked_in_agenda_timezone(self):
        response = self.put(confirmar=True, inicio="2026-11-03T10:00:00Z")
        self.assertEqual(response.status_code, 200, response.text)
        self.db.refresh(self.alvo)
        self.assertEqual((self.alvo.data, self.alvo.hora), ("2026-11-03", "07:00"))

    def test_new_correction_does_not_reuse_previous_retroactive_confirmation(self):
        response = self.put(confirmar=True)
        self.assertEqual(response.status_code, 200, response.text)
        self.audit.reset_mock()
        response = self.put(inicio="2026-11-03T07:15:00")
        self.assertEqual(response.status_code, 409, response.text)
        self.assertEqual(response.json()["detail"]["codigo"], "PRIMEIRA_SAIDA_INVIAVEL")
        self.db.refresh(self.alvo)
        self.assertEqual(self.alvo.inicio, datetime(2026, 11, 3, 7))
        self.assertFalse(agenda._excecao_deslocamento_ativa(self.alvo))
        self.audit.assert_not_called()

    def test_retroactive_flag_preserves_destination_validation(self):
        self.clinica.latitude = None
        self.clinica.longitude = None
        self.db.commit()
        response = self.put(confirmar=True)
        self.assertEqual(response.status_code, 422, response.text)
        self.assert_unchanged()
