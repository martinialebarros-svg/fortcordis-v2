import json
import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

BACKEND_DIR = Path(__file__).resolve().parents[1]
os.chdir(BACKEND_DIR)
sys.path.insert(0, str(BACKEND_DIR))

os.environ.setdefault("DATABASE_URL", "sqlite:///./fortcordis.db")
os.environ.setdefault(
    "SECRET_KEY",
    "frases-store-test-secret-key-1234567890",
)

from app.models.frase import FraseQualitativa, FraseQualitativaHistorico
from app.services import frases_service


def _sample_frases_payload() -> dict:
    return {
        "version": "1.0",
        "last_updated": "2026-03-13T00:00:00",
        "frases": [
            {
                "id": 1,
                "chave": "Normal (Normal)",
                "patologia": "Normal",
                "grau": "Normal",
                "valvas": "ok",
                "camaras": "ok",
                "funcao": "ok",
                "pericardio": "ok",
                "vasos": "ok",
                "ad_vd": "ok",
                "conclusao": "ok",
                "detalhado": {},
                "layout": "detalhado",
                "ativo": 1,
                "created_at": "2026-03-01T10:00:00",
                "updated_at": "2026-03-02T10:00:00",
            },
            {
                "id": 2,
                "chave": "Doenca X (Leve)",
                "patologia": "Doenca X",
                "grau": "Leve",
                "valvas": "texto",
                "camaras": "texto",
                "funcao": "texto",
                "pericardio": "texto",
                "vasos": "texto",
                "ad_vd": "texto",
                "conclusao": "texto",
                "detalhado": {"grupo": "a"},
                "layout": "detalhado",
                "ativo": 1,
                "created_at": "2026-03-01T11:00:00",
                "updated_at": "2026-03-02T11:00:00",
            },
        ],
    }


class FrasesStoreTest(unittest.TestCase):
    def _build_session(self, tmpdir: str):
        db_path = Path(tmpdir) / "frases-store-test.db"
        engine = create_engine(f"sqlite:///{db_path}")
        FraseQualitativa.__table__.create(engine, checkfirst=True)
        FraseQualitativaHistorico.__table__.create(engine, checkfirst=True)
        return sessionmaker(bind=engine, autocommit=False, autoflush=False)(), engine

    def test_seed_populates_database_from_json_when_table_is_empty(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            data_dir = Path(tmpdir)
            frases_file = data_dir / "frases.json"
            patologias_file = data_dir / "patologias.json"
            frases_file.write_text(json.dumps(_sample_frases_payload(), ensure_ascii=False), encoding="utf-8")
            patologias_file.write_text('{"patologias": []}', encoding="utf-8")

            db, engine = self._build_session(tmpdir)
            try:
                with patch.object(frases_service, "DATA_DIR", data_dir), patch.object(
                    frases_service, "FRASES_FILE", frases_file
                ), patch.object(frases_service, "PATOLOGIAS_FILE", patologias_file):
                    report = frases_service.ensure_frases_store_seeded(db)
                    self.assertTrue(report["seeded"])

                    resultado = frases_service.listar_frases(db, limit=10)
                    self.assertEqual(resultado["total"], 2)
                    self.assertEqual(resultado["items"][0]["chave"], "Doenca X (Leve)")
            finally:
                db.close()
                engine.dispose()

    def test_sync_json_mirror_writes_database_snapshot(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            data_dir = Path(tmpdir)
            frases_file = data_dir / "frases.json"
            patologias_file = data_dir / "patologias.json"
            frases_file.write_text(json.dumps({"version": "1.0", "frases": []}), encoding="utf-8")
            patologias_file.write_text('{"patologias": []}', encoding="utf-8")

            db, engine = self._build_session(tmpdir)
            try:
                db.add(
                    FraseQualitativa(
                        chave="Normal (Normal)",
                        patologia="Normal",
                        grau="Normal",
                        conclusao="ok",
                        detalhado={},
                        ativo=1,
                    )
                )
                db.commit()

                with patch.object(frases_service, "DATA_DIR", data_dir), patch.object(
                    frases_service, "FRASES_FILE", frases_file
                ), patch.object(frases_service, "PATOLOGIAS_FILE", patologias_file):
                    sync_result = frases_service.sync_frases_json_mirror(db)
                    mirrored = json.loads(frases_file.read_text(encoding="utf-8"))

                    self.assertTrue(sync_result["synced"])
                    self.assertEqual(sync_result["count"], 1)
                    self.assertEqual(mirrored["frases"][0]["chave"], "Normal (Normal)")
            finally:
                db.close()
                engine.dispose()


if __name__ == "__main__":
    unittest.main()
