import asyncio
import io
import os
import sys
import tempfile
import unittest
from datetime import datetime
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from starlette.datastructures import Headers, UploadFile
from starlette.requests import Request

BACKEND_DIR = Path(__file__).resolve().parents[1]
os.chdir(BACKEND_DIR)
sys.path.insert(0, str(BACKEND_DIR))

from app.api.v1.endpoints import laudos
from app.core.portal_release import PORTAL_RELEASED_STATUS
from app.models.atendimento_clinico import AnexoAtendimento, AtendimentoClinico
from app.models.laudo import Exame, Laudo


PDF_BYTES = b"%PDF-1.4\nportal laudo pdf\n"


def _make_request() -> Request:
    scope = {
        "type": "http",
        "method": "POST",
        "path": "/api/v1/laudos/1/portal/liberar-clinica",
        "raw_path": b"/api/v1/laudos/1/portal/liberar-clinica",
        "query_string": b"",
        "headers": [],
        "client": ("testclient", 50000),
        "server": ("testserver", 80),
        "scheme": "http",
        "http_version": "1.1",
    }
    return Request(scope)


def _make_upload_file(filename: str, content_type: str, content: bytes) -> UploadFile:
    headers = Headers({"content-type": content_type})
    return UploadFile(
        io.BytesIO(content),
        filename=filename,
        headers=headers,
        size=len(content),
    )


class LaudoPortalReleaseTest(unittest.TestCase):
    def _build_session(self):
        tmpdir = tempfile.TemporaryDirectory()
        db_path = Path(tmpdir.name) / "laudo-portal-release.db"
        engine = create_engine(f"sqlite:///{db_path}")
        for table in (
            AtendimentoClinico.__table__,
            Laudo.__table__,
            Exame.__table__,
            AnexoAtendimento.__table__,
        ):
            table.create(engine, checkfirst=True)
        session = sessionmaker(bind=engine, autocommit=False, autoflush=False)()
        return tmpdir, session, engine

    def _fake_pdf(self):
        return SimpleNamespace(
            content=PDF_BYTES,
            filename="laudo-luna.pdf",
            cache_key="cache-key-test",
        )

    def _fake_store(self, tmpdir: tempfile.TemporaryDirectory):
        def _store(atendimento_id: int, filename: str, content: bytes, content_type: str):
            file_path = Path(tmpdir.name) / f"stored-{atendimento_id}-{filename}"
            file_path.write_bytes(content)
            return str(file_path), filename, content_type

        return _store

    def test_liberar_laudo_cria_exame_publicado_no_portal(self) -> None:
        tmpdir, db, engine = self._build_session()
        try:
            laudo = Laudo(
                paciente_id=182,
                veterinario_id=7,
                tipo="ecocardiograma",
                titulo="Laudo ecocardiografico - Luna",
                status="Finalizado",
                clinic_id=8,
                data_exame=datetime(2026, 7, 4, 15, 30),
                criado_por_id=7,
                criado_por_nome="Dr. Martiniano",
            )
            db.add(laudo)
            db.commit()
            db.refresh(laudo)

            current_user = SimpleNamespace(id=7, nome="Dr. Martiniano", email="vet@example.com")
            with (
                patch.object(laudos, "render_laudo_pdf", return_value=self._fake_pdf()) as render_mock,
                patch.object(laudos, "store_atendimento_attachment_file", side_effect=self._fake_store(tmpdir)) as store_mock,
                patch.object(laudos, "registrar_auditoria", return_value=None) as audit_mock,
            ):
                response = laudos.liberar_laudo_para_portal_clinica(
                    laudo.id,
                    request=_make_request(),
                    db=db,
                    current_user=current_user,
                )

            db.refresh(laudo)
            exame = db.query(Exame).filter(Exame.laudo_id == laudo.id).first()
            anexo = db.query(AnexoAtendimento).filter(AnexoAtendimento.exame_id == exame.id).first()

            self.assertEqual(response["status"], PORTAL_RELEASED_STATUS)
            self.assertEqual(laudo.status, PORTAL_RELEASED_STATUS)
            self.assertIsNotNone(exame)
            self.assertIsNotNone(anexo)
            self.assertEqual(exame.status, PORTAL_RELEASED_STATUS)
            self.assertEqual(exame.paciente_id, laudo.paciente_id)
            self.assertEqual(exame.tipo_exame, "Ecocardiograma")
            self.assertEqual(exame.categoria_exame, "Laudo")
            self.assertEqual(response["anexo_id"], anexo.id)
            self.assertEqual(anexo.nome_original, "laudo-luna.pdf")
            self.assertEqual(anexo.mime_type, "application/pdf")
            self.assertEqual(anexo.tamanho, len(PDF_BYTES))
            self.assertEqual(anexo.origem, laudos.PORTAL_LAUDO_ATTACHMENT_ORIGIN)
            self.assertEqual(anexo.url, f"/api/v1/portal/anexos/{anexo.id}/arquivo")
            self.assertTrue(Path(anexo.caminho_arquivo).exists())
            render_mock.assert_called_once()
            store_mock.assert_called_once()
            audit_mock.assert_called_once()
        finally:
            db.close()
            engine.dispose()
            tmpdir.cleanup()

    def test_liberar_laudo_reusa_anexo_pdf_existente(self) -> None:
        tmpdir, db, engine = self._build_session()
        try:
            laudo = Laudo(
                paciente_id=182,
                veterinario_id=7,
                tipo="ecocardiograma",
                titulo="Laudo ecocardiografico - Luna",
                status="Finalizado",
                clinic_id=8,
                data_exame=datetime(2026, 7, 4, 15, 30),
                criado_por_id=7,
                criado_por_nome="Dr. Martiniano",
            )
            db.add(laudo)
            db.commit()
            db.refresh(laudo)

            current_user = SimpleNamespace(id=7, nome="Dr. Martiniano", email="vet@example.com")
            with (
                patch.object(laudos, "render_laudo_pdf", return_value=self._fake_pdf()),
                patch.object(laudos, "store_atendimento_attachment_file", side_effect=self._fake_store(tmpdir)) as store_mock,
                patch.object(laudos, "registrar_auditoria", return_value=None),
            ):
                first = laudos.liberar_laudo_para_portal_clinica(
                    laudo.id,
                    request=_make_request(),
                    db=db,
                    current_user=current_user,
                )
                second = laudos.liberar_laudo_para_portal_clinica(
                    laudo.id,
                    request=_make_request(),
                    db=db,
                    current_user=current_user,
                )

            self.assertEqual(first["anexo_id"], second["anexo_id"])
            self.assertEqual(db.query(AnexoAtendimento).count(), 1)
            store_mock.assert_called_once()
        finally:
            db.close()
            engine.dispose()
            tmpdir.cleanup()

    def test_liberar_eletrocardiograma_usa_pdf_externo_anexado(self) -> None:
        tmpdir, db, engine = self._build_session()
        try:
            pdf_path = Path(tmpdir.name) / "eletro-luke.pdf"
            pdf_path.write_bytes(b"%PDF-1.4\neletro externo\n")

            laudo = Laudo(
                paciente_id=182,
                veterinario_id=7,
                tipo=laudos.TIPO_LAUDO_ELETROCARDIOGRAMA,
                titulo="Laudo de Eletrocardiograma - Luke",
                status="Finalizado",
                clinic_id=8,
                data_exame=datetime(2026, 7, 5, 11, 0),
                criado_por_id=7,
                criado_por_nome="Dr. Martiniano",
            )
            db.add(laudo)
            db.flush()

            anexo = AnexoAtendimento(
                atendimento_id=0,
                exame_id=None,
                tipo="documento",
                descricao="PDF do eletrocardiograma.",
                url="",
                nome_original="eletro-luke.pdf",
                tamanho=pdf_path.stat().st_size,
                mime_type="application/pdf",
                arquivo_hash="abc123",
                dedupe_key=f"laudo:{laudo.id}|sha256:abc123",
                caminho_arquivo=str(pdf_path),
                origem=laudos.ELETROCARDIOGRAMA_UPLOAD_ORIGIN,
            )
            db.add(anexo)
            db.flush()
            laudo.anexos = laudos._serializar_pdf_externo_laudo(
                laudo.anexos,
                {
                    "anexo_id": anexo.id,
                    "nome_original": anexo.nome_original,
                    "mime_type": anexo.mime_type,
                    "tamanho": anexo.tamanho,
                    "arquivo_hash": anexo.arquivo_hash,
                },
            )
            db.commit()
            db.refresh(laudo)
            db.refresh(anexo)

            current_user = SimpleNamespace(id=7, nome="Dr. Martiniano", email="vet@example.com")
            with (
                patch.object(laudos, "render_laudo_pdf", return_value=self._fake_pdf()) as render_mock,
                patch.object(laudos, "store_atendimento_attachment_file", side_effect=self._fake_store(tmpdir)) as store_mock,
                patch.object(laudos, "registrar_auditoria", return_value=None),
            ):
                response = laudos.liberar_laudo_para_portal_clinica(
                    laudo.id,
                    request=_make_request(),
                    db=db,
                    current_user=current_user,
                )

            db.refresh(laudo)
            db.refresh(anexo)
            exame = db.query(Exame).filter(Exame.laudo_id == laudo.id).first()

            self.assertEqual(response["status"], PORTAL_RELEASED_STATUS)
            self.assertEqual(response["anexo_id"], anexo.id)
            self.assertEqual(laudo.status, PORTAL_RELEASED_STATUS)
            self.assertIsNotNone(exame)
            self.assertEqual(exame.tipo_exame, "Eletrocardiograma")
            self.assertEqual(anexo.exame_id, exame.id)
            self.assertEqual(anexo.origem, laudos.PORTAL_LAUDO_ATTACHMENT_ORIGIN)
            self.assertEqual(anexo.url, f"/api/v1/portal/anexos/{anexo.id}/arquivo")
            render_mock.assert_not_called()
            store_mock.assert_not_called()
        finally:
            db.close()
            engine.dispose()
            tmpdir.cleanup()

    def test_liberar_laudo_sem_clinica_e_bloqueado(self) -> None:
        tmpdir, db, engine = self._build_session()
        try:
            laudo = Laudo(
                paciente_id=182,
                veterinario_id=7,
                tipo="ecocardiograma",
                titulo="Laudo sem clinica",
                status="Finalizado",
                clinic_id=None,
                criado_por_id=7,
                criado_por_nome="Dr. Martiniano",
            )
            db.add(laudo)
            db.commit()
            db.refresh(laudo)

            current_user = SimpleNamespace(id=7, nome="Dr. Martiniano", email="vet@example.com")
            with patch.object(laudos, "render_laudo_pdf", return_value=self._fake_pdf()) as render_mock:
                with self.assertRaises(HTTPException) as ctx:
                    laudos.liberar_laudo_para_portal_clinica(
                        laudo.id,
                        request=_make_request(),
                        db=db,
                        current_user=current_user,
                    )

            self.assertEqual(ctx.exception.status_code, 422)
            self.assertEqual(db.query(Exame).count(), 0)
            self.assertEqual(db.query(AnexoAtendimento).count(), 0)
            render_mock.assert_not_called()
        finally:
            db.close()
            engine.dispose()
            tmpdir.cleanup()

    def test_substituir_pdf_eletrocardiograma_antes_da_liberacao_reaproveita_anexo(self) -> None:
        tmpdir, db, engine = self._build_session()
        try:
            old_pdf_path = Path(tmpdir.name) / "eletro-antigo.pdf"
            old_pdf_path.write_bytes(b"%PDF-1.4\neletro antigo\n")

            laudo = Laudo(
                paciente_id=182,
                veterinario_id=7,
                tipo=laudos.TIPO_LAUDO_ELETROCARDIOGRAMA,
                titulo="Laudo de Eletrocardiograma - Luke",
                status="Finalizado",
                clinic_id=8,
                data_exame=datetime(2026, 7, 5, 11, 0),
                criado_por_id=7,
                criado_por_nome="Dr. Martiniano",
            )
            db.add(laudo)
            db.flush()

            anexo = AnexoAtendimento(
                atendimento_id=0,
                exame_id=None,
                tipo="documento",
                descricao="PDF do eletrocardiograma.",
                url="",
                nome_original="eletro-antigo.pdf",
                tamanho=old_pdf_path.stat().st_size,
                mime_type="application/pdf",
                arquivo_hash="oldhash",
                dedupe_key=f"laudo:{laudo.id}|sha256:oldhash",
                caminho_arquivo=str(old_pdf_path),
                origem=laudos.ELETROCARDIOGRAMA_UPLOAD_ORIGIN,
            )
            db.add(anexo)
            db.flush()
            laudo.anexos = laudos._serializar_pdf_externo_laudo(
                laudo.anexos,
                {
                    "anexo_id": anexo.id,
                    "nome_original": anexo.nome_original,
                    "mime_type": anexo.mime_type,
                    "tamanho": anexo.tamanho,
                    "arquivo_hash": anexo.arquivo_hash,
                },
            )
            db.commit()
            db.refresh(laudo)
            db.refresh(anexo)

            arquivo = _make_upload_file(
                "eletro-correto.pdf",
                "application/pdf",
                b"%PDF-1.4\neletro correto\n",
            )
            current_user = SimpleNamespace(id=7, nome="Dr. Martiniano", email="vet@example.com")
            with (
                patch.object(laudos, "store_atendimento_attachment_file", side_effect=self._fake_store(tmpdir)),
                patch.object(laudos, "registrar_auditoria", return_value=None) as audit_mock,
            ):
                response = asyncio.run(
                    laudos.substituir_pdf_eletrocardiograma(
                        laudo.id,
                        request=_make_request(),
                        arquivo=arquivo,
                        db=db,
                        current_user=current_user,
                    )
                )

            db.refresh(laudo)
            db.refresh(anexo)

            self.assertEqual(response["laudo_id"], laudo.id)
            self.assertEqual(response["anexo_id"], anexo.id)
            self.assertFalse(response["liberado_no_portal"])
            self.assertEqual(anexo.origem, laudos.ELETROCARDIOGRAMA_UPLOAD_ORIGIN)
            self.assertEqual(anexo.exame_id, None)
            self.assertEqual(anexo.nome_original, "eletro-correto.pdf")
            self.assertEqual(anexo.url, f"/api/v1/atendimentos/anexos/{anexo.id}/arquivo")
            self.assertFalse(old_pdf_path.exists())
            self.assertIn("eletro-correto.pdf", anexo.caminho_arquivo)
            audit_mock.assert_called_once()
        finally:
            db.close()
            engine.dispose()
            tmpdir.cleanup()

    def test_substituir_pdf_eletrocardiograma_liberado_atualiza_portal(self) -> None:
        tmpdir, db, engine = self._build_session()
        try:
            old_pdf_path = Path(tmpdir.name) / "eletro-portal-antigo.pdf"
            old_pdf_path.write_bytes(b"%PDF-1.4\neletro portal antigo\n")

            laudo = Laudo(
                paciente_id=182,
                veterinario_id=7,
                tipo=laudos.TIPO_LAUDO_ELETROCARDIOGRAMA,
                titulo="Laudo de Eletrocardiograma - Luke",
                status=PORTAL_RELEASED_STATUS,
                clinic_id=8,
                data_exame=datetime(2026, 7, 5, 11, 0),
                criado_por_id=7,
                criado_por_nome="Dr. Martiniano",
            )
            db.add(laudo)
            db.flush()

            exame = Exame(
                laudo_id=laudo.id,
                atendimento_id=55,
                paciente_id=laudo.paciente_id,
                tipo_exame="Eletrocardiograma",
                categoria_exame="Laudo",
                prioridade="Rotina",
                status=PORTAL_RELEASED_STATUS,
                valor=0,
            )
            db.add(exame)
            db.flush()

            anexo = AnexoAtendimento(
                atendimento_id=55,
                exame_id=exame.id,
                tipo="documento",
                descricao="PDF do eletrocardiograma.",
                url="",
                nome_original="eletro-portal-antigo.pdf",
                tamanho=old_pdf_path.stat().st_size,
                mime_type="application/pdf",
                arquivo_hash="portaloldhash",
                dedupe_key=laudos.build_upload_dedupe_key(exame.id, "portaloldhash"),
                caminho_arquivo=str(old_pdf_path),
                origem=laudos.PORTAL_LAUDO_ATTACHMENT_ORIGIN,
            )
            db.add(anexo)
            db.flush()
            anexo.url = f"/api/v1/portal/anexos/{anexo.id}/arquivo"
            laudo.anexos = laudos._serializar_pdf_externo_laudo(
                laudo.anexos,
                {
                    "anexo_id": anexo.id,
                    "nome_original": anexo.nome_original,
                    "mime_type": anexo.mime_type,
                    "tamanho": anexo.tamanho,
                    "arquivo_hash": anexo.arquivo_hash,
                },
            )
            db.commit()
            db.refresh(laudo)
            db.refresh(exame)
            db.refresh(anexo)

            arquivo = _make_upload_file(
                "eletro-portal-correto.pdf",
                "application/pdf",
                b"%PDF-1.4\neletro portal correto\n",
            )
            current_user = SimpleNamespace(id=7, nome="Dr. Martiniano", email="vet@example.com")
            with (
                patch.object(laudos, "store_atendimento_attachment_file", side_effect=self._fake_store(tmpdir)),
                patch.object(laudos, "registrar_auditoria", return_value=None) as audit_mock,
            ):
                response = asyncio.run(
                    laudos.substituir_pdf_eletrocardiograma(
                        laudo.id,
                        request=_make_request(),
                        arquivo=arquivo,
                        db=db,
                        current_user=current_user,
                    )
                )

            db.refresh(laudo)
            db.refresh(exame)
            db.refresh(anexo)

            self.assertEqual(response["laudo_id"], laudo.id)
            self.assertEqual(response["anexo_id"], anexo.id)
            self.assertTrue(response["liberado_no_portal"])
            self.assertEqual(response["exame_id"], exame.id)
            self.assertEqual(anexo.origem, laudos.PORTAL_LAUDO_ATTACHMENT_ORIGIN)
            self.assertEqual(anexo.exame_id, exame.id)
            self.assertEqual(anexo.atendimento_id, 55)
            self.assertEqual(anexo.nome_original, "eletro-portal-correto.pdf")
            self.assertEqual(anexo.url, f"/api/v1/portal/anexos/{anexo.id}/arquivo")
            self.assertEqual(anexo.dedupe_key, laudos.build_upload_dedupe_key(exame.id, anexo.arquivo_hash))
            self.assertFalse(old_pdf_path.exists())
            self.assertIn("eletro-portal-correto.pdf", anexo.caminho_arquivo)
            audit_mock.assert_called_once()
        finally:
            db.close()
            engine.dispose()
            tmpdir.cleanup()


if __name__ == "__main__":
    unittest.main()
