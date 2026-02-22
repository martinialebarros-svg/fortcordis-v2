"""Endpoints para gerenciamento de frases qualitativas"""
from typing import Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models.user import User
from app.models.frase import FraseQualitativa
from app.schemas.frase import (
    FraseQualitativaCreate,
    FraseQualitativaUpdate,
    FraseQualitativaResponse,
    FraseQualitativaLista,
    FraseAplicarRequest,
)
from app.core.security import get_current_user

router = APIRouter()


def montar_chave_frase(patologia: str, grau_refluxo: str = "", grau_geral: str = "") -> str:
    """Monta a chave única da frase baseada em patologia e grau"""
    if patologia == "Normal":
        return "Normal (Normal)"
    if patologia == "Endocardiose Mitral":
        return f"{patologia} ({grau_refluxo})"
    return f"{patologia} ({grau_geral})"


@router.get("", response_model=FraseQualitativaLista)
def listar_frases(
    patologia: Optional[str] = None,
    grau: Optional[str] = None,
    busca: Optional[str] = None,
    ativo: Optional[int] = 1,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    """Lista todas as frases qualitativas com filtros opcionais"""
    query = db.query(FraseQualitativa)
    
    if ativo is not None:
        query = query.filter(FraseQualitativa.ativo == ativo)
    
    if patologia:
        query = query.filter(FraseQualitativa.patologia.ilike(f"%{patologia}%"))
    
    if grau:
        query = query.filter(FraseQualitativa.grau.ilike(f"%{grau}%"))
    
    if busca:
        query = query.filter(
            FraseQualitativa.patologia.ilike(f"%{busca}%") |
            FraseQualitativa.chave.ilike(f"%{busca}%") |
            FraseQualitativa.conclusao.ilike(f"%{busca}%")
        )
    
    total = query.count()
    items = query.offset(skip).limit(limit).all()
    
    return {"items": items, "total": total}


@router.get("/patologias", response_model=List[str])
def listar_patologias(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    """Lista todas as patologias distintas cadastradas"""
    patologias = db.query(FraseQualitativa.patologia).distinct().filter(
        FraseQualitativa.ativo == 1
    ).all()
    return sorted([p[0] for p in patologias if p[0]])


@router.get("/graus", response_model=List[str])
def listar_graus(
    patologia: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    """Lista todos os graus distintos, opcionalmente filtrados por patologia"""
    query = db.query(FraseQualitativa.grau).distinct().filter(
        FraseQualitativa.ativo == 1
    )
    
    if patologia:
        query = query.filter(FraseQualitativa.patologia == patologia)
    
    graus = query.all()
    return sorted([g[0] for g in graus if g[0]])


@router.get("/buscar", response_model=Optional[FraseQualitativaResponse])
def buscar_frase(
    patologia: str,
    grau_refluxo: Optional[str] = None,
    grau_geral: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    """Busca uma frase específica por patologia e grau"""
    chave = montar_chave_frase(patologia, grau_refluxo or "", grau_geral or "")

    # Tenta buscar pela chave exata
    frase = db.query(FraseQualitativa).filter(
        FraseQualitativa.chave == chave,
        FraseQualitativa.ativo == 1
    ).first()

    # Tenta buscar pela chave armazenada (formato diferente)
    if not frase:
        frase = db.query(FraseQualitativa).filter(
            FraseQualitativa.chave == patologia,
            FraseQualitativa.ativo == 1
        ).first()

    # Tenta buscar por patologia + grau
    grau = grau_refluxo or grau_geral or ""
    if not frase and grau:
        frase = db.query(FraseQualitativa).filter(
            FraseQualitativa.patologia == patologia,
            FraseQualitativa.grau == grau,
            FraseQualitativa.ativo == 1
        ).first()

    # Último fallback: busca apenas pela patologia
    if not frase:
        frase = db.query(FraseQualitativa).filter(
            FraseQualitativa.patologia.ilike(f"%{patologia}%"),
            FraseQualitativa.ativo == 1
        ).first()

    return frase


@router.post("/aplicar", response_model=dict)
def aplicar_frase(
    request: FraseAplicarRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    """Retorna o conteúdo da frase para aplicar no laudo"""
    chave = montar_chave_frase(
        request.patologia,
        request.grau_refluxo or "",
        request.grau_geral or ""
    )
    
    # Busca a frase pela chave exata
    frase = db.query(FraseQualitativa).filter(
        FraseQualitativa.chave == chave,
        FraseQualitativa.ativo == 1
    ).first()

    # Se não encontrar, busca pela chave armazenada (pode ter formato diferente)
    if not frase:
        frase = db.query(FraseQualitativa).filter(
            FraseQualitativa.chave == request.patologia,
            FraseQualitativa.ativo == 1
        ).first()

    # Se não encontrar, busca por patologia + grau
    grau = request.grau_refluxo or request.grau_geral or ""
    if not frase and grau:
        frase = db.query(FraseQualitativa).filter(
            FraseQualitativa.patologia == request.patologia,
            FraseQualitativa.grau == grau,
            FraseQualitativa.ativo == 1
        ).first()

    # Último fallback: busca apenas pela patologia
    if not frase:
        frase = db.query(FraseQualitativa).filter(
            FraseQualitativa.patologia.ilike(f"%{request.patologia}%"),
            FraseQualitativa.ativo == 1
        ).first()
    
    if not frase:
        return {
            "success": False,
            "message": f"Frase não encontrada para {request.patologia}",
            "dados": None
        }
    
    # Monta resposta baseada no layout
    if request.layout == "enxuto":
        dados = {
            "valvas": frase.valvas,
            "camaras": frase.camaras,
            "funcao": frase.funcao,
            "pericardio": frase.pericardio,
            "vasos": frase.vasos,
            "ad_vd": frase.ad_vd,
            "conclusao": frase.conclusao,
        }
    else:
        # Layout detalhado
        dados = {
            "det": frase.detalhado or {},
            "valvas": frase.valvas,
            "camaras": frase.camaras,
            "funcao": frase.funcao,
            "pericardio": frase.pericardio,
            "vasos": frase.vasos,
            "ad_vd": frase.ad_vd,
            "conclusao": frase.conclusao,
        }
    
    return {
        "success": True,
        "message": "Frase aplicada com sucesso",
        "dados": dados,
        "frase": {
            "id": frase.id,
            "chave": frase.chave,
            "patologia": frase.patologia,
            "grau": frase.grau,
        }
    }


@router.get("/{frase_id}", response_model=FraseQualitativaResponse)
def obter_frase(
    frase_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    """Obtém uma frase específica pelo ID"""
    frase = db.query(FraseQualitativa).filter(FraseQualitativa.id == frase_id).first()
    if not frase:
        raise HTTPException(status_code=404, detail="Frase não encontrada")
    return frase


@router.post("", response_model=FraseQualitativaResponse, status_code=status.HTTP_201_CREATED)
def criar_frase(
    frase_in: FraseQualitativaCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    """Cria uma nova frase qualitativa"""
    # Verifica se já existe chave
    existing = db.query(FraseQualitativa).filter(
        FraseQualitativa.chave == frase_in.chave
    ).first()
    
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"Já existe uma frase com a chave '{frase_in.chave}'"
        )
    
    frase = FraseQualitativa(
        **frase_in.model_dump(),
        created_by=current_user.id
    )
    
    db.add(frase)
    db.commit()
    db.refresh(frase)
    
    return frase


@router.put("/{frase_id}", response_model=FraseQualitativaResponse)
def atualizar_frase(
    frase_id: int,
    frase_in: FraseQualitativaUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    """Atualiza uma frase existente"""
    frase = db.query(FraseQualitativa).filter(FraseQualitativa.id == frase_id).first()
    if not frase:
        raise HTTPException(status_code=404, detail="Frase não encontrada")
    
    update_data = frase_in.model_dump(exclude_unset=True)
    
    for field, value in update_data.items():
        setattr(frase, field, value)
    
    db.commit()
    db.refresh(frase)
    
    return frase


@router.delete("/{frase_id}")
def deletar_frase(
    frase_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    """Remove uma frase (soft delete - apenas marca como inativo)"""
    frase = db.query(FraseQualitativa).filter(FraseQualitativa.id == frase_id).first()
    if not frase:
        raise HTTPException(status_code=404, detail="Frase não encontrada")
    
    frase.ativo = 0
    db.commit()
    
    return {"message": "Frase removida com sucesso"}


@router.post("/{frase_id}/restaurar")
def restaurar_frase(
    frase_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    """Restaura uma frase removida"""
    frase = db.query(FraseQualitativa).filter(FraseQualitativa.id == frase_id).first()
    if not frase:
        raise HTTPException(status_code=404, detail="Frase não encontrada")
    
    frase.ativo = 1
    db.commit()
    
    return {"message": "Frase restaurada com sucesso"}
