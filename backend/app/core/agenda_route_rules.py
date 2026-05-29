"""Helpers para configuracao de regras de rota da agenda."""
from __future__ import annotations

from copy import deepcopy
from typing import Any

from app.core.agenda_config import carregar_json

DEFAULT_AGENDA_ROTA_REGRAS = {
    "version": "1.0.0",
    "base": {
        "label": "Casa (base operacional)",
        "address": "Av da Universidade, 1949",
        "zip_code": "60020-180",
        "lat": None,
        "lng": None,
    },
    "thresholds": {
        "nearby_anchor_max_travel_min": 20,
        "distant_clinic_min_travel_from_base_min": 35,
        "low_frequency_max_bookings_30d": 3,
        "max_insertion_detour_min": 25,
        "safe_margin_min": 5,
    },
    "offer_policy": {
        "default_first_offer_days_ahead": [2],
        "distant_low_frequency_first_offer_days_ahead": [3, 4],
        "allow_d2_if_anchor_exists": True,
        "emergency_first_offer_days_ahead": [1, 2],
    },
    "route_policy": {
        "end_of_route_window_start": "16:00",
        "prefer_near_base_at_end_of_route": True,
        "bonus_near_base_score": 15,
        "penalty_far_base_score": 10,
        "reject_clear_inefficiency": True,
    },
    "fallback_policy": {
        "suggest_alternative_slots_when_blocked": True,
        "max_alternative_suggestions": 3,
        "allow_extra_slot_start_or_end_route_for_emergency": True,
    },
    "rendering_policy": {
        "use_custom_window": False,
        "window_start": "08:00",
        "window_end": "18:00",
        "slot_interval_min": 30,
    },
    "clinic_overrides": [],
}


def _normalizar_hora_hhmm(value: Any, fallback: str) -> str:
    raw = str(value or "").strip()
    if len(raw) != 5 or raw[2] != ":":
        return fallback

    hh = raw[:2]
    mm = raw[3:]
    if not (hh.isdigit() and mm.isdigit()):
        return fallback

    hora = int(hh)
    minuto = int(mm)
    if hora < 0 or hora > 23 or minuto < 0 or minuto > 59:
        return fallback
    return f"{hora:02d}:{minuto:02d}"


def _hora_em_minutos(value: str) -> int:
    hora_str, minuto_str = value.split(":")
    return int(hora_str) * 60 + int(minuto_str)


def _normalizar_int(value: Any, fallback: int, min_value: int, max_value: int) -> int:
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        parsed = fallback
    return max(min_value, min(max_value, parsed))


def _normalizar_float(value: Any) -> float | None:
    if value in (None, "", "null"):
        return None
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return None
    return parsed


def _normalizar_bool(value: Any, fallback: bool) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return value != 0
    if isinstance(value, str):
        raw = value.strip().lower()
        if raw in {"1", "true", "yes", "sim", "on"}:
            return True
        if raw in {"0", "false", "no", "nao", "não", "off"}:
            return False
    return fallback


def _normalizar_dias_a_frente(value: Any, fallback: list[int]) -> list[int]:
    raw_list = value if isinstance(value, list) else fallback
    dias: list[int] = []
    vistos: set[int] = set()
    for item in raw_list:
        try:
            dia = int(item)
        except (TypeError, ValueError):
            continue
        if dia < 0 or dia > 30:
            continue
        if dia in vistos:
            continue
        vistos.add(dia)
        dias.append(dia)
    dias.sort()
    return dias or list(fallback)


def normalizar_agenda_rota_regras(payload: Any) -> dict[str, Any]:
    source = payload if isinstance(payload, dict) else {}
    default = deepcopy(DEFAULT_AGENDA_ROTA_REGRAS)

    base_src = source.get("base") if isinstance(source.get("base"), dict) else {}
    base = {
        "label": str(base_src.get("label") or default["base"]["label"]).strip() or default["base"]["label"],
        "address": str(base_src.get("address") or default["base"]["address"]).strip() or default["base"]["address"],
        "zip_code": str(base_src.get("zip_code") or default["base"]["zip_code"]).strip() or default["base"]["zip_code"],
        "lat": _normalizar_float(base_src.get("lat")),
        "lng": _normalizar_float(base_src.get("lng")),
    }
    if base["lat"] is not None and not (-90.0 <= base["lat"] <= 90.0):
        base["lat"] = None
    if base["lng"] is not None and not (-180.0 <= base["lng"] <= 180.0):
        base["lng"] = None

    thresholds_src = source.get("thresholds") if isinstance(source.get("thresholds"), dict) else {}
    thresholds = {
        "nearby_anchor_max_travel_min": _normalizar_int(
            thresholds_src.get("nearby_anchor_max_travel_min"),
            default["thresholds"]["nearby_anchor_max_travel_min"],
            1,
            240,
        ),
        "distant_clinic_min_travel_from_base_min": _normalizar_int(
            thresholds_src.get("distant_clinic_min_travel_from_base_min"),
            default["thresholds"]["distant_clinic_min_travel_from_base_min"],
            1,
            360,
        ),
        "low_frequency_max_bookings_30d": _normalizar_int(
            thresholds_src.get("low_frequency_max_bookings_30d"),
            default["thresholds"]["low_frequency_max_bookings_30d"],
            0,
            60,
        ),
        "max_insertion_detour_min": _normalizar_int(
            thresholds_src.get("max_insertion_detour_min"),
            default["thresholds"]["max_insertion_detour_min"],
            0,
            360,
        ),
        "safe_margin_min": _normalizar_int(
            thresholds_src.get("safe_margin_min"),
            default["thresholds"]["safe_margin_min"],
            0,
            120,
        ),
    }

    offer_src = source.get("offer_policy") if isinstance(source.get("offer_policy"), dict) else {}
    offer_policy = {
        "default_first_offer_days_ahead": _normalizar_dias_a_frente(
            offer_src.get("default_first_offer_days_ahead"),
            default["offer_policy"]["default_first_offer_days_ahead"],
        ),
        "distant_low_frequency_first_offer_days_ahead": _normalizar_dias_a_frente(
            offer_src.get("distant_low_frequency_first_offer_days_ahead"),
            default["offer_policy"]["distant_low_frequency_first_offer_days_ahead"],
        ),
        "allow_d2_if_anchor_exists": _normalizar_bool(
            offer_src.get("allow_d2_if_anchor_exists"),
            default["offer_policy"]["allow_d2_if_anchor_exists"],
        ),
        "emergency_first_offer_days_ahead": _normalizar_dias_a_frente(
            offer_src.get("emergency_first_offer_days_ahead"),
            default["offer_policy"]["emergency_first_offer_days_ahead"],
        ),
    }

    route_src = source.get("route_policy") if isinstance(source.get("route_policy"), dict) else {}
    raw_bonus = _normalizar_int(
        route_src.get("bonus_near_base_score"),
        default["route_policy"]["bonus_near_base_score"],
        -999,
        999,
    )
    route_policy = {
        "end_of_route_window_start": _normalizar_hora_hhmm(
            route_src.get("end_of_route_window_start"),
            default["route_policy"]["end_of_route_window_start"],
        ),
        "prefer_near_base_at_end_of_route": _normalizar_bool(
            route_src.get("prefer_near_base_at_end_of_route"),
            default["route_policy"]["prefer_near_base_at_end_of_route"],
        ),
        "bonus_near_base_score": abs(raw_bonus),
        "penalty_far_base_score": _normalizar_int(
            route_src.get("penalty_far_base_score"),
            default["route_policy"]["penalty_far_base_score"],
            0,
            999,
        ),
        "reject_clear_inefficiency": _normalizar_bool(
            route_src.get("reject_clear_inefficiency"),
            default["route_policy"]["reject_clear_inefficiency"],
        ),
    }

    fallback_src = source.get("fallback_policy") if isinstance(source.get("fallback_policy"), dict) else {}
    fallback_policy = {
        "suggest_alternative_slots_when_blocked": _normalizar_bool(
            fallback_src.get("suggest_alternative_slots_when_blocked"),
            default["fallback_policy"]["suggest_alternative_slots_when_blocked"],
        ),
        "max_alternative_suggestions": _normalizar_int(
            fallback_src.get("max_alternative_suggestions"),
            default["fallback_policy"]["max_alternative_suggestions"],
            1,
            20,
        ),
        "allow_extra_slot_start_or_end_route_for_emergency": _normalizar_bool(
            fallback_src.get("allow_extra_slot_start_or_end_route_for_emergency"),
            default["fallback_policy"]["allow_extra_slot_start_or_end_route_for_emergency"],
        ),
    }

    rendering_src = source.get("rendering_policy") if isinstance(source.get("rendering_policy"), dict) else {}
    rendering_policy = {
        "use_custom_window": _normalizar_bool(
            rendering_src.get("use_custom_window"),
            default["rendering_policy"]["use_custom_window"],
        ),
        "window_start": _normalizar_hora_hhmm(
            rendering_src.get("window_start"),
            default["rendering_policy"]["window_start"],
        ),
        "window_end": _normalizar_hora_hhmm(
            rendering_src.get("window_end"),
            default["rendering_policy"]["window_end"],
        ),
        "slot_interval_min": _normalizar_int(
            rendering_src.get("slot_interval_min"),
            default["rendering_policy"]["slot_interval_min"],
            5,
            120,
        ),
    }
    if _hora_em_minutos(rendering_policy["window_start"]) >= _hora_em_minutos(rendering_policy["window_end"]):
        rendering_policy["window_start"] = default["rendering_policy"]["window_start"]
        rendering_policy["window_end"] = default["rendering_policy"]["window_end"]

    overrides_src = source.get("clinic_overrides") if isinstance(source.get("clinic_overrides"), list) else []
    clinic_overrides: list[dict[str, Any]] = []
    for item in overrides_src:
        if not isinstance(item, dict):
            continue
        clinic_name = str(item.get("clinic_name") or "").strip()
        if not clinic_name:
            continue
        clinic_overrides.append(
            {
                "clinic_name": clinic_name,
                "force_days_ahead": _normalizar_dias_a_frente(
                    item.get("force_days_ahead"),
                    offer_policy["distant_low_frequency_first_offer_days_ahead"],
                ),
                "prefer_only_when_anchor_exists": _normalizar_bool(
                    item.get("prefer_only_when_anchor_exists"),
                    True,
                ),
                "notes": str(item.get("notes") or "").strip(),
            }
        )

    return {
        "version": str(source.get("version") or default["version"]).strip() or default["version"],
        "base": base,
        "thresholds": thresholds,
        "offer_policy": offer_policy,
        "route_policy": route_policy,
        "fallback_policy": fallback_policy,
        "rendering_policy": rendering_policy,
        "clinic_overrides": clinic_overrides,
    }


def carregar_agenda_rota_regras(raw: Any) -> dict[str, Any]:
    payload = carregar_json(raw)
    return normalizar_agenda_rota_regras(payload)
