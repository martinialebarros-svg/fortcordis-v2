import os
import sys
import tempfile
import threading
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
os.environ.setdefault("SECRET_KEY", "agenda-concorrencia-slot-test-secret-key-1234567890")

from fastapi import HTTPException

from app.api.v1.endpoints import agenda
from app.models.agendamento import Agendamento
from app.models.clinica import Clinica
from app.models.configuracao import Configuracao
from app.models.servico import Servico


class AgendaConcorrenciaSlotTest(unittest.TestCase):
    def setUp(self) -> None:
        self._tmpdir = tempfile.TemporaryDirectory()
        db_path = Path(self._tmpdir.name) / "agenda-concorrencia-slot.db"
        self._engine = create_engine(
            f"sqlite:///{db_path}",
            connect_args={"check_same_thread": False, "timeout": 10},
        )
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
                nome="Casa Pet",
                ativo=True,
                latitude=-3.7319,
                longitude=-38.5267,
            )
            servico = Servico(nome="Consulta", duracao_minutos=30, ativo=True)
            db.add_all([clinica, servico])
            db.commit()
            db.refresh(clinica)
            db.refresh(servico)
            self.clinica_id = int(clinica.id)
            self.servico_id = int(servico.id)

    def tearDown(self) -> None:
        self._engine.dispose()
        self._tmpdir.cleanup()

    def _payload(self) -> agenda.AgendamentoCreate:
        inicio = datetime(2099, 5, 27, 10, 0, 0)
        return agenda.AgendamentoCreate(
            paciente_id=None,
            clinica_id=self.clinica_id,
            servico_id=self.servico_id,
            inicio=inicio,
            fim=inicio + timedelta(minutes=30),
            status="Reservado",
            observacoes="teste concorrencia",
        )

    def _criar_em_thread(self, barrier: threading.Barrier, resultado: dict[int, tuple], idx: int) -> None:
        db = self._session_factory()
        try:
            barrier.wait(timeout=5)
            resposta = agenda.criar_agendamento(
                agendamento=self._payload(),
                request=SimpleNamespace(),
                db=db,
                current_user=SimpleNamespace(id=idx + 1, nome=f"User {idx + 1}", tem_papel=lambda _: False),
            )
            resultado[idx] = ("ok", int(resposta["id"]))
        except HTTPException as exc:
            resultado[idx] = ("http", int(exc.status_code), str(exc.detail))
        except Exception as exc:
            resultado[idx] = ("err", str(exc))
        finally:
            db.close()

    def test_criacao_concorrente_no_mesmo_slot_cria_apenas_um_agendamento(self) -> None:
        resultado: dict[int, tuple] = {}
        barrier = threading.Barrier(2)

        with patch.object(agenda, "registrar_auditoria", return_value=None), patch.object(
            agenda, "_notificar_agenda_update", return_value=None
        ), patch.object(
            agenda, "_validar_deslocamento_agendamento", return_value=None
        ):
            threads = [
                threading.Thread(target=self._criar_em_thread, args=(barrier, resultado, 0), daemon=True),
                threading.Thread(target=self._criar_em_thread, args=(barrier, resultado, 1), daemon=True),
            ]
            for thread in threads:
                thread.start()
            for thread in threads:
                thread.join(timeout=10)

        self.assertEqual(len(resultado), 2)
        self.assertFalse(any(item[0] == "err" for item in resultado.values()), msg=str(resultado))

        sucessos = [item for item in resultado.values() if item[0] == "ok"]
        falhas_http = [item for item in resultado.values() if item[0] == "http"]

        self.assertEqual(len(sucessos), 1, msg=str(resultado))
        self.assertEqual(len(falhas_http), 1, msg=str(resultado))
        self.assertEqual(falhas_http[0][1], 409, msg=str(resultado))

        with self._session_factory() as db:
            total = db.query(Agendamento).count()
        self.assertEqual(total, 1)


if __name__ == "__main__":
    unittest.main()
