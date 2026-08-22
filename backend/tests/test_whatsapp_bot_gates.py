import os
import sys
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import patch

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

BACKEND_DIR = Path(__file__).resolve().parents[1]
os.chdir(BACKEND_DIR)
sys.path.insert(0, str(BACKEND_DIR))

os.environ.setdefault("DATABASE_URL", "sqlite:///./fortcordis.db")
os.environ.setdefault("SECRET_KEY", "whatsapp-bot-gates-test-secret-key-1234567890")

from app.models.configuracao import Configuracao
from app.models.whatsapp_bot import WhatsAppBotConversaEstado
from app.services import whatsapp_bot_gates as gates


class WhatsAppBotGatesTest(unittest.TestCase):
    def _build_session_factory(self, tmpdir: str):
        db_path = Path(tmpdir) / "whatsapp-bot-gates-test.db"
        engine = create_engine(f"sqlite:///{db_path}")
        Configuracao.__table__.create(engine, checkfirst=True)
        WhatsAppBotConversaEstado.__table__.create(engine, checkfirst=True)
        return sessionmaker(bind=engine, autocommit=False, autoflush=False), engine

    # --- RF-008 -------------------------------------------------------

    def test_is_whatsapp_bot_enabled_exige_env_e_banco(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            SessionFactory, engine = self._build_session_factory(tmpdir)
            try:
                with patch.object(gates, "SessionLocal", SessionFactory):
                    with patch.object(gates.settings, "WHATSAPP_BOT_ENABLED", False):
                        self.assertFalse(gates.is_whatsapp_bot_enabled())

                    with patch.object(gates.settings, "WHATSAPP_BOT_ENABLED", True):
                        self.assertFalse(gates.is_whatsapp_bot_enabled())

                        db = SessionFactory()
                        try:
                            db.add(Configuracao(whatsapp_bot_atendimento_habilitado=True))
                            db.commit()
                        finally:
                            db.close()

                        self.assertTrue(gates.is_whatsapp_bot_enabled())
            finally:
                engine.dispose()

    # --- RF-009 ---------------------------------------------------------

    def test_resolve_conversation_mode_sem_estado_usa_default_institucional(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            SessionFactory, engine = self._build_session_factory(tmpdir)
            try:
                db = SessionFactory()
                try:
                    db.add(Configuracao(whatsapp_bot_modo="auto"))
                    db.commit()
                    self.assertEqual(gates.resolve_conversation_mode(db, "558588018899"), "auto")
                finally:
                    db.close()
            finally:
                engine.dispose()

    def test_resolve_conversation_mode_sem_configuracao_usa_suggest(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            SessionFactory, engine = self._build_session_factory(tmpdir)
            try:
                db = SessionFactory()
                try:
                    self.assertEqual(gates.resolve_conversation_mode(db, "558588018899"), "suggest")
                finally:
                    db.close()
            finally:
                engine.dispose()

    def test_resolve_conversation_mode_com_estado_por_conversa_sobrepoe_default(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            SessionFactory, engine = self._build_session_factory(tmpdir)
            try:
                db = SessionFactory()
                try:
                    db.add(Configuracao(whatsapp_bot_modo="suggest"))
                    db.add(WhatsAppBotConversaEstado(wa_identity="558588018899", modo="off"))
                    db.commit()
                    self.assertEqual(gates.resolve_conversation_mode(db, "558588018899"), "off")
                finally:
                    db.close()
            finally:
                engine.dispose()

    # --- RF-010 ---------------------------------------------------------

    def test_is_locally_paused(self) -> None:
        now = datetime.now(timezone.utc)
        self.assertFalse(gates.is_locally_paused(None, now=now))
        estado_sem_pausa = WhatsAppBotConversaEstado(wa_identity="x", pausado_ate=None)
        self.assertFalse(gates.is_locally_paused(estado_sem_pausa, now=now))
        estado_pausado = WhatsAppBotConversaEstado(wa_identity="x", pausado_ate=now + timedelta(hours=1))
        self.assertTrue(gates.is_locally_paused(estado_pausado, now=now))
        estado_expirado = WhatsAppBotConversaEstado(wa_identity="x", pausado_ate=now - timedelta(minutes=1))
        self.assertFalse(gates.is_locally_paused(estado_expirado, now=now))

    def test_pause_conversation_cria_estado_e_usa_pause_hours_configurado(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            SessionFactory, engine = self._build_session_factory(tmpdir)
            try:
                db = SessionFactory()
                try:
                    now = datetime.now(timezone.utc)
                    with patch.object(gates.settings, "WHATSAPP_BOT_HANDOFF_PAUSE_HOURS", 6):
                        gates.pause_conversation(db, "558588018899", now=now)
                    db.commit()

                    estado = gates.resolve_conversation_state(db, "558588018899")
                    self.assertIsNotNone(estado)
                    pausado_ate = estado.pausado_ate.replace(tzinfo=timezone.utc)
                    self.assertAlmostEqual(pausado_ate.timestamp(), (now + timedelta(hours=6)).timestamp(), delta=1)
                finally:
                    db.close()
            finally:
                engine.dispose()

    # --- RF-012 -----------------------------------------------------------

    def test_customer_service_window(self) -> None:
        now = datetime.now(timezone.utc)
        self.assertFalse(gates.is_customer_service_window_open(None, now=now))
        self.assertTrue(gates.is_customer_service_window_open(now - timedelta(hours=1), now=now))
        self.assertTrue(gates.is_customer_service_window_open(now - timedelta(hours=23, minutes=59), now=now))
        self.assertFalse(gates.is_customer_service_window_open(now - timedelta(hours=24, minutes=1), now=now))

    # --- RF-013 -----------------------------------------------------------

    def test_is_supported_message_type(self) -> None:
        self.assertTrue(gates.is_supported_message_type("text"))
        self.assertTrue(gates.is_supported_message_type("Text"))
        self.assertTrue(gates.is_supported_message_type(None))
        for tipo in ("audio", "image", "document", "sticker", "reaction", "interactive", "button"):
            self.assertFalse(gates.is_supported_message_type(tipo), tipo)

    # --- RF-011/RF-023: vocabulario -----------------------------------

    def test_detecta_pedido_humano(self) -> None:
        self.assertTrue(gates.detecta_pedido_humano("Quero falar com um atendente, por favor"))
        self.assertTrue(gates.detecta_pedido_humano("VOCÊ É UM ROBÔ?"))
        self.assertFalse(gates.detecta_pedido_humano("Qual o horário de funcionamento?"))
        self.assertFalse(gates.detecta_pedido_humano(""))

    def test_detecta_emergencia(self) -> None:
        self.assertTrue(gates.detecta_emergencia("Meu cachorro não está respirando!"))
        self.assertTrue(gates.detecta_emergencia("ele convulsionou agora"))
        self.assertFalse(gates.detecta_emergencia("queria marcar uma consulta de rotina"))
        self.assertFalse(gates.detecta_emergencia(""))


if __name__ == "__main__":
    unittest.main()
