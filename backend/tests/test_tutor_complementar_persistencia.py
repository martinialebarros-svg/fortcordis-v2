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

    def test_criar_multiplos_pets_reusa_tutor_com_dados_de_portal(self) -> None:
        tmpdir, db, engine = self._build_session()
        try:
            primeiro = pacientes.criar_paciente(
                pacientes.PacienteCreate(
                    nome="Luna",
                    tutor="Maria Silva",
                    tutor_email="maria@example.com",
                    tutor_telefone="85999990000",
                    tutor_whatsapp="85999990001",
                    especie="Canina",
                    raca="SRD",
                ),
                db=db,
                current_user=SimpleNamespace(id=1),
            )

            segundo = pacientes.criar_paciente(
                pacientes.PacienteCreate(
                    nome="Theo",
                    tutor_id=primeiro["tutor_id"],
                    tutor="Maria Silva",
                    tutor_email="maria@example.com",
                    especie="Felina",
                    raca="SRD",
                ),
                db=db,
                current_user=SimpleNamespace(id=1),
            )

            self.assertIsNotNone(primeiro["tutor_id"])
            self.assertEqual(primeiro["tutor_id"], segundo["tutor_id"])

            tutor = db.query(Tutor).filter(Tutor.id == primeiro["tutor_id"]).first()
            self.assertIsNotNone(tutor)
            self.assertEqual(tutor.email, "maria@example.com")
            self.assertEqual(tutor.whatsapp, "85999990001")

            luna = pacientes.obter_paciente(
                primeiro["id"],
                db=db,
                current_user=SimpleNamespace(id=1),
            )
            self.assertEqual(luna["tutor_email"], "maria@example.com")
            self.assertEqual(luna["tutor_id"], primeiro["tutor_id"])
        finally:
            db.close()
            engine.dispose()
            tmpdir.cleanup()


if __name__ == "__main__":
    unittest.main()
