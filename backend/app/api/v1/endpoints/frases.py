"""Endpoints para gerenciamento de frases qualitativas."""
from __future__ import annotations

from typing import Any, List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.security import get_current_user
from app.db.database import get_db
from app.models.user import User
from app.schemas.frase import (
    FraseAplicarRequest,
    FraseQualitativaCreate,
    FraseQualitativaLista,
    FraseQualitativaResponse,
    FraseQualitativaUpdate,
)
from app.services import frases_service

router = APIRouter(dependencies=[Depends(get_current_user)])


def _frase_to_response(frase: dict | None) -> dict | None:
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
    db: Session = Depends(get_db),
) -> Any:
    resultado = frases_service.listar_frases(
        db=db,
        patologia=patologia,
        grau=grau,
        busca=busca,
        ativo=ativo,
        skip=skip,
        limit=limit,
    )
    return {
        "items": [_frase_to_response(frase) for frase in resultado["items"]],
        "total": resultado["total"],
    }


@router.get("/patologias", response_model=List[str])
def listar_patologias(
    db: Session = Depends(get_db),
) -> Any:
    return frases_service.listar_patologias(db)


@router.get("/graus", response_model=List[str])
def listar_graus(
    patologia: Optional[str] = None,
    db: Session = Depends(get_db),
) -> Any:
    return frases_service.listar_graus_por_patologia(db, patologia)


@router.get("/buscar", response_model=Optional[FraseQualitativaResponse])
def buscar_frase(
    patologia: str,
    grau_refluxo: Optional[str] = None,
    grau_geral: Optional[str] = None,
    db: Session = Depends(get_db),
) -> Any:
    frase = frases_service.buscar_frase_por_patologia_grau(
        db,
        patologia,
        grau_refluxo,
        grau_geral,
    )
    return _frase_to_response(frase)


@router.post("/aplicar", response_model=dict)
def aplicar_frase(
    request: FraseAplicarRequest,
    db: Session = Depends(get_db),
) -> Any:
    frase = frases_service.buscar_frase_por_patologia_grau(
        db,
        request.patologia,
        request.grau_refluxo,
        request.grau_geral,
    )

    if not frase:
        return {
            "success": False,
            "message": f"Frase nao encontrada para {request.patologia}",
            "dados": None,
        }

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
        },
    }


@router.get("/{frase_id}", response_model=FraseQualitativaResponse)
def obter_frase(
    frase_id: int,
    db: Session = Depends(get_db),
) -> Any:
    frase = frases_service.obter_frase(db, frase_id)
    if not frase:
        raise HTTPException(status_code=404, detail="Frase nao encontrada")
    return _frase_to_response(frase)


@router.post("", response_model=FraseQualitativaResponse, status_code=status.HTTP_201_CREATED)
def criar_frase(
    frase_in: FraseQualitativaCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    try:
        nova_frase = frases_service.criar_frase(
            db,
            frase_in.model_dump(),
            created_by=current_user.id,
        )
        return _frase_to_response(nova_frase)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.put("/{frase_id}", response_model=FraseQualitativaResponse)
def atualizar_frase(
    frase_id: int,
    frase_in: FraseQualitativaUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    try:
        frase_atualizada = frases_service.atualizar_frase(
            db,
            frase_id,
            frase_in.model_dump(exclude_unset=True),
            actor_id=current_user.id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    if not frase_atualizada:
        raise HTTPException(status_code=404, detail="Frase nao encontrada")
    return _frase_to_response(frase_atualizada)


@router.delete("/{frase_id}")
def deletar_frase(
    frase_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    sucesso = frases_service.deletar_frase(db, frase_id, actor_id=current_user.id)
    if not sucesso:
        raise HTTPException(status_code=404, detail="Frase nao encontrada")
    return {"message": "Frase removida com sucesso"}


@router.post("/{frase_id}/restaurar")
def restaurar_frase(
    frase_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    sucesso = frases_service.restaurar_frase(db, frase_id, actor_id=current_user.id)
    if not sucesso:
        raise HTTPException(status_code=404, detail="Frase nao encontrada")
    return {"message": "Frase restaurada com sucesso"}
