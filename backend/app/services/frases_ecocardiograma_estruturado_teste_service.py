from __future__ import annotations

import json
from copy import deepcopy
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

DATA_DIR = Path(__file__).resolve().parents[2] / "data"
FRASES_FILE = DATA_DIR / "frases_ecocardiograma_estruturado_teste.json"

DEFAULT_ASPECTS = [
    {"key": "valva_mitral", "label": "Valva mitral", "categoria": "Valvas", "descricao": "Morfologia e funcionamento da valva mitral.", "placeholder": "Descreva espessamento, prolapso, refluxo, estenose e mobilidade da valva mitral.", "legacy_field": "valvas", "ordem": 10},
    {"key": "valva_aortica", "label": "Valva aortica", "categoria": "Valvas", "descricao": "Morfologia e funcionamento da valva aortica.", "placeholder": "Descreva cuspides, fluxo, refluxo ou estenose da valva aortica.", "legacy_field": "valvas", "ordem": 20},
    {"key": "valva_tricuspide", "label": "Valva tricuspide", "categoria": "Valvas", "descricao": "Morfologia e funcionamento da valva tricuspide.", "placeholder": "Descreva refluxo, espessamento, degeneracao ou estenose da valva tricuspide.", "legacy_field": "valvas", "ordem": 30},
    {"key": "valva_pulmonar", "label": "Valva pulmonar", "categoria": "Valvas", "descricao": "Morfologia e funcionamento da valva pulmonar.", "placeholder": "Descreva valva pulmonar, refluxo, estenose e comportamento do fluxo.", "legacy_field": "valvas", "ordem": 40},
    {"key": "atrio_esquerdo", "label": "Atrio esquerdo", "categoria": "Camaras esquerdas", "descricao": "Tamanho, remodelamento e comportamento do atrio esquerdo.", "placeholder": "Descreva dimensoes, aumento atrial e sinais de remodelamento do atrio esquerdo.", "legacy_field": "camaras", "ordem": 50},
    {"key": "ventriculo_esquerdo", "label": "Ventriculo esquerdo", "categoria": "Camaras esquerdas", "descricao": "Dimensoes e geometria do ventriculo esquerdo.", "placeholder": "Descreva espessuras, diametros, remodelamento e padrao estrutural do VE.", "legacy_field": "camaras", "ordem": 60},
    {"key": "funcao_sistolica_ve", "label": "Funcao sistolica do VE", "categoria": "Funcao", "descricao": "Comportamento da contratilidade e da funcao sistolica global.", "placeholder": "Descreva funcao sistolica, hipercinesia, hipocinesia ou preservacao da contratilidade.", "legacy_field": "funcao", "ordem": 70},
    {"key": "funcao_diastolica", "label": "Funcao diastolica", "categoria": "Funcao", "descricao": "Padrao de enchimento e relaxamento ventricular.", "placeholder": "Descreva funcao diastolica, padrao de enchimento e relaxamento.", "legacy_field": "funcao", "ordem": 80},
    {"key": "atrio_direito", "label": "Atrio direito", "categoria": "Camaras direitas", "descricao": "Dimensoes e comportamento do atrio direito.", "placeholder": "Descreva volume e remodelamento do atrio direito.", "legacy_field": "ad_vd", "ordem": 90},
    {"key": "ventriculo_direito", "label": "Ventriculo direito", "categoria": "Camaras direitas", "descricao": "Dimensoes, espessura e desempenho do ventriculo direito.", "placeholder": "Descreva diametro, hipertrofia, dilatacao e funcao do ventriculo direito.", "legacy_field": "ad_vd", "ordem": 100},
    {"key": "septos", "label": "Septos", "categoria": "Estruturas complementares", "descricao": "Avaliacao dos septos interatrial e interventricular.", "placeholder": "Descreva integridade septal, movimento e eventuais defeitos.", "legacy_field": "camaras", "ordem": 110},
    {"key": "aorta", "label": "Aorta", "categoria": "Vasos", "descricao": "Avaliacao da raiz da aorta e comportamento do vaso.", "placeholder": "Descreva raiz aortica, dimensoes e observacoes relevantes da aorta.", "legacy_field": "vasos", "ordem": 120},
    {"key": "arteria_pulmonar", "label": "Arteria pulmonar", "categoria": "Vasos", "descricao": "Avaliacao da arteria pulmonar e sua relacao com a aorta.", "placeholder": "Descreva arteria pulmonar, relacao AP/Ao e observacoes do fluxo.", "legacy_field": "vasos", "ordem": 130},
    {"key": "pericardio", "label": "Pericardio", "categoria": "Estruturas complementares", "descricao": "Avaliacao do saco pericardico e espaco pericardico.", "placeholder": "Descreva espessamento, derrame ou ausencia de alteracoes pericardicas.", "legacy_field": "pericardio", "ordem": 140},
    {"key": "conclusao", "label": "Conclusao", "categoria": "Conclusao", "descricao": "Sintese final do ecocardiograma.", "placeholder": "Escreva a sintese final do exame com os principais achados.", "legacy_field": "conclusao", "ordem": 150},
]

DEFAULT_SAMPLE_PHRASES = {
    "valva_mitral": [
        {"titulo": "Aspecto habitual", "texto": "Valva mitral com morfologia preservada, sem sinais ecocardiograficos relevantes de degeneracao, estenose ou refluxo significativo.", "tags": ["normal", "base"]},
        {"titulo": "Espessada com regurgitacao leve", "texto": "Valva mitral discretamente espessada, com refluxo mitral de baixa intensidade, sem sinais de repercussao hemodinamica importante no momento.", "tags": ["endocardiose", "b1", "leve"]},
    ],
    "valva_aortica": [
        {"titulo": "Aspecto habitual", "texto": "Valva aortica com morfologia e mobilidade preservadas, sem evidencias de refluxo ou estenose significativa.", "tags": ["normal", "base"]},
    ],
    "valva_tricuspide": [
        {"titulo": "Aspecto habitual", "texto": "Valva tricuspide com morfologia preservada, sem alteracoes ecocardiograficas relevantes e sem refluxo expressivo.", "tags": ["normal", "base"]},
    ],
    "valva_pulmonar": [
        {"titulo": "Aspecto habitual", "texto": "Valva pulmonar com aspecto ecocardiografico preservado, sem estenose ou refluxo significativo.", "tags": ["normal", "base"]},
    ],
    "atrio_esquerdo": [
        {"titulo": "Sem aumento atrial", "texto": "Atrio esquerdo com dimensoes preservadas, sem evidencias de aumento atrial no exame atual.", "tags": ["normal"]},
        {"titulo": "Remodelamento discreto", "texto": "Atrio esquerdo com discreto remodelamento, sem aumento importante das dimensoes cavitarias.", "tags": ["endocardiose", "b1", "leve"]},
    ],
    "ventriculo_esquerdo": [
        {"titulo": "Geometria preservada", "texto": "Ventriculo esquerdo com dimensoes e espessuras preservadas, sem sinais de remodelamento concentrico ou excentrico.", "tags": ["normal"]},
    ],
    "funcao_sistolica_ve": [
        {"titulo": "Funcao sistolica preservada", "texto": "Funcao sistolica global do ventriculo esquerdo preservada, sem evidencias de reducao da contratilidade.", "tags": ["normal"]},
    ],
    "atrio_direito": [
        {"titulo": "Sem alteracoes relevantes", "texto": "Atrio direito sem alteracoes ecocardiograficas relevantes no exame atual.", "tags": ["normal", "base"]},
    ],
    "ventriculo_direito": [
        {"titulo": "Sem alteracoes relevantes", "texto": "Ventriculo direito com dimensoes e funcao preservadas, sem sinais de sobrecarga significativa.", "tags": ["normal", "base"]},
    ],
    "aorta": [
        {"titulo": "Raiz aortica preservada", "texto": "Raiz aortica com dimensoes preservadas e sem alteracoes ecocardiograficas relevantes.", "tags": ["normal", "base"]},
    ],
    "arteria_pulmonar": [
        {"titulo": "Calibre preservado", "texto": "Arteria pulmonar com calibre preservado, sem sinais sugestivos de alteracao hemodinamica relevante.", "tags": ["normal", "base"]},
    ],
    "pericardio": [
        {"titulo": "Sem derrame", "texto": "Pericardio sem alteracoes ecocardiograficas relevantes e sem derrame pericardico detectavel.", "tags": ["normal"]},
    ],
    "conclusao": [
        {"titulo": "Conclusao normal", "texto": "Ecocardiograma sem alteracoes estruturais ou funcionais relevantes no momento.", "tags": ["normal", "conclusao"]},
        {"titulo": "Conclusao endocardiose B1", "texto": "Achados compativeis com endocardiose mitral em classificacao B1, sem sinais ecocardiograficos de repercussao cardiaca importante no exame atual.", "tags": ["endocardiose", "b1", "conclusao"]},
    ],
}

DEFAULT_SAMPLE_PRESETS = [
    {
        "key": "normal_base",
        "label": "Normal base",
        "patologia": "Normal",
        "grau": "Normal",
        "descricao": "Preset basal para exame sem alteracoes estruturais relevantes.",
        "tags": ["normal", "base"],
        "ordem": 10,
        "selecoes": [
            {"aspecto": "valva_mitral", "frase_titulo": "Aspecto habitual"},
            {"aspecto": "valva_aortica", "frase_titulo": "Aspecto habitual"},
            {"aspecto": "valva_tricuspide", "frase_titulo": "Aspecto habitual"},
            {"aspecto": "valva_pulmonar", "frase_titulo": "Aspecto habitual"},
            {"aspecto": "atrio_esquerdo", "frase_titulo": "Sem aumento atrial"},
            {"aspecto": "ventriculo_esquerdo", "frase_titulo": "Geometria preservada"},
            {"aspecto": "funcao_sistolica_ve", "frase_titulo": "Funcao sistolica preservada"},
            {"aspecto": "atrio_direito", "frase_titulo": "Sem alteracoes relevantes"},
            {"aspecto": "ventriculo_direito", "frase_titulo": "Sem alteracoes relevantes"},
            {"aspecto": "aorta", "frase_titulo": "Raiz aortica preservada"},
            {"aspecto": "arteria_pulmonar", "frase_titulo": "Calibre preservado"},
            {"aspecto": "pericardio", "frase_titulo": "Sem derrame"},
            {"aspecto": "conclusao", "frase_titulo": "Conclusao normal"},
        ],
    },
    {
        "key": "endocardiose_mitral_b1",
        "label": "Endocardiose mitral B1",
        "patologia": "Endocardiose Mitral",
        "grau": "B1",
        "descricao": "Exemplo de preset com combinacao tipica de achados leves e sem repercussao marcante.",
        "tags": ["endocardiose", "b1", "teste"],
        "ordem": 20,
        "selecoes": [
            {"aspecto": "valva_mitral", "frase_titulo": "Espessada com regurgitacao leve"},
            {"aspecto": "valva_aortica", "frase_titulo": "Aspecto habitual"},
            {"aspecto": "valva_tricuspide", "frase_titulo": "Aspecto habitual"},
            {"aspecto": "valva_pulmonar", "frase_titulo": "Aspecto habitual"},
            {"aspecto": "atrio_esquerdo", "frase_titulo": "Remodelamento discreto"},
            {"aspecto": "ventriculo_esquerdo", "frase_titulo": "Geometria preservada"},
            {"aspecto": "funcao_sistolica_ve", "frase_titulo": "Funcao sistolica preservada"},
            {"aspecto": "atrio_direito", "frase_titulo": "Sem alteracoes relevantes"},
            {"aspecto": "ventriculo_direito", "frase_titulo": "Sem alteracoes relevantes"},
            {"aspecto": "pericardio", "frase_titulo": "Sem derrame"},
            {"aspecto": "conclusao", "frase_titulo": "Conclusao endocardiose B1"},
        ],
    },
]


def _now_iso() -> str:
    return datetime.now().isoformat()


def _slugify(value: str) -> str:
    return "".join(ch.lower() if ch.isalnum() else "_" for ch in value).strip("_")


def _build_default_store() -> Dict[str, Any]:
    next_phrase_id = 1
    aspectos: List[Dict[str, Any]] = []
    for aspecto in DEFAULT_ASPECTS:
        frases = []
        for frase in DEFAULT_SAMPLE_PHRASES.get(aspecto["key"], []):
            frases.append(
                {
                    "id": next_phrase_id,
                    "titulo": str(frase.get("titulo") or "").strip(),
                    "texto": str(frase.get("texto") or "").strip(),
                    "tags": list(frase.get("tags") or []),
                    "ativo": 1,
                }
            )
            next_phrase_id += 1

        aspecto_item = dict(aspecto)
        aspecto_item["frases"] = frases
        aspectos.append(aspecto_item)

    presets = []
    for index, preset in enumerate(DEFAULT_SAMPLE_PRESETS, start=1):
        preset_item = deepcopy(preset)
        preset_item["id"] = index
        preset_item["ativo"] = 1
        presets.append(preset_item)

    return {
        "version": "1.0",
        "mode": "teste",
        "last_updated": _now_iso(),
        "aspectos": aspectos,
        "presets": presets,
    }


def _ensure_store_file() -> None:
    if FRASES_FILE.exists():
        return
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    FRASES_FILE.write_text(
        json.dumps(_build_default_store(), ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def _load_store() -> Dict[str, Any]:
    _ensure_store_file()
    return json.loads(FRASES_FILE.read_text(encoding="utf-8"))


def _save_store(store: Dict[str, Any]) -> Dict[str, Any]:
    store["last_updated"] = _now_iso()
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    FRASES_FILE.write_text(json.dumps(store, ensure_ascii=False, indent=2), encoding="utf-8")
    return store


def _normalize_store(store: Dict[str, Any]) -> Dict[str, Any]:
    normalized = _build_default_store()
    normalized.update(
        {
            "version": str(store.get("version") or normalized["version"]),
            "mode": str(store.get("mode") or normalized["mode"]),
            "last_updated": str(store.get("last_updated") or normalized["last_updated"]),
        }
    )

    next_phrase_id = 1
    aspectos_payload: List[Dict[str, Any]] = []
    aspect_index = {str(item.get("key") or ""): item for item in store.get("aspectos") or []}
    for default_aspect in DEFAULT_ASPECTS:
        incoming = aspect_index.get(default_aspect["key"], {})
        frases_in = incoming.get("frases") or []
        frases_out = []
        for frase in frases_in:
            titulo = str(frase.get("titulo") or "").strip()
            texto = str(frase.get("texto") or "").strip()
            if not titulo or not texto:
                continue
            frase_id = frase.get("id")
            if not isinstance(frase_id, int):
                frase_id = next_phrase_id
            next_phrase_id = max(next_phrase_id, frase_id + 1)
            frases_out.append(
                {
                    "id": frase_id,
                    "titulo": titulo,
                    "texto": texto,
                    "tags": list(frase.get("tags") or []),
                    "ativo": 1 if int(frase.get("ativo", 1)) else 0,
                }
            )
        aspecto_out = dict(default_aspect)
        aspecto_out["frases"] = frases_out
        aspectos_payload.append(aspecto_out)

    presets_out = []
    next_preset_id = 1
    for preset in store.get("presets") or []:
        label = str(preset.get("label") or "").strip()
        if not label:
            continue
        preset_id = preset.get("id")
        if not isinstance(preset_id, int):
            preset_id = next_preset_id
        next_preset_id = max(next_preset_id, preset_id + 1)
        selecoes = []
        for selecao in preset.get("selecoes") or []:
            aspecto = str(selecao.get("aspecto") or "").strip()
            frase_titulo = str(selecao.get("frase_titulo") or "").strip()
            frase_id = selecao.get("frase_id")
            if not aspecto or (not frase_titulo and frase_id in (None, "")):
                continue
            selecoes.append(
                {
                    "aspecto": aspecto,
                    "frase_titulo": frase_titulo,
                    "frase_id": frase_id,
                }
            )
        presets_out.append(
            {
                "id": preset_id,
                "key": str(preset.get("key") or _slugify(label)).strip(),
                "label": label,
                "patologia": str(preset.get("patologia") or "").strip(),
                "grau": str(preset.get("grau") or "").strip(),
                "descricao": str(preset.get("descricao") or "").strip(),
                "tags": list(preset.get("tags") or []),
                "ordem": int(preset.get("ordem") or (next_preset_id * 10)),
                "ativo": 1 if int(preset.get("ativo", 1)) else 0,
                "selecoes": selecoes,
            }
        )

    normalized["aspectos"] = aspectos_payload
    normalized["presets"] = presets_out
    return normalized


def get_payload() -> Dict[str, Any]:
    store = _normalize_store(_load_store())
    _save_store(store)
    return store


def summarize_store(store: Dict[str, Any]) -> Dict[str, int]:
    aspectos = list(store.get("aspectos") or [])
    presets = list(store.get("presets") or [])
    frases_count = sum(len((aspecto.get("frases") or [])) for aspecto in aspectos)
    return {
        "aspectos_count": len(aspectos),
        "frases_count": frases_count,
        "presets_count": len(presets),
    }


def normalize_external_store(data: Dict[str, Any]) -> Dict[str, Any]:
    return _normalize_store(data)


def import_store(data: Dict[str, Any]) -> Dict[str, Any]:
    normalized = normalize_external_store(data)
    _save_store(normalized)
    return normalized


def _find_aspect(payload: Dict[str, Any], aspecto_key: str) -> Optional[Dict[str, Any]]:
    return next((item for item in payload.get("aspectos") or [] if item.get("key") == aspecto_key), None)


def _find_phrase(
    payload: Dict[str, Any],
    aspecto_key: str,
    frase_id: Any = None,
    frase_titulo: str = "",
) -> Optional[Dict[str, Any]]:
    aspecto = _find_aspect(payload, aspecto_key)
    if not aspecto:
        return None
    frases = aspecto.get("frases") or []
    if frase_id not in (None, ""):
        frase = next((item for item in frases if item.get("id") == int(frase_id)), None)
        if frase:
            return frase
    titulo = str(frase_titulo or "").strip()
    if titulo:
        return next((item for item in frases if str(item.get("titulo") or "").strip() == titulo), None)
    return None


def apply_preset(preset_id: int) -> Dict[str, Any]:
    payload = get_payload()
    preset = next((item for item in payload.get("presets") or [] if item.get("id") == preset_id), None)
    if not preset:
        raise KeyError("Preset nao encontrado.")

    textos: Dict[str, str] = {}
    selecoes_resolvidas: List[Dict[str, Any]] = []
    for selecao in preset.get("selecoes") or []:
        aspecto = str(selecao.get("aspecto") or "").strip()
        frase = _find_phrase(payload, aspecto, selecao.get("frase_id"), str(selecao.get("frase_titulo") or ""))
        if not aspecto or not frase:
            continue
        textos[aspecto] = str(frase.get("texto") or "").strip()
        selecoes_resolvidas.append(
            {
                "aspecto": aspecto,
                "frase_id": frase.get("id"),
                "frase_titulo": frase.get("titulo"),
            }
        )

    return {"preset": preset, "textos": textos, "selecoes_resolvidas": selecoes_resolvidas}


def save_preset(data: Dict[str, Any], preset_id: Optional[int] = None) -> Dict[str, Any]:
    payload = get_payload()
    presets = payload.get("presets") or []
    selecoes = []
    for selecao in data.get("selecoes") or []:
        aspecto = str(selecao.get("aspecto") or "").strip()
        frase = _find_phrase(payload, aspecto, selecao.get("frase_id"), str(selecao.get("frase_titulo") or ""))
        if not aspecto or not frase:
            continue
        selecoes.append(
            {
                "aspecto": aspecto,
                "frase_id": frase.get("id"),
                "frase_titulo": frase.get("titulo"),
            }
        )
    if not selecoes:
        raise ValueError("Selecione pelo menos uma frase para o preset.")

    target = next((item for item in presets if item.get("id") == preset_id), None) if preset_id else None
    if target is None:
        target = {"id": max([int(item.get("id") or 0) for item in presets] + [0]) + 1}
        presets.append(target)

    target.update(
        {
            "key": str(data.get("key") or _slugify(str(data.get("label") or ""))).strip(),
            "label": str(data.get("label") or "").strip(),
            "patologia": str(data.get("patologia") or "").strip(),
            "grau": str(data.get("grau") or "").strip(),
            "descricao": str(data.get("descricao") or "").strip(),
            "tags": list(data.get("tags") or []),
            "ordem": int(data.get("ordem") or ((target["id"]) * 10)),
            "ativo": 1,
            "selecoes": selecoes,
        }
    )
    payload["presets"] = presets
    _save_store(payload)
    return target


def delete_preset(preset_id: int) -> None:
    payload = get_payload()
    payload["presets"] = [item for item in payload.get("presets") or [] if item.get("id") != preset_id]
    _save_store(payload)


def update_phrase(frase_id: int, data: Dict[str, Any]) -> Dict[str, Any]:
    payload = get_payload()
    aspecto_key = str(data.get("aspecto") or "").strip()
    aspecto = _find_aspect(payload, aspecto_key)
    if not aspecto:
        raise KeyError("Aspecto nao encontrado.")
    frase = next((item for item in aspecto.get("frases") or [] if item.get("id") == frase_id), None)
    if not frase:
        raise KeyError("Frase nao encontrada.")

    titulo = str(data.get("titulo") or frase.get("titulo") or "").strip()
    texto = str(data.get("texto") or frase.get("texto") or "").strip()
    if not titulo or not texto:
        raise ValueError("Titulo e texto da frase sao obrigatorios.")

    frase.update(
        {
            "titulo": titulo,
            "texto": texto,
            "tags": list(data.get("tags") or frase.get("tags") or []),
            "ativo": 1,
        }
    )
    _save_store(payload)
    return frase
