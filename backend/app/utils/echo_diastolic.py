"""Species dispatcher for method-specific diastolic consultation evidence."""
from __future__ import annotations

from collections.abc import Mapping
from typing import Any

from app.utils.echo_canine_diastolic import canine_diastolic_notes, canine_diastolic_references
from app.utils.echo_feline_diastolic import feline_diastolic_notes, feline_diastolic_references
from app.utils.referencia_eco_defaults import normalizar_especie_referencia


def diastolic_references(measurements: Mapping[str, Any], species: Any) -> dict[str, dict[str, Any]]:
    normalized = normalizar_especie_referencia(species)
    if normalized == "Canina":
        return canine_diastolic_references(measurements, normalized)
    if normalized == "Felina":
        return feline_diastolic_references(measurements, normalized)
    return {}


def diastolic_notes(measurements: Mapping[str, Any], species: Any) -> list[str]:
    normalized = normalizar_especie_referencia(species)
    if normalized == "Canina":
        return canine_diastolic_notes(measurements, normalized)
    if normalized == "Felina":
        return feline_diastolic_notes(measurements, normalized)
    return []
