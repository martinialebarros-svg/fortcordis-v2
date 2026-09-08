import os
import sys
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

BACKEND_DIR = Path(__file__).resolve().parents[1]
os.chdir(BACKEND_DIR)
sys.path.insert(0, str(BACKEND_DIR))

os.environ.setdefault("DATABASE_URL", "sqlite:///./fortcordis.db")
os.environ.setdefault("SECRET_KEY", "pacientes-listagem-test-secret-key-1234567890")

from app.api.v1.endpoints import pacientes
from app.models.paciente import Paciente
from app.models.tutor import Tutor


class PacientesListagemTest(unittest.TestCase):
    def _build_session(self):
        tmpdir = tempfile.TemporaryDirectory()
        db_path = Path(tmpdir.name) / "pacientes-listagem.db"
        engine = create_engine(f"sqlite:///{db_path}")
        Tutor.__table__.create(engine, checkfirst=True)
        Paciente.__table__.create(engine, checkfirst=True)
        session = sessionmaker(bind=engine, autocommit=False, autoflush=False)()
        return tmpdir, session, engine

    def test_busca_remota_retorna_paciente_ativo_e_preserva_total_da_carteira(self) -> None:
        tmpdir, db, engine = self._build_session()
        try:
            tutor = Tutor(nome="Rafael Caminha Geronimo", nome_key="rafael caminhha geronimo", ativo=1)
            db.add(tutor)
            db.flush()
            db.add_all(
                [
                    Paciente(nome="Bidu", nome_key="bidu", tutor_id=tutor.id, especie="Canina", ativo=1),
                    Paciente(nome="Rex", nome_key="rex", tutor_id=tutor.id, especie="Canina", ativo=1),
                    Paciente(nome="Rex inativo", nome_key="rex inativo", tutor_id=tutor.id, especie="Canina", ativo=0),
                ]
            )
            db.commit()

            resultado = pacientes.listar_pacientes(
                search="rex",
                limit=100,
                db=db,
                current_user=SimpleNamespace(id=1),
            )

            self.assertEqual(resultado["total_ativos"], 2)
            self.assertEqual(resultado["total"], 1)
            self.assertEqual([item["nome"] for item in resultado["items"]], ["Rex"])
        finally:
            db.close()
            engine.dispose()
            tmpdir.cleanup()

    def test_busca_por_identificador_do_pet_ou_tutor_permanece_compativel(self) -> None:
        tmpdir, db, engine = self._build_session()
        try:
            tutor = Tutor(nome="Rafael", nome_key="rafael", ativo=1)
            db.add(tutor)
            db.flush()
            paciente = Paciente(nome="Rex", nome_key="rex", tutor_id=tutor.id, especie="Canina", ativo=1)
            db.add(paciente)
            db.commit()

            por_paciente = pacientes.listar_pacientes(
                search=str(paciente.id),
                limit=100,
                db=db,
                current_user=SimpleNamespace(id=1),
            )
            por_tutor = pacientes.listar_pacientes(
                search=str(tutor.id),
                limit=100,
                db=db,
                current_user=SimpleNamespace(id=1),
            )

            self.assertEqual([item["id"] for item in por_paciente["items"]], [paciente.id])
            self.assertEqual([item["id"] for item in por_tutor["items"]], [paciente.id])
        finally:
            db.close()
            engine.dispose()
            tmpdir.cleanup()


if __name__ == "__main__":
    unittest.main()
