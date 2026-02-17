from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime

from app.db.database import get_db
from app.models.laudo import Laudo, Exame
from app.models.user import User
from app.core.security import get_current_user

router = APIRouter()

@router.get("/laudos")
def listar_laudos(
    paciente_id: Optional[int] = None,
    tipo: Optional[str] = None,
    status: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Lista laudos com filtros"""
    query = db.query(Laudo)
    
    if paciente_id:
        query = query.filter(Laudo.paciente_id == paciente_id)
    if tipo:
        query = query.filter(Laudo.tipo == tipo)
    if status:
        query = query.filter(Laudo.status == status)
    
    total = query.count()
    items = query.offset(skip).limit(limit).all()
    
    return {"total": total, "items": items}

@router.post("/laudos", status_code=status.HTTP_201_CREATED)
def criar_laudo(
    laudo_data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Cria novo laudo"""
    laudo = Laudo(
        paciente_id=laudo_data.get("paciente_id"),
        agendamento_id=laudo_data.get("agendamento_id"),
        veterinario_id=current_user.id,
        tipo=laudo_data.get("tipo", "exame"),
        titulo=laudo_data.get("titulo"),
        descricao=laudo_data.get("descricao"),
        diagnostico=laudo_data.get("diagnostico"),
        observacoes=laudo_data.get("observacoes"),
        anexos=laudo_data.get("anexos"),
        status=laudo_data.get("status", "Rascunho"),
        criado_por_id=current_user.id,
        criado_por_nome=current_user.nome
    )
    
    db.add(laudo)
    db.commit()
    db.refresh(laudo)
    
    return laudo

@router.get("/laudos/{laudo_id}")
def obter_laudo(
    laudo_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Obtém um laudo específico"""
    laudo = db.query(Laudo).filter(Laudo.id == laudo_id).first()
    if not laudo:
        raise HTTPException(status_code=404, detail="Laudo não encontrado")
    return laudo

@router.put("/laudos/{laudo_id}")
def atualizar_laudo(
    laudo_id: int,
    laudo_data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Atualiza um laudo"""
    laudo = db.query(Laudo).filter(Laudo.id == laudo_id).first()
    if not laudo:
        raise HTTPException(status_code=404, detail="Laudo não encontrado")
    
    for field, value in laudo_data.items():
        if hasattr(laudo, field):
            setattr(laudo, field, value)
    
    laudo.updated_at = datetime.now()
    db.commit()
    db.refresh(laudo)
    return laudo

# Exames
@router.get("/exames")
def listar_exames(
    paciente_id: Optional[int] = None,
    tipo_exame: Optional[str] = None,
    status: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Lista exames com filtros"""
    query = db.query(Exame)
    
    if paciente_id:
        query = query.filter(Exame.paciente_id == paciente_id)
    if tipo_exame:
        query = query.filter(Exame.tipo_exame == tipo_exame)
    if status:
        query = query.filter(Exame.status == status)
    
    total = query.count()
    items = query.offset(skip).limit(limit).all()
    
    return {"total": total, "items": items}

@router.post("/exames", status_code=status.HTTP_201_CREATED)
def criar_exame(
    exame_data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Cria novo exame"""
    exame = Exame(
        laudo_id=exame_data.get("laudo_id"),
        paciente_id=exame_data.get("paciente_id"),
        tipo_exame=exame_data.get("tipo_exame"),
        resultado=exame_data.get("resultado"),
        valor_referencia=exame_data.get("valor_referencia"),
        unidade=exame_data.get("unidade"),
        status=exame_data.get("status", "Solicitado"),
        valor=exame_data.get("valor", 0),
        observacoes=exame_data.get("observacoes"),
        criado_por_id=current_user.id,
        criado_por_nome=current_user.nome
    )
    
    db.add(exame)
    db.commit()
    db.refresh(exame)
    
    return exame

@router.patch("/exames/{exame_id}/resultado")
def atualizar_resultado_exame(
    exame_id: int,
    resultado_data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Atualiza resultado de um exame"""
    exame = db.query(Exame).filter(Exame.id == exame_id).first()
    if not exame:
        raise HTTPException(status_code=404, detail="Exame não encontrado")
    
    exame.resultado = resultado_data.get("resultado")
    exame.valor_referencia = resultado_data.get("valor_referencia")
    exame.unidade = resultado_data.get("unidade")
    exame.status = "Concluido"
    exame.data_resultado = datetime.now()
    
    db.commit()
    db.refresh(exame)
    return exame
