from __future__ import annotations

import math
import threading
import time
from collections import deque
from datetime import datetime, timezone
from typing import Any, Deque, Dict, List, Optional, Tuple

from app.core.config import settings

_DEFAULT_5XX_WINDOW_MINUTES = 5
_DEFAULT_5XX_THRESHOLD = 20
_MIN_5XX_WINDOW_MINUTES = 1
_MAX_5XX_WINDOW_MINUTES = 60
_MIN_5XX_THRESHOLD = 1
_MAX_5XX_THRESHOLD = 500
_DEFAULT_LATENCY_WINDOW_MINUTES = 30
_MIN_LATENCY_WINDOW_MINUTES = 1
_MAX_LATENCY_WINDOW_MINUTES = 1440
_DEFAULT_LATENCY_MAX_SAMPLES = 2000
_MIN_LATENCY_MAX_SAMPLES = 100
_MAX_LATENCY_MAX_SAMPLES = 20000
_DEFAULT_LATENCY_ENDPOINTS = [
    "/api/v1/agenda",
    "/api/v1/atendimentos",
    "/api/v1/relatorios",
    "/api/v1/fiscal",
    "/api/v1/logistica",
]

_HTTP_5XX_EVENTS: Deque[Tuple[float, datetime]] = deque()
_HTTP_5XX_LOCK = threading.Lock()
_HTTP_LATENCY_EVENTS: Dict[str, Deque[Tuple[float, float, int, datetime]]] = {}
_HTTP_LATENCY_LOCK = threading.Lock()


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _parse_int_setting(
    raw_value: Any,
    *,
    name: str,
    default: int,
    min_value: int,
    max_value: int,
) -> Tuple[int, Optional[str]]:
    try:
        parsed = int(raw_value)
    except Exception:
        return default, f"{name} invalido. Usando valor padrao {default}."

    if parsed < min_value or parsed > max_value:
        return default, (
            f"{name} fora da faixa [{min_value}, {max_value}]. "
            f"Usando valor padrao {default}."
        )
    return parsed, None


def _parse_endpoint_prefixes(raw_value: Any) -> List[str]:
    if raw_value is None:
        values: List[str] = []
    elif isinstance(raw_value, (list, tuple)):
        values = [str(item).strip() for item in raw_value]
    else:
        values = [item.strip() for item in str(raw_value).split(",")]

    normalized: List[str] = []
    for value in values:
        if not value:
            continue
        if not value.startswith("/"):
            value = f"/{value}"
        if value.endswith("/") and value != "/":
            value = value[:-1]
        normalized.append(value)

    dedup: List[str] = []
    seen = set()
    for item in normalized:
        if item in seen:
            continue
        seen.add(item)
        dedup.append(item)
    return dedup


def get_http_5xx_monitor_config() -> Dict[str, Any]:
    window_minutes, window_warning = _parse_int_setting(
        settings.RUNTIME_HTTP_5XX_ALERT_WINDOW_MINUTES,
        name="RUNTIME_HTTP_5XX_ALERT_WINDOW_MINUTES",
        default=_DEFAULT_5XX_WINDOW_MINUTES,
        min_value=_MIN_5XX_WINDOW_MINUTES,
        max_value=_MAX_5XX_WINDOW_MINUTES,
    )
    threshold, threshold_warning = _parse_int_setting(
        settings.RUNTIME_HTTP_5XX_ALERT_THRESHOLD,
        name="RUNTIME_HTTP_5XX_ALERT_THRESHOLD",
        default=_DEFAULT_5XX_THRESHOLD,
        min_value=_MIN_5XX_THRESHOLD,
        max_value=_MAX_5XX_THRESHOLD,
    )
    warnings = [warning for warning in (window_warning, threshold_warning) if warning]
    return {
        "window_minutes": window_minutes,
        "threshold": threshold,
        "warnings": warnings,
    }


def get_http_latency_monitor_config() -> Dict[str, Any]:
    window_minutes, window_warning = _parse_int_setting(
        settings.RUNTIME_HTTP_LATENCY_WINDOW_MINUTES,
        name="RUNTIME_HTTP_LATENCY_WINDOW_MINUTES",
        default=_DEFAULT_LATENCY_WINDOW_MINUTES,
        min_value=_MIN_LATENCY_WINDOW_MINUTES,
        max_value=_MAX_LATENCY_WINDOW_MINUTES,
    )
    max_samples, samples_warning = _parse_int_setting(
        settings.RUNTIME_HTTP_LATENCY_MAX_SAMPLES_PER_ENDPOINT,
        name="RUNTIME_HTTP_LATENCY_MAX_SAMPLES_PER_ENDPOINT",
        default=_DEFAULT_LATENCY_MAX_SAMPLES,
        min_value=_MIN_LATENCY_MAX_SAMPLES,
        max_value=_MAX_LATENCY_MAX_SAMPLES,
    )
    configured_endpoints = _parse_endpoint_prefixes(
        settings.RUNTIME_HTTP_LATENCY_PRIORITY_ENDPOINTS
    )
    endpoints_warning: Optional[str] = None
    if not configured_endpoints:
        configured_endpoints = list(_DEFAULT_LATENCY_ENDPOINTS)
        endpoints_warning = (
            "RUNTIME_HTTP_LATENCY_PRIORITY_ENDPOINTS vazio/invalido. "
            "Usando endpoints padrao."
        )
    endpoints = configured_endpoints[:5]

    warnings = [
        warning for warning in (window_warning, samples_warning, endpoints_warning) if warning
    ]
    return {
        "window_minutes": window_minutes,
        "max_samples_per_endpoint": max_samples,
        "priority_endpoints": endpoints,
        "warnings": warnings,
    }


def _purge_old_events_locked(*, now_monotonic: float, window_seconds: int) -> None:
    cutoff = now_monotonic - window_seconds
    while _HTTP_5XX_EVENTS and _HTTP_5XX_EVENTS[0][0] < cutoff:
        _HTTP_5XX_EVENTS.popleft()


def _purge_old_latency_events_locked(
    events: Deque[Tuple[float, float, int, datetime]],
    *,
    now_monotonic: float,
    window_seconds: int,
) -> None:
    cutoff = now_monotonic - window_seconds
    while events and events[0][0] < cutoff:
        events.popleft()


def _resolve_monitored_endpoint(path: str, endpoints: List[str]) -> Optional[str]:
    if not path:
        return None
    clean_path = path.strip()
    matches = [endpoint for endpoint in endpoints if clean_path.startswith(endpoint)]
    if not matches:
        return None
    # Prioriza o prefixo mais especifico.
    return sorted(matches, key=len, reverse=True)[0]


def record_http_status(status_code: int) -> None:
    if int(status_code) < 500 or int(status_code) > 599:
        return

    config = get_http_5xx_monitor_config()
    window_seconds = int(config["window_minutes"]) * 60
    now_monotonic = time.monotonic()
    now_utc = _utc_now()

    with _HTTP_5XX_LOCK:
        _HTTP_5XX_EVENTS.append((now_monotonic, now_utc))
        _purge_old_events_locked(now_monotonic=now_monotonic, window_seconds=window_seconds)


def record_http_request(*, path: str, status_code: int, duration_ms: float) -> None:
    status_int = int(status_code)
    duration_float = float(duration_ms)
    if duration_float < 0:
        duration_float = 0.0

    record_http_status(status_int)

    config = get_http_latency_monitor_config()
    endpoint = _resolve_monitored_endpoint(path, list(config["priority_endpoints"]))
    if endpoint is None:
        return

    window_seconds = int(config["window_minutes"]) * 60
    max_samples = int(config["max_samples_per_endpoint"])
    now_monotonic = time.monotonic()
    now_utc = _utc_now()

    with _HTTP_LATENCY_LOCK:
        events = _HTTP_LATENCY_EVENTS.setdefault(endpoint, deque())
        events.append((now_monotonic, duration_float, status_int, now_utc))
        _purge_old_latency_events_locked(
            events,
            now_monotonic=now_monotonic,
            window_seconds=window_seconds,
        )
        while len(events) > max_samples:
            events.popleft()


def get_http_5xx_monitor_status() -> Dict[str, Any]:
    config = get_http_5xx_monitor_config()
    window_seconds = int(config["window_minutes"]) * 60
    now_monotonic = time.monotonic()

    with _HTTP_5XX_LOCK:
        _purge_old_events_locked(now_monotonic=now_monotonic, window_seconds=window_seconds)
        recent_count = len(_HTTP_5XX_EVENTS)
        last_5xx_at = _HTTP_5XX_EVENTS[-1][1].isoformat() if _HTTP_5XX_EVENTS else None

    threshold = int(config["threshold"])
    return {
        "window_minutes": int(config["window_minutes"]),
        "threshold": threshold,
        "recent_5xx_count": recent_count,
        "alert_active": recent_count >= threshold,
        "last_5xx_at": last_5xx_at,
        "config_warnings": list(config["warnings"]),
    }


def _percentile_ms(values: List[float], percentile: int) -> Optional[float]:
    if not values:
        return None
    ordered = sorted(values)
    rank = max(1, math.ceil((percentile / 100.0) * len(ordered)))
    return round(float(ordered[rank - 1]), 2)


def get_http_latency_monitor_status() -> Dict[str, Any]:
    config = get_http_latency_monitor_config()
    window_seconds = int(config["window_minutes"]) * 60
    now_monotonic = time.monotonic()
    endpoints = list(config["priority_endpoints"])
    endpoint_payload: Dict[str, Any] = {}

    with _HTTP_LATENCY_LOCK:
        for endpoint in endpoints:
            events = _HTTP_LATENCY_EVENTS.setdefault(endpoint, deque())
            _purge_old_latency_events_locked(
                events,
                now_monotonic=now_monotonic,
                window_seconds=window_seconds,
            )
            samples = list(events)

            durations = [sample[1] for sample in samples]
            request_count = len(samples)
            error_5xx_count = sum(1 for sample in samples if 500 <= int(sample[2]) <= 599)
            avg_ms = round(sum(durations) / request_count, 2) if request_count else None
            p95_ms = _percentile_ms(durations, 95)
            p99_ms = _percentile_ms(durations, 99)
            last_seen_at = samples[-1][3].isoformat() if samples else None

            endpoint_payload[endpoint] = {
                "request_count": request_count,
                "error_5xx_count": error_5xx_count,
                "avg_ms": avg_ms,
                "p95_ms": p95_ms,
                "p99_ms": p99_ms,
                "last_seen_at": last_seen_at,
            }

    return {
        "window_minutes": int(config["window_minutes"]),
        "max_samples_per_endpoint": int(config["max_samples_per_endpoint"]),
        "priority_endpoints": endpoints,
        "endpoints": endpoint_payload,
        "config_warnings": list(config["warnings"]),
    }


def reset_http_5xx_monitor_state_for_tests() -> None:
    with _HTTP_5XX_LOCK:
        _HTTP_5XX_EVENTS.clear()
    with _HTTP_LATENCY_LOCK:
        _HTTP_LATENCY_EVENTS.clear()
