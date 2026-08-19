from __future__ import annotations

import re
from typing import Any

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.referencia_eco import ReferenciaEco
from app.utils.referencia_eco_defaults import (
    aplicar_defaults_publicados_caninos,
    normalizar_especie_referencia,
)


ECHO_MEASUREMENT_UNITS: dict[str, str] = {
    "DIVEd": "mm",
    "DIVEd_normalizado": "cm/kg^0,294",
    "SIVd": "mm",
    "PLVEd": "mm",
    "DIVES": "mm",
    "SIVs": "mm",
    "PLVES": "mm",
    "DIVEd_2D": "mm",
    "DIVEd_normalizado_2D": "cm/kg^0,294",
    "SIVd_2D": "mm",
    "PLVEd_2D": "mm",
    "DIVES_2D": "mm",
    "SIVs_2D": "mm",
    "PLVES_2D": "mm",
    "VDF": "mL",
    "VDF_2D": "mL",
    "VSF": "mL",
    "VSF_2D": "mL",
    "FE_Teicholz": "%",
    "FE_Teicholz_2D": "%",
    "DeltaD_FS": "%",
    "DeltaD_FS_2D": "%",
    "TAPSE": "mm",
    "MAPSE": "mm",
    "Aorta": "mm",
    "Atrio_esquerdo": "mm",
    "AE_Ao": "adimensional",
    "Fracao_encurtamento_AE": "%",
    "Fluxo_auricular": "m/s",
    "Onda_E": "m/s",
    "Onda_A": "m/s",
    "E_A": "adimensional",
    "E_TRIV": "adimensional",
    "TD": "ms",
    "TRIV": "ms",
    "MR_dp_dt": "mmHg/s",
    "e_doppler": "m/s",
    "a_doppler": "m/s",
    "doppler_tecidual_relacao": "adimensional",
    "E_E_linha": "adimensional",
    "AP": "mm",
    "Ao_nivel_AP": "mm",
    "AP_Ao": "adimensional",
    "IM_Vmax": "m/s",
    "IM_Grad": "mmHg",
    "IT_Vmax": "m/s",
    "IT_Grad": "mmHg",
    "IA_Vmax": "m/s",
    "IA_Grad": "mmHg",
    "IP_Vmax": "m/s",
    "IP_Grad": "mmHg",
    "Remodelamento_AD": "qualitativo",
    "PAD_estimada": "mmHg",
    "PSAP": "mmHg",
    "VE_tecnica_relatorio": "qualitativo",
    "Vmax_aorta": "m/s",
    "Grad_aorta": "mmHg",
    "Vmax_pulmonar": "m/s",
    "Grad_pulmonar": "mmHg",
}

ECHO_MEASUREMENT_METHODS: dict[str, str] = {
    **{
        key: "modo M"
        for key in (
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
        )
    },
    **{
        key: "modo bidimensional"
        for key in (
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
        )
    },
    "TAPSE": "excursão sistólica anular",
    "MAPSE": "excursão sistólica anular",
    "Aorta": "modo bidimensional",
    "Atrio_esquerdo": "modo bidimensional",
    "AE_Ao": "modo bidimensional",
    "Fracao_encurtamento_AE": "modo bidimensional",
    "Fluxo_auricular": "Doppler pulsado",
    "Onda_E": "Doppler pulsado transmitral",
    "Onda_A": "Doppler pulsado transmitral",
    "E_A": "Doppler pulsado transmitral",
    "E_TRIV": "Doppler pulsado transmitral",
    "TD": "Doppler pulsado transmitral",
    "TRIV": "Doppler pulsado",
    "MR_dp_dt": "Doppler contínuo",
    "e_doppler": "Doppler tecidual",
    "a_doppler": "Doppler tecidual",
    "doppler_tecidual_relacao": "Doppler tecidual",
    "E_E_linha": "Doppler pulsado e tecidual",
    "AP": "modo bidimensional",
    "Ao_nivel_AP": "modo bidimensional",
    "AP_Ao": "modo bidimensional",
    "IM_Vmax": "Doppler contínuo",
    "IM_Grad": "Bernoulli simplificada",
    "IT_Vmax": "Doppler contínuo",
    "IT_Grad": "Bernoulli simplificada",
    "IA_Vmax": "Doppler contínuo",
    "IA_Grad": "Bernoulli simplificada",
    "IP_Vmax": "Doppler contínuo",
    "IP_Grad": "Bernoulli simplificada",
    "Remodelamento_AD": "avaliação morfológica",
    "PAD_estimada": "estimativa ecocardiográfica",
    "PSAP": "estimativa ecocardiográfica",
    "VE_tecnica_relatorio": "seleção do operador",
    "Vmax_aorta": "Doppler contínuo",
    "Grad_aorta": "Doppler contínuo",
    "Vmax_pulmonar": "Doppler contínuo",
    "Grad_pulmonar": "Doppler contínuo",
}


REFERENCE_FIELD_MAP: dict[str, tuple[str, str, str]] = {
    "DIVEd": ("lvid_d_min", "lvid_d_max", "mm"),
    "DIVES": ("lvid_s_min", "lvid_s_max", "mm"),
    "SIVd": ("ivs_d_min", "ivs_d_max", "mm"),
    "SIVs": ("ivs_s_min", "ivs_s_max", "mm"),
    "PLVEd": ("lvpw_d_min", "lvpw_d_max", "mm"),
    "PLVES": ("lvpw_s_min", "lvpw_s_max", "mm"),
    "DIVEd_2D": ("lvid_d_min", "lvid_d_max", "mm"),
    "DIVES_2D": ("lvid_s_min", "lvid_s_max", "mm"),
    "SIVd_2D": ("ivs_d_min", "ivs_d_max", "mm"),
    "SIVs_2D": ("ivs_s_min", "ivs_s_max", "mm"),
    "PLVEd_2D": ("lvpw_d_min", "lvpw_d_max", "mm"),
    "PLVES_2D": ("lvpw_s_min", "lvpw_s_max", "mm"),
    "VDF": ("edv_min", "edv_max", "mL"),
    "VDF_2D": ("edv_min", "edv_max", "mL"),
    "VSF": ("esv_min", "esv_max", "mL"),
    "VSF_2D": ("esv_min", "esv_max", "mL"),
    "FE_Teicholz": ("ef_min", "ef_max", "%"),
    "FE_Teicholz_2D": ("ef_min", "ef_max", "%"),
    "DeltaD_FS": ("fs_min", "fs_max", "%"),
    "DeltaD_FS_2D": ("fs_min", "fs_max", "%"),
    "TAPSE": ("tapse_min", "tapse_max", "mm"),
    "MAPSE": ("mapse_min", "mapse_max", "mm"),
    "Aorta": ("ao_min", "ao_max", "mm"),
    "Atrio_esquerdo": ("la_min", "la_max", "mm"),
    "AE_Ao": ("la_ao_min", "la_ao_max", "adimensional"),
    "AP": ("ap_min", "ap_max", "mm"),
    "AP_Ao": ("ap_ao_min", "ap_ao_max", "adimensional"),
    "Onda_E": ("mv_e_min", "mv_e_max", "m/s"),
    "Onda_A": ("mv_a_min", "mv_a_max", "m/s"),
    "E_A": ("mv_ea_min", "mv_ea_max", "adimensional"),
    "TD": ("mv_dt_min", "mv_dt_max", "ms"),
    "TRIV": ("ivrt_min", "ivrt_max", "ms"),
    "e_doppler": ("tdi_e_min", "tdi_e_max", "m/s"),
    "a_doppler": ("tdi_a_min", "tdi_a_max", "m/s"),
    "E_E_linha": ("e_e_linha_min", "e_e_linha_max", "adimensional"),
    "Vmax_aorta": ("vmax_ao_min", "vmax_ao_max", "m/s"),
    "Vmax_pulmonar": ("vmax_pulm_min", "vmax_pulm_max", "m/s"),
}


def _positive_float(value: Any) -> float | None:
    try:
        parsed = float(str(value).replace(",", ".").strip())
    except (TypeError, ValueError):
        return None
    return parsed if parsed > 0 else None


def _reference_query_for_species(db: Session, species: str):
    query = db.query(ReferenciaEco)
    normalized = normalizar_especie_referencia(species)
    if normalized == "Canina":
        return query.filter(ReferenciaEco.especie.ilike("canin%"))
    if normalized == "Felina":
        return query.filter(ReferenciaEco.especie.ilike("felin%"))
    return query.filter(ReferenciaEco.especie.ilike(str(normalized or species).strip()))


def load_echo_reference_context(
    db: Session,
    *,
    species: str | None,
    weight_kg: Any,
) -> dict[str, Any] | None:
    normalized_species = normalizar_especie_referencia(species)
    resolved_weight = _positive_float(weight_kg)
    if not normalized_species or resolved_weight is None:
        return None

    reference = (
        _reference_query_for_species(db, normalized_species)
        .order_by(
            func.abs(ReferenciaEco.peso_kg - resolved_weight),
            ReferenciaEco.peso_kg.asc(),
        )
        .first()
    )
    if reference is None:
        return None

    raw_reference = {
        column.name: getattr(reference, column.name)
        for column in ReferenciaEco.__table__.columns
    }
    resolved_reference = aplicar_defaults_publicados_caninos(
        raw_reference,
        peso_kg=resolved_weight,
    )
    ranges: dict[str, dict[str, Any]] = {}
    for measurement_key, (minimum_key, maximum_key, unit) in REFERENCE_FIELD_MAP.items():
        minimum = resolved_reference.get(minimum_key)
        maximum = resolved_reference.get(maximum_key)
        if measurement_key in {"e_doppler", "a_doppler"}:
            minimum = float(minimum) / 100 if minimum is not None else None
            maximum = float(maximum) / 100 if maximum is not None else None
        if minimum is None and maximum is None:
            continue
        ranges[measurement_key] = {
            "min": minimum,
            "max": maximum,
            "unit": unit,
        }

    return {
        "source": "tabela_de_referencia_carregada",
        "reference_id": reference.id,
        "species": normalized_species,
        "patient_weight_kg": resolved_weight,
        "nearest_reference_weight_kg": reference.peso_kg,
        "ranges": ranges,
    }


def safe_measurement_context(
    current_measurements: dict[str, str] | None,
    *,
    reference_context: dict[str, Any] | None = None,
) -> dict[str, dict[str, Any]]:
    safe: dict[str, dict[str, Any]] = {}
    ranges = (
        reference_context.get("ranges", {})
        if isinstance(reference_context, dict)
        else {}
    )
    for key, value in (current_measurements or {}).items():
        normalized = str(value or "").strip()
        if key not in ECHO_MEASUREMENT_UNITS:
            continue
        if key == "Remodelamento_AD":
            if normalized.lower() in {"ausente", "leve", "moderado", "importante"}:
                safe[key] = {
                    "value": normalized.lower(),
                    "unit": ECHO_MEASUREMENT_UNITS[key],
                    "method": ECHO_MEASUREMENT_METHODS[key],
                }
            continue
        if key == "VE_tecnica_relatorio":
            if normalized.lower() in {"modo_m", "2d"}:
                safe[key] = {
                    "value": normalized.lower(),
                    "unit": ECHO_MEASUREMENT_UNITS[key],
                    "method": ECHO_MEASUREMENT_METHODS[key],
                }
            continue
        if not re.fullmatch(r"[-+]?\d+(?:[.,]\d+)?", normalized):
            continue
        item: dict[str, Any] = {
            "value": normalized,
            "unit": ECHO_MEASUREMENT_UNITS[key],
            "method": ECHO_MEASUREMENT_METHODS[key],
        }
        reference_range = ranges.get(key)
        if isinstance(reference_range, dict):
            item["reference"] = reference_range
        safe[key] = item
    return safe
