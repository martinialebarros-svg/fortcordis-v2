import os
import sys
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path
from types import SimpleNamespace

from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

BACKEND_DIR = Path(__file__).resolve().parents[1]
os.chdir(BACKEND_DIR)
sys.path.insert(0, str(BACKEND_DIR))

os.environ.setdefault("DATABASE_URL", "sqlite:///./fortcordis.db")
os.environ.setdefault("SECRET_KEY", "whatsapp-bot-endpoints-test-secret-key-1234567890")

from app.api.v1.endpoints import whatsapp_bot
from app.models.configuracao import Configuracao
from app.models.whatsapp_bot import WhatsAppBotConversaEstado, WhatsAppBotJob, WhatsAppBotResposta


class WhatsAppBotEndpointsTest(unittest.TestCase):
    def _build_session_factory(self, tmpdir: str):
        db_path = Path(tmpdir) / "whatsapp-bot-endpoints-test.db"
        engine = create_engine(f"sqlite:///{db_path}")
        for table in (
            Configuracao.__table__,
            WhatsAppBotConversaEstado.__table__,
            WhatsAppBotJob.__table__,
            WhatsAppBotResposta.__table__,
        ):
            table.create(engine, checkfirst=True)
        return sessionmaker(bind=engine, autocommit=False, autoflush=False), engine

    def _user(self, user_id=1):
        return SimpleNamespace(id=user_id)

    def test_get_estado_sem_linha_usa_default_institucional(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            SessionFactory, engine = self._build_session_factory(tmpdir)
            try:
                db = SessionFactory()
                try:
                    db.add(Configuracao(whatsapp_bot_modo="auto"))
                    db.commit()
                    resposta = whatsapp_bot.get_conversa_estado("558588018899", db=db, current_user=self._user())
                finally:
                    db.close()

                self.assertEqual(resposta["modo"], "auto")
                self.assertEqual(resposta["modo_origem"], "institucional")
                self.assertIsNone(resposta["pausado_ate"])
                self.assertFalse(resposta["pausado"])
                self.assertIsNone(resposta["rascunho_pendente"])
            finally:
                engine.dispose()

    def test_patch_estado_altera_modo_da_conversa(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            SessionFactory, engine = self._build_session_factory(tmpdir)
            try:
                db = SessionFactory()
                try:
                    resposta = whatsapp_bot.atualizar_conversa_estado(
                        "558588018899",
                        whatsapp_bot.WhatsAppBotConversaEstadoUpdateRequest(modo="auto"),
                        db=db,
                        current_user=self._user(42),
                    )
                finally:
                    db.close()

                self.assertEqual(resposta["modo"], "auto")
                self.assertEqual(resposta["modo_origem"], "conversa")

                verify = SessionFactory()
                try:
                    estado = (
                        verify.query(WhatsAppBotConversaEstado)
                        .filter(WhatsAppBotConversaEstado.wa_identity == "558588018899")
                        .first()
                    )
                    self.assertEqual(estado.modo, "auto")
                    self.assertEqual(estado.atualizado_por_id, 42)
                finally:
                    verify.close()
            finally:
                engine.dispose()

    def test_patch_estado_modo_invalido_e_422(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            SessionFactory, engine = self._build_session_factory(tmpdir)
            try:
                db = SessionFactory()
                try:
                    with self.assertRaises(HTTPException) as ctx:
                        whatsapp_bot.atualizar_conversa_estado(
                            "558588018899",
                            whatsapp_bot.WhatsAppBotConversaEstadoUpdateRequest(modo="invalido"),
                            db=db,
                            current_user=self._user(),
                        )
                    self.assertEqual(ctx.exception.status_code, 422)
                finally:
                    db.close()
            finally:
                engine.dispose()

    def test_patch_estado_pausar_e_despausar(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            SessionFactory, engine = self._build_session_factory(tmpdir)
            try:
                db = SessionFactory()
                try:
                    pausado = whatsapp_bot.atualizar_conversa_estado(
                        "558588018899",
                        whatsapp_bot.WhatsAppBotConversaEstadoUpdateRequest(pausar=True),
                        db=db,
                        current_user=self._user(),
                    )
                    self.assertTrue(pausado["pausado"])
                    self.assertIsNotNone(pausado["pausado_ate"])

                    despausado = whatsapp_bot.atualizar_conversa_estado(
                        "558588018899",
                        whatsapp_bot.WhatsAppBotConversaEstadoUpdateRequest(pausar=False),
                        db=db,
                        current_user=self._user(),
                    )
                    self.assertFalse(despausado["pausado"])
                    self.assertIsNone(despausado["pausado_ate"])
                finally:
                    db.close()
            finally:
                engine.dispose()

    def test_get_estado_expoe_rascunho_pendente(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            SessionFactory, engine = self._build_session_factory(tmpdir)
            try:
                db = SessionFactory()
                try:
                    job = WhatsAppBotJob(
                        wa_identity="558588018899",
                        conversation_id="conv-1",
                        wa_message_id="wamid.1",
                        status="done",
                        scheduled_for=datetime.now(timezone.utc),
                    )
                    db.add(job)
                    db.commit()
                    db.add(
                        WhatsAppBotResposta(
                            job_id=job.id,
                            wa_identity="558588018899",
                            conversation_id="conv-1",
                            decisao="draft",
                            motivo="intent_fora_da_allowlist",
                            texto_gerado="Ola! posso ajudar?",
                        )
                    )
                    db.commit()

                    resposta = whatsapp_bot.get_conversa_estado("558588018899", db=db, current_user=self._user())
                finally:
                    db.close()

                self.assertIsNotNone(resposta["rascunho_pendente"])
                self.assertEqual(resposta["rascunho_pendente"]["texto_gerado"], "Ola! posso ajudar?")
            finally:
                engine.dispose()

    def test_preview_nao_altera_nada_e_conta_por_status_e_decisao(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            SessionFactory, engine = self._build_session_factory(tmpdir)
            try:
                db = SessionFactory()
                try:
                    db.add(Configuracao(whatsapp_bot_atendimento_habilitado=True, whatsapp_bot_modo="suggest"))
                    db.add(
                        WhatsAppBotJob(
                            wa_identity="a", conversation_id="c1", wa_message_id="m1",
                            status="pending", scheduled_for=datetime.now(timezone.utc),
                        )
                    )
                    db.add(
                        WhatsAppBotJob(
                            wa_identity="b", conversation_id="c2", wa_message_id="m2",
                            status="done", scheduled_for=datetime.now(timezone.utc),
                        )
                    )
                    db.commit()
                    job_done = db.query(WhatsAppBotJob).filter(WhatsAppBotJob.wa_message_id == "m2").first()
                    db.add(
                        WhatsAppBotResposta(
                            job_id=job_done.id, wa_identity="b", conversation_id="c2", decisao="suppressed",
                            motivo="janela_fechada",
                        )
                    )
                    db.commit()

                    resposta = whatsapp_bot.preview_whatsapp_bot(db=db, current_user=self._user())
                finally:
                    db.close()

                self.assertEqual(resposta["jobs_por_status"], {"pending": 1, "done": 1})
                self.assertEqual(resposta["respostas_por_decisao"], {"suppressed": 1})
                self.assertTrue(resposta["whatsapp_bot_atendimento_habilitado_banco"])
                self.assertEqual(resposta["whatsapp_bot_modo_institucional"], "suggest")

                verify = SessionFactory()
                try:
                    self.assertEqual(verify.query(WhatsAppBotJob).count(), 2)
                    self.assertEqual(verify.query(WhatsAppBotResposta).count(), 1)
                finally:
                    verify.close()
            finally:
                engine.dispose()


if __name__ == "__main__":
    unittest.main()
