import os
import sys
import tempfile
import unittest
from contextlib import ExitStack
from datetime import datetime
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

BACKEND_DIR = Path(__file__).resolve().parents[1]
os.chdir(BACKEND_DIR)
sys.path.insert(0, str(BACKEND_DIR))

os.environ.setdefault("DATABASE_URL", "sqlite:///./fortcordis.db")
os.environ.setdefault("SECRET_KEY", "portal-access-http-test-secret-key-1234567890")

from app.core.config import settings
from app.core.portal_release import PORTAL_RELEASED_STATUS
from app.core.portal_security import PORTAL_DOWNLOAD_TOKEN_HEADER
from app.db.database import get_db
from app.main import app
from app.models.atendimento_clinico import AnexoAtendimento, AtendimentoClinico
from app.models.clinica import Clinica
from app.models.laudo import Exame, Laudo
from app.models.paciente import Paciente
from app.models.portal_access import PortalAccessChallenge
from app.models.tutor import Tutor


class _FakeRemoteResponse:
    def __init__(self, body: bytes, headers: dict[str, str] | None = None):
        self._body = body
        self.headers = headers or {}

    def raise_for_status(self):
        return None

    def iter_bytes(self):
        yield self._body

    def close(self):
        return None


class _FakeRemoteClient:
    def __init__(self, body: bytes, headers: dict[str, str] | None, requested_urls: list[dict]):
        self._body = body
        self._headers = headers or {}
        self._requested_urls = requested_urls

    def build_request(self, method: str, url: str, headers: dict[str, str] | None = None):
        request = SimpleNamespace(method=method, url=url, headers=headers or {})
        self._requested_urls.append(
            {
                "method": method,
                "url": url,
                "headers": headers or {},
            }
        )
        return request

    def send(self, request, stream: bool = False):
        _ = request
        _ = stream
        return _FakeRemoteResponse(self._body, self._headers)

    def close(self):
        return None


class PortalAccessHttpFlowTest(unittest.TestCase):
    def setUp(self) -> None:
        self._tmpdir = tempfile.TemporaryDirectory()
        db_path = Path(self._tmpdir.name) / "portal-access-http-flow.db"
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
            Laudo.__table__,
            Exame.__table__,
            AnexoAtendimento.__table__,
            PortalAccessChallenge.__table__,
        ):
            table.create(self._engine, checkfirst=True)

    def tearDown(self) -> None:
        app.dependency_overrides.clear()
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

    def _seed_portal_data(self, *, remote_attachment_url: str | None = None):
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
            outra_clinica = Clinica(
                nome="Clinica Parceira B",
                email="outra@example.com",
                ativo=True,
            )
            db.add_all([tutor, clinica, outra_clinica])
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
                data_atendimento=datetime(2026, 6, 16, 9, 30),
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
                status=PORTAL_RELEASED_STATUS,
                data_solicitacao=datetime(2026, 6, 16, 9, 0),
                data_resultado=datetime(2026, 6, 16, 10, 0),
                observacoes="Exame liberado para portal.",
            )
            db.add(exame)
            db.flush()

            exame_interno = Exame(
                atendimento_id=atendimento.id,
                paciente_id=paciente.id,
                tipo_exame="Eletrocardiograma",
                categoria_exame="Cardiologia",
                prioridade="Rotina",
                status="Concluido",
                data_solicitacao=datetime(2026, 6, 16, 9, 15),
                data_resultado=datetime(2026, 6, 16, 10, 15),
                observacoes="Exame concluido internamente, ainda nao liberado no portal.",
            )
            db.add(exame_interno)
            db.flush()

            attachment_bytes = b"%PDF-1.4\nportal http flow\n"
            attachment_path = Path(self._tmpdir.name) / "eco-luna.pdf"
            if remote_attachment_url is None:
                attachment_path.write_bytes(attachment_bytes)
            anexo = AnexoAtendimento(
                atendimento_id=atendimento.id,
                exame_id=exame.id,
                tipo="documento",
                descricao="Laudo PDF",
                url=remote_attachment_url or f"/api/v1/portal/anexos/{exame.id}/arquivo",
                nome_original="eco-luna.pdf",
                tamanho=len(attachment_bytes),
                mime_type="application/pdf",
                caminho_arquivo=None if remote_attachment_url else str(attachment_path),
                origem="upload",
            )
            db.add(anexo)
            db.commit()
            return {
                "tutor_id": tutor.id,
                "tutor_email": tutor.email,
                "paciente_id": paciente.id,
                "clinica_id": clinica.id,
                "clinica_email": clinica.email,
                "outra_clinica_id": outra_clinica.id,
                "outra_clinica_email": outra_clinica.email,
                "exame_id": exame.id,
                "anexo_id": anexo.id,
                "attachment_bytes": attachment_bytes,
                "remote_attachment_url": remote_attachment_url,
            }
        finally:
            db.close()

    def _request_tutor_token(self, client: TestClient, seed: dict) -> str:
        challenge_response = client.post(
            "/api/v1/portal/tutores/sessao-link",
            json={
                "tutor_id": seed["tutor_id"],
                "paciente_id": seed["paciente_id"],
                "canal": "email",
                "contato": seed["tutor_email"],
            },
        )
        self.assertEqual(challenge_response.status_code, 202)
        challenge_payload = challenge_response.json()
        self.assertTrue(challenge_payload["accepted"])
        self.assertTrue(challenge_payload["debug_code"])

        verify_response = client.post(
            "/api/v1/portal/auth/verificar-codigo",
            json={
                "challenge_id": challenge_payload["challenge_id"],
                "codigo": challenge_payload["debug_code"],
            },
        )
        self.assertEqual(verify_response.status_code, 200)
        return verify_response.json()["access_token"]

    def _request_clinic_token(self, client: TestClient, *, clinica_id: int, clinica_email: str) -> str:
        challenge_response = client.post(
            "/api/v1/portal/clinicas/sessao-link",
            json={
                "clinica_id": clinica_id,
                "email": clinica_email,
                "responsavel_nome": "Dra. Parceira",
            },
        )
        self.assertEqual(challenge_response.status_code, 202)
        challenge_payload = challenge_response.json()
        self.assertTrue(challenge_payload["accepted"])
        self.assertTrue(challenge_payload["debug_code"])

        verify_response = client.post(
            "/api/v1/portal/auth/verificar-codigo",
            json={
                "challenge_id": challenge_payload["challenge_id"],
                "codigo": challenge_payload["debug_code"],
            },
        )
        self.assertEqual(verify_response.status_code, 200)
        return verify_response.json()["access_token"]

    def test_tutor_http_flow_lists_and_downloads_attachment(self) -> None:
        seed = self._seed_portal_data()
        app.dependency_overrides[get_db] = self._override_get_db()

        with ExitStack() as stack:
            stack.enter_context(patch.object(settings, "PORTAL_DEBUG_EXPOSE_CODE", True))
            stack.enter_context(patch("app.api.v1.endpoints.portal.registrar_auditoria", return_value=None))
            stack.enter_context(
                patch(
                    "app.api.v1.endpoints.portal.send_portal_access_code",
                    return_value=SimpleNamespace(provider="smtp", channel="email"),
                )
            )
            with TestClient(app) as client:
                token = self._request_tutor_token(client, seed)
                auth_headers = {"Authorization": f"Bearer {token}"}

                list_response = client.get(
                    f"/api/v1/portal/pets/{seed['paciente_id']}/exames",
                    headers=auth_headers,
                )
                self.assertEqual(list_response.status_code, 200)
                list_payload = list_response.json()
                self.assertEqual(list_payload["total"], 1)
                self.assertEqual(list_payload["items"][0]["id"], seed["exame_id"])
                self.assertEqual(list_payload["items"][0]["anexos"][0]["anexo_id"], seed["anexo_id"])

                download_url_response = client.post(
                    f"/api/v1/portal/exames/{seed['exame_id']}/download-url",
                    headers=auth_headers,
                    json={},
                )
                self.assertEqual(download_url_response.status_code, 200)
                download_item = download_url_response.json()["items"][0]
                self.assertEqual(download_item["anexo_id"], seed["anexo_id"])
                self.assertEqual(download_item["download_token_header"], PORTAL_DOWNLOAD_TOKEN_HEADER)

                file_response = client.get(
                    download_item["download_url"],
                    headers={download_item["download_token_header"]: download_item["download_token"]},
                )
                self.assertEqual(file_response.status_code, 200)
                self.assertEqual(file_response.content, seed["attachment_bytes"])
                self.assertEqual(file_response.headers["content-type"], "application/pdf")

    def test_clinic_http_flow_filters_scope_and_downloads_attachment(self) -> None:
        seed = self._seed_portal_data()
        app.dependency_overrides[get_db] = self._override_get_db()

        with ExitStack() as stack:
            stack.enter_context(patch.object(settings, "PORTAL_DEBUG_EXPOSE_CODE", True))
            stack.enter_context(patch("app.api.v1.endpoints.portal.registrar_auditoria", return_value=None))
            stack.enter_context(
                patch(
                    "app.api.v1.endpoints.portal.send_portal_access_code",
                    return_value=SimpleNamespace(provider="smtp", channel="email"),
                )
            )
            with TestClient(app) as client:
                token = self._request_clinic_token(
                    client,
                    clinica_id=seed["clinica_id"],
                    clinica_email=seed["clinica_email"],
                )
                other_token = self._request_clinic_token(
                    client,
                    clinica_id=seed["outra_clinica_id"],
                    clinica_email=seed["outra_clinica_email"],
                )

                clinic_headers = {"Authorization": f"Bearer {token}"}
                other_headers = {"Authorization": f"Bearer {other_token}"}

                own_list_response = client.get(
                    f"/api/v1/portal/pets/{seed['paciente_id']}/exames",
                    headers=clinic_headers,
                )
                self.assertEqual(own_list_response.status_code, 200)
                self.assertEqual(own_list_response.json()["total"], 1)

                other_list_response = client.get(
                    f"/api/v1/portal/pets/{seed['paciente_id']}/exames",
                    headers=other_headers,
                )
                self.assertEqual(other_list_response.status_code, 200)
                self.assertEqual(other_list_response.json()["total"], 0)

                download_url_response = client.post(
                    f"/api/v1/portal/exames/{seed['exame_id']}/download-url",
                    headers=clinic_headers,
                    json={},
                )
                self.assertEqual(download_url_response.status_code, 200)
                download_item = download_url_response.json()["items"][0]

                blocked_download_url_response = client.post(
                    f"/api/v1/portal/exames/{seed['exame_id']}/download-url",
                    headers=other_headers,
                    json={},
                )
                self.assertEqual(blocked_download_url_response.status_code, 403)

                file_response = client.get(
                    download_item["download_url"],
                    headers={download_item["download_token_header"]: download_item["download_token"]},
                )
                self.assertEqual(file_response.status_code, 200)
                self.assertEqual(file_response.content, seed["attachment_bytes"])

    def test_tutor_http_flow_downloads_remote_attachment_url(self) -> None:
        remote_url = "https://storage.example.com/portal/eco-luna.pdf"
        remote_bytes = b"%PDF-1.4\nremote portal http flow\n"
        requested_urls: list[dict] = []
        seed = self._seed_portal_data(remote_attachment_url=remote_url)
        app.dependency_overrides[get_db] = self._override_get_db()

        def _fake_client_factory(*args, **kwargs):
            _ = args
            _ = kwargs
            return _FakeRemoteClient(
                remote_bytes,
                headers={
                    "content-type": "application/pdf",
                    "content-length": str(len(remote_bytes)),
                },
                requested_urls=requested_urls,
            )

        with ExitStack() as stack:
            stack.enter_context(patch.object(settings, "PORTAL_DEBUG_EXPOSE_CODE", True))
            stack.enter_context(patch("app.api.v1.endpoints.portal.registrar_auditoria", return_value=None))
            stack.enter_context(
                patch(
                    "app.api.v1.endpoints.portal.send_portal_access_code",
                    return_value=SimpleNamespace(provider="smtp", channel="email"),
                )
            )
            stack.enter_context(
                patch("app.services.attachment_download_service.httpx.Client", side_effect=_fake_client_factory)
            )
            with TestClient(app) as client:
                token = self._request_tutor_token(client, seed)
                auth_headers = {"Authorization": f"Bearer {token}"}

                list_response = client.get(
                    f"/api/v1/portal/pets/{seed['paciente_id']}/exames",
                    headers=auth_headers,
                )
                self.assertEqual(list_response.status_code, 200)
                list_payload = list_response.json()
                self.assertTrue(list_payload["items"][0]["anexos"][0]["download_available"])

                download_url_response = client.post(
                    f"/api/v1/portal/exames/{seed['exame_id']}/download-url",
                    headers=auth_headers,
                    json={},
                )
                self.assertEqual(download_url_response.status_code, 200)
                download_item = download_url_response.json()["items"][0]

                file_response = client.get(
                    download_item["download_url"],
                    headers={download_item["download_token_header"]: download_item["download_token"]},
                )
                self.assertEqual(file_response.status_code, 200)
                self.assertEqual(file_response.content, remote_bytes)
                self.assertEqual(file_response.headers["content-type"], "application/pdf")

        self.assertEqual(len(requested_urls), 1)
        self.assertEqual(requested_urls[0]["url"], remote_url)


if __name__ == "__main__":
    unittest.main()
