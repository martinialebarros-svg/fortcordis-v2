"""Read-only stage journal summary. Never emit payloads, SQL or error messages."""
from __future__ import annotations

import collections
import json
import re
import subprocess
import sys

EVENTS = (
    "Failed to persist webhook event",
    "PostgreSQL query failed",
    "Unexpected PostgreSQL pool error",
)
CODE = re.compile(r"^(?:[0-9A-Z]{5}|ECONNRESET|ECONNREFUSED|ETIMEDOUT|EPIPE|ENOTFOUND)$")
TIMESTAMP = re.compile(r"\[(\d{4}-\d{2}-\d{2}T[\d:.]+Z)\]")


def classify(message: str, code: str | None) -> str:
    value = message.lower()
    if code == "53300" or any(term in value for term in (
        "maxclients", "max client", "too many clients", "connection slots",
        "connection limit", "too many connections",
    )):
        return "connection_capacity"
    if code == "28P01" or "authentication failed" in value or "password authentication" in value:
        return "authentication_failure"
    if "timeout" in value or "timed out" in value or code == "ETIMEDOUT":
        return "timeout"
    if "certificate" in value or "ssl" in value or "tls" in value:
        return "tls_failure"
    if code in ("ECONNRESET", "ECONNREFUSED", "EPIPE", "ENOTFOUND", "08006", "08001") or any(
        term in value for term in ("connection terminated", "connection reset", "pooler is not healthy")
    ):
        return "connection_unavailable"
    if code == "23505":
        return "uniqueness_conflict"
    return "database_error"


def summarize(journal: str) -> dict:
    counts = collections.Counter()
    timestamps = []
    for line in journal.splitlines():
        event = next((event for event in EVENTS if event in line), None)
        if event is None:
            continue
        try:
            meta = json.loads(line[line.index("{", line.index(event)):])
        except (ValueError, json.JSONDecodeError):
            meta = {}
        details = meta.get("details", meta) if isinstance(meta, dict) else {}
        if not isinstance(details, dict):
            details = {}
        raw_code = details.get("code")
        code = raw_code if isinstance(raw_code, str) and CODE.fullmatch(raw_code) else None
        # The raw message is used only to classify; none of its words leave the host.
        message = str(details.get("message") or "")
        for inner in details.get("inner_errors") or []:
            if isinstance(inner, dict):
                message += " " + str(inner.get("message") or "")
        counts[(event, code, classify(message, code))] += 1
        timestamp = TIMESTAMP.search(line)
        if timestamp:
            timestamps.append(timestamp.group(1))
    return {
        "scope": "stage_whatsapp_persistence",
        "events_found": sum(counts.values()),
        "first_seen": min(timestamps) if timestamps else None,
        "last_seen": max(timestamps) if timestamps else None,
        "errors": [
            {"event": event, "code": code, "category": category, "count": count}
            for (event, code, category), count in sorted(counts.items(), key=lambda item: str(item[0]))
        ],
    }


def main() -> int:
    password = sys.stdin.readline().removesuffix("\n")
    result = subprocess.run(
        ["sudo", "-S", "-p", "", "journalctl", "-u", "fortcordis-stage-whatsapp-backend",
         "--since", "2 hours ago", "--no-pager", "-n", "5000", "-o", "cat"],
        input=password + "\n", text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
        timeout=45, check=False,
    )
    if result.returncode:
        print(json.dumps({"scope": "stage_whatsapp_persistence", "status": "journal_read_failed"}))
        return 1
    print(json.dumps(summarize(result.stdout), sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
