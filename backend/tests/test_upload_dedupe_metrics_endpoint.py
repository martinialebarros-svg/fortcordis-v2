import os
import sys
import unittest
from datetime import date, timedelta
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


class _FakeDeleteResult:
    def __init__(self, rowcount):
        self.rowcount = rowcount


class _FakeDB:
    def __init__(self, rows):
        self.rows = rows
        self.calls = []

    def execute(self, query, params):
        self.calls.append((query, params))
        return _FakeResult(self.rows)


class _FakeCleanupDB:
    def __init__(self, *, rowcount=0, should_fail=False):
        self.rowcount = rowcount
        self.should_fail = should_fail
        self.calls = []
        self.committed = False
        self.rolled_back = False

    def execute(self, query, params):
        self.calls.append((query, params))
        if self.should_fail:
            raise RuntimeError("cleanup failure")
        return _FakeDeleteResult(self.rowcount)

    def commit(self):
        self.committed = True

    def rollback(self):
        self.rolled_back = True


class UploadDedupeMetricsEndpointTest(unittest.TestCase):
    def setUp(self) -> None:
        self.user = SimpleNamespace(id=1, nome="Metrics User")
        self.original_retention_days = atendimento.settings.UPLOAD_DEDUPE_METRICS_RETENTION_DAYS

    def tearDown(self) -> None:
        atendimento.settings.UPLOAD_DEDUPE_METRICS_RETENTION_DAYS = self.original_retention_days

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

    def test_cleanup_upload_dedupe_metricas_returns_deleted_rows(self) -> None:
        atendimento.settings.UPLOAD_DEDUPE_METRICS_RETENTION_DAYS = 90
        db = _FakeCleanupDB(rowcount=3)

        payload = atendimento.executar_cleanup_upload_dedupe_metricas(
            db=db,
            current_user=self.user,
        )

        self.assertEqual(payload["retention_days"], 90)
        self.assertEqual(payload["cutoff_date"], (date.today() - timedelta(days=90)).isoformat())
        self.assertEqual(payload["deleted_rows"], 3)
        self.assertEqual(len(db.calls), 1)
        self.assertTrue(db.committed)
        self.assertFalse(db.rolled_back)
        self.assertIn("DELETE FROM upload_dedupe_metricas", str(db.calls[0][0]))

    def test_cleanup_upload_dedupe_metricas_returns_zero_when_no_rows_match(self) -> None:
        atendimento.settings.UPLOAD_DEDUPE_METRICS_RETENTION_DAYS = 90
        db = _FakeCleanupDB(rowcount=0)

        payload = atendimento.executar_cleanup_upload_dedupe_metricas(
            db=db,
            current_user=self.user,
        )

        self.assertEqual(payload["deleted_rows"], 0)
        self.assertTrue(db.committed)
        self.assertFalse(db.rolled_back)

    def test_cleanup_upload_dedupe_metricas_rejects_invalid_retention_setting(self) -> None:
        atendimento.settings.UPLOAD_DEDUPE_METRICS_RETENTION_DAYS = 0
        db = _FakeCleanupDB(rowcount=10)

        with self.assertRaises(HTTPException) as ctx:
            atendimento.executar_cleanup_upload_dedupe_metricas(
                db=db,
                current_user=self.user,
            )

        self.assertEqual(ctx.exception.status_code, 500)
        self.assertIn("UPLOAD_DEDUPE_METRICS_RETENTION_DAYS invalido", str(ctx.exception.detail))
        self.assertFalse(db.committed)
        self.assertFalse(db.rolled_back)

    def test_cleanup_upload_dedupe_metricas_rolls_back_on_execution_error(self) -> None:
        atendimento.settings.UPLOAD_DEDUPE_METRICS_RETENTION_DAYS = 90
        db = _FakeCleanupDB(should_fail=True)

        with self.assertRaises(HTTPException) as ctx:
            atendimento.executar_cleanup_upload_dedupe_metricas(
                db=db,
                current_user=self.user,
            )

        self.assertEqual(ctx.exception.status_code, 500)
        self.assertIn("Falha ao executar cleanup de metricas de upload", str(ctx.exception.detail))
        self.assertFalse(db.committed)
        self.assertTrue(db.rolled_back)


if __name__ == "__main__":
    unittest.main()
