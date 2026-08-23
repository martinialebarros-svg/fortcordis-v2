import os
import sys
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import patch
from zoneinfo import ZoneInfo

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

BACKEND_DIR = Path(__file__).resolve().parents[1]
os.chdir(BACKEND_DIR)
sys.path.insert(0, str(BACKEND_DIR))

os.environ.setdefault("DATABASE_URL", "sqlite:///./fortcordis.db")
os.environ.setdefault("SECRET_KEY", "whatsapp-bot-tools-test-secret-key-1234567890")

from app.core.portal_release import PORTAL_RELEASED_STATUS
from app.models.atendimento_clinico import AtendimentoClinico
from app.models.clinica import Clinica
from app.models.configuracao import Configuracao
from app.models.laudo import Exame, Laudo
from app.models.paciente import Paciente
from app.models.servico import Servico
from app.models.tutor import Tutor
from app.services import whatsapp_bot_tools as tools

LOCAL_TZ = ZoneInfo("America/Fortaleza")


class WhatsAppBotToolContextTest(unittest.TestCase):
    """Escopo que pode ser None e escopo que vaza."""

    def test_persona_tutor_exige_tutor_id(self) -> None:
        with self.assertRaises(tools.WhatsAppBotToolError):
            tools.WhatsAppBotToolContext(db=None, match_type="tutor", tutor_id=None)

    def test_persona_clinica_exige_clinica_id(self) -> None:
        with self.assertRaises(tools.WhatsAppBotToolError):
            tools.WhatsAppBotToolContext(db=None, match_type="clinica", clinica_id=None)

    def test_escopo_cruzado_e_recusado(self) -> None:
        with self.assertRaises(tools.WhatsAppBotToolError):
            tools.WhatsAppBotToolContext(
                db=None, match_type="tutor", tutor_id=1, clinica_id=2
            )
        with self.assertRaises(tools.WhatsAppBotToolError):
            tools.WhatsAppBotToolContext(
                db=None, match_type="clinica", clinica_id=2, tutor_id=1
            )

    def test_match_type_invalido_e_recusado(self) -> None:
        with self.assertRaises(tools.WhatsAppBotToolError):
            tools.WhatsAppBotToolContext(db=None, match_type="staff", tutor_id=1)


class WhatsAppBotDispatcherTest(unittest.TestCase):
    def test_nome_fora_da_allowlist_falha_fechado(self) -> None:
        ctx = tools.WhatsAppBotToolContext(db=None, match_type="tutor", tutor_id=1)
        resultado = tools.execute_bot_tool(ctx, "relatorio_debitos_pendentes")
        self.assertFalse(resultado["ok"])
        self.assertIn("nao disponivel", resultado["error"])

    def test_dispatcher_descarta_argumento_nao_previsto(self) -> None:
        """Escopo nunca pode chegar como argumento do modelo."""
        ctx = tools.WhatsAppBotToolContext(db=None, match_type="tutor", tutor_id=1)
        with patch.object(tools, "consultar_dados_institucionais", return_value={"ok": True}) as mock:
            tools.TOOLS_POR_PERSONA["tutor"]["consultar_dados_institucionais"] = mock
            try:
                tools.execute_bot_tool(
                    ctx, "consultar_dados_institucionais", {"tutor_id": 99, "clinica_id": 99}
                )
            finally:
                tools.TOOLS_POR_PERSONA["tutor"]["consultar_dados_institucionais"] = (
                    tools.consultar_dados_institucionais
                )
        mock.assert_called_once_with(ctx)


class WhatsAppBotToolsDbTest(unittest.TestCase):
    def _factory(self, tmpdir: str):
        db_path = Path(tmpdir) / "whatsapp-bot-tools-test.db"
        engine = create_engine(f"sqlite:///{db_path}")
        for table in (
            Configuracao.__table__,
            Servico.__table__,
            Clinica.__table__,
            Tutor.__table__,
            Paciente.__table__,
            Laudo.__table__,
            Exame.__table__,
            AtendimentoClinico.__table__,
        ):
            table.create(engine, checkfirst=True)
        return sessionmaker(bind=engine, autocommit=False, autoflush=False), engine

    # --- dados institucionais --------------------------------------------

    def test_cadastro_institucional_vazio_falha_fechado(self) -> None:
        """Regressao medida em stage (2026-08-23).

        Existia linha de `Configuracao` com endereco, telefone e e-mail
        vazios, e a tool devolvia `ok=True`. Isso dava fonte valida sem dado:
        a prontidao ficava verde e a RF-020 aceitava o turno como ancorado.
        """
        with tempfile.TemporaryDirectory() as tmpdir:
            Factory, engine = self._factory(tmpdir)
            try:
                db = Factory()
                try:
                    db.add(Configuracao(cidade="Fortaleza", estado="CE"))
                    db.commit()
                    ctx = tools.WhatsAppBotToolContext(db=db, match_type="tutor", tutor_id=1)
                    res = tools.consultar_dados_institucionais(ctx)
                    self.assertFalse(res["ok"])
                    self.assertFalse(res["tem_endereco"])
                    self.assertFalse(res["tem_contato"])
                    # Cidade/estado sozinhos nao sao endereco publicavel.
                    self.assertEqual(
                        sorted(res["campos_vazios"]), ["email", "endereco", "telefone"]
                    )
                finally:
                    db.close()
            finally:
                engine.dispose()

    def test_so_telefone_preenchido_habilita_contato_e_nao_endereco(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            Factory, engine = self._factory(tmpdir)
            try:
                db = Factory()
                try:
                    db.add(Configuracao(telefone="(85) 3333-4444"))
                    db.commit()
                    ctx = tools.WhatsAppBotToolContext(db=db, match_type="tutor", tutor_id=1)
                    res = tools.consultar_dados_institucionais(ctx)
                    self.assertTrue(res["ok"])
                    self.assertTrue(res["tem_contato"])
                    self.assertFalse(res["tem_endereco"])
                    self.assertIsNone(res["endereco"])
                finally:
                    db.close()
            finally:
                engine.dispose()

    def test_espaco_em_branco_nao_conta_como_dado(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            Factory, engine = self._factory(tmpdir)
            try:
                db = Factory()
                try:
                    db.add(Configuracao(endereco="   ", telefone="\t"))
                    db.commit()
                    ctx = tools.WhatsAppBotToolContext(db=db, match_type="tutor", tutor_id=1)
                    res = tools.consultar_dados_institucionais(ctx)
                    self.assertFalse(res["ok"])
                finally:
                    db.close()
            finally:
                engine.dispose()

    # --- horario ---------------------------------------------------------

    def test_horario_em_dia_util_devolve_janela(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            Factory, engine = self._factory(tmpdir)
            try:
                db = Factory()
                try:
                    db.add(Configuracao())
                    db.commit()
                    ctx = tools.WhatsAppBotToolContext(db=db, match_type="tutor", tutor_id=1)
                    hoje = datetime.now(LOCAL_TZ).date()
                    # Proxima segunda-feira.
                    segunda = hoje + timedelta(days=(1 - hoje.isoweekday()) % 7)
                    res = tools.consultar_horario_funcionamento(ctx, data=segunda.isoformat())
                    self.assertTrue(res["ok"])
                    self.assertTrue(res["aberto"])
                    self.assertEqual(res["inicio"], "08:00")
                    self.assertEqual(res["fim"], "14:00")
                finally:
                    db.close()
            finally:
                engine.dispose()

    def test_horario_em_domingo_nao_devolve_horario(self) -> None:
        """Feriado/fechado herda a janela semanal em `_agenda_day_window`.

        Se o payload devolvesse `inicio`/`fim` nesse caso, o bot diria
        "hoje funcionamos de 08:00 as 14:00" num dia fechado.
        """
        with tempfile.TemporaryDirectory() as tmpdir:
            Factory, engine = self._factory(tmpdir)
            try:
                db = Factory()
                try:
                    db.add(Configuracao())
                    db.commit()
                    ctx = tools.WhatsAppBotToolContext(db=db, match_type="tutor", tutor_id=1)
                    hoje = datetime.now(LOCAL_TZ).date()
                    domingo = hoje + timedelta(days=(7 - hoje.isoweekday()) % 7)
                    res = tools.consultar_horario_funcionamento(ctx, data=domingo.isoformat())
                    self.assertTrue(res["ok"])
                    self.assertFalse(res["aberto"])
                    self.assertIsNone(res["inicio"])
                    self.assertIsNone(res["fim"])
                finally:
                    db.close()
            finally:
                engine.dispose()

    def test_data_fora_da_janela_consultavel_e_recusada(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            Factory, engine = self._factory(tmpdir)
            try:
                db = Factory()
                try:
                    ctx = tools.WhatsAppBotToolContext(db=db, match_type="tutor", tutor_id=1)
                    res = tools.consultar_horario_funcionamento(ctx, data="2029-01-01")
                    self.assertFalse(res["ok"])
                    res = tools.consultar_horario_funcionamento(ctx, data="nao-e-data")
                    self.assertFalse(res["ok"])
                finally:
                    db.close()
            finally:
                engine.dispose()

    # --- preco -----------------------------------------------------------

    def test_preco_tutor_usa_tabela_e_ignora_preco_negociado(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            Factory, engine = self._factory(tmpdir)
            try:
                db = Factory()
                try:
                    db.add(Configuracao(cidade="Fortaleza"))
                    db.add(
                        Servico(
                            nome="Ecocardiograma",
                            ativo=True,
                            preco_fortaleza_comercial=420,
                            preco_rm_comercial=480,
                        )
                    )
                    db.commit()
                    ctx = tools.WhatsAppBotToolContext(db=db, match_type="tutor", tutor_id=1)
                    res = tools.consultar_preco_tabela(ctx, servico_nome="eco")
                    self.assertTrue(res["ok"])
                    self.assertEqual(res["itens"][0]["valor"], "420.00")
                    self.assertEqual(res["itens"][0]["fonte"], "tabela:preco_fortaleza_comercial")
                finally:
                    db.close()
            finally:
                engine.dispose()

    def test_preco_zero_nao_entra_no_payload(self) -> None:
        """`to_decimal` do precos_service transforma NULL em 0.00 em silencio.

        "R$ 0,00" e um resultado alcancavel e nunca deve ser enviavel.
        """
        with tempfile.TemporaryDirectory() as tmpdir:
            Factory, engine = self._factory(tmpdir)
            try:
                db = Factory()
                try:
                    db.add(Servico(nome="Servico sem preco", ativo=True))
                    db.commit()
                    ctx = tools.WhatsAppBotToolContext(db=db, match_type="tutor", tutor_id=1)
                    res = tools.consultar_preco_tabela(ctx)
                    self.assertFalse(res["ok"])
                finally:
                    db.close()
            finally:
                engine.dispose()

    def test_preco_nao_aceita_parametro_de_clinica(self) -> None:
        """Vazamento de preco negociado impossivel por construcao."""
        import inspect

        assinatura = inspect.signature(tools.consultar_preco_tabela)
        self.assertNotIn("clinica_id", assinatura.parameters)
        self.assertNotIn("clinica_nome", assinatura.parameters)

    # --- status de laudo -------------------------------------------------

    def _seed_laudo(self, db, *, tutor_nome, pet_nome, laudo_status, exame_status, clinica_id=None):
        tutor = Tutor(nome=tutor_nome, ativo=1)
        db.add(tutor)
        db.commit()
        pet = Paciente(nome=pet_nome, tutor_id=tutor.id, ativo=1)
        db.add(pet)
        db.commit()
        laudo = Laudo(
            paciente_id=pet.id,
            veterinario_id=1,
            tipo="exame",
            titulo="Eco",
            status=laudo_status,
            clinic_id=clinica_id,
        )
        db.add(laudo)
        db.commit()
        exame = Exame(
            paciente_id=pet.id,
            laudo_id=laudo.id,
            tipo_exame="Ecocardiograma",
            status=exame_status,
        )
        db.add(exame)
        db.commit()
        return tutor, pet, laudo, exame

    def test_laudo_finalizado_nao_e_pronto(self) -> None:
        """"Finalizado" e aguardando_liberacao, nao publicado."""
        with tempfile.TemporaryDirectory() as tmpdir:
            Factory, engine = self._factory(tmpdir)
            try:
                db = Factory()
                try:
                    tutor, _, _, _ = self._seed_laudo(
                        db, tutor_nome="Maria", pet_nome="Thor",
                        laudo_status="Finalizado", exame_status="Concluido",
                    )
                    ctx = tools.WhatsAppBotToolContext(db=db, match_type="tutor", tutor_id=tutor.id)
                    res = tools.consultar_status_laudo(ctx)
                    self.assertTrue(res["ok"])
                    self.assertEqual(res["itens"][0]["status_cliente"], "ainda_nao")
                finally:
                    db.close()
            finally:
                engine.dispose()

    def test_laudo_liberado_no_portal_e_pronto(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            Factory, engine = self._factory(tmpdir)
            try:
                db = Factory()
                try:
                    tutor, _, _, _ = self._seed_laudo(
                        db, tutor_nome="Maria", pet_nome="Thor",
                        laudo_status=PORTAL_RELEASED_STATUS, exame_status="Concluido",
                    )
                    ctx = tools.WhatsAppBotToolContext(db=db, match_type="tutor", tutor_id=tutor.id)
                    res = tools.consultar_status_laudo(ctx)
                    self.assertEqual(res["itens"][0]["status_cliente"], "pronto")
                finally:
                    db.close()
            finally:
                engine.dispose()

    def test_exame_liberado_sem_laudo_liberado_tambem_e_pronto(self) -> None:
        """A liberacao e por EXAME; o filtro do portal e um OR assimetrico."""
        with tempfile.TemporaryDirectory() as tmpdir:
            Factory, engine = self._factory(tmpdir)
            try:
                db = Factory()
                try:
                    tutor, _, _, _ = self._seed_laudo(
                        db, tutor_nome="Maria", pet_nome="Thor",
                        laudo_status="Rascunho", exame_status=PORTAL_RELEASED_STATUS,
                    )
                    ctx = tools.WhatsAppBotToolContext(db=db, match_type="tutor", tutor_id=tutor.id)
                    res = tools.consultar_status_laudo(ctx)
                    self.assertEqual(res["itens"][0]["status_cliente"], "pronto")
                finally:
                    db.close()
            finally:
                engine.dispose()

    def test_tutor_nao_ve_laudo_de_outro_tutor(self) -> None:
        """CA-023."""
        with tempfile.TemporaryDirectory() as tmpdir:
            Factory, engine = self._factory(tmpdir)
            try:
                db = Factory()
                try:
                    tutor_a, _, _, _ = self._seed_laudo(
                        db, tutor_nome="Maria", pet_nome="Thor",
                        laudo_status=PORTAL_RELEASED_STATUS, exame_status="Concluido",
                    )
                    self._seed_laudo(
                        db, tutor_nome="Joao", pet_nome="Rex",
                        laudo_status=PORTAL_RELEASED_STATUS, exame_status="Concluido",
                    )
                    ctx = tools.WhatsAppBotToolContext(db=db, match_type="tutor", tutor_id=tutor_a.id)
                    res = tools.consultar_status_laudo(ctx)
                    nomes = {item["pet_nome"] for item in res["itens"]}
                    self.assertEqual(nomes, {"Thor"})
                finally:
                    db.close()
            finally:
                engine.dispose()

    def test_clinica_nao_ve_laudo_de_outra_clinica(self) -> None:
        """CA-023, lado clinica (filtro por Laudo.clinic_id)."""
        with tempfile.TemporaryDirectory() as tmpdir:
            Factory, engine = self._factory(tmpdir)
            try:
                db = Factory()
                try:
                    self._seed_laudo(
                        db, tutor_nome="Maria", pet_nome="Thor",
                        laudo_status=PORTAL_RELEASED_STATUS, exame_status="Concluido",
                        clinica_id=10,
                    )
                    self._seed_laudo(
                        db, tutor_nome="Joao", pet_nome="Rex",
                        laudo_status=PORTAL_RELEASED_STATUS, exame_status="Concluido",
                        clinica_id=20,
                    )
                    ctx = tools.WhatsAppBotToolContext(db=db, match_type="clinica", clinica_id=10)
                    res = tools.consultar_status_laudo(ctx)
                    nomes = {item["pet_nome"] for item in res["itens"]}
                    self.assertEqual(nomes, {"Thor"})
                finally:
                    db.close()
            finally:
                engine.dispose()

    def test_payload_de_laudo_nao_carrega_campo_clinico(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            Factory, engine = self._factory(tmpdir)
            try:
                db = Factory()
                try:
                    tutor, pet, laudo, exame = self._seed_laudo(
                        db, tutor_nome="Maria", pet_nome="Thor",
                        laudo_status=PORTAL_RELEASED_STATUS, exame_status="Concluido",
                    )
                    laudo.diagnostico = "Endocardiose de valva mitral estagio B2"
                    laudo.descricao = "AE/Ao 2.1, DIVEdN 1.9"
                    exame.resultado = "refluxo mitral moderado"
                    db.commit()

                    ctx = tools.WhatsAppBotToolContext(db=db, match_type="tutor", tutor_id=tutor.id)
                    res = tools.consultar_status_laudo(ctx)
                    chaves = set(res["itens"][0].keys())
                    self.assertEqual(
                        chaves, {"tipo_exame", "pet_nome", "status_cliente", "data_solicitacao"}
                    )
                    texto = str(res).lower()
                    for proibido in ("endocardiose", "ae/ao", "divedn", "refluxo", "diagnostico"):
                        self.assertNotIn(proibido, texto, proibido)
                finally:
                    db.close()
            finally:
                engine.dispose()

    def test_pet_inativo_nao_entra(self) -> None:
        """Falar de pet inativo em resposta automatica e o pior erro possivel."""
        with tempfile.TemporaryDirectory() as tmpdir:
            Factory, engine = self._factory(tmpdir)
            try:
                db = Factory()
                try:
                    tutor, pet, _, _ = self._seed_laudo(
                        db, tutor_nome="Maria", pet_nome="Thor",
                        laudo_status=PORTAL_RELEASED_STATUS, exame_status="Concluido",
                    )
                    pet.ativo = 0
                    db.commit()
                    ctx = tools.WhatsAppBotToolContext(db=db, match_type="tutor", tutor_id=tutor.id)
                    res = tools.consultar_status_laudo(ctx)
                    self.assertFalse(res["ok"])
                finally:
                    db.close()
            finally:
                engine.dispose()

    def test_sem_registro_nao_afirma_ainda_nao(self) -> None:
        """Negar existencia de exame que pode existir em outro escopo seria
        afirmar algo sem fonte."""
        with tempfile.TemporaryDirectory() as tmpdir:
            Factory, engine = self._factory(tmpdir)
            try:
                db = Factory()
                try:
                    ctx = tools.WhatsAppBotToolContext(db=db, match_type="tutor", tutor_id=999)
                    res = tools.consultar_status_laudo(ctx)
                    self.assertFalse(res["ok"])
                finally:
                    db.close()
            finally:
                engine.dispose()


if __name__ == "__main__":
    unittest.main()
