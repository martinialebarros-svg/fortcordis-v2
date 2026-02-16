from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import Optional
from app.db.database import get_db
from app.models.paciente import Paciente
from app.core.security import get_current_user
from app.models.user import User

router = APIRouter()

@router.get("")
def listar_pacientes(
    skip: int = 0,
    limit: int = 100,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Lista pacientes"""
    query = db.query(Paciente.id, Paciente.nome)
    
    if search:
        query = query.filter(Paciente.nome.ilike(f"%{search}%"))
    
    total = query.count()
    items = query.offset(skip).limit(limit).all()
    
    # Retornar sem tutor (ou com tutor vazio)
    pacientes = [{"id": p.id, "nome": p.nome, "tutor": ""} for p in items]
    
    return {"total": total, "items": pacientes}
