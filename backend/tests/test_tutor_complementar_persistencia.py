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
os.environ.setdefault("SECRET_KEY", "tutor-complementar-persistencia-secret-key-1234567890")

from app.api.v1.endpoints import pacientes, tutores
from app.models.paciente import Paciente
from app.models.tutor import Tutor


class TutorComplementarPersistenciaTest(unittest.TestCase):
    def _build_session(self):
        tmpdir = tempfile.TemporaryDirectory()
        db_path = Path(tmpdir.name) / "tutor-complementar-persistencia.db"
        engine = create_engine(f"sqlite:///{db_path}")
        Tutor.__table__.create(engine, checkfirst=True)
        Paciente.__table__.create(engine, checkfirst=True)
        session = sessionmaker(bind=engine, autocommit=False, autoflush=False)()
        return tmpdir, session, engine

    def test_atualizar_tutor_persiste_campos_complementares(self) -> None:
        tmpdir, db, engine = self._build_session()
        try:
            tutor = Tutor(nome="Maria Silva", ativo=1)
            db.add(tutor)
            db.commit()
            db.refresh(tutor)

            paciente = Paciente(nome="Luna", tutor_id=tutor.id, ativo=1)
            db.add(paciente)
            db.commit()
            db.refresh(paciente)

            payload = tutores.TutorUpdate(
                nome="Maria Silva",
                telefone="85999990000",
                whatsapp="85999990001",
                email="maria@example.com",
                cpf="12345678900",
                cep="60020180",
                endereco="Avenida Teste",
                numero="2800",
                complemento="Sala 1",
                bairro="Benfica",
                cidade="Fortaleza",
                estado="CE",
            )

            tutores.atualizar_tutor(
                tutor.id,
                payload,
                db=db,
                current_user=SimpleNamespace(id=1),
            )

            tutor_response = tutores.obter_tutor(
                tutor.id,
                db=db,
                current_user=SimpleNamespace(id=1),
            )
            self.assertEqual(tutor_response["cpf"], "12345678900")
            self.assertEqual(tutor_response["endereco"], "Avenida Teste")
            self.assertEqual(tutor_response["cidade"], "Fortaleza")
            self.assertEqual(tutor_response["estado"], "CE")

            tutor_from_patient = pacientes.obter_tutor_paciente(
                paciente.id,
                db=db,
                current_user=SimpleNamespace(id=1),
            )
            self.assertEqual(tutor_from_patient["cpf"], "12345678900")
            self.assertEqual(tutor_from_patient["cep"], "60020180")
            self.assertEqual(tutor_from_patient["bairro"], "Benfica")
            self.assertEqual(tutor_from_patient["numero"], "2800")
        finally:
            db.close()
            engine.dispose()
            tmpdir.cleanup()


if __name__ == "__main__":
    unittest.main()

