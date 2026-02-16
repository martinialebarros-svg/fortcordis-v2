from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from app.db.database import get_db
from app.models.user import User
from app.core.security import get_current_user, require_papel

router = APIRouter()

@router.get("/dashboard")
def admin_dashboard(current_user: User = Depends(require_papel("admin"))):
    """Só admin pode acessar"""
    return {
        "message": "Bem-vindo ao painel de admin",
        "user": current_user.nome,
        "papeis": [p.nome for p in current_user.papeis]
    }

@router.get("/usuarios")
def listar_usuarios(
    current_user: User = Depends(require_papel("admin")),
    db: Session = Depends(get_db)
):
    """Lista todos os usuários - só admin"""
    usuarios = db.query(User).all()
    return [{
        "id": u.id,
        "nome": u.nome,
        "email": u.email,
        "ativo": u.ativo,
        "papeis": [p.nome for p in u.papeis]
    } for u in usuarios]
