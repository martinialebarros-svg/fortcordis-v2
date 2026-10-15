#!/usr/bin/env python3
"""Bounded anonymous GET smoke. Planning is offline; --execute enables HTTPS."""

import argparse
import hashlib
import html
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import subprocess
import tempfile
import time
from urllib.parse import urljoin, urlsplit


TARGETS = {
    "stage": {
        "origin": "https://app.stage.fortcordis.com.br",
        "aliases": ["https://stage.fortcordis.com.br", "https://www.stage.fortcordis.com.br"],
    },
    "production": {"origin": "https://app.fortcordis.com.br", "aliases": []},
}
PAGE_PATH = "/laudos/novo"
MARKERS = (
    "VSVD/RVOT",
    "origem não confirmada",
    "Calculado: 4 × V².",
    "calculado (4 × V²)",
)
MAX_CHUNKS = 64
MAX_REQUESTS = MAX_CHUNKS + 6
MAX_BODY_BYTES = 8 * 1024 * 1024
MAX_SECONDS = 240
REDIRECT_STATUSES = {301, 302, 307, 308}
JAVASCRIPT_CONTENT_TYPES = {
    "text/javascript", "application/javascript", "application/x-javascript",
    "text/ecmascript", "application/ecmascript",
}


class SmokeError(Exception):
    """Messages are fixed diagnostic codes, never response content."""


def emit(event, **values):
    print(json.dumps({"event": event, **values}, ensure_ascii=False), flush=True)


def normalize_js_escapes(text):
    # Decode characters only; never evaluate downloaded JavaScript.
    text = text.replace("\\/", "/")
    for _ in range(2):
        text = re.sub(r"\\u\{([0-9a-fA-F]{1,6})\}",
                      lambda m: chr(int(m[1], 16)) if int(m[1], 16) <= 0x10FFFF else "", text)
        text = re.sub(r"\\u([0-9a-fA-F]{4})", lambda m: chr(int(m[1], 16)), text)
        text = re.sub(r"\\x([0-9a-fA-F]{2})", lambda m: chr(int(m[1], 16)), text)
    return text


class ScriptReferences(HTMLParser):
    def __init__(self):
        super().__init__()
        self.references = set()

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "script" and attrs.get("src"):
            self.references.add(attrs["src"])
        if tag == "link" and attrs.get("href"):
            if urlsplit(attrs["href"]).path.endswith(".js"):
                self.references.add(attrs["href"])


def same_origin_chunks(document, page_url, reference_notes=None):
    parser = ScriptReferences()
    parser.feed(document)
    # App Router also references chunks in inline Flight data. Observe these
    # references in this response; do not guess a route manifest or asset name.
    pattern = r"(?:/_next/)?static/chunks/[A-Za-z0-9_./%()\[\]@~+\-]+\.js"
    for reference in re.findall(pattern, normalize_js_escapes(html.unescape(document))):
        parser.references.add(reference if reference.startswith("/") else "/_next/" + reference)
    page = urlsplit(page_url)
    chunks = set()
    for reference in parser.references:
        candidate = urljoin(page_url, html.unescape(reference))
        target = urlsplit(candidate)
        if target.scheme != "https" or target.netloc != page.netloc:
            if reference_notes is not None:
                # Report the hostname only, never query strings or inline URLs
                # that might contain tokens. Do not fetch external bodies.
                host = target.hostname or "unrecognized"
                if not re.fullmatch(r"[A-Za-z0-9.\-]{1,253}", host):
                    host = "unrecognized"
                note = f"External script reference skipped (host: {host}); no external body requested."
                if note not in reference_notes:
                    reference_notes.append(note)
            continue
        if target.username or target.password or target.fragment or not target.path.endswith(".js"):
            continue
        if not target.path.startswith("/_next/static/"):
            raise SmokeError("same_origin_script_outside_next_static")
        chunks.add(candidate)
    if not chunks:
        raise SmokeError("no_same_origin_javascript_references")
    if len(chunks) > MAX_CHUNKS:
        raise SmokeError("same_origin_javascript_budget_exceeded")
    return sorted(chunks)


class PublicGets:
    def __init__(self, target):
        self.allowed_origins = {target["origin"], *target["aliases"]}
        self.started = time.monotonic()
        self.requests = 0
        self.last_content_type = ""

    def get(self, url):
        self.last_content_type = ""
        parsed = urlsplit(url)
        origin = f"{parsed.scheme}://{parsed.netloc}"
        if origin not in self.allowed_origins or parsed.username or parsed.password:
            raise SmokeError("target_outside_fixed_allowlist")
        remaining = MAX_SECONDS - (time.monotonic() - self.started)
        if remaining < 1 or self.requests >= MAX_REQUESTS:
            raise SmokeError("request_or_wall_time_budget_exceeded")
        self.requests += 1
        request_timeout = max(1, min(12, int(remaining)))
        with tempfile.TemporaryDirectory(prefix="outflow-public-get-") as directory:
            body_path = Path(directory) / "body"
            command = [
                "curl", "--disable", "--noproxy", "*", "--silent", "--show-error",
                "--request", "GET", "--proto", "=https", "--proto-redir", "=https",
                "--max-redirs", "0", "--connect-timeout", "4",
                "--max-time", str(request_timeout), "--max-filesize", str(MAX_BODY_BYTES),
                "--user-agent", "FortCordis-Outflow-ReadOnly-Smoke/1",
                "--header", "Accept: */*", "--output", str(body_path),
                "--write-out", "%{json}", "--url", url,
            ]
            try:
                completed = subprocess.run(command, stdin=subprocess.DEVNULL, capture_output=True,
                                           timeout=min(remaining, request_timeout + 1))
            except (OSError, subprocess.TimeoutExpired):
                raise SmokeError("get_transport_unavailable") from None
            # Never print curl stderr, metadata, headers, cookies or response bodies.
            if completed.returncode:
                raise SmokeError("get_transport_failed")
            try:
                metadata = json.loads(completed.stdout)
                status = int(metadata["http_code"])
                redirect = str(metadata.get("redirect_url") or "")
                self.last_content_type = str(metadata.get("content_type") or "").split(";", 1)[0].strip().lower()
            except (ValueError, TypeError, KeyError):
                raise SmokeError("get_transport_metadata_invalid") from None
            if not body_path.exists() or body_path.stat().st_size > MAX_BODY_BYTES:
                raise SmokeError("get_response_size_exceeded")
            body = body_path.read_bytes()
        return status, redirect, body


def observed_release(health):
    value = health
    for key in ("checks", "observability", "http_latency_monitor", "persistence", "release_id"):
        if not isinstance(value, dict):
            return None
        value = value.get(key)
    return value if isinstance(value, str) and re.fullmatch(r"[0-9a-fA-F]{7,40}", value) else None


def check_public_runtime(gets, origin, path, expected_prefix):
    status, _, body = gets.get(origin + path)
    if 500 <= status <= 599:
        raise SmokeError("public_runtime_reports_unhealthy")
    if status != 200:
        # Nginx may expose /api only. A 404 does not prove runtime failure.
        if status in {401, 403, 404} or 300 <= status <= 399:
            return {"check": path[1:], "outcome": "unavailable", "http_status": status,
                    "release_verified": False}
        raise SmokeError("public_runtime_unexpected_status")
    try:
        payload = json.loads(body)
    except (ValueError, UnicodeError):
        return {"check": path[1:], "outcome": "unavailable", "http_status": status,
                "release_verified": False}
    if not isinstance(payload, dict):
        return {"check": path[1:], "outcome": "unavailable", "http_status": status,
                "release_verified": False}
    readiness = payload.get("readiness")
    if readiness is not None and readiness != "ready":
        raise SmokeError("public_runtime_reports_not_ready")
    release = observed_release(payload)
    if release and not release.lower().startswith(expected_prefix.lower()):
        raise SmokeError("public_runtime_release_mismatch")
    return {"check": path[1:], "outcome": "passed" if readiness == "ready" else "unavailable",
            "http_status": status, "release_verified": bool(release),
            **({"observed_release_id": release.lower()} if release else {})}


def run_smoke(environment, expected_prefix, getter=None):
    target = TARGETS[environment]
    origin = target["origin"]
    gets = getter or PublicGets(target)
    summary = {"environment": environment, "expected_release_prefix": expected_prefix,
               "public_get_smoke_passed": False, "release_identity_verified": False,
               "checks": [], "marker_matches": {}, "limitations": []}
    try:
        # Bodies from these API checks are discarded and never included in output.
        status, _, _ = gets.get(origin + "/api/v1/auth/me")
        summary["checks"].append({"check": "anonymous_auth", "http_status": status,
                                  "outcome": "passed" if status == 401 else "failed"})
        if status != 401:
            raise SmokeError("anonymous_auth_did_not_return_401")
        for alias in target["aliases"]:
            status, redirect, _ = gets.get(alias + PAGE_PATH)
            correct = status in REDIRECT_STATUSES and redirect == origin + PAGE_PATH
            summary["checks"].append({"check": "stage_alias", "host": urlsplit(alias).hostname,
                                      "http_status": status, "preserves_route": correct,
                                      "outcome": "passed" if correct else "failed"})
            if not correct:
                raise SmokeError("stage_alias_did_not_preserve_route")
        for path in ("/health", "/ready"):
            result = check_public_runtime(gets, origin, path, expected_prefix)
            summary["checks"].append(result)
            summary["release_identity_verified"] |= result["release_verified"]
        status, _, body = gets.get(origin + PAGE_PATH)
        summary["checks"].append({"check": "canonical_new_report", "http_status": status,
                                  "outcome": "passed" if status == 200 else "failed"})
        if status != 200:
            raise SmokeError("canonical_new_report_did_not_return_200")
        chunks = same_origin_chunks(body.decode("utf-8", errors="replace"), origin + PAGE_PATH,
                                    summary["limitations"])
        matches = {marker: [] for marker in MARKERS}
        for url in chunks:
            status, _, body = gets.get(url)
            path = urlsplit(url).path
            content_type = gets.last_content_type
            mime_valid = content_type in JAVASCRIPT_CONTENT_TYPES
            is_html = body.lstrip(b"\xef\xbb\xbf \t\r\n").lower().startswith((b"<!doctype", b"<html"))
            summary["checks"].append({"check": "same_origin_javascript", "path": path,
                                      "http_status": status,
                                      "body_bytes": len(body),
                                      "sha256": hashlib.sha256(body).hexdigest(),
                                      "content_type": content_type if mime_valid else "unrecognized_or_missing",
                                      "outcome": "passed" if status == 200 and mime_valid and not is_html else "failed"})
            if status != 200:
                raise SmokeError("referenced_javascript_did_not_return_200")
            if not mime_valid:
                raise SmokeError("referenced_javascript_content_type_invalid")
            if is_html:
                raise SmokeError("referenced_javascript_is_html")
            text = normalize_js_escapes(body.decode("utf-8", errors="replace"))
            for marker in MARKERS:
                if marker in text:
                    matches[marker].append(path)
        summary["marker_matches"] = matches
        if any(not paths for paths in matches.values()):
            raise SmokeError("required_outflow_marker_missing")
        summary["public_get_smoke_passed"] = True
    except SmokeError as error:
        summary["error_code"] = str(error)
    if not summary["release_identity_verified"]:
        summary["limitations"].append(
            "Public runtime release identity unavailable; confirm the completed deploy logs and internal git SHA assertion."
        )
    summary["limitations"].append(
        "Anonymous GET and served-bundle evidence does not verify the authenticated editor, importer or regenerated PDF."
    )
    summary["requests"] = gets.requests
    return summary


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--environment", choices=TARGETS, required=True)
    parser.add_argument("--expected-release", required=True)
    parser.add_argument("--summary-file", type=Path)
    parser.add_argument("--execute", action="store_true")
    args = parser.parse_args()
    if not re.fullmatch(r"[0-9a-fA-F]{7,40}", args.expected_release):
        parser.error("expected-release must be a 7..40 character hexadecimal commit prefix")
    if not args.execute:
        emit("plan", environment=args.environment, origin=TARGETS[args.environment]["origin"],
             expected_release_prefix=args.expected_release, network_requests_started=False,
             maximum_gets=MAX_REQUESTS, maximum_chunks=MAX_CHUNKS, wall_time_seconds=MAX_SECONDS,
             required_markers=MARKERS)
        return 0
    summary = run_smoke(args.environment, args.expected_release)
    emit("summary", **summary)
    if args.summary_file:
        args.summary_file.parent.mkdir(parents=True, exist_ok=True)
        args.summary_file.write_text(json.dumps(summary, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return 0 if summary["public_get_smoke_passed"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
