from __future__ import annotations

import math
import re
import unicodedata
from dataclasses import dataclass
from typing import Optional

from app.schemas.ai_echo import (
    EchoClinicalStructureOutput,
    EchoClinicalWarningOutput,
    EchoMeasurementOutput,
)


@dataclass(frozen=True)
class MeasurementPattern:
    label_pattern: str
    canonical_name: str
    display_name: str
    unit: Optional[str]
    target_field_key: Optional[str]
    percentage: bool = False


MEASUREMENT_PATTERNS = (
    MeasurementPattern(
        r"(?:rela[cç][aã]o\s+)?(?:[aá]trio\s+esquerdo\s+(?:(?:a|sobre)\s+|/\s*)?aorta|ae\s*/\s*ao)",
        "la_ao",
        "AE/Ao",
        None,
        "AE_Ao",
    ),
    MeasurementPattern(
        r"(?:dived\s*(?:normalizado|n)|di[aâ]metro\s+interno\s+do\s+ventr[ií]culo\s+esquerdo\s+em\s+di[aá]stole\s+normalizado)",
        "lviddn",
        "DIVEdN",
        None,
        "DIVEd_normalizado",
    ),
    MeasurementPattern(
        r"(?:velocidade\s+(?:m[aá]xima\s+)?d[oa]\s+)?(?:refluxo|regurgita[cç][aã]o|insufici[eê]ncia)\s+tric[uú]spide",
        "tricuspid_regurgitation_velocity",
        "Velocidade do refluxo tricúspide",
        "m/s",
        "IT_Vmax",
    ),
    MeasurementPattern(
        r"gradiente(?:\s+(?:estimado|tric[uú]spide|de\s+press[aã]o))?",
        "tricuspid_gradient",
        "Gradiente estimado",
        "mmHg",
        None,
    ),
    MeasurementPattern(
        r"(?:fe|fra[cç][aã]o\s+de\s+eje[cç][aã]o)",
        "ejection_fraction",
        "Fração de ejeção",
        "%",
        "FE_Teicholz",
        True,
    ),
    MeasurementPattern(
        r"(?:fs|fra[cç][aã]o\s+de\s+encurtamento)",
        "fractional_shortening",
        "Fração de encurtamento",
        "%",
        "DeltaD_FS",
        True,
    ),
    MeasurementPattern(r"tapse", "tapse", "TAPSE", "mm", "TAPSE"),
    MeasurementPattern(r"mapse", "mapse", "MAPSE", "mm", "MAPSE"),
    MeasurementPattern(
        r"(?:velocidade\s+d[ae]\s+)?onda\s+e",
        "mitral_e_velocity",
        "Velocidade da onda E",
        "m/s",
        "Onda_E",
    ),
    MeasurementPattern(
        r"(?:velocidade\s+d[ae]\s+)?onda\s+a",
        "mitral_a_velocity",
        "Velocidade da onda A",
        "m/s",
        "Onda_A",
    ),
    MeasurementPattern(
        r"(?:rela[cç][aã]o\s+)?e\s*/\s*a",
        "mitral_e_a_ratio",
        "E/A",
        None,
        "E_A",
    ),
    MeasurementPattern(r"triv", "ivrt", "TRIV", "ms", "TRIV"),
    MeasurementPattern(
        r"(?:paat\s*/\s*pet|rela[cç][aã]o\s+paat\s+pet)",
        "paat_pet",
        "PAAT/PET",
        None,
        None,
    ),
    MeasurementPattern(
        r"(?:di[aâ]metro\s+d[oa]\s+)?ducto\s+arterioso",
        "ductus_diameter",
        "Diâmetro do ducto arterioso",
        "mm",
        None,
    ),
)

_NUMBER_WORDS = {
    "zero": 0,
    "um": 1,
    "uma": 1,
    "dois": 2,
    "duas": 2,
    "tres": 3,
    "quatro": 4,
    "cinco": 5,
    "seis": 6,
    "sete": 7,
    "oito": 8,
    "nove": 9,
    "dez": 10,
    "onze": 11,
    "doze": 12,
    "treze": 13,
    "quatorze": 14,
    "catorze": 14,
    "quinze": 15,
    "dezesseis": 16,
    "dezessete": 17,
    "dezoito": 18,
    "dezenove": 19,
    "vinte": 20,
    "trinta": 30,
    "quarenta": 40,
    "cinquenta": 50,
    "sessenta": 60,
    "setenta": 70,
    "oitenta": 80,
    "noventa": 90,
    "cem": 100,
    "cento": 100,
}
_NUMBER_TOKEN_PATTERN = (
    r"-?\d+(?:[,.]\d+)?|"
    r"(?:zero|um|uma|dois|duas|tr[eê]s|quatro|cinco|seis|sete|oito|nove|dez|"
    r"onze|doze|treze|quatorze|catorze|quinze|dezesseis|dezessete|dezoito|"
    r"dezenove|vinte|trinta|quarenta|cinquenta|sessenta|setenta|oitenta|noventa|"
    r"cem|cento|e|v[ií]rgula|ponto)\b(?:[\s-]+(?:zero|um|uma|dois|duas|tr[eê]s|"
    r"quatro|cinco|seis|sete|oito|nove|dez|onze|doze|treze|quatorze|catorze|"
    r"quinze|dezesseis|dezessete|dezoito|dezenove|vinte|trinta|quarenta|"
    r"cinquenta|sessenta|setenta|oitenta|noventa|cem|cento|e|v[ií]rgula|ponto)\b){0,10}"
)

_EXPECTED_UNITS = {
    "tricuspid_regurgitation_velocity": "m/s",
    "tricuspid_gradient": "mmHg",
    "ejection_fraction": "%",
    "fractional_shortening": "%",
    "tapse": "mm",
    "mapse": "mm",
    "mitral_e_velocity": "m/s",
    "mitral_a_velocity": "m/s",
    "ivrt": "ms",
    "ductus_diameter": "mm",
}


def _normalize_unit(value: str | None) -> str:
    normalized = _strip_accents(str(value or "")).replace(" ", "").lower()
    aliases = {
        "m/s": "m/s",
        "mps": "m/s",
        "metrosporsegundo": "m/s",
        "mmhg": "mmHg",
        "milimetrosdemercurio": "mmHg",
        "%": "%",
        "porcento": "%",
        "mm": "mm",
        "milimetro": "mm",
        "milimetros": "mm",
        "ms": "ms",
        "milissegundo": "ms",
        "milissegundos": "ms",
    }
    return aliases.get(normalized, str(value or "").strip())


def _strip_accents(value: str) -> str:
    return "".join(
        char
        for char in unicodedata.normalize("NFD", value.lower())
        if unicodedata.category(char) != "Mn"
    )


def _parse_integer_words(value: str) -> Optional[int]:
    words = [word for word in _strip_accents(value).replace("-", " ").split() if word != "e"]
    if not words or any(word not in _NUMBER_WORDS for word in words):
        return None
    total = 0
    for word in words:
        total += _NUMBER_WORDS[word]
    return total


def parse_spoken_number(value: str) -> Optional[tuple[float, str]]:
    raw = str(value or "").strip(" \t\r\n.,;:")
    if not raw:
        return None
    compact = raw.replace(" ", "")
    if re.fullmatch(r"-?\d+(?:[,.]\d+)?", compact):
        normalized = compact.replace(",", ".")
        return float(normalized), normalized

    normalized_words = _strip_accents(raw)
    decimal_parts = re.split(r"\b(?:virgula|ponto)\b", normalized_words, maxsplit=1)
    integer_value = _parse_integer_words(decimal_parts[0])
    if integer_value is None:
        return None
    if len(decimal_parts) == 1:
        return float(integer_value), str(integer_value)

    fraction_words = [
        word for word in decimal_parts[1].replace("-", " ").split() if word != "e"
    ]
    if not fraction_words:
        return None
    if all(word in {"zero", "um", "uma", "dois", "duas", "tres", "quatro", "cinco", "seis", "sete", "oito", "nove"} for word in fraction_words):
        fraction_digits = "".join(str(_NUMBER_WORDS[word]) for word in fraction_words)
    else:
        fraction_value = _parse_integer_words(decimal_parts[1])
        if fraction_value is None:
            return None
        fraction_digits = str(fraction_value)
    exact = f"{integer_value}.{fraction_digits}"
    return float(exact), exact


def extract_measurements_from_transcript(
    transcript: str,
) -> tuple[list[EchoMeasurementOutput], list[EchoClinicalWarningOutput]]:
    measurements: list[EchoMeasurementOutput] = []
    warnings: list[EchoClinicalWarningOutput] = []
    text = str(transcript or "")

    for definition in MEASUREMENT_PATTERNS:
        for label_match in re.finditer(definition.label_pattern, text, flags=re.IGNORECASE):
            tail = text[label_match.end() : label_match.end() + 140]
            number_match = re.search(
                rf"(?:\s*(?:de|em|igual\s+a|medindo)\s*)?({_NUMBER_TOKEN_PATTERN})",
                tail,
                flags=re.IGNORECASE,
            )
            if not number_match:
                continue
            parsed = parse_spoken_number(number_match.group(1))
            if parsed is None:
                continue
            numeric_value, raw_value = parsed
            source_end = label_match.end() + number_match.end()
            source_text = text[label_match.start() : source_end].strip()

            if numeric_value < 0:
                warnings.append(
                    EchoClinicalWarningOutput(
                        warning_type="negative_measurement",
                        severity="critical",
                        message=f"{definition.display_name} foi ditada com valor negativo e não pode ser aplicada.",
                        related_fields=[definition.canonical_name],
                    )
                )
                continue

            measurements.append(
                EchoMeasurementOutput(
                    canonical_name=definition.canonical_name,
                    display_name=definition.display_name,
                    value=numeric_value,
                    raw_value=raw_value,
                    unit=definition.unit,
                    target_field_key=definition.target_field_key,
                    source_text=source_text,
                    confidence=1.0,
                )
            )
            if definition.percentage and numeric_value > 100:
                warnings.append(
                    EchoClinicalWarningOutput(
                        warning_type="percentage_out_of_range",
                        severity="critical",
                        message=f"{definition.display_name} acima de 100%; revisar transcrição e unidade.",
                        related_fields=[definition.canonical_name],
                    )
                )

    return measurements, warnings


def _warning_key(warning: EchoClinicalWarningOutput) -> tuple[str, str]:
    return warning.warning_type, warning.message


def validate_and_enrich_clinical_output(
    output: EchoClinicalStructureOutput,
    transcript: str,
) -> EchoClinicalStructureOutput:
    deterministic, numeric_warnings = extract_measurements_from_transcript(transcript)
    measurements = list(output.measurements)
    warnings = list(output.warnings)
    existing_by_name: dict[str, list[EchoMeasurementOutput]] = {}
    for measurement in measurements:
        existing_by_name.setdefault(measurement.canonical_name, []).append(measurement)

    for extracted in deterministic:
        candidates = existing_by_name.get(extracted.canonical_name, [])
        matching = any(
            candidate.value is not None
            and extracted.value is not None
            and math.isclose(candidate.value, extracted.value, rel_tol=1e-6, abs_tol=1e-6)
            and (candidate.unit or "") == (extracted.unit or "")
            for candidate in candidates
        )
        if matching:
            continue
        if candidates:
            warnings.append(
                EchoClinicalWarningOutput(
                    warning_type="numeric_conflict",
                    severity="critical",
                    message=(
                        f"Há valores divergentes para {extracted.display_name}; "
                        "nenhum deles foi escolhido automaticamente."
                    ),
                    related_fields=[extracted.canonical_name],
                )
            )
        measurements.append(extracted)
        existing_by_name.setdefault(extracted.canonical_name, []).append(extracted)

    percentages = {
        "ejection_fraction",
        "fractional_shortening",
    }
    validated_measurements: list[EchoMeasurementOutput] = []
    for measurement in measurements:
        safe_measurement = measurement
        if measurement.value is not None and measurement.value < 0:
            warnings.append(
                EchoClinicalWarningOutput(
                    warning_type="negative_measurement",
                    severity="critical",
                    message=f"{measurement.display_name} possui valor negativo e exige revisão.",
                    related_fields=[measurement.canonical_name],
                )
            )
            safe_measurement = measurement.model_copy(
                update={"target_field_key": None}
            )
        expected_unit = _EXPECTED_UNITS.get(measurement.canonical_name)
        if expected_unit and _normalize_unit(measurement.unit) != expected_unit:
            warnings.append(
                EchoClinicalWarningOutput(
                    warning_type="unexpected_measurement_unit",
                    severity="critical",
                    message=(
                        f"{measurement.display_name} possui unidade ausente ou incompatível; "
                        "o valor foi preservado somente para revisão."
                    ),
                    related_fields=[measurement.canonical_name],
                )
            )
            safe_measurement = safe_measurement.model_copy(
                update={"target_field_key": None}
            )
        if (
            measurement.canonical_name in percentages
            and measurement.value is not None
            and measurement.value > 100
        ):
            warnings.append(
                EchoClinicalWarningOutput(
                    warning_type="percentage_out_of_range",
                    severity="critical",
                    message=f"{measurement.display_name} acima de 100%; revisar transcrição e unidade.",
                    related_fields=[measurement.canonical_name],
                )
            )
        validated_measurements.append(safe_measurement)
    measurements = validated_measurements

    velocity = next(
        (
            item.value
            for item in measurements
            if item.canonical_name == "tricuspid_regurgitation_velocity" and item.value is not None
        ),
        None,
    )
    gradient = next(
        (
            item.value
            for item in measurements
            if item.canonical_name == "tricuspid_gradient" and item.value is not None
        ),
        None,
    )
    if velocity is not None and gradient is not None:
        calculated = 4 * (velocity**2)
        tolerance = max(5.0, calculated * 0.2)
        if abs(calculated - gradient) > tolerance:
            warnings.append(
                EchoClinicalWarningOutput(
                    warning_type="velocity_gradient_mismatch",
                    severity="warning",
                    message=(
                        "Velocidade do refluxo tricúspide e gradiente informado parecem "
                        f"incompatíveis pela verificação ΔP = 4 × V² "
                        f"({calculated:.2f} mmHg versus {gradient:g} mmHg). "
                        "Os valores informados foram preservados."
                    ),
                    related_fields=[
                        "tricuspid_regurgitation_velocity",
                        "tricuspid_gradient",
                    ],
                )
            )

    normalized_transcript = _strip_accents(transcript)
    contradiction_pairs = (
        (
            "sem refluxo mitral",
            ("refluxo mitral moderado", "refluxo mitral importante", "refluxo mitral grave"),
            "mitral_regurgitation_contradiction",
            ["valva_mitral"],
        ),
        (
            "atrio esquerdo normal",
            ("atrio esquerdo muito dilatado", "atrio esquerdo aumentado"),
            "left_atrium_contradiction",
            ["atrio_esquerdo"],
        ),
    )
    for negative, positives, warning_type, related_fields in contradiction_pairs:
        if negative in normalized_transcript and any(
            positive in normalized_transcript for positive in positives
        ):
            warnings.append(
                EchoClinicalWarningOutput(
                    warning_type=warning_type,
                    severity="critical",
                    message="A transcrição contém afirmações clínicas contraditórias; revisar antes de aplicar.",
                    related_fields=related_fields,
                )
            )

    existing_warning_keys = set()
    deduped_warnings: list[EchoClinicalWarningOutput] = []
    for warning in [*warnings, *numeric_warnings]:
        key = _warning_key(warning)
        if key in existing_warning_keys:
            continue
        existing_warning_keys.add(key)
        deduped_warnings.append(warning)

    field_suggestions = list(output.field_suggestions)
    if output.conclusion_suggestion and not any(
        suggestion.field_key == "conclusao" for suggestion in field_suggestions
    ):
        field_suggestions.append(
            {
                "field_key": "conclusao",
                "text": "\n".join(output.conclusion_suggestion),
                "confidence": min(
                    [suggestion.confidence for suggestion in output.field_suggestions] or [0.75]
                ),
                "source_spans": [],
                "evidence_type": "diagnostic_suggestion",
            }
        )

    return EchoClinicalStructureOutput.model_validate(
        {
            **output.model_dump(),
            "measurements": measurements,
            "field_suggestions": field_suggestions,
            "warnings": deduped_warnings,
        }
    )
