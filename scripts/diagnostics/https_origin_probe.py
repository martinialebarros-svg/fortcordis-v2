#!/usr/bin/env python3
"""Bounded public HTTPS diagnostics. Planning never makes a network request."""

import argparse
import datetime as dt
import ipaddress
import json
import math
from pathlib import Path
import platform
import re
import subprocess
import time

UTC = dt.timezone.utc
APP_URL = "https://app.fortcordis.com.br/financeiro"
CONTROL_URL = "https://example.com/"
SLOTS = 20
INTERVAL_SECONDS = 10
MAX_LATENESS_SECONDS = 2
TIME_FIELDS = (
    "time_namelookup", "time_connect", "time_appconnect",
    "time_pretransfer", "time_starttransfer", "time_total",
)


class ScheduleLatenessExceeded(Exception):
    pass


def stamp(epoch=None):
    return dt.datetime.fromtimestamp(time.time() if epoch is None else epoch, UTC).isoformat()


def parse_start(value):
    if not re.fullmatch(r"[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z", value):
        raise ValueError("start_utc must use YYYY-MM-DDTHH:MM:SSZ")
    try:
        return dt.datetime.strptime(value, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=UTC).timestamp()
    except ValueError:
        raise ValueError("start_utc is not a valid UTC date") from None


def safe_metrics(metadata):
    """Never copy raw curl JSON: it can contain URLs, certificate data or errors."""
    result = {}
    for key in TIME_FIELDS:
        value = metadata.get(key)
        result[key] = value if isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value) and value >= 0 else None
    for key in ("http_code", "ssl_verify_result"):
        value = metadata.get(key)
        result[key] = value if isinstance(value, int) and not isinstance(value, bool) and value >= 0 else None
    version = metadata.get("http_version")
    result["http_version"] = version if version in ("0", "1", "1.0", "1.1", "2", "3") else None
    try:
        destination = str(ipaddress.ip_address(metadata.get("remote_ip", "")))
    except (ValueError, TypeError):
        destination = None
    result["destination_ip"] = destination
    return result


def runtime_metadata():
    """Read version only; discard build features, backend versions and all stderr."""
    curl_version = None
    try:
        completed = subprocess.run(
            ["curl", "-q", "--version"], stdin=subprocess.DEVNULL,
            capture_output=True, text=True, timeout=2,
        )
        match = re.match(r"curl ([0-9]+\.[0-9]+\.[0-9]+)(?:\s|$)", completed.stdout)
        if completed.returncode == 0 and match:
            curl_version = match.group(1)
    except (OSError, subprocess.TimeoutExpired):
        pass
    system = platform.system()
    return {"platform": system if system in ("Darwin", "Linux", "Windows") else "other", "curl_version": curl_version}


def classify_timeout(metrics):
    """Attribute only phases supported by curl's completed-stage timings."""
    dns = metrics["time_namelookup"]
    tcp = metrics["time_connect"]
    tls = metrics["time_appconnect"]
    first_byte = metrics["time_starttransfer"]
    if tcp == 0 and tls == 0:
        return "tcp_connect_timeout" if dns is not None and dns > 0 else "preconnect_or_dns_timeout"
    if tcp is not None and tcp > 0 and tls == 0:
        return "tls_handshake_timeout"
    if tls is not None and tls > 0 and first_byte == 0:
        return "first_byte_timeout"
    if first_byte is not None and first_byte > 0:
        return "transfer_timeout"
    return "timeout_phase_unconfirmed"


def probe(url, origin, nonce, slot, scheduled_epoch=None):
    started = time.time()
    if scheduled_epoch is not None and started - scheduled_epoch > MAX_LATENESS_SECONDS:
        raise ScheduleLatenessExceeded
    user_agent = f"FortCordis-Diagnostic-{nonce}-{origin}-{slot}"
    command = [
        "curl", "-q", "--noproxy", "*", "--silent", "--show-error",
        "--http1.1", "--proto", "=https", "--proto-redir", "=https",
        "--max-redirs", "0", "--connect-timeout", "4", "--max-time", "6",
        "--user-agent", user_agent, "--output", "/dev/null", "--write-out", "%{json}", url,
    ]
    metadata = {}
    try:
        completed = subprocess.run(command, stdin=subprocess.DEVNULL, capture_output=True, text=True, timeout=8)
        exit_code = completed.returncode
        try:
            parsed = json.loads(completed.stdout)
            metadata = parsed if isinstance(parsed, dict) else {}
        except (ValueError, TypeError):
            pass
        # Raw stderr is discarded; localized curl messages never determine phase.
        error_category = "curl_error" if exit_code != 0 else None
    except subprocess.TimeoutExpired:
        exit_code, error_category = 124, "process_timeout"
    except OSError:
        exit_code, error_category = 125, "process_unavailable"
    metrics = safe_metrics(metadata)
    if exit_code == 28:
        error_category = classify_timeout(metrics)
    response_ok = exit_code == 0 and metrics["http_code"] == 200 and metrics["ssl_verify_result"] == 0 and metrics["http_version"] == "1.1"
    category = "success" if response_ok else error_category or "unexpected_response_or_metadata"
    return {
        "origin": origin, "slot": slot, "target": "financeiro" if url == APP_URL else "control_example",
        "started_at_utc": stamp(started), "ended_at_utc": stamp(),
        "scheduled_start_utc": stamp(scheduled_epoch) if scheduled_epoch is not None else None,
        "start_lateness_seconds": round(started - scheduled_epoch, 6) if scheduled_epoch is not None else None,
        "curl_exit": exit_code, "category": category, "expected_response": response_ok,
        "connect_timeout_seconds": 4, "transfer_timeout_seconds": 6, "process_timeout_seconds": 8,
        **metrics,
    }


def run_collection(args, start_epoch):
    output = Path(args.output_dir)
    output.mkdir(parents=True, exist_ok=False)
    rows = []
    aborted_reason = None
    aborted_slot = None
    execution_started = stamp()
    runtime = runtime_metadata()
    with (output / "observations.jsonl").open("x", encoding="utf-8") as stream:
        def record(row):
            rows.append(row)
            line = json.dumps(row, ensure_ascii=False, allow_nan=False)
            stream.write(line + "\n")
            stream.flush()
            print(line, flush=True)

        record(probe(CONTROL_URL, args.origin, args.nonce, "control-before"))
        for slot in range(1, SLOTS + 1):
            scheduled = start_epoch + (slot - 1) * INTERVAL_SECONDS
            while True:
                remaining = scheduled - time.time()
                if remaining <= 0:
                    break
                time.sleep(min(0.2, remaining))
            if time.time() - scheduled > MAX_LATENESS_SECONDS:
                aborted_reason, aborted_slot = "schedule_lateness_exceeded_2_seconds", slot
                break
            try:
                row = probe(APP_URL, args.origin, args.nonce, slot, scheduled)
            except ScheduleLatenessExceeded:
                aborted_reason, aborted_slot = "probe_start_lateness_exceeded_2_seconds", slot
                break
            record(row)
            if row["start_lateness_seconds"] > MAX_LATENESS_SECONDS:
                aborted_reason, aborted_slot = "probe_start_lateness_exceeded_2_seconds", slot
                break
        app_rows = [row for row in rows if row["target"] == "financeiro"]
        if aborted_reason is None and len(app_rows) == SLOTS and any(not row["expected_response"] for row in rows):
            record(probe(CONTROL_URL, args.origin, args.nonce, "control-after"))

    control_rows = [row for row in rows if row["target"] == "control_example"]
    collection_complete = aborted_reason is None and len(app_rows) == SLOTS
    summary = {
        "schema_version": 1, "origin": args.origin, "correlation_nonce": args.nonce,
        "runtime": runtime,
        "planned_start_utc": args.start_utc, "execution_started_at_utc": execution_started,
        "completed_at_utc": stamp(), "collection_complete": collection_complete,
        "exit_code_meaning": "Zero means the scheduled collection completed, not that the service was healthy.",
        "aborted_reason": aborted_reason, "aborted_slot": aborted_slot,
        "attempts": len(rows), "maximum_attempts": 22,
        "app_attempts": len(app_rows), "app_expected_responses": sum(row["expected_response"] for row in app_rows),
        "app_failures": sum(not row["expected_response"] for row in app_rows),
        "control_attempts": len(control_rows), "control_failures": sum(not row["expected_response"] for row in control_rows),
        "categories": {category: sum(row["category"] == category for row in rows) for category in sorted({row["category"] for row in rows})},
        "protocol": {"slots": SLOTS, "interval_seconds": INTERVAL_SECONDS, "http": "1.1", "tls_verification_required": True, "redirects": False, "retries": 0, "concurrency_per_origin": 1},
        "limitations": [
            "A complete collection can contain failures; it does not prove continuous availability.",
            "A zero TLS verify result without a completed handshake is not TLS success.",
            "Destination addresses are retained; source addresses, credentials, headers, bodies and raw stderr are not recorded.",
            "A User-Agent only identifies a request after it reaches HTTP; it does not identify failed TCP handshakes.",
            "Timeout phases describe completed curl stages and do not establish the network fault's cause or location.",
        ],
    }
    (output / "summary.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2, allow_nan=False) + "\n", encoding="utf-8")
    print(json.dumps({"collection_complete": collection_complete, "attempts": len(rows), "app_failures": summary["app_failures"], "summary": str(output / "summary.json")}), flush=True)
    return 0 if collection_complete else 2


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--origin", choices=("local", "github"), required=True)
    parser.add_argument("--nonce", required=True)
    parser.add_argument("--start-utc", required=True)
    parser.add_argument("--output-dir", required=True)
    parser.add_argument("--execute", action="store_true")
    args = parser.parse_args(argv)
    if not re.fullmatch(r"[A-Za-z0-9]{8,32}", args.nonce):
        parser.error("nonce must contain 8..32 ASCII letters or digits")
    try:
        start_epoch = parse_start(args.start_utc)
    except ValueError as error:
        parser.error(str(error))
    if not args.execute:
        print(json.dumps({"mode": "plan_only", "network_requests_started": False, "origin": args.origin, "planned_start_utc": args.start_utc, "slots": SLOTS, "interval_seconds": INTERVAL_SECONDS, "maximum_gets": 22, "concurrency_per_origin": 1, "tls_verification_required": True, "follow_redirects": False, "execute_required": True}))
        return 0
    delay = start_epoch - time.time()
    if not 15 <= delay <= 300:
        parser.error("start_utc must be between 15 and 300 seconds in the future")
    if Path(args.output_dir).exists():
        parser.error("output-dir already exists; preserve the previous evidence")
    return run_collection(args, start_epoch)


if __name__ == "__main__":
    raise SystemExit(main())
