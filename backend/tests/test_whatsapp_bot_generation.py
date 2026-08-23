import os
import sys
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock, patch

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

BACKEND_DIR = Path(__file__).resolve().parents[1]
os.chdir(BACKEND_DIR)
sys.path.insert(0, str(BACKEND_DIR))

os.environ.setdefault("DATABASE_URL", "sqlite:///./fortcordis.db")
os.environ.setdefault("SECRET_KEY", "whatsapp-bot-generation-test-secret-key-1234567890")

from app.models.agendamento import Agendamento
from app.models.assistente_ia import AssistenteIAConhecimentoDocumento
from app.models.atendimento_clinico import AtendimentoClinico
from app.models.clinica import Clinica
from app.models.configuracao import Configuracao
from app.models.laudo import Exame, Laudo
from app.models.ordem_servico import OrdemServico
from app.models.paciente import Paciente
from app.models.servico import Servico
from app.models.tutor import Tutor
from app.models.whatsapp_bot import WhatsAppBotResposta
from app.schemas.whatsapp_bot import WhatsAppBotReplyOutput
from app.services import whatsapp_bot_generation as generation
from app.services.whatsapp_bot_providers import GeneratedReply, WhatsAppBotProviderError


def fake_provider(*, texto, intent, fontes=None, precisa_humano=False):
    """Provider FAKE, sem rede - padrao do ai-echo (SimpleNamespace + Mock)."""
    reply = GeneratedReply(
        output=WhatsAppBotReplyOutput(
            texto=texto, intent=intent, fontes=fontes or [], precisa_humano=precisa_humano
        ),
        model="fake-model",
        input_tokens=120,
        output_tokens=40,
    )
    return SimpleNamespace(generate=Mock(return_value=reply))


class WhatsAppBotGenerationTest(unittest.TestCase):
    def _factory(self, tmpdir: str):
        db_path = Path(tmpdir) / "whatsapp-bot-generation-test.db"
        engine = create_engine(f"sqlite:///{db_path}")
        for table in (
            Configuracao.__table__,
            Servico.__table__,
            Clinica.__table__,
            Tutor.__table__,
            Paciente.__table__,
            Agendamento.__table__,
            OrdemServico.__table__,
            Laudo.__table__,
            Exame.__table__,
            AtendimentoClinico.__table__,
            AssistenteIAConhecimentoDocumento.__table__,
            WhatsAppBotResposta.__table__,
        ):
            table.create(engine, checkfirst=True)
        return sessionmaker(bind=engine, autocommit=False, autoflush=False), engine

    def _seed_tutor(self, db, *, whatsapp="5585999990001"):
        db.add(Configuracao(cidade="Fortaleza", endereco="Rua Teste, 100", telefone="8533334444"))
        db.add(Servico(nome="Ecocardiograma", ativo=True, preco_fortaleza_comercial=420))
        tutor = Tutor(nome="Maria", whatsapp=whatsapp, ativo=1)
        db.add(tutor)
        db.commit()
        db.add(Paciente(nome="Thor", tutor_id=tutor.id, ativo=1))
        db.commit()
        return tutor

    # --- caminhos que NAO chamam o provider ------------------------------

    def test_identidade_nao_resolvida_nao_chama_provider(self) -> None:
        """RF-016/CA-013: sem identidade, nenhum dado e nenhuma geracao."""
        with tempfile.TemporaryDirectory() as tmpdir:
            Factory, engine = self._factory(tmpdir)
            try:
                db = Factory()
                try:
                    provider = SimpleNamespace(
                        generate=Mock(side_effect=AssertionError("provider nao deve ser chamado"))
                    )
                    resultado = generation.gerar_resposta(
                        db,
                        wa_identity="5585900000000",
                        corpo_mensagem="qual o horario?",
                        modo="suggest",
                        provider=provider,
                    )
                finally:
                    db.close()

                self.assertEqual(resultado.decisao, "handoff")
                self.assertEqual(resultado.motivo, "identidade_nao_resolvida")
                provider.generate.assert_not_called()
            finally:
                engine.dispose()

    def test_teto_diario_suprime_antes_de_gastar_token(self) -> None:
        """RF-025/CA-017."""
        with tempfile.TemporaryDirectory() as tmpdir:
            Factory, engine = self._factory(tmpdir)
            try:
                db = Factory()
                try:
                    self._seed_tutor(db)
                    for i in range(3):
                        db.add(
                            WhatsAppBotResposta(
                                job_id=i + 1,
                                wa_identity="5585999990001",
                                conversation_id="conv-1",
                                decisao="sent",
                                motivo="ok",
                            )
                        )
                    db.commit()

                    provider = SimpleNamespace(
                        generate=Mock(side_effect=AssertionError("provider nao deve ser chamado"))
                    )
                    with patch.object(
                        generation.settings, "WHATSAPP_BOT_MAX_REPLIES_PER_CONVERSATION_DAY", 3
                    ):
                        resultado = generation.gerar_resposta(
                            db,
                            wa_identity="5585999990001",
                            corpo_mensagem="qual o horario?",
                            modo="auto",
                            provider=provider,
                        )
                finally:
                    db.close()

                self.assertEqual(resultado.decisao, "suppressed")
                self.assertEqual(resultado.motivo, "teto_diario")
                provider.generate.assert_not_called()
            finally:
                engine.dispose()

    def test_rascunho_nao_consome_teto_diario(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            Factory, engine = self._factory(tmpdir)
            try:
                db = Factory()
                try:
                    self._seed_tutor(db)
                    for i in range(5):
                        db.add(
                            WhatsAppBotResposta(
                                job_id=i + 1,
                                wa_identity="5585999990001",
                                conversation_id="conv-1",
                                decisao="draft",
                                motivo="modo_suggest",
                            )
                        )
                    db.commit()
                    contagem = generation.contar_respostas_do_dia(db, "5585999990001")
                finally:
                    db.close()
                self.assertEqual(contagem, 0)
            finally:
                engine.dispose()

    # --- guardrails no caminho completo ----------------------------------

    def test_conteudo_clinico_gerado_vira_blocked_com_motivo(self) -> None:
        """CA-015: bloqueio nunca vira silencio."""
        with tempfile.TemporaryDirectory() as tmpdir:
            Factory, engine = self._factory(tmpdir)
            try:
                db = Factory()
                try:
                    self._seed_tutor(db)
                    provider = fake_provider(
                        texto="Pelo que voce descreve, seu pet tem insuficiencia cardiaca.",
                        intent="horario_funcionamento",
                    )
                    resultado = generation.gerar_resposta(
                        db,
                        wa_identity="5585999990001",
                        corpo_mensagem="ele tossiu, e serio?",
                        modo="auto",
                        provider=provider,
                    )
                finally:
                    db.close()

                self.assertEqual(resultado.decisao, "blocked")
                self.assertEqual(resultado.motivo, "diagnostico")
                # O texto gerado fica registrado para auditoria, mas nao e enviado.
                self.assertIn("insuficiencia cardiaca", resultado.texto_gerado)
                self.assertEqual(resultado.modelo, "fake-model")
                self.assertIsNotNone(resultado.prompt_version)
            finally:
                engine.dispose()

    def test_intent_fora_da_allowlist_em_auto_vira_blocked(self) -> None:
        """CA-014/CA-024."""
        with tempfile.TemporaryDirectory() as tmpdir:
            Factory, engine = self._factory(tmpdir)
            try:
                db = Factory()
                try:
                    self._seed_tutor(db)
                    provider = fake_provider(
                        texto="Sobre a cobranca, a equipe vai te responder.",
                        intent="cobranca",
                    )
                    resultado = generation.gerar_resposta(
                        db,
                        wa_identity="5585999990001",
                        corpo_mensagem="tenho valor em aberto?",
                        modo="auto",
                        provider=provider,
                    )
                finally:
                    db.close()

                self.assertEqual(resultado.decisao, "blocked")
                self.assertEqual(resultado.motivo, "intent_fora_allowlist")
            finally:
                engine.dispose()

    def test_resposta_aprovada_em_suggest_vira_rascunho_sem_envio(self) -> None:
        """Critério de conclusao da Fase 4."""
        with tempfile.TemporaryDirectory() as tmpdir:
            Factory, engine = self._factory(tmpdir)
            try:
                db = Factory()
                try:
                    self._seed_tutor(db)
                    provider = fake_provider(
                        texto=(
                            "Somos o atendimento automatico da FortCordis. "
                            "Se precisar de uma pessoa, e so pedir."
                        ),
                        intent="formas_contato",
                    )
                    resultado = generation.gerar_resposta(
                        db,
                        wa_identity="5585999990001",
                        corpo_mensagem="como falo com voces?",
                        modo="suggest",
                        provider=provider,
                    )
                finally:
                    db.close()

                self.assertEqual(resultado.decisao, "draft")
                self.assertEqual(resultado.motivo, "modo_suggest")
                self.assertIsNone(resultado.texto_enviado)
                self.assertEqual(resultado.match_type, "tutor")
                self.assertEqual(resultado.resolution, "matched")
                self.assertEqual(resultado.input_tokens, 120)
                self.assertEqual(resultado.output_tokens, 40)
                self.assertIsNotNone(resultado.latencia_ms)
            finally:
                engine.dispose()

    def test_aprovada_em_auto_ainda_nao_envia_nesta_fase(self) -> None:
        """RF-027 depende de mudanca no servico Node - envio e Fase 6."""
        with tempfile.TemporaryDirectory() as tmpdir:
            Factory, engine = self._factory(tmpdir)
            try:
                db = Factory()
                try:
                    self._seed_tutor(db)
                    provider = fake_provider(
                        texto="Atendimento automatico: para falar com alguem, e so pedir.",
                        intent="formas_contato",
                    )
                    resultado = generation.gerar_resposta(
                        db,
                        wa_identity="5585999990001",
                        corpo_mensagem="como falo com voces?",
                        modo="auto",
                        provider=provider,
                    )
                finally:
                    db.close()

                self.assertEqual(resultado.decisao, "draft")
                self.assertEqual(resultado.motivo, "aprovado_aguardando_envio_fase6")
                self.assertIsNone(resultado.texto_enviado)
            finally:
                engine.dispose()

    def test_modelo_pedindo_humano_vira_handoff(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            Factory, engine = self._factory(tmpdir)
            try:
                db = Factory()
                try:
                    self._seed_tutor(db)
                    provider = fake_provider(
                        texto="Vou passar para a equipe te ajudar.",
                        intent="formas_contato",
                        precisa_humano=True,
                    )
                    resultado = generation.gerar_resposta(
                        db,
                        wa_identity="5585999990001",
                        corpo_mensagem="preciso de ajuda",
                        modo="auto",
                        provider=provider,
                    )
                finally:
                    db.close()

                self.assertEqual(resultado.decisao, "handoff")
                self.assertEqual(resultado.motivo, "modelo_pediu_humano")
            finally:
                engine.dispose()

    def test_falha_do_provider_vira_handoff_nao_erro(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            Factory, engine = self._factory(tmpdir)
            try:
                db = Factory()
                try:
                    self._seed_tutor(db)
                    provider = SimpleNamespace(
                        generate=Mock(
                            side_effect=WhatsAppBotProviderError("timeout", code="provider_timeout")
                        )
                    )
                    resultado = generation.gerar_resposta(
                        db,
                        wa_identity="5585999990001",
                        corpo_mensagem="qual o horario?",
                        modo="auto",
                        provider=provider,
                    )
                finally:
                    db.close()

                self.assertEqual(resultado.decisao, "handoff")
                self.assertEqual(resultado.motivo, "provider:provider_timeout")
            finally:
                engine.dispose()

    def test_contexto_do_prompt_nao_carrega_ordem_de_servico(self) -> None:
        """CA-024: OS/valor/cobranca nao entram no prompt nem por contexto."""
        with tempfile.TemporaryDirectory() as tmpdir:
            Factory, engine = self._factory(tmpdir)
            try:
                db = Factory()
                try:
                    self._seed_tutor(db)
                    provider = fake_provider(
                        texto="Atendimento automatico da FortCordis.", intent="formas_contato"
                    )
                    generation.gerar_resposta(
                        db,
                        wa_identity="5585999990001",
                        corpo_mensagem="oi",
                        modo="suggest",
                        provider=provider,
                    )
                finally:
                    db.close()

                payload = provider.generate.call_args.kwargs["payload"]
                texto_payload = str(payload).lower()
                for proibido in ("numero_os", "valor_final", "ordens_servico"):
                    self.assertNotIn(proibido, texto_payload, proibido)
            finally:
                engine.dispose()


if __name__ == "__main__":
    unittest.main()
