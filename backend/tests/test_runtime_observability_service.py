import os
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

BACKEND_DIR = Path(__file__).resolve().parents[1]
os.chdir(BACKEND_DIR)
sys.path.insert(0, str(BACKEND_DIR))

os.environ.setdefault("DATABASE_URL", "sqlite:///./fortcordis.db")
os.environ.setdefault("SECRET_KEY", "runtime-observability-test-secret-key-1234567890")

from app.services import runtime_observability


class RuntimeObservabilityServiceTest(unittest.TestCase):
    def setUp(self) -> None:
        runtime_observability.reset_http_5xx_monitor_state_for_tests()

    def tearDown(self) -> None:
        runtime_observability.reset_http_5xx_monitor_state_for_tests()

    def test_record_http_status_counts_only_5xx(self) -> None:
        runtime_observability.record_http_status(200)
        runtime_observability.record_http_status(404)
        runtime_observability.record_http_status(500)
        runtime_observability.record_http_status(503)

        payload = runtime_observability.get_http_5xx_monitor_status()
        self.assertEqual(payload["recent_5xx_count"], 2)

    def test_alert_activates_when_threshold_reached(self) -> None:
        with patch.object(runtime_observability.settings, "RUNTIME_HTTP_5XX_ALERT_THRESHOLD", 2):
            runtime_observability.record_http_status(500)
            runtime_observability.record_http_status(501)
            payload = runtime_observability.get_http_5xx_monitor_status()

        self.assertTrue(payload["alert_active"])
        self.assertEqual(payload["recent_5xx_count"], 2)

    def test_old_events_are_pruned_by_window(self) -> None:
        with patch.object(runtime_observability.settings, "RUNTIME_HTTP_5XX_ALERT_WINDOW_MINUTES", 1):
            with patch("app.services.runtime_observability.time.monotonic", return_value=1000.0):
                runtime_observability.record_http_status(500)

            with patch("app.services.runtime_observability.time.monotonic", return_value=1065.0):
                payload = runtime_observability.get_http_5xx_monitor_status()

        self.assertEqual(payload["recent_5xx_count"], 0)
        self.assertFalse(payload["alert_active"])

    def test_invalid_config_falls_back_to_defaults_with_warning(self) -> None:
        with patch.object(runtime_observability.settings, "RUNTIME_HTTP_5XX_ALERT_WINDOW_MINUTES", 0):
            with patch.object(runtime_observability.settings, "RUNTIME_HTTP_5XX_ALERT_THRESHOLD", "abc"):
                payload = runtime_observability.get_http_5xx_monitor_status()

        self.assertEqual(payload["window_minutes"], 5)
        self.assertEqual(payload["threshold"], 20)
        self.assertGreaterEqual(len(payload["config_warnings"]), 1)

    def test_http_latency_monitor_tracks_p95_and_p99_for_priority_endpoint(self) -> None:
        with patch.object(
            runtime_observability.settings,
            "RUNTIME_HTTP_LATENCY_PRIORITY_ENDPOINTS",
            "/api/v1/agenda,/api/v1/atendimentos,/api/v1/relatorios,/api/v1/fiscal,/api/v1/logistica",
        ):
            runtime_observability.record_http_request(
                path="/api/v1/agenda",
                status_code=200,
                duration_ms=10,
            )
            runtime_observability.record_http_request(
                path="/api/v1/agenda/123",
                status_code=200,
                duration_ms=100,
            )
            runtime_observability.record_http_request(
                path="/api/v1/agenda",
                status_code=503,
                duration_ms=250,
            )

        payload = runtime_observability.get_http_latency_monitor_status()
        agenda = payload["endpoints"]["/api/v1/agenda"]
        self.assertEqual(agenda["request_count"], 3)
        self.assertEqual(agenda["error_5xx_count"], 1)
        self.assertEqual(agenda["p95_ms"], 250.0)
        self.assertEqual(agenda["p99_ms"], 250.0)
        self.assertIsNotNone(agenda["last_seen_at"])

    def test_http_latency_monitor_ignores_non_priority_endpoint(self) -> None:
        with patch.object(
            runtime_observability.settings,
            "RUNTIME_HTTP_LATENCY_PRIORITY_ENDPOINTS",
            "/api/v1/agenda,/api/v1/atendimentos,/api/v1/relatorios,/api/v1/fiscal,/api/v1/logistica",
        ):
            runtime_observability.record_http_request(
                path="/api/v1/pacientes",
                status_code=200,
                duration_ms=30,
            )

        payload = runtime_observability.get_http_latency_monitor_status()
        for endpoint in payload["priority_endpoints"]:
            self.assertEqual(payload["endpoints"][endpoint]["request_count"], 0)

    def test_http_latency_monitor_prunes_old_events_by_window(self) -> None:
        with patch.object(runtime_observability.settings, "RUNTIME_HTTP_LATENCY_WINDOW_MINUTES", 1):
            with patch("app.services.runtime_observability.time.monotonic", return_value=1000.0):
                runtime_observability.record_http_request(
                    path="/api/v1/agenda",
                    status_code=200,
                    duration_ms=50,
                )
            with patch("app.services.runtime_observability.time.monotonic", return_value=1065.0):
                payload = runtime_observability.get_http_latency_monitor_status()

        agenda = payload["endpoints"]["/api/v1/agenda"]
        self.assertEqual(agenda["request_count"], 0)
        self.assertIsNone(agenda["p95_ms"])
        self.assertIsNone(agenda["p99_ms"])


if __name__ == "__main__":
    unittest.main()
