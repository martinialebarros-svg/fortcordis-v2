import copy
import os
import sys
import unittest
from io import BytesIO
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock, patch

from fastapi import FastAPI
from fastapi.testclient import TestClient
from PIL import Image
from pypdf import PdfWriter

BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_DIR))
os.environ.setdefault("DATABASE_URL", "sqlite://")
os.environ.setdefault("SECRET_KEY", "test-assistente-secret-not-for-production")

from app.api.v1.endpoints import atendimento_assistente as endpoint
from app.core.config import settings
from app.core.security import get_current_user, _authorize_request_by_matrix
from app.db.database import get_db
from app.schemas.atendimento_assistente import AnaliseClinica
from app.services import atendimento_assistente as service
from starlette.requests import Request

CONTEXT = {"paciente": {"id": 42, "nome": "Paciente Teste", "especie": "Canina"}}
TRANSCRIPT = "Tutor relata tosse, mas nega desmaios."
FILE = service.ArquivoAnalise("01_exame.pdf", "application/pdf", b"%PDF-test", 2)


def raw_output(with_file=False):
    return {
        "campos": [{"campo": "anamnese", "texto": TRANSCRIPT, "fonte": "transcricao", "evidencia": TRANSCRIPT}],
        "fontes": [{"arquivo": FILE.nome, "paciente_nome": "Paciente Teste", "especie": "Canino", "data_exame": "2026-10-26", "identidade": "compativel", "motivo": "Identificação legível."}] if with_file else [],
        "achados_exames": [{"arquivo": FILE.nome, "pagina": 1, "descricao": "Hemoglobina", "valor": "12,3", "unidade": "g/dL", "referencia": "10 a 18 g/dL", "confianca": "alta", "alertas": [], "evidencia": "Hemoglobina: 12,3 g/dL"}] if with_file else [],
        "sugestoes": [{"titulo": "Reavaliar tosse", "justificativa": "Relato na transcrição.", "conduta": "Considerar investigação após exame clínico.", "limitacoes": ["Depende da avaliação do veterinário."]}],
        "pendencias": [], "avisos": [],
    }


def checked(payload, files=None):
    return service.validar_resultado(AnaliseClinica.model_validate(payload), transcript=TRANSCRIPT, context=CONTEXT, files=files or [])


def png_bytes():
    buffer = BytesIO()
    Image.new("RGB", (64, 64), color="white").save(buffer, format="PNG")
    return buffer.getvalue()


def pdf_bytes(pages=1, encrypted=False):
    writer = PdfWriter()
    for _ in range(pages):
        writer.add_blank_page(width=100, height=100)
    if encrypted:
        writer.encrypt("test-only")
    buffer = BytesIO()
    writer.write(buffer)
    return buffer.getvalue()


class ValidationTests(unittest.TestCase):
    def test_transcript_keeps_negation_and_requires_literal_evidence(self):
        payload = raw_output()
        self.assertEqual(checked(payload)["campos"][0]["texto"], TRANSCRIPT)
        payload["campos"][0]["evidencia"] = "Tutor confirma desmaios."
        self.assertEqual(checked(payload)["campos"], [])

    def test_correct_identity_values_units_and_source_are_preserved(self):
        result = checked(raw_output(True), [FILE])
        self.assertFalse(result["bloqueado_integracao"])
        self.assertEqual(result["achados_exames"][0]["valor"], "12,3")
        self.assertEqual(result["achados_exames"][0]["unidade"], "g/dL")
        self.assertEqual(result["fontes"][0]["data_exame"], "2026-10-26")

    def test_wrong_patient_cannot_be_overridden_by_model_compatible_claim(self):
        for field, value in [("paciente_nome", "Outro paciente"), ("especie", "Felina"), ("paciente_nome", None)]:
            with self.subTest(field=field, value=value):
                payload = raw_output(True)
                payload["fontes"][0][field] = value
                result = checked(payload, [FILE])
                self.assertTrue(result["bloqueado_integracao"])
                self.assertEqual(result["campos"], [])
                self.assertEqual(result["sugestoes"], [])
                self.assertTrue(result["achados_exames"][0]["alertas"])

    def test_missing_duplicate_or_unknown_source_is_rejected(self):
        for kind in ["missing", "duplicate", "unknown"]:
            payload = raw_output(True)
            if kind == "missing":
                payload["fontes"] = []
            elif kind == "duplicate":
                payload["fontes"].append(copy.deepcopy(payload["fontes"][0]))
            else:
                payload["fontes"][0]["arquivo"] = "outro.pdf"
            with self.subTest(kind=kind), self.assertRaises(service.AssistenteError):
                checked(payload, [FILE])

    def test_uncertain_reading_loses_usable_value_and_unit(self):
        for level in ["baixa", "media"]:
            payload = raw_output(True)
            payload["achados_exames"][0]["confianca"] = level
            result = checked(payload, [FILE])
            finding = result["achados_exames"][0]
            self.assertIsNone(finding["valor"])
            self.assertIsNone(finding["unidade"])
            self.assertIsNone(finding["referencia"])
            self.assertTrue(finding["alertas"])

    def test_unsupported_page_or_file_is_rejected(self):
        for changes in [{"pagina": 3}, {"pagina": None}, {"arquivo": "inexistente.pdf"}]:
            payload = raw_output(True)
            payload["achados_exames"][0].update(changes)
            with self.subTest(changes=changes), self.assertRaises(service.AssistenteError):
                checked(payload, [FILE])

    def test_file_field_cannot_bypass_individual_finding_review(self):
        payload = raw_output(True)
        payload["campos"][0].update(fonte=FILE.nome, evidencia="Resultado duvidoso")
        self.assertEqual(checked(payload, [FILE])["campos"], [])

    def test_missing_reference_stays_missing(self):
        payload = raw_output(True)
        payload["achados_exames"][0]["referencia"] = None
        self.assertIsNone(checked(payload, [FILE])["achados_exames"][0]["referencia"])

    def test_document_label_and_unit_variants_are_not_normalized(self):
        payload = raw_output(True)
        payload["achados_exames"][0].update(descricao="HGB", valor="123", unidade="g/L", referencia=None, evidencia="HGB 123 g/L")
        result = checked(payload, [FILE])["achados_exames"][0]
        self.assertEqual((result["descricao"], result["valor"], result["unidade"]), ("HGB", "123", "g/L"))
        self.assertIsNone(result["referencia"])

    def test_unsupported_model_is_not_replaced_silently(self):
        with patch.object(settings, "ATENDIMENTO_IA_ENABLED", True), patch.object(settings, "OPENAI_API_KEY", "test-key"), patch.object(settings, "ATENDIMENTO_IA_MODEL", "other-model"):
            with self.assertRaises(service.AssistenteError) as captured:
                service.require_enabled()
            self.assertEqual(captured.exception.status_code, 503)

    def test_unknown_field_and_injected_extra_properties_rejected(self):
        for changes in [{"campo": "plano_terapeutico"}, {"aplicar_automaticamente": True}]:
            payload = raw_output()
            payload["campos"][0].update(changes)
            with self.subTest(changes=changes), self.assertRaises(ValueError):
                AnaliseClinica.model_validate(payload)

    def test_file_signatures_and_dimensions_are_checked(self):
        image = service.validar_arquivo("../../exame.png", "image/png", png_bytes(), 1)
        self.assertEqual(image.nome, "01_exame.png")
        for name, mime, content in [("foto.png", "image/png", b"fake"), ("foto.jpg", "image/jpeg", png_bytes()), ("foto.png", "text/html", png_bytes()), ("exame.pdf", "application/pdf", b"%PDF-corrupt"), ("exame.html", "text/html", b"<script>")]:
            with self.subTest(name=name, mime=mime), self.assertRaises(service.AssistenteError):
                service.validar_arquivo(name, mime, content, 1)

    def test_pdf_parsing_encryption_and_page_limit(self):
        self.assertEqual(service.validar_arquivo("exame.pdf", "application/pdf", pdf_bytes(2), 1).paginas, 2)
        for content in [pdf_bytes(31), pdf_bytes(encrypted=True)]:
            with self.assertRaises(service.AssistenteError):
                service.validar_arquivo("exame.pdf", "application/pdf", content, 1)

    def test_size_limits_reject_without_provider(self):
        with patch.object(service, "ARQUIVO_MAX_BYTES", 2), self.assertRaises(service.AssistenteError):
            service.validar_arquivo("exame.png", "image/png", png_bytes(), 1)
        with patch.object(service, "AUDIO_MAX_BYTES", 2), self.assertRaises(service.AssistenteError):
            service.validar_audio("audio.webm", "audio/webm", b"\x1aE\xdf\xa3test")

    def test_audio_signatures_and_container_mime(self):
        self.assertEqual(service.validar_audio("audio.webm", "audio/webm;codecs=opus", b"\x1aE\xdf\xa3test"), ("audio.webm", "audio/webm"))
        self.assertEqual(service.validar_audio("audio.mp4", "audio/mp4", b"\x00\x00\x00\x20ftypisom")[1], "audio/mp4")
        for extension in ("mp3", "mpeg", "mpga"):
            self.assertEqual(service.validar_audio(f"audio.{extension}", "audio/mpeg", b"ID3test")[1], "audio/mpeg")
        for name, content in [("audio.webm", b"text"), ("audio.exe", b"fake"), ("audio.wav", b"RIFFfakeBAD!")]:
            with self.subTest(name=name), self.assertRaises(service.AssistenteError):
                service.validar_audio(name, "audio/webm", content)


class ProviderTests(unittest.TestCase):
    def setUp(self):
        self.client = Mock()
        self.factory = patch.object(service, "OpenAI", return_value=self.client)
        self.factory.start()
        self.addCleanup(self.factory.stop)
        self.provider = service.OpenAIAtendimentoProvider()

    def test_current_models_no_retry_no_fallback_no_store(self):
        self.client.responses.parse.return_value = SimpleNamespace(status="completed", output_parsed=AnaliseClinica.model_validate(raw_output()))
        self.provider.analisar(transcript=TRANSCRIPT, context=CONTEXT, files=[], user_id=1)
        kwargs = self.client.responses.parse.call_args.kwargs
        self.assertEqual(kwargs["model"], "gpt-6.1-sol")
        self.assertEqual(kwargs["reasoning"], {"effort": "max"})
        self.assertFalse(kwargs["store"])
        self.assertNotIn("tools", kwargs)
        self.assertEqual(service.OpenAI.call_args.kwargs["max_retries"], 0)

    def test_pdf_and_image_are_embedded_without_external_urls(self):
        image = service.ArquivoAnalise("02_foto.png", "image/png", png_bytes(), 1)
        output = raw_output(True)
        extra = copy.deepcopy(output["fontes"][0])
        extra["arquivo"] = image.nome
        output["fontes"].append(extra)
        self.client.responses.parse.return_value = SimpleNamespace(status="completed", output_parsed=AnaliseClinica.model_validate(output))
        self.provider.analisar(transcript=TRANSCRIPT, context=CONTEXT, files=[FILE, image], user_id=1)
        content = self.client.responses.parse.call_args.kwargs["input"][0]["content"]
        pdf = next(item for item in content if item["type"] == "input_file")
        self.assertTrue(pdf["file_data"].startswith("data:application/pdf;base64,"))
        self.assertEqual(pdf["detail"], "high")
        self.assertNotIn("file_url", pdf)
        self.assertTrue(next(item for item in content if item["type"] == "input_image")["image_url"].startswith("data:image/png;base64,"))

    def test_transcription_uses_languages_and_never_singular_language(self):
        self.client.audio.transcriptions.create.return_value = SimpleNamespace(text=TRANSCRIPT)
        result = self.provider.transcrever(nome="audio.webm", mime="audio/webm", content=b"audio")
        self.assertEqual(result["texto"], TRANSCRIPT)
        kwargs = self.client.audio.transcriptions.create.call_args.kwargs
        self.assertEqual(kwargs["model"], "gpt-transcribe")
        self.assertEqual(kwargs["extra_body"], {"languages": ["pt"]})
        self.assertNotIn("language", kwargs)

    def test_incomplete_refusal_or_invalid_response_never_becomes_suggestion(self):
        for response in [SimpleNamespace(status="incomplete", output_parsed=raw_output()), SimpleNamespace(status="completed", output_parsed=None), SimpleNamespace(status="completed", output_parsed={"invented": True})]:
            self.client.responses.parse.return_value = response
            with self.subTest(response=response), self.assertRaises(service.AssistenteError):
                self.provider.analisar(transcript=TRANSCRIPT, context=CONTEXT, files=[], user_id=1)

    def test_provider_exception_does_not_leak_content_or_credentials(self):
        self.client.responses.parse.side_effect = RuntimeError("sensitive-patient-data secret-key")
        with self.assertRaises(service.AssistenteError) as captured:
            self.provider.analisar(transcript=TRANSCRIPT, context=CONTEXT, files=[], user_id=1)
        self.assertNotIn("sensitive", str(captured.exception))
        self.assertNotIn("secret", str(captured.exception))


class EndpointTests(unittest.TestCase):
    def setUp(self):
        self.app = FastAPI()
        self.app.include_router(endpoint.router, prefix="/api/v1/atendimentos")
        self.db = Mock()
        self.app.dependency_overrides[get_db] = lambda: self.db
        self.app.dependency_overrides[get_current_user] = lambda: SimpleNamespace(id=1, nome="Veterinário teste", email="vet@example.invalid")
        self.client = TestClient(self.app)
        self.context = patch.object(endpoint, "_contexto", return_value=CONTEXT)
        self.context.start()
        self.addCleanup(self.context.stop)
        self.enabled = patch.object(settings, "ATENDIMENTO_IA_ENABLED", True)
        self.enabled.start()
        self.addCleanup(self.enabled.stop)
        self.key = patch.object(settings, "OPENAI_API_KEY", "test-key")
        self.key.start()
        self.addCleanup(self.key.stop)
        self.audit = patch.object(endpoint, "registrar_auditoria")
        self.audit.start()
        self.addCleanup(self.audit.stop)
        self.provider = Mock()
        self.factory = patch.object(endpoint, "OpenAIAtendimentoProvider", return_value=self.provider)
        self.factory.start()
        self.addCleanup(self.factory.stop)

    def test_status_identifies_authoritative_user_and_patient(self):
        response = self.client.get("/api/v1/atendimentos/1/assistente/status")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["usuario_id"], 1)
        self.assertEqual(response.json()["paciente_id"], 42)

    def test_status_feature_gate_and_missing_key(self):
        with patch.object(settings, "ATENDIMENTO_IA_ENABLED", False):
            self.assertFalse(self.client.get("/api/v1/atendimentos/1/assistente/status").json()["habilitado"])
            response = self.client.post("/api/v1/atendimentos/1/assistente/analisar", data={"consentimento": "true", "transcricao": TRANSCRIPT})
            self.assertEqual(response.status_code, 503)
        with patch.object(settings, "OPENAI_API_KEY", ""):
            self.assertFalse(self.client.get("/api/v1/atendimentos/1/assistente/status").json()["configurado"])
        endpoint.OpenAIAtendimentoProvider.assert_not_called()

    def test_authentication_is_required_on_all_routes(self):
        self.app.dependency_overrides.pop(get_current_user)
        for method, path, kwargs in [("get", "status", {}), ("post", "analisar", {"data": {"transcricao": TRANSCRIPT}}), ("post", "transcrever", {"files": {"audio": ("audio.webm", b"\x1aE\xdf\xa3test", "audio/webm")}})]:
            with self.subTest(path=path):
                response = getattr(self.client, method)(f"/api/v1/atendimentos/1/assistente/{path}", **kwargs)
                self.assertEqual(response.status_code, 401)
        endpoint.OpenAIAtendimentoProvider.assert_not_called()

    def test_permission_matrix_covers_assistant_endpoints(self):
        for method, action in [("GET", "visualizar"), ("POST", "editar")]:
            request = Request({"type": "http", "method": method, "path": "/api/v1/atendimentos/1/assistente/analisar", "headers": []})
            user = SimpleNamespace(tem_papel=lambda role: False)
            with patch("app.core.security._user_has_matrix_permission", return_value=False) as permission:
                with self.assertRaises(Exception) as captured:
                    _authorize_request_by_matrix(request, self.db, user)
                self.assertEqual(captured.exception.status_code, 403)
                permission.assert_called_once_with(self.db, user, "atendimento_clinico", action)

    def test_consent_and_nonempty_source_required(self):
        for data in [{"transcricao": TRANSCRIPT}, {"consentimento": "false", "transcricao": TRANSCRIPT}, {"consentimento": "true"}]:
            with self.subTest(data=data):
                response = self.client.post("/api/v1/atendimentos/1/assistente/analisar", data=data)
                self.assertEqual(response.status_code, 422)
        endpoint.OpenAIAtendimentoProvider.assert_not_called()

    def test_analysis_releases_database_and_does_not_change_record(self):
        self.provider.analisar.return_value = checked(raw_output())
        response = self.client.post("/api/v1/atendimentos/1/assistente/analisar", data={"consentimento": "true", "transcricao": TRANSCRIPT})
        self.assertEqual(response.status_code, 200, response.text)
        self.db.rollback.assert_called_once()
        self.db.commit.assert_not_called()
        self.db.add.assert_not_called()
        self.assertTrue(response.json()["revisao_obrigatoria"])
        details = endpoint.registrar_auditoria.call_args.kwargs["detalhes"]
        self.assertNotIn("transcricao", details)
        self.assertNotIn("paciente", details)

    def test_transcription_upload_contract(self):
        self.provider.transcrever.return_value = {"texto": TRANSCRIPT, "modelo": "gpt-transcribe", "avisos": []}
        response = self.client.post("/api/v1/atendimentos/1/assistente/transcrever", data={"consentimento": "true"}, files={"audio": ("audio.webm", b"\x1aE\xdf\xa3test", "audio/webm")})
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()["texto"], TRANSCRIPT)

    def test_multiple_uploads_keep_unambiguous_source_ids(self):
        self.provider.analisar.return_value = checked(raw_output())
        response = self.client.post("/api/v1/atendimentos/1/assistente/analisar", data={"consentimento": "true"}, files=[("arquivos", ("exame.png", png_bytes(), "image/png")), ("arquivos", ("exame.png", png_bytes(), "image/png"))])
        self.assertEqual(response.status_code, 200, response.text)
        files = self.provider.analisar.call_args.kwargs["files"]
        self.assertEqual([file.nome for file in files], ["01_exame.png", "02_exame.png"])

    def test_missing_attendance_and_provider_error_are_explicit(self):
        with patch.object(endpoint, "_contexto", side_effect=endpoint.HTTPException(404, "Atendimento não encontrado.")):
            response = self.client.post("/api/v1/atendimentos/99/assistente/analisar", data={"consentimento": "true", "transcricao": TRANSCRIPT})
            self.assertEqual(response.status_code, 404)
            endpoint.OpenAIAtendimentoProvider.assert_not_called()
        self.provider.analisar.side_effect = service.AssistenteError("Tempo excedido.", 504)
        response = self.client.post("/api/v1/atendimentos/1/assistente/analisar", data={"consentimento": "true", "transcricao": TRANSCRIPT})
        self.assertEqual(response.status_code, 504)
        self.db.commit.assert_not_called()

    def test_files_count_total_and_text_limits(self):
        response = self.client.post("/api/v1/atendimentos/1/assistente/analisar", data={"consentimento": "true"}, files=[("arquivos", (f"{i}.png", png_bytes(), "image/png")) for i in range(6)])
        self.assertEqual(response.status_code, 413, response.text)
        with patch.object(endpoint, "ARQUIVOS_MAX_BYTES", 1):
            response = self.client.post("/api/v1/atendimentos/1/assistente/analisar", data={"consentimento": "true"}, files={"arquivos": ("exame.png", png_bytes(), "image/png")})
            self.assertEqual(response.status_code, 413, response.text)
        with patch.object(endpoint, "TRANSCRICAO_MAX_CHARS", 4):
            response = self.client.post("/api/v1/atendimentos/1/assistente/analisar", data={"consentimento": "true", "transcricao": TRANSCRIPT})
            self.assertEqual(response.status_code, 413, response.text)
        endpoint.OpenAIAtendimentoProvider.assert_not_called()


if __name__ == "__main__":
    unittest.main()
