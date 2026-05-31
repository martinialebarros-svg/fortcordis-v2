import os
import sys
import unittest
from pathlib import Path
from unittest.mock import patch
from urllib.parse import parse_qs, urlparse

BACKEND_DIR = Path(__file__).resolve().parents[1]
os.chdir(BACKEND_DIR)
sys.path.insert(0, str(BACKEND_DIR))
os.environ.setdefault("DATABASE_URL", "sqlite:///./fortcordis.db")
os.environ.setdefault("SECRET_KEY", "logistica-google-cost-controls-test-secret-key-1234567890")

from app.models.clinica import Clinica
from app.services import logistica_service


class LogisticaGoogleCostControlsTest(unittest.TestCase):
    def test_estimar_deslocamento_pula_google_quando_lookup_ao_vivo_desligado(self) -> None:
        origem = Clinica(id=1, nome="Origem", latitude=-3.7200, longitude=-38.5200)
        destino = Clinica(id=2, nome="Destino", latitude=-3.8100, longitude=-38.6100)
        telemetry = []

        with (
            patch.object(logistica_service.settings, "GOOGLE_MAPS_API_KEY", "fake-key"),
            patch.object(logistica_service, "_consultar_google_routes_api_raw") as mocked_routes,
            patch.object(logistica_service, "_consultar_google_distance_matrix_raw") as mocked_dm,
        ):
            _km, duracao_min, fonte = logistica_service.estimar_deslocamento(
                origem,
                destino,
                perfil="comercial",
                permitir_google_lookup=False,
                telemetry_events=telemetry,
            )

        mocked_routes.assert_not_called()
        mocked_dm.assert_not_called()
        self.assertGreater(duracao_min, 0)
        self.assertTrue(fonte.startswith("heuristica_"))
        self.assertTrue(
            any(
                event.get("operation") == "google_lookup_skipped" and event.get("status") == "skipped"
                for event in telemetry
            )
        )

    def test_routes_usa_routing_traffic_unaware_por_padrao(self) -> None:
        telemetry = []
        captured_bodies = []

        def _fake_post(_url, body, headers=None, timeout=8.0):
            captured_bodies.append(body)
            return {
                "routes": [
                    {
                        "distanceMeters": 10000,
                        "duration": "1200s",
                    }
                ]
            }

        with (
            patch.object(logistica_service.settings, "GOOGLE_MAPS_API_KEY", "fake-key"),
            patch.object(logistica_service.settings, "LOGISTICA_GOOGLE_TRAFFIC_AWARE", False),
            patch.object(logistica_service, "_http_post_json", side_effect=_fake_post),
        ):
            out = logistica_service._consultar_google_routes_api_raw(
                {"address": "A"},
                {"address": "B"},
                telemetry_events=telemetry,
            )

        self.assertIsNotNone(out)
        self.assertEqual(captured_bodies[0].get("routingPreference"), "TRAFFIC_UNAWARE")
        self.assertEqual(out.get("provider"), "routes_api_basic")

    def test_distance_matrix_sem_parametros_de_trafego_quando_flag_desligada(self) -> None:
        telemetry = []
        captured_urls = []

        def _fake_get(url, timeout=8.0):
            captured_urls.append(url)
            return {
                "status": "OK",
                "rows": [
                    {
                        "elements": [
                            {
                                "status": "OK",
                                "distance": {"value": 1500},
                                "duration": {"value": 240},
                            }
                        ]
                    }
                ],
            }

        with (
            patch.object(logistica_service.settings, "GOOGLE_MAPS_API_KEY", "fake-key"),
            patch.object(logistica_service.settings, "LOGISTICA_GOOGLE_TRAFFIC_AWARE", False),
            patch.object(logistica_service, "_http_get_json", side_effect=_fake_get),
        ):
            out = logistica_service._consultar_google_distance_matrix_raw(
                "-3.72,-38.52",
                "-3.81,-38.61",
                telemetry_events=telemetry,
            )

        self.assertIsNotNone(out)
        self.assertEqual(out.get("provider"), "distance_matrix_basic")
        query = parse_qs(urlparse(captured_urls[0]).query)
        self.assertNotIn("departure_time", query)
        self.assertNotIn("traffic_model", query)


if __name__ == "__main__":
    unittest.main()
