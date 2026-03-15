from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent
os.chdir(BACKEND_DIR)
sys.path.insert(0, str(BACKEND_DIR))

from app.db.database import SessionLocal
from app.services.frases_service import (
    ensure_frases_store_seeded,
    get_frases_store_report,
    sync_frases_json_mirror,
)


def build_sync_result(apply: bool = False) -> dict:
    report_before = get_frases_store_report()
    result = {
        "before": report_before,
        "apply_requested": bool(apply),
        "seed": None,
        "json_mirror": None,
    }

    if apply:
        db = SessionLocal()
        try:
            result["seed"] = ensure_frases_store_seeded(db)
            report_after_seed = get_frases_store_report()
            if int(report_after_seed.get("missing_in_database_count") or 0) == 0:
                result["json_mirror"] = sync_frases_json_mirror(db)
            else:
                result["json_mirror"] = {
                    "synced": False,
                    "count": 0,
                    "reason": "database_still_missing_entries",
                    "missing_in_database_count": int(report_after_seed.get("missing_in_database_count") or 0),
                    "extra_in_database_count": int(report_after_seed.get("extra_in_database_count") or 0),
                }
        finally:
            db.close()

    result["after"] = get_frases_store_report()
    return result


def main() -> None:
    parser = argparse.ArgumentParser(description="Inspeciona ou sincroniza o store de frases.")
    parser.add_argument("--apply", action="store_true", help="Aplica seed no banco e regrava o espelho JSON.")
    args = parser.parse_args()

    result = build_sync_result(apply=bool(args.apply))
    print(json.dumps(result, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
