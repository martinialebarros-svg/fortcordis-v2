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
os.environ.setdefault("SECRET_KEY", "agenda-duracao-servico-create-test-secret-key-1234567890")

from app.api.v1.endpoints import agenda
from app.models.agendamento import Agendamento
from app.models.clinica import Clinica
from app.models.configuracao import Configuracao
from app.models.servico import Servico


class AgendaDuracaoServicoCreateTest(unittest.TestCase):
    def _build_session(self):
        tmpdir = tempfile.TemporaryDirectory()
        db_path = Path(tmpdir.name) / "agenda-duracao-servico-create.db"
        engine = create_engine(f"sqlite:///{db_path}")
        for table in (
            Configuracao.__table__,
            Clinica.__table__,
            Servico.__table__,
            Agendamento.__table__,
        ):
            table.create(engine, checkfirst=True)
        session = sessionmaker(bind=engine, autocommit=False, autoflush=False)()
        return tmpdir, session, engine

    def test_criar_agendamento_forca_duracao_do_servico_quando_payload_traz_fim_maior(self) -> None:
        tmpdir, db, engine = self._build_session()
        try:
            clinica = Clinica(nome="Casa Pet", ativo=True)
            servico = Servico(nome="Eletrocardiograma", duracao_minutos=20, ativo=True)
            db.add_all([clinica, servico])
            db.commit()
            db.refresh(clinica)
            db.refresh(servico)

            inicio = datetime(2099, 5, 25, 11, 0, 0)
            fim_payload = inicio + timedelta(minutes=60)
            payload = agenda.AgendamentoCreate(
                paciente_id=None,
                clinica_id=clinica.id,
                servico_id=servico.id,
                inicio=inicio,
                fim=fim_payload,
                status="Reservado",
                observacoes="[Assistente agenda] sugestao aceita",
            )

            with patch.object(agenda, "registrar_auditoria", return_value=None), patch.object(
                agenda, "_notificar_agenda_update", return_value=None
            ):
                resposta = agenda.criar_agendamento(
                    agendamento=payload,
                    request=SimpleNamespace(),
                    db=db,
                    current_user=SimpleNamespace(id=1, nome="Teste"),
                )

            agendamento_criado = db.query(Agendamento).filter(Agendamento.id == int(resposta["id"])).first()
            self.assertIsNotNone(agendamento_criado)
            self.assertEqual(
                int((agendamento_criado.fim - agendamento_criado.inicio).total_seconds() // 60),
                20,
            )
        finally:
            db.close()
            engine.dispose()
            tmpdir.cleanup()


if __name__ == "__main__":
    unittest.main()
