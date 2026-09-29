"""Published echo intervals and method-aware safeguards for stored catalog rows."""
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
    (45.0, 14.8, 23.7),
)
# Intervalos de predição por peso: Visser et al., J Vet Cardiol 2015,
# DOI 10.1016/j.jvc.2014.10.003 (tabela também apresentada na tese do autor).


def normalizar_especie_referencia(especie: Any) -> str | None:
    if especie is None:
        return None

    valor_original = str(especie).strip()
    valor = unicodedata.normalize("NFKD", valor_original)
    valor = valor.encode("ascii", "ignore").decode("ascii").lower()
    if not valor:
        return None
    if valor in {"felina", "felino", "felinos", "feline", "gato", "gatos", "cat", "cats"}:
        return "Felina"
    if valor in {"canina", "canino", "caninos", "canine", "cao", "caes", "cachorro", "cachorros", "dog", "dogs"}:
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
    """Resolve TAPSE by the closest tabulated body weight."""
    _, ref_min, ref_max = min(
        _TAPSE_CANINO_REFERENCIAS_MM,
        key=lambda item: (abs(item[0] - peso_kg), item[0]),
    )
    return ref_min, ref_max


def aplicar_defaults_publicados_caninos(
    referencia: dict[str, Any],
    *,
    peso_kg: Any | None = None,
) -> dict[str, Any]:
    resultado = dict(referencia)
    resultado.pop("fs_source", None)
    especie = normalizar_especie_referencia(resultado.get("especie"))
    peso_resolvido = _coerce_positive_float(peso_kg)
    if peso_resolvido is None:
        peso_resolvido = _coerce_positive_float(resultado.get("peso_kg"))

    # The catalog's EF columns do not identify Teichholz or Simpson. Neither
    # Visser 2019 (Simpson) nor Häggström 2016 (no EF interval) validates an
    # automatic Teichholz comparison. Keep the stored values for audit only.
    resultado["ef_min"] = None
    resultado["ef_max"] = None
    resultado["ef_reference_note"] = "FE Teichholz: intervalo não validado por método"

    # Visser et al. 2019, Table 3: 95% RI for FS, M-mode, short axis, in 122
    # healthy adult dogs (2.6–67.8 kg). Replace only the known unsourced
    # catalog default; never attribute a custom row to this study.
    if especie == "Canina":
        if (peso_resolvido is not None and 2.6 <= peso_resolvido <= 67.8
                and (resultado.get("fs_min"), resultado.get("fs_max"))
                in {(25, 45), (20.7, 51.9)}):
            resultado["fs_min"] = 20.7
            resultado["fs_max"] = 51.9
            resultado["fs_source"] = "Visser et al. 2019; modo M, eixo curto; cães adultos saudáveis"
        else:
            resultado["fs_min"] = None
            resultado["fs_max"] = None
    elif especie == "Felina":
        # Häggström et al. 2016, Table 3: weight-specific FS prediction limits
        # in adult pure-bred cats with unremarkable echocardiograms.
        row_weight = _coerce_positive_float(resultado.get("peso_kg"))
        expected_upper = 63 if row_weight is not None and row_weight >= 9.5 else 62
        if (peso_resolvido is not None and 1.5 <= peso_resolvido <= 11.0
                and row_weight is not None and 1.5 <= row_weight <= 11.0
                and resultado.get("fs_min") == 28
                and resultado.get("fs_max") == expected_upper):
            resultado["fs_source"] = "Häggström et al. 2016; modo M; gatos adultos de raça pura"
        else:
            resultado["fs_min"] = None
            resultado["fs_max"] = None
    else:
        resultado["fs_min"] = None
        resultado["fs_max"] = None

    if especie != "Canina":
        return resultado

    if peso_resolvido is None:
        return resultado

    if (
        _TAPSE_CANINO_REFERENCIAS_MM[0][0] <= peso_resolvido <= _TAPSE_CANINO_REFERENCIAS_MM[-1][0]
        and (resultado.get("tapse_min") is None or resultado.get("tapse_max") is None)
    ):
        tapse_min, tapse_max = obter_tapse_canino_por_peso(peso_resolvido)
        resultado["tapse_min"] = tapse_min
        resultado["tapse_max"] = tapse_max

    # Schober e Luis Fuentes (2001) publicaram ICs das médias de MAPSE,
    # não intervalos de referência individuais; não preencher MAPSE com esses ICs.
    return resultado
