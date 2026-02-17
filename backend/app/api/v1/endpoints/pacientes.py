from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import Optional
from app.db.database import get_db
from app.models.paciente import Paciente
from app.models.tutor import Tutor
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
    """Lista pacientes com nome do tutor"""
    query = db.query(
        Paciente.id,
        Paciente.nome,
        Paciente.tutor_id,
        Tutor.nome.label('tutor_nome')
    ).outerjoin(Tutor, Paciente.tutor_id == Tutor.id)
    
    if search:
        query = query.filter(Paciente.nome.ilike(f"%{search}%"))
    
    total = query.count()
    items = query.offset(skip).limit(limit).all()
    
    pacientes = [{"id": p.id, "nome": p.nome, "tutor_id": p.tutor_id, "tutor": p.tutor_nome or ""} for p in items]
    
    return {"total": total, "items": pacientes}
