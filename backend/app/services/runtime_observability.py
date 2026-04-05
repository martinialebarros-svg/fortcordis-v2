from __future__ import annotations

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

_HTTP_5XX_EVENTS: Deque[Tuple[float, datetime]] = deque()
_HTTP_5XX_LOCK = threading.Lock()


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


def _purge_old_events_locked(*, now_monotonic: float, window_seconds: int) -> None:
    cutoff = now_monotonic - window_seconds
    while _HTTP_5XX_EVENTS and _HTTP_5XX_EVENTS[0][0] < cutoff:
        _HTTP_5XX_EVENTS.popleft()


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


def reset_http_5xx_monitor_state_for_tests() -> None:
    with _HTTP_5XX_LOCK:
        _HTTP_5XX_EVENTS.clear()
