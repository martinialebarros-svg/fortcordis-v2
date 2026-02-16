from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List
from app.db.database import get_db
from app.models.servico import Servico
from app.core.security import get_current_user
from app.models.user import User

router = APIRouter()

@router.get("")
def listar_servicos(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Lista servicos"""
    query = db.query(
        Servico.id,
        Servico.nome
    )
    
    total = query.count()
    items = query.offset(skip).limit(limit).all()
    
    servicos = [{"id": s.id, "nome": s.nome} for s in items]
    
    return {"total": total, "items": servicos}
