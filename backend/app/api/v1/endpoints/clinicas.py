from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List
from app.db.database import get_db
from app.models.clinica import Clinica
from app.core.security import get_current_user
from app.models.user import User

router = APIRouter()

@router.get("")
def listar_clinicas(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Lista clinicas"""
    query = db.query(
        Clinica.id,
        Clinica.nome
    )
    
    total = query.count()
    items = query.offset(skip).limit(limit).all()
    
    clinicas = [{"id": c.id, "nome": c.nome} for c in items]
    
    return {"total": total, "items": clinicas}
