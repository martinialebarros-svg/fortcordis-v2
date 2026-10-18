#!/usr/bin/env python3
"""Stage-only proof with an isolated PostgreSQL schema and zero Google traffic.

The live API is probed only for default denial. Successful execution/concurrency
use the deployed code in this process with a synthetic transport and schema.
No existing policy, clinic, appointment or message is modified.
"""
from __future__ import annotations

import json
import os
import sys
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import patch
from urllib.error import HTTPError
from urllib.request import Request, urlopen
from uuid import uuid4
from zoneinfo import ZoneInfo


def main():
    root = Path(__file__).resolve().parents[1]
    backend = root / "backend"
    if root != Path("/var/www/fortcordis-stage"):
        raise RuntimeError("Canário permitido somente no checkout de stage.")
    os.chdir(backend)
    sys.path.insert(0, str(backend))
    sys.path.insert(0, str(root / "scripts"))
    from app.core.config import settings
    from fiscal_rotina_stage_canary import _validar_destino
    _validar_destino(root, settings.APP_ENV, settings.DATABASE_URL)

    from deploy_authenticated_canary import _token_from_internal_backend
    bearer = _token_from_internal_backend(str(backend))

    def live_request(path, body=None):
        data = json.dumps(body).encode() if body is not None else None
        req = Request("http://127.0.0.1:8001/api/v1" + path, data=data,
                      headers={"Authorization": "Bearer " + bearer, "Content-Type": "application/json"})
        try:
            with urlopen(req, timeout=20) as response:
                return response.status, json.loads(response.read())
        except HTTPError as exc:
            return exc.code, json.loads(exc.read())

    code, live_status = live_request("/google-maps-control/status")
    assert code == 200 and not live_status["enabled"], "Stage deve permanecer sem gasto habilitado"
    code, denial = live_request("/agenda/sugestoes-horario", {})
    assert code == 409 and denial["detail"]["code"] == "GOOGLE_MAPS_COST_BLOCKED"
    code, denied_preview = live_request("/google-maps-control/preview", {
        "method": "POST", "path": "/api/v1/agenda/sugestoes-horario", "body": {},
    })
    assert code == 200 and denied_preview["blocked"] and denied_preview["quote_id"] is None

    from sqlalchemy import create_engine, text
    from app.db import database
    from app.models.google_maps_cost_control import COST_TABLES
    from app.services import google_maps_cost_control as guard, logistica_service, geocoding_service
    schema = "maps_canary_" + uuid4().hex
    admin = create_engine(settings.DATABASE_URL, pool_pre_ping=True)
    with admin.begin() as connection:
        connection.execute(text(f'CREATE SCHEMA "{schema}"'))
    synthetic = create_engine(settings.DATABASE_URL, pool_pre_ping=True, pool_size=8,
                              execution_options={"schema_translate_map": {None: schema}})
    try:
        for table in COST_TABLES:
            table.create(synthetic)
        day = datetime.now(ZoneInfo("America/Fortaleza")).date().isoformat()
        config = guard.CostConfiguration.model_validate({
            "enabled": True,
            "limits": {"action": {"calls": 3, "estimated_brl": 1},
                       "day": {"calls": 4, "estimated_brl": 1},
                       "month": {"calls": 5, "estimated_brl": 1}},
            "prices_usd": {sku: "0.01" for sku in guard.SKUS},
            "fx_brl_per_usd_upper": 6, "price_multiplier": 1,
            "pricing_valid_until": (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat(),
            "opening_usage": {"day": {"calls": 0, "estimated_brl": 0},
                              "month": {"calls": 0, "estimated_brl": 0}},
            "opening_usage_as_of": day, "opening_usage_basis": "synthetic_stage",
        })
        outbound = []
        def fake_http(*args, **kwargs):
            outbound.append("synthetic")
            return {"routes": [{"distanceMeters": 1000, "duration": "600s"}]}
        path = "/api/v1/logistica/deslocamento"
        query = {"origem_clinica_id": "1", "destino_clinica_id": "2"}
        with (patch.object(database, "engine", synthetic),
              patch.object(settings, "GOOGLE_MAPS_API_KEY", "synthetic-stage-only"),
              patch.object(logistica_service, "urlopen", side_effect=AssertionError("Unexpected real transport")),
              patch.object(logistica_service, "_http_get_json", side_effect=AssertionError("Unexpected fallback transport")),
              patch.object(geocoding_service, "urlopen", side_effect=AssertionError("Unexpected geocoding transport")),
              patch.object(logistica_service, "_http_post_json", side_effect=fake_http)):
            guard.update_configuration(999999, config, 0)
            def quote():
                return guard.create_preview(999999, "GET", path, query, None)
            abandoned = quote()
            assert abandoned["required"] and not outbound
            tokens = [guard.confirm_preview(999999, quote()["quote_id"])["token"] for _ in range(8)]
            def run(token):
                execution = guard.claim_execution(999999, token, "GET", path, query, None)
                context = guard.bind_execution(execution)
                try:
                    logistica_service._consultar_google_routes_api_raw({"address": "synthetic A"}, {"address": "synthetic B"})
                    return True
                except guard.GoogleMapsCostBlocked:
                    return False
                finally:
                    guard.reset_execution(context)
                    guard.finish_execution(execution)
            with ThreadPoolExecutor(max_workers=8) as pool:
                results = list(pool.map(run, tokens))
            assert sum(results) == 4 and len(outbound) == 4
            try:
                guard.claim_execution(999999, tokens[0], "GET", path, query, None)
                raise AssertionError("Replay aceito")
            except guard.GoogleMapsCostBlocked:
                pass
            try:
                with guard.automatic_action("whatsapp_agenda", "synthetic-one-job"):
                    logistica_service._consultar_google_routes_api_raw({"address": "synthetic A"}, {"address": "synthetic B"})
                raise AssertionError("Automação sem política aceita")
            except guard.GoogleMapsCostBlocked:
                pass
            assert len(outbound) == 4
            usage = guard.get_status()["consumption"]
            assert usage["day"]["calls"] == 4 and usage["month"]["calls"] == 4
            # Reopen the pool: authorization/usage is durable, not process cache.
            synthetic.dispose()
            assert guard.get_status()["consumption"] == usage
        print(json.dumps({"stage_live_direct_request_blocked": True,
            "stage_live_preview_blocked": True, "isolated_postgresql": True,
            "cancelled_preview_paid_calls": 0, "concurrent_attempts": 8,
            "synthetic_outbound_calls": len(outbound), "daily_limit": 4,
            "replay_blocked": True, "automatic_without_policy_blocked": True,
            "usage_survives_reconnect": True, "actual_google_calls": 0,
            "existing_operational_records_modified": 0}))
    finally:
        synthetic.dispose()
        with admin.begin() as connection:
            connection.execute(text(f'DROP SCHEMA "{schema}" CASCADE'))
        admin.dispose()


if __name__ == "__main__":
    main()
