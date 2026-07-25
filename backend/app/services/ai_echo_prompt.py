from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any

PROMPT_VERSION = "echo-clinical-ptbr-v1"
VOCABULARY_PATH = Path(__file__).resolve().parents[2] / "data" / "ai_echo_vocabulary_pt_br.json"


@lru_cache(maxsize=1)
def load_default_vocabulary() -> list[dict[str, str]]:
    try:
        payload = json.loads(VOCABULARY_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return []
    terms = payload.get("terms") if isinstance(payload, dict) else None
    if not isinstance(terms, list):
        return []
    normalized: list[dict[str, str]] = []
    for item in terms:
        if not isinstance(item, dict):
            continue
        spoken = str(item.get("spoken_form") or "").strip()
        canonical = str(item.get("canonical_form") or "").strip()
        if spoken and canonical:
            normalized.append(
                {
                    "spoken_form": spoken,
                    "canonical_form": canonical,
                    "category": str(item.get("category") or "clinical").strip(),
                }
            )
    return normalized


def build_transcription_prompt(custom_vocabulary: list[dict[str, Any]]) -> str:
    vocabulary = [*load_default_vocabulary(), *custom_vocabulary]
    pairs = [
        f"{str(item.get('spoken_form') or '').strip()} = {str(item.get('canonical_form') or '').strip()}"
        for item in vocabulary
        if str(item.get("spoken_form") or "").strip()
        and str(item.get("canonical_form") or "").strip()
    ]
    context = "; ".join(pairs[:300])
    return (
        "Transcreva em português brasileiro um ditado de ecocardiografia veterinária. "
        "Preserve exatamente números, separadores decimais, unidades, relações, negações e "
        "graus. Não resuma, não interprete e não complete informações ausentes. "
        f"Vocabulário clínico e formas preferidas: {context}"
    )[:12000]


def build_clinical_structuring_instructions(
    *,
    phrase_preferences: list[dict[str, Any]],
) -> str:
    preferences = [
        {
            "field_key": str(item.get("field_key") or "").strip(),
            "phrase_text": str(item.get("phrase_text") or "").strip(),
            "tags": item.get("tags") if isinstance(item.get("tags"), list) else [],
        }
        for item in phrase_preferences
        if str(item.get("field_key") or "").strip()
        and str(item.get("phrase_text") or "").strip()
    ]
    preferences_json = json.dumps(preferences[:300], ensure_ascii=False)
    return f"""
Você é um assistente de estruturação de laudo de ecocardiografia veterinária.
Sua saída deve obedecer estritamente ao esquema fornecido.

Regras clínicas obrigatórias:
- Use apenas fatos presentes na transcrição. Nunca invente achados, medidas, unidades ou diagnósticos.
- Preserve os números, os separadores decimais, as unidades e as relações como foram ditados.
- Não arredonde, converta unidade, calcule ou corrija silenciosamente.
- Se houver dúvida entre valores, mantenha a dúvida em warning e não escolha arbitrariamente.
- Separe fato, inferência e sugestão diagnóstica em evidence_type.
- Suspeita não é diagnóstico definitivo.
- Não prescreva tratamento, medicamento ou dose.
- Não assine, finalize, publique ou valide o laudo.
- Produza textos curtos, objetivos e em português brasileiro.
- Expanda siglas na primeira ocorrência quando isso não adicionar informação ausente.
- Não use intervalos de referência fixos. Espécie, peso, raça, idade, método e referência
  selecionada são necessários para qualquer comparação.
- Quando algo não foi informado, não crie sugestão e registre a lacuna em missing_information
  somente se ela for clinicamente relevante à interpretação dos fatos ditados.
- Conflitos, percentuais acima de 100, unidades duvidosas e incompatibilidades entre velocidade
  e gradiente devem ser warnings; não altere os valores fornecidos.
- Use apenas as chaves reais do formulário disponibilizadas pelo esquema.

Preferências já aprovadas pelo usuário, a reutilizar quando compatíveis com os fatos:
{preferences_json}
""".strip()
