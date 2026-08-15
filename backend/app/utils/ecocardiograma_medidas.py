from __future__ import annotations

import re
from typing import Any


LV_M_MODE_KEYS = {
    "DIVEd",
    "DIVEd_normalizado",
    "SIVd",
    "PLVEd",
    "DIVES",
    "SIVs",
    "PLVES",
    "VDF",
    "VSF",
    "FE_Teicholz",
    "DeltaD_FS",
}

LV_2D_KEYS = {
    "DIVEd_2D",
    "DIVEd_normalizado_2D",
    "SIVd_2D",
    "PLVEd_2D",
    "DIVES_2D",
    "SIVs_2D",
    "PLVES_2D",
    "VDF_2D",
    "VSF_2D",
    "FE_Teicholz_2D",
    "DeltaD_FS_2D",
}

_NUMERIC_VALUE_PATTERN = re.compile(
    r"^[+-]?(?:\d+(?:[.,]\d*)?|[.,]\d+)(?:[eE][+-]?\d+)?$"
)


def _has_positive_measurement(
    measurements: dict[str, Any],
    keys: set[str],
) -> bool:
    for key in keys:
        raw_value = str(measurements.get(key) or "").strip().replace(",", ".")
        if not raw_value:
            continue
        try:
            if float(raw_value) > 0:
                return True
        except (TypeError, ValueError):
            continue
    return False


def inferir_tecnica_ve_relatorio(
    measurements: dict[str, Any],
) -> str | None:
    selected = str(measurements.get("VE_tecnica_relatorio") or "").strip().lower()
    if selected in {"modo_m", "2d"}:
        return selected

    has_m_mode = _has_positive_measurement(measurements, LV_M_MODE_KEYS)
    has_2d = _has_positive_measurement(measurements, LV_2D_KEYS)
    if has_m_mode and not has_2d:
        return "modo_m"
    if has_2d and not has_m_mode:
        return "2d"
    return None


def extrair_medidas_ecocardiograma_da_descricao(
    description: str | None,
) -> dict[str, str]:
    if not description:
        return {}

    section_match = re.search(
        r"##\s*Medidas\s+Ecocardiogr(?:a|á)ficas\s*(.*?)(?=\n##\s*|\Z)",
        str(description),
        re.IGNORECASE | re.DOTALL,
    )
    if not section_match:
        return {}

    measurements: dict[str, str] = {}
    for match in re.finditer(
        r"^\s*-\s*([A-Za-z0-9_]+):\s*(.*?)\s*$",
        section_match.group(1),
        re.MULTILINE,
    ):
        key = match.group(1)
        raw_value = match.group(2).strip()
        if not raw_value:
            continue

        if key == "VE_tecnica_relatorio":
            normalized = raw_value.lower().replace("-", "_").replace(" ", "_")
            if normalized in {"modo_m", "2d"}:
                measurements[key] = normalized
            continue

        if key == "Remodelamento_AD":
            normalized = raw_value.lower()
            if normalized in {"ausente", "leve", "moderado", "importante"}:
                measurements[key] = normalized
            continue

        if _NUMERIC_VALUE_PATTERN.fullmatch(raw_value):
            measurements[key] = raw_value.replace(",", ".")

    inferred = inferir_tecnica_ve_relatorio(measurements)
    if inferred:
        measurements["VE_tecnica_relatorio"] = inferred
    return measurements
