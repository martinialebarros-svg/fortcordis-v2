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

BACKEND_DIR = Path(__file__).resolve().parents[1]
os.chdir(BACKEND_DIR)
sys.path.insert(0, str(BACKEND_DIR))

os.environ.setdefault("DATABASE_URL", "sqlite:///./fortcordis.db")
os.environ.setdefault("SECRET_KEY", "atendimento-portal-exam-release-test-secret-key-1234567890")

from app.api.v1.endpoints import atendimento
from app.core.portal_release import PORTAL_RELEASED_STATUS
from app.models.atendimento_clinico import AnexoAtendimento, AtendimentoClinico
from app.models.laudo import Exame


class AtendimentoPortalExamReleaseTest(unittest.TestCase):
    def _build_session(self):
        tmpdir = tempfile.TemporaryDirectory()
        db_path = Path(tmpdir.name) / "atendimento-portal-exam-release.db"
        engine = create_engine(
            f"sqlite:///{db_path}",
            connect_args={"check_same_thread": False},
        )
        for table in (
            AtendimentoClinico.__table__,
            Exame.__table__,
            AnexoAtendimento.__table__,
        ):
            table.create(engine, checkfirst=True)
        session_factory = sessionmaker(bind=engine, autocommit=False, autoflush=False)
        return tmpdir, session_factory(), engine

    def _seed_exam(self, db, tmpdir=None, *, clinic_id=8, tipo_exame="ECG", pdf=True):
        atendimento_item = AtendimentoClinico(
            paciente_id=182,
            tutor_id=44,
            clinica_id=clinic_id,
            veterinario_id=77,
            especie="Canina",
            data_atendimento=datetime(2026, 7, 5, 9, 30),
            status="Concluido",
            criado_por_id=77,
            criado_por_nome="Vet Teste",
        )
        db.add(atendimento_item)
        db.flush()

        exame = Exame(
            atendimento_id=atendimento_item.id,
            paciente_id=atendimento_item.paciente_id,
            tipo_exame=tipo_exame,
            categoria_exame="",
            prioridade="Rotina",
            status="Concluido",
            data_solicitacao=datetime(2026, 7, 5, 9, 30),
            data_resultado=datetime(2026, 7, 5, 10, 0),
            observacoes="ECG concluido.",
        )
        db.add(exame)
        db.flush()

        if pdf:
            # achado #20 da auditoria: liberar no portal agora exige que o
            # anexo tenha uma fonte de download REAL (attachment_has_download_source),
            # nao so metadado batendo com "parece PDF" - o arquivo precisa
            # existir de fato no caminho declarado.
            caminho_arquivo = str(Path(tmpdir.name) / "ecg-luke.pdf") if tmpdir else "/tmp/ecg-luke.pdf"
            if tmpdir:
                Path(caminho_arquivo).write_bytes(b"%PDF-1.4 fake pdf content for test")
            db.add(
                AnexoAtendimento(
                    atendimento_id=atendimento_item.id,
                    exame_id=exame.id,
                    tipo="resultado_exame",
                    descricao="PDF do resultado",
                    url="/api/v1/atendimentos/anexos/1/arquivo",
                    nome_original="ecg-luke.pdf",
                    tamanho=1024,
                    mime_type="application/pdf",
                    caminho_arquivo=caminho_arquivo,
                    origem="upload",
                )
            )
        db.commit()
        return atendimento_item, exame

    def test_liberar_ecg_importado_normaliza_tipo_e_publica_exame(self) -> None:
        tmpdir, db, engine = self._build_session()
        try:
            _, exame = self._seed_exam(db, tmpdir, tipo_exame="ECG", pdf=True)
            user = SimpleNamespace(id=99, nome="Dr Teste")

            # A auditoria abre sessao propria contra o banco real; manter o teste
            # hermetico ao banco temporario.
            with patch.object(atendimento, "_auditar_transicao_exame_portal") as auditoria_mock:
                payload = atendimento.liberar_exame_no_portal(
                    exame_id=exame.id,
                    db=db,
                    current_user=user,
                )

            self.assertEqual(payload["status"], PORTAL_RELEASED_STATUS)
            self.assertEqual(payload["exame"]["tipo_exame"], "Eletrocardiograma")
            self.assertEqual(payload["exame"]["categoria_exame"], "Cardiologia")
            self.assertEqual(len(payload["exame"]["anexos_resultado"]), 1)
            self.assertEqual(auditoria_mock.call_count, 1)
            self.assertEqual(auditoria_mock.call_args.kwargs["acao"], "LIBERAR_EXAME_PORTAL")

            db.refresh(exame)
            self.assertEqual(exame.status, PORTAL_RELEASED_STATUS)
            self.assertEqual(exame.tipo_exame, "Eletrocardiograma")
            self.assertEqual(exame.observacoes, atendimento.PORTAL_EXAME_RELEASE_MESSAGE)
        finally:
            db.close()
            engine.dispose()
            tmpdir.cleanup()

    def test_liberar_exame_sem_pdf_e_bloqueado(self) -> None:
        tmpdir, db, engine = self._build_session()
        try:
            _, exame = self._seed_exam(db, tipo_exame="Eletrocardiograma", pdf=False)

            with self.assertRaises(HTTPException) as ctx:
                atendimento.liberar_exame_no_portal(
                    exame_id=exame.id,
                    db=db,
                    current_user=SimpleNamespace(id=99, nome="Dr Teste"),
                )

            self.assertEqual(ctx.exception.status_code, 422)
            self.assertIn("PDF", str(ctx.exception.detail))
            db.refresh(exame)
            self.assertNotEqual(exame.status, PORTAL_RELEASED_STATUS)
        finally:
            db.close()
            engine.dispose()
            tmpdir.cleanup()
