from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel

from app.db.database import get_db
from app.models.clinica import Clinica
from app.core.security import get_current_user
from app.models.user import User

router = APIRouter()

# Schema
class ClinicaCreate(BaseModel):
    nome: str
    cnpj: Optional[str] = ""
    telefone: Optional[str] = ""
    email: Optional[str] = ""
    endereco: Optional[str] = ""

class ClinicaResponse(BaseModel):
    id: int
    nome: str
    cnpj: Optional[str] = None
    telefone: Optional[str] = None

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


@router.post("", response_model=ClinicaResponse, status_code=status.HTTP_201_CREATED)
def criar_clinica(
    clinica: ClinicaCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Cria uma nova clinica"""
    # Verificar se ja existe clinica com mesmo nome
    existing = db.query(Clinica).filter(
        Clinica.nome.ilike(clinica.nome)
    ).first()
    
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"Ja existe uma clinica com o nome '{clinica.nome}'"
        )
    
    db_clinica = Clinica(
        nome=clinica.nome,
        cnpj=clinica.cnpj,
        telefone=clinica.telefone,
        email=clinica.email,
        endereco=clinica.endereco,

        ativo=1
    )
    
    db.add(db_clinica)
    db.commit()
    db.refresh(db_clinica)
    
    return {
        "id": db_clinica.id,
        "nome": db_clinica.nome,
        "cnpj": db_clinica.cnpj,
        "telefone": db_clinica.telefone
    }


@router.get("/{clinica_id}")
def obter_clinica(
    clinica_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Obtem detalhes de uma clinica"""
    clinica = db.query(Clinica).filter(Clinica.id == clinica_id).first()
    
    if not clinica:
        raise HTTPException(status_code=404, detail="Clinica nao encontrada")
    
    return {
        "id": clinica.id,
        "nome": clinica.nome,
        "cnpj": clinica.cnpj,
        "telefone": clinica.telefone,
        "email": clinica.email,
        "endereco": clinica.endereco,

    }


@router.put("/{clinica_id}")
def atualizar_clinica(
    clinica_id: int,
    clinica: ClinicaCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Atualiza uma clinica existente"""
    db_clinica = db.query(Clinica).filter(Clinica.id == clinica_id).first()
    
    if not db_clinica:
        raise HTTPException(status_code=404, detail="Clinica nao encontrada")
    
    db_clinica.nome = clinica.nome
    db_clinica.cnpj = clinica.cnpj
    db_clinica.telefone = clinica.telefone
    db_clinica.email = clinica.email
    db_clinica.endereco = clinica.endereco

    
    db.commit()
    db.refresh(db_clinica)
    
    return {
        "id": db_clinica.id,
        "nome": db_clinica.nome,
        "message": "Clinica atualizada com sucesso"
    }


@router.delete("/{clinica_id}")
def deletar_clinica(
    clinica_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Remove uma clinica"""
    db_clinica = db.query(Clinica).filter(Clinica.id == clinica_id).first()
    
    if not db_clinica:
        raise HTTPException(status_code=404, detail="Clinica nao encontrada")
    
    db.delete(db_clinica)
    db.commit()
    
    return {"message": "Clinica removida com sucesso"}
