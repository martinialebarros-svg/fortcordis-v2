import os
import sys
import tempfile
import unittest
from contextlib import ExitStack
from datetime import datetime
from pathlib import Path
from types import SimpleNamespace
from urllib.parse import parse_qs, urlparse
from unittest.mock import patch

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

BACKEND_DIR = Path(__file__).resolve().parents[1]
os.chdir(BACKEND_DIR)
sys.path.insert(0, str(BACKEND_DIR))

os.environ.setdefault("DATABASE_URL", "sqlite:///./fortcordis.db")
os.environ.setdefault("SECRET_KEY", "portal-clinic-invite-auth-test-secret-key-1234567890")

from app.api.v1.endpoints import portal
from app.api.v1.endpoints import portal_clinic_auth
from app.core.config import settings
from app.db.database import get_db
from app.models.atendimento_clinico import AnexoAtendimento, AtendimentoClinico
from app.models.clinica import Clinica
from app.models.laudo import Exame
from app.models.paciente import Paciente
from app.models.portal_clinic_auth import (
    PortalAuthChallenge,
    PortalClinicAccount,
    PortalClinicInvite,
    PortalClinicSession,
    PortalPasswordResetToken,
)
from app.models.tutor import Tutor


class PortalClinicInviteAuthTest(unittest.TestCase):
    def setUp(self) -> None:
        self._app = FastAPI()
        self._app.include_router(portal.router, prefix="/api/v1/portal", tags=["portal"])
        self._app.include_router(portal_clinic_auth.router, prefix="/api/v1/portal", tags=["portal"])
        self._tmpdir = tempfile.TemporaryDirectory()
        db_path = Path(self._tmpdir.name) / "portal-clinic-invite-auth.db"
        self._engine = create_engine(
            f"sqlite:///{db_path}",
            connect_args={"check_same_thread": False},
        )
        self._session_factory = sessionmaker(
            bind=self._engine,
            autocommit=False,
            autoflush=False,
        )

        for table in (
            Tutor.__table__,
            Paciente.__table__,
            Clinica.__table__,
            AtendimentoClinico.__table__,
            Exame.__table__,
            AnexoAtendimento.__table__,
            PortalClinicInvite.__table__,
            PortalClinicAccount.__table__,
            PortalClinicSession.__table__,
            PortalPasswordResetToken.__table__,
            PortalAuthChallenge.__table__,
        ):
            table.create(self._engine, checkfirst=True)

    def tearDown(self) -> None:
        self._app.dependency_overrides.clear()
        self._engine.dispose()
        self._tmpdir.cleanup()

    def _override_get_db(self):
        def _get_db_override():
            db = self._session_factory()
            try:
                yield db
            finally:
                db.close()

        return _get_db_override

    def _seed_portal_data(self):
        db = self._session_factory()
        try:
            tutor = Tutor(
                nome="Maria Tutora",
                email="maria@example.com",
                whatsapp="(85) 99999-0000",
                telefone="85999990000",
                ativo=1,
            )
            clinica = Clinica(
                nome="Clinica Parceira A",
                email="parceira@example.com",
                ativo=True,
            )
            db.add_all([tutor, clinica])
            db.flush()

            paciente = Paciente(
                tutor_id=tutor.id,
                nome="Luna",
                especie="Canina",
                ativo=1,
            )
            db.add(paciente)
            db.flush()

            atendimento = AtendimentoClinico(
                paciente_id=paciente.id,
                tutor_id=tutor.id,
                clinica_id=clinica.id,
                agendamento_id=None,
                veterinario_id=77,
                especie="Canina",
                data_atendimento=datetime(2026, 7, 3, 9, 30),
                status="Concluido",
                criado_por_id=77,
                criado_por_nome="Vet Teste",
            )
            db.add(atendimento)
            db.flush()

            exame = Exame(
                atendimento_id=atendimento.id,
                paciente_id=paciente.id,
                tipo_exame="Ecocardiograma",
                categoria_exame="Cardiologia",
                prioridade="Rotina",
                status="Concluido",
                data_solicitacao=datetime(2026, 7, 3, 9, 0),
                data_resultado=datetime(2026, 7, 3, 10, 0),
                observacoes="Exame liberado para portal.",
            )
            db.add(exame)
            db.flush()

            attachment_bytes = b"%PDF-1.4\nportal clinic invite auth\n"
            attachment_path = Path(self._tmpdir.name) / "eco-luna.pdf"
            attachment_path.write_bytes(attachment_bytes)
            anexo = AnexoAtendimento(
                atendimento_id=atendimento.id,
                exame_id=exame.id,
                tipo="documento",
                descricao="Laudo PDF",
                url=f"/api/v1/portal/anexos/{exame.id}/arquivo",
                nome_original="eco-luna.pdf",
                tamanho=len(attachment_bytes),
                mime_type="application/pdf",
                caminho_arquivo=str(attachment_path),
                origem="upload",
            )
            db.add(anexo)
            db.commit()
            return {
                "clinica_id": clinica.id,
                "clinica_nome": clinica.nome,
                "paciente_id": paciente.id,
                "exame_id": exame.id,
                "attachment_bytes": attachment_bytes,
            }
        finally:
            db.close()

    def _install_overrides(self):
        self._app.dependency_overrides[get_db] = self._override_get_db()
        self._app.dependency_overrides[portal_clinic_auth._require_portal_admin] = lambda: SimpleNamespace(
            id=1,
            nome="Admin Teste",
            email="admin@example.com",
        )

    def test_admin_can_inspect_and_revoke_pending_invite(self) -> None:
        seed = self._seed_portal_data()
        self._install_overrides()

        with ExitStack() as stack:
            stack.enter_context(patch.object(settings, "PORTAL_CLINIC_INVITE_AUTH_ENABLED", True))
            stack.enter_context(patch.object(settings, "PORTAL_WHATSAPP_ENABLED", False))
            stack.enter_context(patch("app.api.v1.endpoints.portal_clinic_auth.registrar_auditoria", return_value=None))
            with TestClient(self._app) as client:
                create_response = client.post(
                    f"/api/v1/portal/admin/clinicas/{seed['clinica_id']}/convites",
                    json={
                        "delivery_channel": "whatsapp",
                        "delivery_target": "85999990000",
                        "expires_in_hours": 72,
                        "allow_manual_copy": True,
                    },
                )
                self.assertEqual(create_response.status_code, 200)
                invite_id = create_response.json()["invite_id"]

                summary_response = client.get(
                    f"/api/v1/portal/admin/clinicas/{seed['clinica_id']}/acesso",
                )
                self.assertEqual(summary_response.status_code, 200)
                summary_payload = summary_response.json()
                self.assertEqual(summary_payload["clinica_id"], seed["clinica_id"])
                self.assertEqual(summary_payload["invite"]["id"], invite_id)
                self.assertEqual(summary_payload["invite"]["status"], "pending")
                self.assertIsNone(summary_payload["account"])
                self.assertEqual(summary_payload["active_session_count"], 0)

                revoke_response = client.post(
                    f"/api/v1/portal/admin/clinicas/{seed['clinica_id']}/convites/{invite_id}/revogar",
                    json={"reason": "convite cancelado"},
                )
                self.assertEqual(revoke_response.status_code, 200)
                self.assertEqual(revoke_response.json()["status"], "revoked")

                summary_after_revoke = client.get(
                    f"/api/v1/portal/admin/clinicas/{seed['clinica_id']}/acesso",
                )
                self.assertEqual(summary_after_revoke.status_code, 200)
                self.assertEqual(summary_after_revoke.json()["invite"]["status"], "revoked")

    def test_invite_activation_autologin_refresh_and_exam_scope(self) -> None:
        seed = self._seed_portal_data()
        self._install_overrides()
        db = self._session_factory()
        try:
            db.add(
                PortalClinicAccount(
                    clinica_id=seed["clinica_id"],
                    email_normalized="portal.clinica@example.com",
                    responsavel_nome="Cadastro pendente antigo",
                    password_hash="pending-password-hash",
                    status="pending_verification",
                )
            )
            db.commit()
        finally:
            db.close()

        captured_codes: dict[str, str] = {}

        def _capture_login_mfa(*, code: str, **kwargs):
            captured_codes["login_mfa"] = code
            return SimpleNamespace(provider="smtp", channel="email")

        with ExitStack() as stack:
            stack.enter_context(patch.object(settings, "PORTAL_CLINIC_INVITE_AUTH_ENABLED", True))
            stack.enter_context(patch.object(settings, "PORTAL_CLINIC_PASSWORD_LOGIN_ENABLED", True))
            stack.enter_context(patch.object(settings, "PORTAL_WHATSAPP_ENABLED", False))
            stack.enter_context(patch("app.api.v1.endpoints.portal_clinic_auth.registrar_auditoria", return_value=None))
            stack.enter_context(
                patch(
                    "app.api.v1.endpoints.portal_clinic_auth.send_login_mfa_code",
                    side_effect=_capture_login_mfa,
                )
            )
            with TestClient(self._app) as client:
                invite_response = client.post(
                    f"/api/v1/portal/admin/clinicas/{seed['clinica_id']}/convites",
                    json={
                        "delivery_channel": "whatsapp",
                        "delivery_target": "85999990000",
                        "account_email": "portal.clinica@example.com",
                        "expires_in_hours": 72,
                        "allow_manual_copy": True,
                    },
                )
                self.assertEqual(invite_response.status_code, 200)
                invite_payload = invite_response.json()
                invite_token = invite_payload["activation_url"].rstrip("/").split("/")[-1]

                status_response = client.get(f"/api/v1/portal/clinicas/convites/{invite_token}")
                self.assertEqual(status_response.status_code, 200)
                self.assertEqual(status_response.json()["status"], "pending")

                activation_response = client.post(
                    "/api/v1/portal/clinicas/ativacao",
                    json={
                        "invite_token": invite_token,
                        "responsavel_nome": "Dra. Parceira",
                        "password": "Senha-forte-123",
                        "password_confirmation": "Senha-forte-123",
                    },
                )
                self.assertEqual(activation_response.status_code, 200)
                activation_payload = activation_response.json()
                self.assertEqual(activation_payload["actor_type"], "clinica")
                self.assertEqual(activation_payload["clinica_id"], seed["clinica_id"])
                self.assertTrue(activation_payload["access_token"])
                self.assertEqual(activation_payload["auth_method"], "invite_activation")
                self.assertTrue(activation_payload["trusted_session_expires_at"])

                status_after_activation = client.get(f"/api/v1/portal/clinicas/convites/{invite_token}")
                self.assertEqual(status_after_activation.status_code, 200)
                self.assertEqual(status_after_activation.json()["status"], "used")

                auth_headers = {"Authorization": f"Bearer {activation_payload['access_token']}"}
                exams_response = client.get(
                    f"/api/v1/portal/pets/{seed['paciente_id']}/exames",
                    headers=auth_headers,
                )
                self.assertEqual(exams_response.status_code, 200)
                self.assertEqual(exams_response.json()["total"], 1)

                refresh_response = client.post("/api/v1/portal/auth/refresh")
                self.assertEqual(refresh_response.status_code, 200)
                self.assertEqual(refresh_response.json()["auth_method"], "refresh")
                self.assertTrue(refresh_response.json()["access_token"])

                logout_response = client.post("/api/v1/portal/auth/logout")
                self.assertEqual(logout_response.status_code, 200)

                blocked_refresh_response = client.post("/api/v1/portal/auth/refresh")
                self.assertEqual(blocked_refresh_response.status_code, 401)

                login_response = client.post(
                    "/api/v1/portal/auth/login",
                    json={
                        "email": "portal.clinica@example.com",
                        "password": "Senha-forte-123",
                        "remember_device_until_shift_end": True,
                    },
                )
                self.assertEqual(login_response.status_code, 200)
                self.assertFalse(login_response.json()["mfa_required"])
                self.assertTrue(login_response.json()["access_token"])
                self.assertTrue(login_response.json()["trusted_session_expires_at"])
                self.assertNotIn("login_mfa", captured_codes)

    def test_password_reset_revokes_session_and_forces_mfa_on_next_login(self) -> None:
        seed = self._seed_portal_data()
        self._install_overrides()

        captured_codes: dict[str, str] = {}
        captured_reset: dict[str, str] = {}

        def _capture_login_mfa(*, code: str, **kwargs):
            captured_codes["login_mfa"] = code
            return SimpleNamespace(provider="smtp", channel="email")

        def _capture_reset_email(*, reset_url: str, **kwargs):
            captured_reset["url"] = reset_url
            return SimpleNamespace(provider="smtp", channel="email")

        with ExitStack() as stack:
            stack.enter_context(patch.object(settings, "PORTAL_CLINIC_INVITE_AUTH_ENABLED", True))
            stack.enter_context(patch.object(settings, "PORTAL_CLINIC_PASSWORD_LOGIN_ENABLED", True))
            stack.enter_context(patch.object(settings, "PORTAL_WHATSAPP_ENABLED", False))
            stack.enter_context(patch("app.api.v1.endpoints.portal_clinic_auth.registrar_auditoria", return_value=None))
            stack.enter_context(
                patch(
                    "app.api.v1.endpoints.portal_clinic_auth.send_login_mfa_code",
                    side_effect=_capture_login_mfa,
                )
            )
            stack.enter_context(
                patch(
                    "app.api.v1.endpoints.portal_clinic_auth.send_password_reset_email",
                    side_effect=_capture_reset_email,
                )
            )
            with TestClient(self._app) as client:
                invite_response = client.post(
                    f"/api/v1/portal/admin/clinicas/{seed['clinica_id']}/convites",
                    json={
                        "delivery_channel": "whatsapp",
                        "delivery_target": "85999990000",
                        "account_email": "portal.reset@example.com",
                        "expires_in_hours": 72,
                        "allow_manual_copy": True,
                    },
                )
                invite_token = invite_response.json()["activation_url"].rstrip("/").split("/")[-1]

                activation_response = client.post(
                    "/api/v1/portal/clinicas/ativacao",
                    json={
                        "invite_token": invite_token,
                        "responsavel_nome": "Dra. Reset",
                        "password": "Senha-forte-123",
                        "password_confirmation": "Senha-forte-123",
                    },
                )
                self.assertEqual(activation_response.status_code, 200)
                self.assertTrue(activation_response.json()["access_token"])

                forgot_response = client.post(
                    "/api/v1/portal/auth/esqueci-senha",
                    json={"email": "portal.reset@example.com"},
                )
                self.assertEqual(forgot_response.status_code, 200)
                reset_token = parse_qs(urlparse(captured_reset["url"]).query)["token"][0]

                reset_response = client.post(
                    "/api/v1/portal/auth/redefinir-senha",
                    json={
                        "reset_token": reset_token,
                        "password": "Nova-senha-456",
                        "password_confirmation": "Nova-senha-456",
                    },
                )
                self.assertEqual(reset_response.status_code, 200)

                refresh_after_reset = client.post("/api/v1/portal/auth/refresh")
                self.assertEqual(refresh_after_reset.status_code, 401)

                login_with_old_password = client.post(
                    "/api/v1/portal/auth/login",
                    json={
                        "email": "portal.reset@example.com",
                        "password": "Senha-forte-123",
                        "remember_device_until_shift_end": False,
                    },
                )
                self.assertEqual(login_with_old_password.status_code, 401)

                login_with_new_password = client.post(
                    "/api/v1/portal/auth/login",
                    json={
                        "email": "portal.reset@example.com",
                        "password": "Nova-senha-456",
                        "remember_device_until_shift_end": False,
                    },
                )
                self.assertEqual(login_with_new_password.status_code, 200)
                self.assertTrue(login_with_new_password.json()["mfa_required"])


if __name__ == "__main__":
    unittest.main()
