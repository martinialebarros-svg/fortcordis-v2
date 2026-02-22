"""Endpoints para gerenciamento de frases qualitativas via JSON"""
from typing import Any, List, Optional
from fastapi import APIRouter, HTTPException, status, Query

from app.services import frases_service
from app.schemas.frase import (
    FraseQualitativaCreate,
    FraseQualitativaUpdate,
    FraseQualitativaResponse,
    FraseQualitativaLista,
    FraseAplicarRequest,
)

router = APIRouter()


def _frase_to_response(frase: dict) -> dict:
    """Converte uma frase do dict para o formato de resposta."""
    if not frase:
        return None
    return {
        "id": frase.get("id"),
        "chave": frase.get("chave", ""),
        "patologia": frase.get("patologia", ""),
        "grau": frase.get("grau", ""),
        "valvas": frase.get("valvas", ""),
        "camaras": frase.get("camaras", ""),
        "funcao": frase.get("funcao", ""),
        "pericardio": frase.get("pericardio", ""),
        "vasos": frase.get("vasos", ""),
        "ad_vd": frase.get("ad_vd", ""),
        "conclusao": frase.get("conclusao", ""),
        "detalhado": frase.get("detalhado"),
        "layout": frase.get("layout", "detalhado"),
        "ativo": frase.get("ativo", 1),
        "created_at": frase.get("created_at"),
        "updated_at": frase.get("updated_at"),
        "created_by": frase.get("created_by"),
    }


@router.get("", response_model=FraseQualitativaLista)
def listar_frases(
    patologia: Optional[str] = None,
    grau: Optional[str] = None,
    busca: Optional[str] = None,
    ativo: Optional[int] = 1,
    skip: int = 0,
    limit: int = 100,
) -> Any:
    """Lista todas as frases qualitativas com filtros opcionais"""
    resultado = frases_service.listar_frases(
        patologia=patologia,
        grau=grau,
        busca=busca,
        ativo=ativo,
        skip=skip,
        limit=limit
    )
    
    items = [_frase_to_response(f) for f in resultado["items"]]
    return {"items": items, "total": resultado["total"]}


@router.get("/patologias", response_model=List[str])
def listar_patologias() -> Any:
    """Lista todas as patologias distintas cadastradas"""
    return frases_service.listar_patologias()


@router.get("/graus", response_model=List[str])
def listar_graus(
    patologia: Optional[str] = None,
) -> Any:
    """Lista todos os graus distintos, opcionalmente filtrados por patologia"""
    return frases_service.listar_graus_por_patologia(patologia)


@router.get("/buscar", response_model=Optional[FraseQualitativaResponse])
def buscar_frase(
    patologia: str,
    grau_refluxo: Optional[str] = None,
    grau_geral: Optional[str] = None,
) -> Any:
    """Busca uma frase específica por patologia e grau"""
    frase = frases_service.buscar_frase_por_patologia_grau(
        patologia, grau_refluxo, grau_geral
    )
    return _frase_to_response(frase)


@router.post("/aplicar", response_model=dict)
def aplicar_frase(
    request: FraseAplicarRequest,
) -> Any:
    """Retorna o conteúdo da frase para aplicar no laudo"""
    frase = frases_service.buscar_frase_por_patologia_grau(
        request.patologia,
        request.grau_refluxo,
        request.grau_geral
    )
    
    if not frase:
        return {
            "success": False,
            "message": f"Frase não encontrada para {request.patologia}",
            "dados": None
        }
    
    # Monta resposta baseada no layout
    if request.layout == "enxuto":
        dados = {
            "valvas": frase.get("valvas", ""),
            "camaras": frase.get("camaras", ""),
            "funcao": frase.get("funcao", ""),
            "pericardio": frase.get("pericardio", ""),
            "vasos": frase.get("vasos", ""),
            "ad_vd": frase.get("ad_vd", ""),
            "conclusao": frase.get("conclusao", ""),
        }
    else:
        # Layout detalhado
        dados = {
            "det": frase.get("detalhado", {}),
            "valvas": frase.get("valvas", ""),
            "camaras": frase.get("camaras", ""),
            "funcao": frase.get("funcao", ""),
            "pericardio": frase.get("pericardio", ""),
            "vasos": frase.get("vasos", ""),
            "ad_vd": frase.get("ad_vd", ""),
            "conclusao": frase.get("conclusao", ""),
        }
    
    return {
        "success": True,
        "message": "Frase aplicada com sucesso",
        "dados": dados,
        "frase": {
            "id": frase.get("id"),
            "chave": frase.get("chave"),
            "patologia": frase.get("patologia"),
            "grau": frase.get("grau"),
        }
    }


@router.get("/{frase_id}", response_model=FraseQualitativaResponse)
def obter_frase(
    frase_id: int,
) -> Any:
    """Obtém uma frase específica pelo ID"""
    frase = frases_service.obter_frase(frase_id)
    if not frase:
        raise HTTPException(status_code=404, detail="Frase não encontrada")
    return _frase_to_response(frase)


@router.post("", response_model=FraseQualitativaResponse, status_code=status.HTTP_201_CREATED)
def criar_frase(
    frase_in: FraseQualitativaCreate,
) -> Any:
    """Cria uma nova frase qualitativa"""
    try:
        frase_data = frase_in.model_dump()
        nova_frase = frases_service.criar_frase(frase_data)
        return _frase_to_response(nova_frase)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/{frase_id}", response_model=FraseQualitativaResponse)
def atualizar_frase(
    frase_id: int,
    frase_in: FraseQualitativaUpdate,
) -> Any:
    """Atualiza uma frase existente"""
    frase_data = frase_in.model_dump(exclude_unset=True)
    frase_atualizada = frases_service.atualizar_frase(frase_id, frase_data)
    
    if not frase_atualizada:
        raise HTTPException(status_code=404, detail="Frase não encontrada")
    
    return _frase_to_response(frase_atualizada)


@router.delete("/{frase_id}")
def deletar_frase(
    frase_id: int,
) -> Any:
    """Remove uma frase (soft delete - apenas marca como inativo)"""
    sucesso = frases_service.deletar_frase(frase_id)
    
    if not sucesso:
        raise HTTPException(status_code=404, detail="Frase não encontrada")
    
    return {"message": "Frase removida com sucesso"}


@router.post("/{frase_id}/restaurar")
def restaurar_frase(
    frase_id: int,
) -> Any:
    """Restaura uma frase removida"""
    sucesso = frases_service.restaurar_frase(frase_id)
    
    if not sucesso:
        raise HTTPException(status_code=404, detail="Frase não encontrada")
    
    return {"message": "Frase restaurada com sucesso"}
