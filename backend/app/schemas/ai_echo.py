from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator


EchoFieldKey = Literal[
    "valva_mitral",
    "valva_aortica",
    "valva_tricuspide",
    "valva_pulmonar",
    "atrio_esquerdo",
    "ventriculo_esquerdo",
    "funcao_sistolica_ve",
    "funcao_diastolica",
    "atrio_direito",
    "ventriculo_direito",
    "septos",
    "aorta",
    "arteria_pulmonar",
    "pericardio",
    "conclusao",
]

EchoMeasurementFieldKey = Literal[
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
    "TAPSE",
    "MAPSE",
    "Aorta",
    "Atrio_esquerdo",
    "AE_Ao",
    "Fracao_encurtamento_AE",
    "Fluxo_auricular",
    "Onda_E",
    "Onda_A",
    "E_A",
    "TD",
    "TRIV",
    "MR_dp_dt",
    "e_doppler",
    "a_doppler",
    "doppler_tecidual_relacao",
    "E_E_linha",
    "AP",
    "Ao_nivel_AP",
    "AP_Ao",
    "IM_Vmax",
    "IT_Vmax",
    "IA_Vmax",
    "IP_Vmax",
    "Vmax_aorta",
    "Grad_aorta",
    "Vmax_pulmonar",
    "Grad_pulmonar",
]


class StrictSchema(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class EchoExamContext(StrictSchema):
    species: Optional[str]
    weight_kg: Optional[float] = Field(default=None, gt=0)


class EchoMeasurementOutput(StrictSchema):
    canonical_name: str = Field(min_length=1, max_length=80)
    display_name: str = Field(min_length=1, max_length=140)
    value: Optional[float]
    raw_value: Optional[str] = Field(default=None, max_length=80)
    unit: Optional[str] = Field(default=None, max_length=40)
    target_field_key: Optional[EchoMeasurementFieldKey]
    source_text: str = Field(min_length=1, max_length=1000)
    confidence: float = Field(ge=0, le=1)


class EchoFieldSuggestionOutput(StrictSchema):
    field_key: EchoFieldKey
    text: str = Field(min_length=1, max_length=5000)
    confidence: float = Field(ge=0, le=1)
    source_spans: list[str]
    evidence_type: Literal["fact", "inference", "diagnostic_suggestion"]


class EchoClinicalWarningOutput(StrictSchema):
    warning_type: str = Field(min_length=1, max_length=80)
    severity: Literal["info", "warning", "critical"]
    message: str = Field(min_length=1, max_length=1000)
    related_fields: list[str]


class EchoClinicalStructureOutput(StrictSchema):
    exam_context: EchoExamContext
    measurements: list[EchoMeasurementOutput]
    field_suggestions: list[EchoFieldSuggestionOutput]
    conclusion_suggestion: list[str]
    warnings: list[EchoClinicalWarningOutput]
    missing_information: list[str]


class EchoSessionCreateRequest(StrictSchema):
    laudo_id: int = Field(gt=0)


class EchoStructureRequest(StrictSchema):
    edited_transcript: str = Field(min_length=1, max_length=30000)
    current_measurements: dict[str, str] = Field(default_factory=dict)

    @field_validator("current_measurements")
    @classmethod
    def validate_measurement_keys(cls, value: dict[str, str]) -> dict[str, str]:
        allowed = set(EchoMeasurementFieldKey.__args__)
        unknown = sorted(set(value).difference(allowed))
        if unknown:
            raise ValueError(f"Campos de medida desconhecidos: {', '.join(unknown)}")
        normalized = {key: str(text or "").strip() for key, text in value.items()}
        oversized = sorted(key for key, text in normalized.items() if len(text) > 80)
        if oversized:
            raise ValueError(f"Valores de medida muito longos: {', '.join(oversized)}")
        return normalized


class EchoApplyRequest(StrictSchema):
    confirmed: Literal[True]
    accepted_suggestion_ids: list[str]
    accepted_measurement_ids: list[str]
    suggestion_overrides: dict[str, str] = Field(default_factory=dict)
    mode: Literal["replace", "append", "empty_only"] = "replace"
    current_fields: dict[str, str]
    current_measurements: dict[str, str]

    @field_validator("suggestion_overrides")
    @classmethod
    def validate_suggestion_overrides(cls, value: dict[str, str]) -> dict[str, str]:
        normalized: dict[str, str] = {}
        for suggestion_id, text in value.items():
            clean_id = str(suggestion_id or "").strip()
            clean_text = str(text or "").strip()
            if not clean_id or len(clean_id) > 36:
                raise ValueError("Identificador de sugestão inválido.")
            if not clean_text or len(clean_text) > 5000:
                raise ValueError("Texto editado da sugestão inválido.")
            normalized[clean_id] = clean_text
        return normalized

    @field_validator("current_fields")
    @classmethod
    def validate_field_keys(cls, value: dict[str, str]) -> dict[str, str]:
        allowed = set(EchoFieldKey.__args__)
        unknown = sorted(set(value).difference(allowed))
        if unknown:
            raise ValueError(f"Campos qualitativos desconhecidos: {', '.join(unknown)}")
        return {key: str(text or "") for key, text in value.items()}

    @field_validator("current_measurements")
    @classmethod
    def validate_measurement_keys(cls, value: dict[str, str]) -> dict[str, str]:
        allowed = set(EchoMeasurementFieldKey.__args__)
        unknown = sorted(set(value).difference(allowed))
        if unknown:
            raise ValueError(f"Campos de medida desconhecidos: {', '.join(unknown)}")
        return {key: str(text or "") for key, text in value.items()}


class EchoFeedbackRequest(StrictSchema):
    feedback_type: Literal["accepted", "edited", "rejected", "reject_session"]
    suggestion_id: Optional[str] = Field(default=None, max_length=36)
    field_key: Optional[str] = Field(default=None, max_length=80)
    original_suggestion: Optional[str] = Field(default=None, max_length=5000)
    final_text: Optional[str] = Field(default=None, max_length=5000)


class EchoVocabularyInput(StrictSchema):
    spoken_form: str = Field(min_length=1, max_length=180)
    canonical_form: str = Field(min_length=1, max_length=180)
    category: str = Field(default="clinical", min_length=1, max_length=60)
    active: bool = True


class EchoPhrasePreferenceInput(StrictSchema):
    field_key: EchoFieldKey
    phrase_text: str = Field(min_length=1, max_length=5000)
    tags: list[str] = Field(default_factory=list, max_length=20)
    active: bool = True


class EchoPreferencesUpdateRequest(StrictSchema):
    vocabulary: list[EchoVocabularyInput] = Field(max_length=500)
    phrases: list[EchoPhrasePreferenceInput] = Field(max_length=500)
