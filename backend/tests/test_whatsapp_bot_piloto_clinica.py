import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import Mock

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

BACKEND_DIR = Path(__file__).resolve().parents[1]
os.chdir(BACKEND_DIR)
sys.path.insert(0, str(BACKEND_DIR))

os.environ.setdefault("DATABASE_URL", "sqlite:///./fortcordis.db")
os.environ.setdefault("SECRET_KEY", "whatsapp-bot-piloto-test-secret-key-1234567890")

from app.models.clinica import Clinica
from app.models.configuracao import Configuracao
from app.models.whatsapp_bot import WhatsAppBotClinicaEstado, WhatsAppBotConversaEstado
from app.services import whatsapp_bot_gates as gates


class WhatsAppBotPilotoClinicaTest(unittest.TestCase):
    """Fase 2 do piloto por clinica: resolucao de modo com tres niveis."""

    def _factory(self, tmpdir: str):
        db_path = Path(tmpdir) / "piloto.db"
        engine = create_engine(f"sqlite:///{db_path}")
        for table in (
            Configuracao.__table__,
            Clinica.__table__,
            WhatsAppBotConversaEstado.__table__,
            WhatsAppBotClinicaEstado.__table__,
        ):
            table.create(engine, checkfirst=True)
        return sessionmaker(bind=engine, autocommit=False, autoflush=False), engine

    def _cenario(self, db, *, participacao="todos", modo_institucional="suggest"):
        db.add(
            Configuracao(
                whatsapp_bot_modo=modo_institucional,
                whatsapp_bot_participacao=participacao,
            )
        )
        db.add(Clinica(id=7, nome="Clinica Parceira", ativo=True))
        db.commit()

    def _resolver(self, db, *, match_type="clinica", clinica_id=7, modo_atual="suggest"):
        return gates.resolve_modo_efetivo(
            db,
            wa_identity="558588018899",
            match_type=match_type,
            clinica_id=clinica_id,
            modo_atual=modo_atual,
        )

    # --- CA-P01: postura `todos` preserva o comportamento atual -----------

    def test_todos_sem_linha_de_clinica_nao_bloqueia(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            Factory, engine = self._factory(tmpdir)
            try:
                db = Factory()
                try:
                    self._cenario(db, participacao="todos")
                    modo, bloqueio = self._resolver(db)
                finally:
                    db.close()
                self.assertEqual(modo, "suggest")
                self.assertIsNone(bloqueio)
            finally:
                engine.dispose()

    # --- CA-P02: piloto sem habilitacao e `fora_do_piloto` ----------------

    def test_piloto_sem_linha_de_clinica_bloqueia(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            Factory, engine = self._factory(tmpdir)
            try:
                db = Factory()
                try:
                    self._cenario(db, participacao="piloto")
                    modo, bloqueio = self._resolver(db)
                finally:
                    db.close()
                self.assertEqual(modo, "off")
                self.assertEqual(bloqueio, "fora_do_piloto")
            finally:
                engine.dispose()

    # --- CA-P03: clinica habilitada gera normalmente ----------------------

    def test_piloto_com_clinica_habilitada_gera(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            Factory, engine = self._factory(tmpdir)
            try:
                db = Factory()
                try:
                    self._cenario(db, participacao="piloto")
                    db.add(WhatsAppBotClinicaEstado(clinica_id=7, modo="suggest"))
                    db.commit()
                    modo, bloqueio = self._resolver(db)
                finally:
                    db.close()
                self.assertEqual(modo, "suggest")
                self.assertIsNone(bloqueio)
            finally:
                engine.dispose()

    # --- CA-P04: `off` explicito vale mesmo com postura `todos` -----------

    def test_clinica_off_explicito_bloqueia_mesmo_em_todos(self) -> None:
        """`off` da clinica e decisao, nao ausencia: vale nas duas posturas."""
        with tempfile.TemporaryDirectory() as tmpdir:
            Factory, engine = self._factory(tmpdir)
            try:
                db = Factory()
                try:
                    self._cenario(db, participacao="todos")
                    db.add(WhatsAppBotClinicaEstado(clinica_id=7, modo="off"))
                    db.commit()
                    modo, bloqueio = self._resolver(db)
                finally:
                    db.close()
                self.assertEqual(modo, "off")
                self.assertEqual(bloqueio, "clinica_desabilitada")
            finally:
                engine.dispose()

    # --- CA-P05: conversa vence clinica, nas duas direcoes ----------------

    def test_conversa_vence_clinica_off(self) -> None:
        """Atendente liga o bot numa conversa de clinica desabilitada."""
        with tempfile.TemporaryDirectory() as tmpdir:
            Factory, engine = self._factory(tmpdir)
            try:
                db = Factory()
                try:
                    self._cenario(db, participacao="piloto")
                    db.add(WhatsAppBotClinicaEstado(clinica_id=7, modo="off"))
                    db.add(WhatsAppBotConversaEstado(wa_identity="558588018899", modo="suggest"))
                    db.commit()
                    modo, bloqueio = self._resolver(db, modo_atual="suggest")
                finally:
                    db.close()
                self.assertEqual(modo, "suggest")
                self.assertIsNone(bloqueio, "conversa explicita tem que vencer a clinica")
            finally:
                engine.dispose()

    def test_conversa_off_vence_clinica_habilitada(self) -> None:
        """O caminho inverso ja e barrado antes, em `_process_job`.

        Aqui o que importa e que a participacao NAO reabra: com estado de
        conversa explicito, a funcao devolve o que o chamador trouxe.
        """
        with tempfile.TemporaryDirectory() as tmpdir:
            Factory, engine = self._factory(tmpdir)
            try:
                db = Factory()
                try:
                    self._cenario(db, participacao="piloto")
                    db.add(WhatsAppBotClinicaEstado(clinica_id=7, modo="suggest"))
                    db.add(WhatsAppBotConversaEstado(wa_identity="558588018899", modo="off"))
                    db.commit()
                    modo, bloqueio = self._resolver(db, modo_atual="off")
                finally:
                    db.close()
                self.assertEqual(modo, "off")
                self.assertIsNone(bloqueio)
            finally:
                engine.dispose()

    # --- CA-P06: tutor no piloto ------------------------------------------

    def test_piloto_tutor_sem_opt_in_bloqueia(self) -> None:
        """Tutor nao tem agrupamento: em piloto so entra por conversa."""
        with tempfile.TemporaryDirectory() as tmpdir:
            Factory, engine = self._factory(tmpdir)
            try:
                db = Factory()
                try:
                    self._cenario(db, participacao="piloto")
                    modo, bloqueio = self._resolver(db, match_type="tutor", clinica_id=None)
                finally:
                    db.close()
                self.assertEqual(modo, "off")
                self.assertEqual(bloqueio, "fora_do_piloto")
            finally:
                engine.dispose()

    def test_piloto_tutor_com_opt_in_gera(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            Factory, engine = self._factory(tmpdir)
            try:
                db = Factory()
                try:
                    self._cenario(db, participacao="piloto")
                    db.add(WhatsAppBotConversaEstado(wa_identity="558588018899", modo="suggest"))
                    db.commit()
                    modo, bloqueio = self._resolver(db, match_type="tutor", clinica_id=None)
                finally:
                    db.close()
                self.assertEqual(modo, "suggest")
                self.assertIsNone(bloqueio)
            finally:
                engine.dispose()

    # --- CB-P01: identidade ambigua ---------------------------------------

    def test_identidade_nao_resolvida_em_piloto_bloqueia_sem_inventar_clinica(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            Factory, engine = self._factory(tmpdir)
            try:
                db = Factory()
                try:
                    self._cenario(db, participacao="piloto")
                    db.add(WhatsAppBotClinicaEstado(clinica_id=7, modo="suggest"))
                    db.commit()
                    modo, bloqueio = self._resolver(db, match_type=None, clinica_id=None)
                finally:
                    db.close()
                self.assertEqual(modo, "off")
                self.assertEqual(bloqueio, "fora_do_piloto")
            finally:
                engine.dispose()

    # --- CB-P03: voltar de piloto para todos preserva os `off` ------------

    def test_voltar_para_todos_preserva_off_explicito(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            Factory, engine = self._factory(tmpdir)
            try:
                db = Factory()
                try:
                    self._cenario(db, participacao="todos")
                    db.add(WhatsAppBotClinicaEstado(clinica_id=7, modo="off"))
                    db.commit()
                    _, bloqueio = self._resolver(db)
                finally:
                    db.close()
                self.assertEqual(bloqueio, "clinica_desabilitada")
            finally:
                engine.dispose()

    # --- postura invalida falha para o lado seguro ------------------------

    def test_participacao_desconhecida_cai_em_todos(self) -> None:
        """O valor seguro aqui e o que NAO muda comportamento.

        `piloto` e decisao deliberada; nunca pode nascer de leitura suja.
        """
        with tempfile.TemporaryDirectory() as tmpdir:
            Factory, engine = self._factory(tmpdir)
            try:
                db = Factory()
                try:
                    self._cenario(db, participacao="valor-invalido")
                    self.assertEqual(gates.resolve_participacao(db), "todos")
                    _, bloqueio = self._resolver(db)
                finally:
                    db.close()
                self.assertIsNone(bloqueio)
            finally:
                engine.dispose()

    # --- CA-P09: caminho barrado nao chama LLM ----------------------------

    def test_bloqueio_nao_chama_provider(self) -> None:
        """NFR-P02: barrar nao pode custar token nem consulta de dado."""
        from app.services import whatsapp_bot_generation as generation

        provider = Mock()
        provider.generate = Mock(side_effect=AssertionError("provider nao pode ser chamado"))

        with tempfile.TemporaryDirectory() as tmpdir:
            Factory, engine = self._factory(tmpdir)
            try:
                db = Factory()
                try:
                    self._cenario(db, participacao="piloto")
                    resultado = generation.gerar_resposta(
                        db,
                        wa_identity="558588018899",
                        corpo_mensagem="qual o horario?",
                        modo="suggest",
                        provider=provider,
                    )
                finally:
                    db.close()
                self.assertEqual(resultado.decisao, "suppressed")
                self.assertEqual(resultado.motivo, "fora_do_piloto")
                self.assertIsNone(resultado.texto_gerado)
                provider.generate.assert_not_called()
            finally:
                engine.dispose()


if __name__ == "__main__":
    unittest.main()


class WhatsAppBotPilotoEndpointsTest(unittest.TestCase):
    """RF-P07: leitura e escrita da participacao por clinica."""

    def _factory(self, tmpdir: str):
        db_path = Path(tmpdir) / "piloto-endpoints.db"
        engine = create_engine(f"sqlite:///{db_path}")
        for table in (
            Configuracao.__table__,
            Clinica.__table__,
            WhatsAppBotConversaEstado.__table__,
            WhatsAppBotClinicaEstado.__table__,
        ):
            table.create(engine, checkfirst=True)
        return sessionmaker(bind=engine, autocommit=False, autoflush=False), engine

    def _user(self, admin=True):
        from types import SimpleNamespace

        return SimpleNamespace(id=1, tem_papel=lambda papel: admin and papel == "admin")

    def test_listagem_deriva_participa_da_postura(self) -> None:
        """Sem linha, o mesmo estado significa coisas opostas nas duas posturas.

        Por isso `participa` e derivado no backend: deixar a tela inferir
        convidaria a errar justo no campo que decide exposicao.
        """
        from app.api.v1.endpoints import whatsapp_bot as endpoints

        for postura, esperado in (("todos", True), ("piloto", False)):
            with tempfile.TemporaryDirectory() as tmpdir:
                Factory, engine = self._factory(tmpdir)
                try:
                    db = Factory()
                    try:
                        db.add(Configuracao(whatsapp_bot_participacao=postura))
                        db.add(Clinica(id=7, nome="Parceira", ativo=True))
                        db.commit()
                        r = endpoints.listar_participacao_das_clinicas(db=db, current_user=self._user())
                    finally:
                        db.close()
                    self.assertEqual(r["participacao"], postura)
                    self.assertEqual(len(r["clinicas"]), 1)
                    self.assertIsNone(r["clinicas"][0]["modo"])
                    self.assertEqual(r["clinicas"][0]["participa"], esperado, postura)
                finally:
                    engine.dispose()

    def test_put_cria_e_atualiza_a_linha(self) -> None:
        from app.api.v1.endpoints import whatsapp_bot as endpoints

        with tempfile.TemporaryDirectory() as tmpdir:
            Factory, engine = self._factory(tmpdir)
            try:
                db = Factory()
                try:
                    db.add(Configuracao(whatsapp_bot_participacao="piloto"))
                    db.add(Clinica(id=7, nome="Parceira", ativo=True))
                    db.commit()
                    endpoints.atualizar_participacao_da_clinica(
                        7,
                        endpoints.WhatsAppBotClinicaEstadoUpdateRequest(modo="suggest", observacao="piloto"),
                        db=db,
                        current_user=self._user(),
                    )
                    endpoints.atualizar_participacao_da_clinica(
                        7,
                        endpoints.WhatsAppBotClinicaEstadoUpdateRequest(modo="off"),
                        db=db,
                        current_user=self._user(),
                    )
                    linhas = db.query(WhatsAppBotClinicaEstado).all()
                    self.assertEqual(len(linhas), 1, "PUT nao pode duplicar linha")
                    self.assertEqual(linhas[0].modo, "off")
                    self.assertEqual(linhas[0].habilitado_por_id, 1)
                finally:
                    db.close()
            finally:
                engine.dispose()

    def test_put_recusa_modo_invalido_e_clinica_inexistente(self) -> None:
        from fastapi import HTTPException

        from app.api.v1.endpoints import whatsapp_bot as endpoints

        with tempfile.TemporaryDirectory() as tmpdir:
            Factory, engine = self._factory(tmpdir)
            try:
                db = Factory()
                try:
                    db.add(Clinica(id=7, nome="Parceira", ativo=True))
                    db.commit()
                    with self.assertRaises(HTTPException) as ctx:
                        endpoints.atualizar_participacao_da_clinica(
                            7,
                            endpoints.WhatsAppBotClinicaEstadoUpdateRequest(modo="invalido"),
                            db=db,
                            current_user=self._user(),
                        )
                    self.assertEqual(ctx.exception.status_code, 422)

                    with self.assertRaises(HTTPException) as ctx2:
                        endpoints.atualizar_participacao_da_clinica(
                            999,
                            endpoints.WhatsAppBotClinicaEstadoUpdateRequest(modo="suggest"),
                            db=db,
                            current_user=self._user(),
                        )
                    self.assertEqual(ctx2.exception.status_code, 404)
                finally:
                    db.close()
            finally:
                engine.dispose()

    def test_clinica_inativa_nao_aparece_na_listagem(self) -> None:
        """CB-P02: linha de participacao nao ressuscita clinica desativada."""
        from app.api.v1.endpoints import whatsapp_bot as endpoints

        with tempfile.TemporaryDirectory() as tmpdir:
            Factory, engine = self._factory(tmpdir)
            try:
                db = Factory()
                try:
                    db.add(Configuracao(whatsapp_bot_participacao="piloto"))
                    db.add(Clinica(id=7, nome="Desativada", ativo=False))
                    db.add(WhatsAppBotClinicaEstado(clinica_id=7, modo="suggest"))
                    db.commit()
                    r = endpoints.listar_participacao_das_clinicas(db=db, current_user=self._user())
                finally:
                    db.close()
                self.assertEqual(r["clinicas"], [])
            finally:
                engine.dispose()
