from __future__ import annotations

import json
import math
import re
import unicodedata
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

from app.schemas.ai_echo import (
    EchoClinicalStructureOutput,
    EchoFieldSuggestionOutput,
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

_NORMAL_FIELD_SUGGESTIONS = {
    "valva_mitral": "Valva mitral com morfologia e mobilidade preservadas, sem evidências de refluxo ou estenose significativa.",
    "valva_aortica": "Valva aórtica com morfologia e mobilidade preservadas, sem evidências de refluxo ou estenose significativa.",
    "valva_tricuspide": "Valva tricúspide com morfologia e mobilidade preservadas, sem evidências de refluxo ou estenose significativa.",
    "valva_pulmonar": "Valva pulmonar com morfologia e mobilidade preservadas, sem evidências de refluxo ou estenose significativa.",
    "atrio_esquerdo": "Átrio esquerdo com dimensões preservadas, sem evidências de aumento atrial.",
    "ventriculo_esquerdo": "Ventrículo esquerdo com dimensões e espessuras preservadas, sem sinais de remodelamento.",
    "funcao_sistolica_ve": "Função sistólica global do ventrículo esquerdo preservada.",
    "funcao_diastolica": "Função diastólica preservada, com padrão de enchimento ventricular dentro da normalidade.",
    "atrio_direito": "Átrio direito com dimensões preservadas, sem alterações ecocardiográficas relevantes.",
    "ventriculo_direito": "Ventrículo direito com dimensões e função preservadas, sem sinais de sobrecarga.",
    "septos": "Septos interatrial e interventricular íntegros, sem alterações ecocardiográficas relevantes.",
    "aorta": "Aorta com dimensões preservadas, sem alterações ecocardiográficas relevantes.",
    "arteria_pulmonar": "Artéria pulmonar com calibre preservado, sem alterações ecocardiográficas relevantes.",
    "pericardio": "Pericárdio sem alterações ecocardiográficas relevantes e sem derrame pericárdico.",
}

_GLOBAL_NORMAL_PATTERNS = (
    r"\bexame\s+(?:esta\s+)?normal\b",
    r"\bsem\s+alteracoes?\s+ecocardiograficas?\b",
    r"\bdemais\s+parametros?\s+ecocardiograficos?\s+(?:estao\s+)?(?:dentro\s+da\s+normalidade|normais?)\b",
    r"\brestante\s+(?:do\s+exame\s+)?(?:esta\s+)?(?:dentro\s+da\s+normalidade|normal)\b",
    r"\b(?:o\s+)?resto\s+dos?\s+parametros?\s+ecocardiograficos?(?:\s+avaliados?)?\s+(?:esta\s+|estao\s+)?(?:dentro\s+da\s+normalidade|normal|normais)\b",
)

_REMAINING_NORMAL_PATTERNS = (
    r"\bdemais\s+parametros?\s+ecocardiograficos?\s+(?:estao\s+)?(?:dentro\s+da\s+normalidade|normais?)\b",
    r"\brestante\s+(?:do\s+exame\s+)?(?:esta\s+)?(?:dentro\s+da\s+normalidade|normal)\b",
    r"\b(?:o\s+)?resto\s+dos?\s+parametros?\s+ecocardiograficos?(?:\s+avaliados?)?\s+(?:esta\s+|estao\s+)?(?:dentro\s+da\s+normalidade|normal|normais)\b",
)

_DIASTOLIC_GRADE_ONE_PATTERN = re.compile(
    r"\bdisfuncao\s+diastolica\s+(?:de\s+)?grau\s+(?:1|i|um)\b",
)
_MITRAL_MILD_THICKENING_PATTERN = re.compile(
    r"\b(?:valva\s+)?mitral\b.*\b(?:folhetos?\s+)?espessad|\bespessamento\b.*\bmitral\b"
)
_MITRAL_MILD_REGURGITATION_PATTERN = re.compile(
    r"\b(?:refluxo|regurgitacao)\s+(?:mitral\s+)?leve\b"
    r"|\bmitral\b.*\b(?:refluxo|regurgitacao)\s+leve\b"
)
_MITRAL_B1_PATTERN = re.compile(
    r"\b(?:classificacao|estagio)?\s*b1\b|\bendocardiose\b.*\bmitral\b.*\bb1\b"
)
_MITRAL_DISEASE_PATTERN = re.compile(
    r"\b(?:endocardiose|degeneracao\s+mixomatosa|doenca\s+valvar\s+mixomatosa)"
    r"\b.*\bmitral\b|\bmitral\b.*\b(?:endocardiose|mixomatosa)\b"
)
_MITRAL_STAGE_C_PATTERN = re.compile(
    r"\b(?:estagio|classificacao|grau|classe)?\s*c\b"
    r"|\b(?:estagio|classificacao|grau|classe)\s+(?:acvim\s+)?c\b"
)
_MITRAL_IMPORTANT_REGURGITATION_PATTERN = re.compile(
    r"\b(?:refluxo|regurgitacao|insuficiencia)\s+(?:mitral\s+)?"
    r"(?:importante|acentuad[ao]|grave|sever[ao])\b"
    r"|\bmitral\b.*\b(?:refluxo|regurgitacao|insuficiencia)\b.*"
    r"\b(?:importante|acentuad[ao]|grave|sever[ao])\b"
)
_TRICUSPID_REGURGITATION_PATTERN = re.compile(
    r"\b(?:refluxo|regurgitacao|insuficiencia)\s+(?:da\s+valva\s+)?tricuspide\b"
    r"|\btricuspide\b.*\b(?:refluxo|regurgitacao|insuficiencia)\b"
)
_RIGHT_CHAMBER_REPERCUSSION_PATTERN = re.compile(
    r"\b(?:repercussao|dilatacao|remodelamento|sobrecarga)\b.*"
    r"\b(?:camaras?\s+direitas?|atrio\s+direito|ventriculo\s+direito)\b"
)
_PULMONARY_CONGESTION_PATTERN = re.compile(
    r"\b(?:congestao\s+venosa\s+pulmonar|edema\s+pulmonar(?:\s+cardiogenico)?|"
    r"insuficiencia\s+cardiaca\s+congestiva|icc)\b"
)
_STRUCTURED_PHRASES_PATH = (
    Path(__file__).resolve().parents[2]
    / "data"
    / "frases_ecocardiograma_estruturado_teste.json"
)


def _normal_preset_suggestions(species: str | None) -> dict[str, str]:
    normalized_species = _strip_accents(str(species or ""))
    preset_key = "normal_gato" if any(
        token in normalized_species for token in ("felina", "felino", "gato")
    ) else "normal_cao"
    try:
        payload = json.loads(_STRUCTURED_PHRASES_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return dict(_NORMAL_FIELD_SUGGESTIONS)

    aspects = {
        str(item.get("key") or ""): item
        for item in payload.get("aspectos", [])
        if isinstance(item, dict)
    }
    preset = next(
        (
            item
            for item in payload.get("presets", [])
            if isinstance(item, dict)
            and str(item.get("key") or "") == preset_key
            and item.get("ativo", 1)
        ),
        None,
    )
    if not preset:
        return dict(_NORMAL_FIELD_SUGGESTIONS)

    resolved: dict[str, str] = {}
    for selection in preset.get("selecoes", []):
        if not isinstance(selection, dict):
            continue
        field_key = str(selection.get("aspecto") or "")
        title = str(selection.get("frase_titulo") or "")
        aspect = aspects.get(field_key) or {}
        phrase = next(
            (
                item
                for item in aspect.get("frases", [])
                if isinstance(item, dict)
                and str(item.get("titulo") or "") == title
                and item.get("ativo", 1)
            ),
            None,
        )
        text = str((phrase or {}).get("texto") or "").strip()
        if field_key and text:
            resolved[field_key] = text
    return resolved or dict(_NORMAL_FIELD_SUGGESTIONS)


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


def _consolidate_field_suggestions(
    suggestions: list[EchoFieldSuggestionOutput],
) -> tuple[list[EchoFieldSuggestionOutput], list[EchoClinicalWarningOutput]]:
    """Keep one reviewable suggestion per form field without hiding duplication."""
    consolidated: list[EchoFieldSuggestionOutput] = []
    index_by_field: dict[str, int] = {}
    duplicated_fields: set[str] = set()

    for suggestion in suggestions:
        field_key = str(suggestion.field_key)
        existing_index = index_by_field.get(field_key)
        if existing_index is None:
            index_by_field[field_key] = len(consolidated)
            consolidated.append(suggestion)
            continue

        duplicated_fields.add(field_key)
        existing = consolidated[existing_index]
        if suggestion.confidence > existing.confidence:
            consolidated[existing_index] = suggestion

    warnings = [
        EchoClinicalWarningOutput(
            warning_type="duplicate_field_suggestion",
            severity="warning",
            message=(
                f"A IA retornou mais de uma sugestão para o campo {field_key}; "
                "foi mantida somente a de maior confiança para revisão."
            ),
            related_fields=[field_key],
        )
        for field_key in sorted(duplicated_fields)
    ]
    return consolidated, warnings


def _expand_asserted_normality(
    *,
    transcript: str,
    suggestions: list[EchoFieldSuggestionOutput],
    species: str | None,
) -> tuple[list[EchoFieldSuggestionOutput], list[EchoClinicalWarningOutput]]:
    normalized = _strip_accents(transcript)
    if not any(re.search(pattern, normalized) for pattern in _GLOBAL_NORMAL_PATTERNS):
        return suggestions, []

    remaining_only = any(
        re.search(pattern, normalized) for pattern in _REMAINING_NORMAL_PATTERNS
    )
    source = (
        "demais parâmetros ecocardiográficos dentro da normalidade"
        if remaining_only
        else "exame normal, sem alterações ecocardiográficas"
    )
    preset_suggestions = _normal_preset_suggestions(species)
    if remaining_only:
        expanded = [
            item
            for item in suggestions
            if not item.source_spans
            or not all(
                any(
                    re.search(pattern, _strip_accents(span))
                    for pattern in _GLOBAL_NORMAL_PATTERNS
                )
                for span in item.source_spans
            )
        ]
    else:
        expanded = []
    existing_fields = {str(item.field_key) for item in expanded}

    diastolic_grade_one = bool(_DIASTOLIC_GRADE_ONE_PATTERN.search(normalized))
    mitral_mild_disease = bool(
        _MITRAL_MILD_THICKENING_PATTERN.search(normalized)
        and _MITRAL_MILD_REGURGITATION_PATTERN.search(normalized)
    )
    mitral_b1 = mitral_mild_disease and bool(_MITRAL_B1_PATTERN.search(normalized))
    if mitral_mild_disease:
        expanded = [
            item for item in expanded if str(item.field_key) != "valva_mitral"
        ]
        existing_fields.discard("valva_mitral")
        expanded.append(
            EchoFieldSuggestionOutput(
                field_key="valva_mitral",
                text=(
                    "Valva mitral com espessamento leve a moderado dos folhetos, "
                    "predominando no folheto septal. Refluxo mitral de grau leve ao "
                    "Doppler colorido, com jato estreito restrito à porção proximal "
                    "do átrio esquerdo."
                ),
                confidence=1.0,
                source_spans=[
                    "valva mitral com folhetos espessados e refluxo leve"
                ],
                evidence_type="fact",
            )
        )
        existing_fields.add("valva_mitral")

    if diastolic_grade_one:
        expanded = [
            item
            for item in expanded
            if str(item.field_key) not in {"funcao_diastolica", "conclusao"}
        ]
        existing_fields.difference_update({"funcao_diastolica", "conclusao"})
        expanded.append(
            EchoFieldSuggestionOutput(
                field_key="funcao_diastolica",
                text="Disfunção diastólica grau I (padrão senil).",
                confidence=1.0,
                source_spans=["disfunção diastólica grau 1, padrão senil"],
                evidence_type="fact",
            )
        )
        existing_fields.add("funcao_diastolica")

    for field_key, text in preset_suggestions.items():
        if field_key in existing_fields:
            continue
        expanded.append(
            EchoFieldSuggestionOutput(
                field_key=field_key,
                text=text,
                confidence=0.95,
                source_spans=[source],
                evidence_type="fact",
            )
        )
        existing_fields.add(field_key)

    if mitral_b1 and diastolic_grade_one:
        expanded = [
            item for item in expanded if str(item.field_key) != "conclusao"
        ]
        expanded.append(
            EchoFieldSuggestionOutput(
                field_key="conclusao",
                text=(
                    "Achados ecocardiográficos compatíveis com degeneração "
                    "mixomatosa da valva mitral, com refluxo de grau leve e sem "
                    "remodelamento cardíaco significativo. Estágio B1 (ACVIM). "
                    "Disfunção diastólica grau I (padrão senil)."
                ),
                confidence=1.0,
                source_spans=[
                    "endocardiose mitral B1 com refluxo leve",
                    "disfunção diastólica grau 1, padrão senil",
                ],
                evidence_type="diagnostic_suggestion",
            )
        )
    elif diastolic_grade_one:
        expanded.append(
            EchoFieldSuggestionOutput(
                field_key="conclusao",
                text="Disfunção diastólica grau I (padrão senil).",
                confidence=1.0,
                source_spans=["disfunção diastólica grau 1, padrão senil"],
                evidence_type="diagnostic_suggestion",
            )
        )
    elif "conclusao" not in existing_fields:
        expanded.append(
            EchoFieldSuggestionOutput(
                field_key="conclusao",
                text="Ecocardiograma dentro dos limites da normalidade.",
                confidence=0.95,
                source_spans=[source],
                evidence_type="diagnostic_suggestion",
            )
        )

    return expanded, [
        EchoClinicalWarningOutput(
            warning_type="global_normality_expanded",
            severity="info",
            message=(
                "A afirmação global de normalidade foi expandida para os campos sem "
                "alteração específica. Revise as sugestões antes de aplicá-las."
            ),
            related_fields=sorted(preset_suggestions),
        )
    ]


def _enrich_from_current_measurements(
    suggestions: list[EchoFieldSuggestionOutput],
    warnings: list[EchoClinicalWarningOutput],
    current_measurements: dict[str, str] | None,
    species: str | None,
) -> tuple[list[EchoFieldSuggestionOutput], list[EchoClinicalWarningOutput]]:
    normalized_species = _strip_accents(str(species or ""))
    if any(token in normalized_species for token in ("felina", "felino", "gato")):
        return suggestions, warnings
    raw_la_ao = str((current_measurements or {}).get("AE_Ao") or "").strip()
    if not raw_la_ao:
        return suggestions, warnings
    try:
        la_ao = float(raw_la_ao.replace(",", "."))
    except ValueError:
        return suggestions, warnings
    if la_ao < 1.6:
        return suggestions, warnings

    important = la_ao > 2.3
    atrial_text = (
        f"Átrio esquerdo com dilatação importante (relação AE/Ao {la_ao:g}), "
        "compatível com repercussão hemodinâmica significativa."
        if important
        else (
            f"Átrio esquerdo aumentado (relação AE/Ao {la_ao:g}), "
            "compatível com remodelamento atrial esquerdo."
        )
    )
    conclusion_part = (
        f"Dilatação atrial esquerda importante (AE/Ao {la_ao:g}), com "
        "repercussão hemodinâmica significativa."
        if important
        else f"Aumento atrial esquerdo (AE/Ao {la_ao:g})."
    )
    enriched = [
        item
        for item in suggestions
        if str(item.field_key) not in {"atrio_esquerdo", "conclusao"}
    ]
    previous_conclusion = next(
        (
            item.text.strip()
            for item in suggestions
            if str(item.field_key) == "conclusao" and item.text.strip()
        ),
        "",
    )
    previous_conclusion = re.sub(
        r"\s*(?:e\s+)?sem remodelamento card[ií]aco significativo\.\s*"
        r"Est[aá]gio B1 \(ACVIM\)\.",
        ".",
        previous_conclusion,
        flags=re.IGNORECASE,
    )
    previous_conclusion = re.sub(r"\.{2,}", ".", previous_conclusion).strip()
    enriched.append(
        EchoFieldSuggestionOutput(
            field_key="atrio_esquerdo",
            text=atrial_text,
            confidence=1.0,
            source_spans=[f"Medida do formulário: AE/Ao {raw_la_ao}"],
            evidence_type="fact",
        )
    )
    enriched.append(
        EchoFieldSuggestionOutput(
            field_key="conclusao",
            text=" ".join(part for part in (previous_conclusion, conclusion_part) if part),
            confidence=0.95,
            source_spans=[f"Medida do formulário: AE/Ao {raw_la_ao}"],
            evidence_type="diagnostic_suggestion",
        )
    )
    return enriched, [
        *warnings,
        EchoClinicalWarningOutput(
            warning_type="report_measurement_interpreted",
            severity="warning",
            message=(
                "A relação AE/Ao preenchida no formulário foi interpretada. "
                "Confirme espécie, técnica de medida e os demais critérios de "
                "remodelamento antes de definir estágio clínico."
            ),
            related_fields=["AE_Ao", "atrio_esquerdo", "conclusao"],
        ),
    ]


def _measurement_float(
    current_measurements: dict[str, str] | None,
    field_key: str,
) -> float | None:
    raw = str((current_measurements or {}).get(field_key) or "").strip()
    match = re.search(r"-?\d+(?:[,.]\d+)?", raw)
    if not match:
        return None
    try:
        return float(match.group(0).replace(",", "."))
    except ValueError:
        return None


def _replace_field_suggestion(
    suggestions: list[EchoFieldSuggestionOutput],
    *,
    field_key: str,
    text: str,
    source_spans: list[str],
    evidence_type: str,
    confidence: float = 0.95,
) -> list[EchoFieldSuggestionOutput]:
    return [
        item for item in suggestions if str(item.field_key) != field_key
    ] + [
        EchoFieldSuggestionOutput(
            field_key=field_key,
            text=text,
            confidence=confidence,
            source_spans=source_spans,
            evidence_type=evidence_type,
        )
    ]


def _enrich_advanced_mitral_multimodal(
    suggestions: list[EchoFieldSuggestionOutput],
    warnings: list[EchoClinicalWarningOutput],
    *,
    transcript: str,
    current_measurements: dict[str, str] | None,
    species: str | None,
) -> tuple[list[EchoFieldSuggestionOutput], list[EchoClinicalWarningOutput]]:
    normalized_species = _strip_accents(str(species or ""))
    normalized = _strip_accents(transcript)
    if any(token in normalized_species for token in ("felina", "felino", "gato")):
        return suggestions, warnings
    if not _MITRAL_DISEASE_PATTERN.search(normalized):
        return suggestions, warnings

    stage_c = bool(_MITRAL_STAGE_C_PATTERN.search(normalized))
    important_mr = bool(_MITRAL_IMPORTANT_REGURGITATION_PATTERN.search(normalized))
    tricuspid_regurgitation = bool(_TRICUSPID_REGURGITATION_PATTERN.search(normalized))
    right_chamber_repercussion = bool(
        _RIGHT_CHAMBER_REPERCUSSION_PATTERN.search(normalized)
    )
    pulmonary_congestion = bool(_PULMONARY_CONGESTION_PATTERN.search(normalized))

    la_ao = _measurement_float(current_measurements, "AE_Ao")
    lviddn = _measurement_float(current_measurements, "DIVEd_normalizado")
    e_wave = _measurement_float(current_measurements, "Onda_E")
    e_a = _measurement_float(current_measurements, "E_A")
    e_e_prime = _measurement_float(current_measurements, "E_E_linha")
    mr_vmax = _measurement_float(current_measurements, "IM_Vmax")
    tr_vmax = _measurement_float(current_measurements, "IT_Vmax")

    advanced_left_remodeling = bool(
        (la_ao is not None and la_ao > 2.3)
        or (lviddn is not None and lviddn >= 1.7)
    )
    filling_pressure_support = bool(
        (e_wave is not None and e_wave > 1.2)
        or (e_a is not None and e_a >= 2.0)
    )
    if not any(
        (
            stage_c,
            important_mr,
            tricuspid_regurgitation,
            advanced_left_remodeling,
            filling_pressure_support,
        )
    ):
        return suggestions, warnings

    enriched = list(suggestions)
    evidence_sources = ["Ditado: doença mixomatosa/endocardiose mitral"]

    if stage_c or important_mr:
        mitral_parts = [
            "Valva mitral com espessamento e aspecto mixomatoso dos folhetos"
        ]
        mitral_parts.append(
            "regurgitação mitral importante ao Doppler colorido"
            if important_mr
            else "regurgitação mitral associada"
        )
        if mr_vmax is not None:
            mitral_parts.append(f"Vmax do jato regurgitante de {mr_vmax:g} m/s")
        enriched = _replace_field_suggestion(
            enriched,
            field_key="valva_mitral",
            text="; ".join(mitral_parts) + ".",
            source_spans=[
                *evidence_sources,
                *(
                    [f"Medida do formulário: IM Vmax {mr_vmax:g}"]
                    if mr_vmax is not None
                    else []
                ),
            ],
            evidence_type="fact",
        )

    if la_ao is not None and la_ao >= 1.6:
        atrial_severity = "importante" if la_ao > 2.3 else "presente"
        enriched = _replace_field_suggestion(
            enriched,
            field_key="atrio_esquerdo",
            text=(
                f"Átrio esquerdo com dilatação {atrial_severity} "
                f"(relação AE/Ao {la_ao:g}), compatível com remodelamento por "
                "sobrecarga volumétrica."
            ),
            source_spans=[f"Medida do formulário: AE/Ao {la_ao:g}"],
            evidence_type="inference",
        )

    if lviddn is not None and lviddn >= 1.7:
        enriched = _replace_field_suggestion(
            enriched,
            field_key="ventriculo_esquerdo",
            text=(
                "Ventrículo esquerdo dilatado, com remodelamento excêntrico por "
                f"sobrecarga volumétrica (DIVEd normalizado {lviddn:g})."
            ),
            source_spans=[f"Medida do formulário: DIVEd normalizado {lviddn:g}"],
            evidence_type="inference",
        )

    if filling_pressure_support:
        doppler_values: list[str] = []
        if e_wave is not None:
            doppler_values.append(f"onda E {e_wave:g} m/s")
        if e_a is not None:
            doppler_values.append(f"relação E/A {e_a:g}")
        if e_e_prime is not None:
            doppler_values.append(f"E/E' {e_e_prime:g}")
        enriched = _replace_field_suggestion(
            enriched,
            field_key="funcao_diastolica",
            text=(
                f"Fluxo transmitral com {', '.join(doppler_values)}, conjunto "
                "compatível com elevação das pressões de enchimento do ventrículo "
                "esquerdo no contexto da doença mitral."
            ),
            source_spans=[
                f"Medidas do formulário: {', '.join(doppler_values)}",
            ],
            evidence_type="inference",
        )

    if tricuspid_regurgitation:
        tricuspid_text = "Regurgitação tricúspide identificada ao Doppler colorido"
        if tr_vmax is not None:
            tricuspid_text += f", com Vmax de {tr_vmax:g} m/s"
        enriched = _replace_field_suggestion(
            enriched,
            field_key="valva_tricuspide",
            text=tricuspid_text + ".",
            source_spans=[
                "Ditado: regurgitação tricúspide",
                *(
                    [f"Medida do formulário: IT Vmax {tr_vmax:g}"]
                    if tr_vmax is not None
                    else []
                ),
            ],
            evidence_type="fact",
        )

    if right_chamber_repercussion:
        enriched = _replace_field_suggestion(
            enriched,
            field_key="atrio_direito",
            text="Átrio direito com dilatação associada à repercussão hemodinâmica descrita.",
            source_spans=["Ditado: repercussão em câmaras direitas"],
            evidence_type="fact",
        )
        enriched = _replace_field_suggestion(
            enriched,
            field_key="ventriculo_direito",
            text="Ventrículo direito com sinais de sobrecarga/remodelamento, conforme descrito no ditado.",
            source_spans=["Ditado: repercussão em câmaras direitas"],
            evidence_type="fact",
        )

    conclusion_parts = [
        "Achados compatíveis com endocardiose mitral (degeneração mixomatosa) avançada"
    ]
    if important_mr:
        conclusion_parts.append("regurgitação mitral importante")
    if la_ao is not None and la_ao >= 1.6:
        conclusion_parts.append(
            (
                "dilatação atrial esquerda com repercussão hemodinâmica "
                f"significativa (AE/Ao {la_ao:g})"
                if la_ao > 2.3
                else f"dilatação atrial esquerda (AE/Ao {la_ao:g})"
            )
        )
    if lviddn is not None and lviddn >= 1.7:
        conclusion_parts.append(f"dilatação ventricular esquerda (DIVEdn {lviddn:g})")
    if filling_pressure_support:
        conclusion_parts.append("indicadores Doppler de elevadas pressões de enchimento")
    if tricuspid_regurgitation:
        conclusion_parts.append("regurgitação tricúspide associada")
    conclusion = ", com ".join(
        (conclusion_parts[0], ", ".join(conclusion_parts[1:]))
    ) if len(conclusion_parts) > 1 else conclusion_parts[0]
    conclusion += "."
    if stage_c:
        conclusion += " Estágio C (ACVIM), conforme classificação informada no ditado."
    if pulmonary_congestion:
        conclusion += " Sinais de congestão venosa pulmonar informados no ditado."
    enriched = _replace_field_suggestion(
        enriched,
        field_key="conclusao",
        text=conclusion,
        source_spans=[
            *evidence_sources,
            *(
                ["Ditado: estágio C (ACVIM)"]
                if stage_c
                else []
            ),
            *(
                ["Ditado: congestão venosa pulmonar/ICC"]
                if pulmonary_congestion
                else []
            ),
        ],
        evidence_type="diagnostic_suggestion",
        confidence=0.9,
    )

    enriched_warnings = [
        *warnings,
        EchoClinicalWarningOutput(
            warning_type="multimodal_correlation_applied",
            severity="info",
            message=(
                "O áudio foi correlacionado às medidas do formulário. Revise a "
                "técnica, as unidades e a coerência clínica antes de aplicar."
            ),
            related_fields=[
                key
                for key in (
                    "AE_Ao",
                    "DIVEd_normalizado",
                    "Onda_E",
                    "E_A",
                    "E_E_linha",
                    "IM_Vmax",
                    "IT_Vmax",
                )
                if str((current_measurements or {}).get(key) or "").strip()
            ],
        ),
    ]
    if stage_c and not pulmonary_congestion:
        enriched_warnings.append(
            EchoClinicalWarningOutput(
                warning_type="stage_c_requires_chf_evidence",
                severity="warning",
                message=(
                    "O estágio C foi informado no ditado, mas congestão atual ou "
                    "histórico prévio de insuficiência cardíaca não foram descritos. "
                    "Confirme sinais clínicos e/ou evidência radiográfica."
                ),
                related_fields=["conclusao"],
            )
        )
    if mr_vmax is not None:
        enriched_warnings.append(
            EchoClinicalWarningOutput(
                warning_type="mitral_velocity_not_regurgitation_grade",
                severity="info",
                message=(
                    "A velocidade do jato mitral foi incorporada como medida, mas "
                    "não foi usada isoladamente para graduar a regurgitação."
                ),
                related_fields=["IM_Vmax", "valva_mitral"],
            )
        )
    if tr_vmax is not None and tr_vmax >= 3.0:
        enriched_warnings.append(
            EchoClinicalWarningOutput(
                warning_type="tr_velocity_requires_ph_context",
                severity="warning",
                message=(
                    "A velocidade da regurgitação tricúspide está elevada. A "
                    "probabilidade de hipertensão pulmonar requer correlação com "
                    "sinais anatômicos adicionais e o contexto clínico."
                ),
                related_fields=["IT_Vmax", "valva_tricuspide", "ventriculo_direito"],
            )
        )
    return enriched, enriched_warnings


def validate_and_enrich_clinical_output(
    output: EchoClinicalStructureOutput,
    transcript: str,
    *,
    species: str | None = None,
    current_measurements: dict[str, str] | None = None,
) -> EchoClinicalStructureOutput:
    deterministic, numeric_warnings = extract_measurements_from_transcript(transcript)
    field_suggestions, duplicate_warnings = _consolidate_field_suggestions(
        list(output.field_suggestions)
    )
    field_suggestions, normality_warnings = _expand_asserted_normality(
        transcript=transcript,
        suggestions=field_suggestions,
        species=species or output.exam_context.species,
    )
    field_suggestions, measurement_warnings = _enrich_from_current_measurements(
        field_suggestions,
        [*duplicate_warnings, *normality_warnings],
        current_measurements,
        species or output.exam_context.species,
    )
    field_suggestions, measurement_warnings = _enrich_advanced_mitral_multimodal(
        field_suggestions,
        measurement_warnings,
        transcript=transcript,
        current_measurements=current_measurements,
        species=species or output.exam_context.species,
    )
    measurements = list(output.measurements)
    warnings = [*output.warnings, *measurement_warnings]
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
