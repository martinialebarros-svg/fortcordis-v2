import os
import sys
import tempfile
import unittest
from datetime import datetime, timedelta
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

BACKEND_DIR = Path(__file__).resolve().parents[1]
os.chdir(BACKEND_DIR)
sys.path.insert(0, str(BACKEND_DIR))
os.environ.setdefault("DATABASE_URL", "sqlite:///./fortcordis.db")
os.environ.setdefault("SECRET_KEY", "agenda-alteracao-servico-hoje-test-secret-key")

from fastapi import HTTPException

from app.api.v1.endpoints import agenda
from app.models.agendamento import Agendamento
from app.models.clinica import Clinica
from app.models.configuracao import Configuracao
from app.models.servico import Servico


class AgendaAlteracaoServicoHojeTest(unittest.TestCase):
    def setUp(self) -> None:
        self._tmpdir = tempfile.TemporaryDirectory()
        db_path = Path(self._tmpdir.name) / "agenda-servico-hoje.db"
        self._engine = create_engine(f"sqlite:///{db_path}")
        for table in (
            Configuracao.__table__,
            Clinica.__table__,
            Servico.__table__,
            Agendamento.__table__,
        ):
            table.create(self._engine, checkfirst=True)
        self._session_factory = sessionmaker(bind=self._engine, autocommit=False, autoflush=False)

        with self._session_factory() as db:
            clinica = Clinica(
                nome="Clinica Hoje",
                ativo=True,
                latitude=-3.7319,
                longitude=-38.5267,
            )
            servico_original = Servico(nome="Consulta", duracao_minutos=30, ativo=True)
            servico_novo = Servico(nome="Consulta + Eco", duracao_minutos=60, ativo=True)
            db.add_all([clinica, servico_original, servico_novo])
            db.commit()
            db.refresh(clinica)
            db.refresh(servico_original)
            db.refresh(servico_novo)

            inicio = datetime.now(agenda.LOCAL_TZ).replace(tzinfo=None) - timedelta(hours=2)
            agendamento = Agendamento(
                clinica_id=clinica.id,
                servico_id=servico_original.id,
                inicio=inicio,
                fim=inicio + timedelta(minutes=30),
                data=inicio.date().isoformat(),
                hora=inicio.strftime("%H:%M"),
                status="Agendado",
            )
            db.add(agendamento)
            db.commit()
            db.refresh(agendamento)
            self.agendamento_id = int(agendamento.id)
            self.servico_original_id = int(servico_original.id)
            self.servico_novo_id = int(servico_novo.id)
            self.inicio_original = inicio
            self.fim_original = inicio + timedelta(minutes=30)

    def tearDown(self) -> None:
        self._engine.dispose()
        self._tmpdir.cleanup()

    @staticmethod
    def _usuario(admin: bool) -> SimpleNamespace:
        return SimpleNamespace(
            id=1,
            nome="Admin" if admin else "Recepcao",
            tem_papel=lambda papel: admin and papel == "admin",
        )

    def _atualizar(self, *, admin: bool, confirmar: bool):
        with self._session_factory() as db, patch.object(
            agenda, "registrar_auditoria", return_value=None
        ), patch.object(
            agenda, "_notificar_agenda_update", return_value=None
        ), patch.object(
            agenda, "_validar_deslocamento_agendamento", return_value=None
        ):
            return agenda.atualizar_agendamento(
                agendamento_id=self.agendamento_id,
                agendamento=agenda.AgendamentoUpdate(
                    servico_id=self.servico_novo_id,
                    confirmar_alteracao_servico_hoje=confirmar,
                ),
                request=SimpleNamespace(),
                db=db,
                current_user=self._usuario(admin),
            )

    def test_exige_confirmacao_explicita_do_admin(self) -> None:
        with self.assertRaises(HTTPException) as contexto:
            self._atualizar(admin=True, confirmar=False)

        self.assertEqual(contexto.exception.status_code, 409)
        self.assertEqual(
            contexto.exception.detail["codigo"],
            "CONFIRMACAO_ALTERACAO_SERVICO_HOJE",
        )

    def test_bloqueia_confirmacao_por_perfil_nao_admin(self) -> None:
        with self.assertRaises(HTTPException) as contexto:
            self._atualizar(admin=False, confirmar=True)

        self.assertEqual(contexto.exception.status_code, 403)

    def test_admin_confirmado_troca_servico_e_preserva_intervalo_iniciado(self) -> None:
        resposta = self._atualizar(admin=True, confirmar=True)

        self.assertEqual(resposta["servico_id"], self.servico_novo_id)
        with self._session_factory() as db:
            atualizado = db.query(Agendamento).filter_by(id=self.agendamento_id).one()
            self.assertEqual(atualizado.servico_id, self.servico_novo_id)
            self.assertEqual(atualizado.inicio, self.inicio_original)
            self.assertEqual(atualizado.fim, self.fim_original)
