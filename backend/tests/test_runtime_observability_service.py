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
        self.assertEqual(agenda["max_ms"], 250.0)
        self.assertEqual(agenda["slow_request_count"], 0)
        self.assertEqual(agenda["p95_ms"], 250.0)
        self.assertEqual(agenda["p99_ms"], 250.0)
        self.assertIsNotNone(agenda["last_seen_at"])

    def test_http_latency_monitor_keeps_max_and_counts_only_samples_above_gate(self) -> None:
        for duration_ms in (100, 1200, 1200.01, 2400):
            runtime_observability.record_http_request(
                path="/api/v1/agenda",
                status_code=200,
                duration_ms=duration_ms,
            )

        payload = runtime_observability.get_http_latency_monitor_status()
        agenda = payload["endpoints"]["/api/v1/agenda"]
        self.assertEqual(payload["slow_request_threshold_ms"], 1200.0)
        self.assertEqual(agenda["max_ms"], 2400.0)
        self.assertEqual(agenda["slow_request_count"], 2)

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

    def test_http_latency_monitor_tracks_exact_financeiro_reads_separately(self) -> None:
        with patch.object(
            runtime_observability.settings,
            "RUNTIME_HTTP_LATENCY_EXACT_ENDPOINTS",
            "/api/v1/ordens-servico,/api/v1/ordens-servico/cobrancas",
        ):
            runtime_observability.record_http_request(
                path="/api/v1/ordens-servico",
                method="GET",
                status_code=200,
                duration_ms=120,
            )
            runtime_observability.record_http_request(
                path="/api/v1/ordens-servico/cobrancas",
                method="GET",
                status_code=200,
                duration_ms=240,
            )
            runtime_observability.record_http_request(
                path="/api/v1/ordens-servico/123",
                method="GET",
                status_code=200,
                duration_ms=900,
            )
            runtime_observability.record_http_request(
                path="/api/v1/ordens-servico",
                method="POST",
                status_code=201,
                duration_ms=600,
            )
            payload = runtime_observability.get_http_latency_monitor_status()

        ordens = payload["endpoints"]["/api/v1/ordens-servico"]
        cobrancas = payload["endpoints"]["/api/v1/ordens-servico/cobrancas"]
        self.assertEqual(ordens["request_count"], 1)
        self.assertEqual(ordens["p50_ms"], 120.0)
        self.assertEqual(ordens["p95_ms"], 120.0)
        self.assertEqual(cobrancas["request_count"], 1)
        self.assertEqual(cobrancas["p50_ms"], 240.0)
        self.assertEqual(cobrancas["p95_ms"], 240.0)
        self.assertEqual(
            payload["exact_endpoints"],
            ["/api/v1/ordens-servico", "/api/v1/ordens-servico/cobrancas"],
        )
        self.assertEqual(len(payload["priority_endpoint_prefixes"]), 5)
        self.assertEqual(len(payload["priority_endpoints"]), 7)

    def test_http_latency_monitor_warns_when_endpoint_limits_are_exceeded(self) -> None:
        configured_prefixes = ",".join(f"/api/v1/prefix-{index}" for index in range(6))
        configured_exact = ",".join(f"/api/v1/exact-{index}" for index in range(6))
        with patch.object(
            runtime_observability.settings,
            "RUNTIME_HTTP_LATENCY_PRIORITY_ENDPOINTS",
            configured_prefixes,
        ), patch.object(
            runtime_observability.settings,
            "RUNTIME_HTTP_LATENCY_EXACT_ENDPOINTS",
            configured_exact,
        ):
            payload = runtime_observability.get_http_latency_monitor_config()

        self.assertEqual(len(payload["priority_endpoint_prefixes"]), 5)
        self.assertEqual(len(payload["exact_endpoints"]), 5)
        self.assertTrue(
            any("PRIORITY_ENDPOINTS excede o limite" in item for item in payload["warnings"])
        )
        self.assertTrue(
            any("EXACT_ENDPOINTS excede o limite" in item for item in payload["warnings"])
        )

    def test_exact_read_never_falls_back_to_overlapping_prefix_for_non_get(self) -> None:
        with patch.object(
            runtime_observability.settings,
            "RUNTIME_HTTP_LATENCY_PRIORITY_ENDPOINTS",
            "/api/v1/ordens-servico",
        ), patch.object(
            runtime_observability.settings,
            "RUNTIME_HTTP_LATENCY_EXACT_ENDPOINTS",
            "/api/v1/ordens-servico",
        ):
            sample_without_method = runtime_observability.record_http_request(
                path="/api/v1/ordens-servico",
                status_code=200,
                duration_ms=400,
            )
            post_sample = runtime_observability.record_http_request(
                path="/api/v1/ordens-servico",
                method="POST",
                status_code=201,
                duration_ms=600,
            )
            detail_sample = runtime_observability.record_http_request(
                path="/api/v1/ordens-servico/123",
                method="GET",
                status_code=200,
                duration_ms=800,
            )
            get_sample = runtime_observability.record_http_request(
                path="/api/v1/ordens-servico",
                method="GET",
                status_code=200,
                duration_ms=120,
            )
            payload = runtime_observability.get_http_latency_monitor_status()

        self.assertIsNone(sample_without_method)
        self.assertIsNone(post_sample)
        self.assertIsNone(detail_sample)
        self.assertIsNotNone(get_sample)
        self.assertEqual(payload["priority_endpoint_prefixes"], [])
        self.assertTrue(
            any("prefixo duplicado foi ignorado" in item for item in payload["config_warnings"])
        )
        self.assertEqual(
            payload["endpoints"]["/api/v1/ordens-servico"]["request_count"],
            1,
        )

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
        self.assertIsNone(agenda["max_ms"])
        self.assertEqual(agenda["slow_request_count"], 0)
        self.assertIsNone(agenda["p95_ms"])
        self.assertIsNone(agenda["p99_ms"])


if __name__ == "__main__":
    unittest.main()
