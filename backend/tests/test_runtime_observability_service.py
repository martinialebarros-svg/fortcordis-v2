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


if __name__ == "__main__":
    unittest.main()
