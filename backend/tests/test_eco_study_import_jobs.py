import os
import sys
import unittest
from pathlib import Path
from types import SimpleNamespace

BACKEND_DIR = Path(__file__).resolve().parents[1]
os.chdir(BACKEND_DIR)
sys.path.insert(0, str(BACKEND_DIR))

os.environ.setdefault("DATABASE_URL", "sqlite:///./fortcordis.db")
os.environ.setdefault("SECRET_KEY", "eco-study-jobs-test-secret-key-1234567890")

from app.services.eco_study_import_jobs import serialize_eco_study_import_job  # noqa: E402


class EcoStudyImportJobsTest(unittest.TestCase):
    def test_serializes_completed_result(self) -> None:
        job = SimpleNamespace(
            id=42,
            status="completed",
            arquivo_nome="estudo.pdf",
            erro=None,
            resultado_json='{"medidas":{"DIVEd":32.4}}',
            created_at=None,
            started_at=None,
            finished_at=None,
        )

        payload = serialize_eco_study_import_job(job)

        self.assertEqual(payload["job_id"], 42)
        self.assertEqual(payload["dados"]["medidas"]["DIVEd"], 32.4)


if __name__ == "__main__":
    unittest.main()
