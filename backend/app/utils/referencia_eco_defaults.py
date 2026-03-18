"""Published canine TAPSE/MAPSE defaults when the DB row has no values."""
from __future__ import annotations

from typing import Any
import unicodedata

_TAPSE_CANINO_REFERENCIAS_MM: tuple[tuple[float, float, float], ...] = (
    (3.0, 6.6, 10.6),
    (4.0, 7.2, 11.5),
    (5.0, 7.7, 12.3),
    (7.0, 8.5, 13.6),
    (9.0, 9.2, 14.7),
    (12.0, 10.0, 16.0),
    (15.0, 10.7, 17.1),
    (20.0, 11.6, 18.6),
    (25.0, 12.4, 19.9),
    (30.0, 13.1, 21.0),
    (35.0, 13.7, 22.0),
    (40.0, 14.3, 22.8),
)


def normalizar_especie_referencia(especie: Any) -> str | None:
    if especie is None:
        return None

    valor_original = str(especie).strip()
    valor = unicodedata.normalize("NFKD", valor_original)
    valor = valor.encode("ascii", "ignore").decode("ascii").lower()
    if not valor:
        return None
    if valor.startswith("fel") or "gato" in valor or "cat" in valor:
        return "Felina"
    if valor.startswith("can") or "cao" in valor or "dog" in valor:
        return "Canina"
    return valor_original


def _coerce_positive_float(valor: Any) -> float | None:
    if valor in (None, ""):
        return None

    try:
        numero = float(str(valor).replace(",", ".").strip())
    except (TypeError, ValueError):
        return None

    return numero if numero > 0 else None


def obter_tapse_canino_por_peso(peso_kg: float) -> tuple[float, float]:
    """Resolve TAPSE by the closest published body weight."""
    _, ref_min, ref_max = min(
        _TAPSE_CANINO_REFERENCIAS_MM,
        key=lambda item: (abs(item[0] - peso_kg), item[0]),
    )
    return ref_min, ref_max


def obter_mapse_canino_por_peso(peso_kg: float) -> tuple[float, float]:
    """
    MAPSE was published in cm (Schober et al. 2001) and is converted to mm,
    which is the unit used by the system and imported XML data.
    """
    if peso_kg < 15:
        return 6.5, 7.5
    if peso_kg <= 40:
        return 10.3, 11.3
    return 12.1, 18.1


def aplicar_defaults_publicados_caninos(
    referencia: dict[str, Any],
    *,
    peso_kg: Any | None = None,
) -> dict[str, Any]:
    resultado = dict(referencia)

    if normalizar_especie_referencia(resultado.get("especie")) != "Canina":
        return resultado

    peso_resolvido = _coerce_positive_float(peso_kg)
    if peso_resolvido is None:
        peso_resolvido = _coerce_positive_float(resultado.get("peso_kg"))
    if peso_resolvido is None:
        return resultado

    if resultado.get("tapse_min") is None or resultado.get("tapse_max") is None:
        tapse_min, tapse_max = obter_tapse_canino_por_peso(peso_resolvido)
        resultado["tapse_min"] = tapse_min
        resultado["tapse_max"] = tapse_max

    if resultado.get("mapse_min") is None or resultado.get("mapse_max") is None:
        mapse_min, mapse_max = obter_mapse_canino_por_peso(peso_resolvido)
        resultado["mapse_min"] = mapse_min
        resultado["mapse_max"] = mapse_max

    return resultado
