import os
import sys
import unittest
from pathlib import Path
from types import SimpleNamespace

from fastapi import HTTPException

BACKEND_DIR = Path(__file__).resolve().parents[1]
os.chdir(BACKEND_DIR)
sys.path.insert(0, str(BACKEND_DIR))

os.environ.setdefault("DATABASE_URL", "sqlite:///./fortcordis.db")
os.environ.setdefault("SECRET_KEY", "upload-dedupe-metrics-endpoint-test-secret-key-1234567890")

from app.api.v1.endpoints import atendimento


class _FakeResult:
    def __init__(self, rows):
        self._rows = rows

    def fetchall(self):
        return self._rows


class _FakeDB:
    def __init__(self, rows):
        self.rows = rows
        self.calls = []

    def execute(self, query, params):
        self.calls.append((query, params))
        return _FakeResult(self.rows)


class UploadDedupeMetricsEndpointTest(unittest.TestCase):
    def setUp(self) -> None:
        self.user = SimpleNamespace(id=1, nome="Metrics User")

    def test_consultar_metricas_upload_dedupe_rejects_invalid_start_date(self) -> None:
        db = _FakeDB(rows=[])
        with self.assertRaises(HTTPException) as ctx:
            atendimento.consultar_metricas_upload_dedupe(
                data_inicio="2026-99-01",
                data_fim=None,
                clinica_id=None,
                db=db,
                current_user=self.user,
            )
        self.assertEqual(ctx.exception.status_code, 400)
        self.assertIn("data_inicio invalido", str(ctx.exception.detail))

    def test_consultar_metricas_upload_dedupe_rejects_inverted_date_range(self) -> None:
        db = _FakeDB(rows=[])
        with self.assertRaises(HTTPException) as ctx:
            atendimento.consultar_metricas_upload_dedupe(
                data_inicio="2026-04-05",
                data_fim="2026-04-04",
                clinica_id=None,
                db=db,
                current_user=self.user,
            )
        self.assertEqual(ctx.exception.status_code, 400)
        self.assertIn("data_inicio", str(ctx.exception.detail))

    def test_consultar_metricas_upload_dedupe_returns_daily_aggregation(self) -> None:
        db = _FakeDB(
            rows=[
                ("2026-04-04", 5, 2, 1, 8),
                ("2026-04-03", 3, 1, 0, 4),
            ]
        )

        payload = atendimento.consultar_metricas_upload_dedupe(
            data_inicio="2026-04-03",
            data_fim="2026-04-04",
            clinica_id=7,
            db=db,
            current_user=self.user,
        )

        self.assertEqual(len(payload["items"]), 2)
        self.assertEqual(payload["items"][0]["date"], "2026-04-04")
        self.assertEqual(payload["items"][0]["uploads_novos"], 5)
        self.assertEqual(payload["items"][0]["dedupe_precheck"], 2)
        self.assertEqual(payload["items"][0]["dedupe_collision"], 1)
        self.assertEqual(payload["items"][0]["total_uploads"], 8)
        self.assertEqual(payload["filters"]["clinica_id"], 7)
        self.assertEqual(len(db.calls), 1)


if __name__ == "__main__":
    unittest.main()
