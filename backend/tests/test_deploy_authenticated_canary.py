import importlib.util
import unittest
from pathlib import Path


REPO_DIR = Path(__file__).resolve().parents[2]
SCRIPT_PATH = REPO_DIR / "scripts" / "deploy_authenticated_canary.py"
SPEC = importlib.util.spec_from_file_location("deploy_authenticated_canary", SCRIPT_PATH)
if SPEC is None or SPEC.loader is None:
    raise RuntimeError(f"Nao foi possivel carregar script canary: {SCRIPT_PATH}")
CANARY = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(CANARY)


class DeployAuthenticatedCanaryValidationTest(unittest.TestCase):
    def test_validate_admin_payload_ok(self) -> None:
        payload = {
            "runtime": {
                "ready": True,
                "observability": {
                    "http_5xx_monitor": {"alert_active": False},
                    "upload_dedupe_cleanup_worker": {
                        "enabled": True,
                        "status": "running",
                        "thread_alive": True,
                    },
                },
            }
        }
        self.assertEqual(CANARY._validate_admin_payload(payload), [])

    def test_validate_admin_payload_flags_unhealthy_signals(self) -> None:
        payload = {
            "runtime": {
                "ready": False,
                "observability": {
                    "http_5xx_monitor": {"alert_active": True},
                    "upload_dedupe_cleanup_worker": {
                        "enabled": True,
                        "status": "stopped",
                        "thread_alive": False,
                    },
                },
            }
        }
        errors = CANARY._validate_admin_payload(payload)
        self.assertTrue(any("runtime.ready" in item for item in errors))
        self.assertTrue(any("alert_active=true" in item for item in errors))
        self.assertTrue(any("status invalido" in item for item in errors))
        self.assertTrue(any("thread_alive=false" in item for item in errors))

    def test_validate_agenda_payload_requires_items_list(self) -> None:
        self.assertEqual(CANARY._validate_agenda_payload({"items": []}), [])
        errors = CANARY._validate_agenda_payload({"items": "nao-lista"})
        self.assertTrue(any("items" in item for item in errors))

    def test_validate_cleanup_status_payload_requires_expected_keys(self) -> None:
        payload = {
            "last_status": "ok",
            "consecutive_failures": 0,
            "alert_active": False,
        }
        self.assertEqual(CANARY._validate_cleanup_status_payload(payload), [])

        errors = CANARY._validate_cleanup_status_payload({"last_status": "ok"})
        self.assertTrue(any("consecutive_failures" in item for item in errors))
        self.assertTrue(any("alert_active" in item for item in errors))


if __name__ == "__main__":
    unittest.main()
