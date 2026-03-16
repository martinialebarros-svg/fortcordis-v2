from typing import Any, Dict

from fastapi import APIRouter, HTTPException

from app.services import frases_ecocardiograma_estruturado_teste_service as service

router = APIRouter()


@router.get("")
def listar_payload() -> Dict[str, Any]:
    return service.get_payload()


@router.post("/presets/{preset_id}/aplicar")
def aplicar_preset(preset_id: int) -> Dict[str, Any]:
    try:
        return service.apply_preset(preset_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/presets")
def criar_preset(data: Dict[str, Any]) -> Dict[str, Any]:
    try:
        return service.save_preset(data)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.put("/presets/{preset_id}")
def atualizar_preset(preset_id: int, data: Dict[str, Any]) -> Dict[str, Any]:
    try:
        return service.save_preset(data, preset_id=preset_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.delete("/presets/{preset_id}")
def excluir_preset(preset_id: int) -> Dict[str, Any]:
    service.delete_preset(preset_id)
    return {"ok": True}


@router.post("/frases")
def criar_frase(data: Dict[str, Any]) -> Dict[str, Any]:
    try:
        return service.create_phrase(data)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.put("/frases/{frase_id}")
def atualizar_frase(frase_id: int, data: Dict[str, Any]) -> Dict[str, Any]:
    try:
        return service.update_phrase(frase_id, data)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
