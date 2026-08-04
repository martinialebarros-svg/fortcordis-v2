import os
import sys
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace

from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

BACKEND_DIR = Path(__file__).resolve().parents[1]
os.chdir(BACKEND_DIR)
sys.path.insert(0, str(BACKEND_DIR))

os.environ.setdefault("DATABASE_URL", "sqlite:///./fortcordis.db")
os.environ.setdefault("SECRET_KEY", "tutor-inativo-reativacao-secret-key-1234567890")

from app.api.v1.endpoints import tutores
from app.models.tutor import Tutor


class TutorInativoReativacaoTest(unittest.TestCase):
    def _build_session(self):
        tmpdir = tempfile.TemporaryDirectory()
        db_path = Path(tmpdir.name) / "tutor-inativo-reativacao.db"
        engine = create_engine(f"sqlite:///{db_path}")
        Tutor.__table__.create(engine, checkfirst=True)
        session = sessionmaker(bind=engine, autocommit=False, autoflush=False)()
        return tmpdir, session, engine

    def test_tutor_inativo_exige_confirmacao_e_volta_para_a_busca_apos_reativacao(self) -> None:
        tmpdir, db, engine = self._build_session()
        try:
            tutor = Tutor(
                nome="Genival Filho",
                nome_key="genival filho",
                telefone="85990000000",
                ativo=0,
            )
            db.add(tutor)
            db.commit()
            db.refresh(tutor)

            with self.assertRaises(HTTPException) as ctx:
                tutores.criar_tutor(
                    tutores.TutorCreate(nome="Genival Filho", telefone="85998887777"),
                    db=db,
                    current_user=SimpleNamespace(id=1),
                )

            self.assertEqual(ctx.exception.status_code, 409)
            self.assertEqual(ctx.exception.detail["codigo"], "TUTOR_INATIVO_EXISTENTE")
            self.assertEqual(ctx.exception.detail["tutor"]["id"], tutor.id)
            db.refresh(tutor)
            self.assertEqual(tutor.ativo, 0)
            self.assertEqual(tutor.telefone, "85990000000")

            response = tutores.criar_tutor(
                tutores.TutorCreate(
                    nome="Genival Filho",
                    telefone="85998887777",
                    confirmar_reativacao=True,
                ),
                db=db,
                current_user=SimpleNamespace(id=1),
            )

            self.assertEqual(response["id"], tutor.id)
            self.assertEqual(response["message"], "Tutor reativado com sucesso")
            db.refresh(tutor)
            self.assertEqual(tutor.ativo, 1)
            self.assertEqual(tutor.telefone, "85998887777")

            encontrados = tutores.listar_tutores(
                busca="genival",
                limit=50,
                db=db,
                current_user=SimpleNamespace(id=1),
            )
            self.assertEqual(encontrados["total"], 1)
            self.assertEqual(encontrados["items"][0]["id"], tutor.id)
        finally:
            db.close()
            engine.dispose()
            tmpdir.cleanup()

    def test_tutor_ativo_com_mesmo_nome_continua_idempotente(self) -> None:
        tmpdir, db, engine = self._build_session()
        try:
            tutor = Tutor(nome="Genival Filho", nome_key="genival filho", ativo=1)
            db.add(tutor)
            db.commit()
            db.refresh(tutor)

            response = tutores.criar_tutor(
                tutores.TutorCreate(nome="Genival Filho"),
                db=db,
                current_user=SimpleNamespace(id=1),
            )

            self.assertEqual(response["id"], tutor.id)
            self.assertEqual(response["message"], "Tutor já existe")
        finally:
            db.close()
            engine.dispose()
            tmpdir.cleanup()


if __name__ == "__main__":
    unittest.main()
