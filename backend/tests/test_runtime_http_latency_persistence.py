import importlib.util
import os
import sys
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import patch

from sqlalchemy import create_engine, inspect
from sqlalchemy.orm import sessionmaker

BACKEND_DIR = Path(__file__).resolve().parents[1]
os.chdir(BACKEND_DIR)
sys.path.insert(0, str(BACKEND_DIR))

os.environ.setdefault("DATABASE_URL", "sqlite:///./fortcordis.db")
os.environ.setdefault("SECRET_KEY", "runtime-latency-persistence-test-secret-key-1234567890")

from app.db import database
from app.models.runtime_http_latency_metric import RuntimeHttpLatencyMetric
from app.services import runtime_observability

MIGRATION_PATH = (
    BACKEND_DIR / "migrations" / "versions" / "20260903_80_runtime_http_latency_metrics.py"
)
SPEC = importlib.util.spec_from_file_location("migration_20260903_80", MIGRATION_PATH)
if SPEC is None or SPEC.loader is None:
    raise RuntimeError(f"Nao foi possivel carregar migracao: {MIGRATION_PATH}")
MIGRATION = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MIGRATION)


class RuntimeHttpLatencyPersistenceTest(unittest.TestCase):
    def setUp(self) -> None:
        runtime_observability.reset_http_5xx_monitor_state_for_tests()
        self.tmpdir = tempfile.TemporaryDirectory()
        self.engine = create_engine(f"sqlite:///{Path(self.tmpdir.name) / 'metrics.db'}")
        with self.engine.begin() as connection:
            MIGRATION.upgrade(connection, "sqlite")
            MIGRATION.upgrade(connection, "sqlite")
        self.session_factory = sessionmaker(autocommit=False, autoflush=False, bind=self.engine)
        self.session_patch = patch.object(database, "SessionLocal", self.session_factory)
        self.session_patch.start()

    def tearDown(self) -> None:
        self.session_patch.stop()
        self.engine.dispose()
        self.tmpdir.cleanup()
        runtime_observability.reset_http_5xx_monitor_state_for_tests()

    def test_migration_creates_idempotent_table_and_indexes(self) -> None:
        inspector = inspect(self.engine)
        self.assertIn("runtime_http_latency_metrics", inspector.get_table_names())
        index_names = {
            item["name"]
            for item in inspector.get_indexes("runtime_http_latency_metrics")
        }
        self.assertIn("ix_runtime_http_latency_metrics_created_at", index_names)
        self.assertIn(
            "ix_runtime_http_latency_metrics_endpoint_release_created",
            index_names,
        )

    def test_request_context_and_persisted_summary_keep_only_aggregate_fields(self) -> None:
        with patch.object(runtime_observability.settings, "RUNTIME_HTTP_LATENCY_RELEASE_ID", "abc123"):
            token = runtime_observability.begin_http_request_observation("/api/v1/agenda/42")
            runtime_observability.record_database_query_duration(12.5)
            runtime_observability.record_database_query_duration(7.5)
            runtime_observability.record_database_pool_wait(3.25)
            first_sample = runtime_observability.record_http_request(
                path="/api/v1/agenda/42",
                status_code=200,
                duration_ms=100,
            )
            runtime_observability.end_http_request_observation(token)
            second_sample = runtime_observability.record_http_request(
                path="/api/v1/agenda/999?paciente=nao-persistir",
                status_code=503,
                duration_ms=300,
                database_ms=50,
                pool_wait_ms=10,
            )

        self.assertEqual(first_sample["endpoint"], "/api/v1/agenda")
        self.assertEqual(first_sample["database_ms"], 20.0)
        self.assertEqual(first_sample["pool_wait_ms"], 3.25)
        self.assertNotIn("42", first_sample.values())
        self.assertTrue(runtime_observability.persist_http_latency_sample(first_sample))
        self.assertTrue(runtime_observability.persist_http_latency_sample(second_sample))

        db = self.session_factory()
        try:
            payload = runtime_observability.get_persisted_http_latency_summary(db, hours=24)
        finally:
            db.close()

        self.assertTrue(payload["available"])
        self.assertFalse(payload["truncated"])
        self.assertEqual(len(payload["groups"]), 1)
        group = payload["groups"][0]
        self.assertEqual(group["endpoint"], "/api/v1/agenda")
        self.assertEqual(group["release_id"], "abc123")
        self.assertEqual(group["request_count"], 2)
        self.assertEqual(group["error_5xx_count"], 1)
        self.assertEqual(group["p50_ms"], 100.0)
        self.assertEqual(group["p95_ms"], 300.0)
        self.assertEqual(group["database_p95_ms"], 50.0)
        self.assertEqual(group["pool_wait_p95_ms"], 10.0)

    def test_persistence_failure_is_isolated_from_request(self) -> None:
        sample = runtime_observability.record_http_request(
            path="/api/v1/agenda/42",
            status_code=200,
            duration_ms=100,
        )
        with patch.object(database, "SessionLocal", side_effect=RuntimeError("indisponivel")):
            self.assertFalse(runtime_observability.persist_http_latency_sample(sample))

    def test_first_persisted_write_cleans_expired_samples_with_bounded_retention(self) -> None:
        db = self.session_factory()
        try:
            db.add(
                RuntimeHttpLatencyMetric(
                    endpoint="/api/v1/agenda",
                    release_id="old-release",
                    status_code=200,
                    duration_ms=100,
                    database_ms=10,
                    pool_wait_ms=1,
                    created_at=datetime.now(timezone.utc) - timedelta(days=2),
                )
            )
            db.commit()
        finally:
            db.close()

        sample = runtime_observability.record_http_request(
            path="/api/v1/agenda/42",
            status_code=200,
            duration_ms=100,
        )
        with patch.object(runtime_observability.settings, "RUNTIME_HTTP_LATENCY_RETENTION_DAYS", 1):
            self.assertTrue(runtime_observability.persist_http_latency_sample(sample))

        db = self.session_factory()
        try:
            rows = db.query(RuntimeHttpLatencyMetric).all()
        finally:
            db.close()
        self.assertEqual(len(rows), 1)
        self.assertNotEqual(rows[0].release_id, "old-release")


if __name__ == "__main__":
    unittest.main()
