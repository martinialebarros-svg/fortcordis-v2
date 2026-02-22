from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import Optional
from pydantic import BaseModel
import re
import unicodedata

from app.db.database import get_db
from app.models.tutor import Tutor
from app.core.security import get_current_user
from app.models.user import User

router = APIRouter()


def _gerar_nome_key(nome: Optional[str]) -> str:
    """Gera chave normalizada para compatibilidade com schema legado."""
    if not nome:
        return ""
    texto = unicodedata.normalize("NFKD", nome)
    texto = "".join(c for c in texto if not unicodedata.combining(c))
    texto = texto.lower().strip()
    texto = re.sub(r"[^a-z0-9\s]", "", texto)
    texto = re.sub(r"\s+", " ", texto)
    return texto


class TutorCreate(BaseModel):
    nome: str
    telefone: Optional[str] = None
    whatsapp: Optional[str] = None
    email: Optional[str] = None


class TutorUpdate(BaseModel):
    nome: Optional[str] = None
    telefone: Optional[str] = None
    whatsapp: Optional[str] = None
    email: Optional[str] = None


@router.get("")
@router.get("/")
def listar_tutores(
    skip: int = 0,
    limit: int = 100,
    busca: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Lista todos os tutores"""
    query = db.query(Tutor).filter(Tutor.ativo == 1)
    
    if busca:
        query = query.filter(Tutor.nome.ilike(f"%{busca}%"))
    
    total = query.count()
    items = query.offset(skip).limit(limit).all()
    
    return {
        "total": total,
        "items": [{"id": t.id, "nome": t.nome, "telefone": t.telefone} for t in items]
    }


@router.post("", status_code=status.HTTP_201_CREATED)
@router.post("/", status_code=status.HTTP_201_CREATED)
def criar_tutor(
    tutor: TutorCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Cria um novo tutor"""
    # Verificar se já existe tutor com mesmo nome
    existente = db.query(Tutor).filter(Tutor.nome.ilike(tutor.nome)).first()
    if existente:
        return {
            "id": existente.id,
            "nome": existente.nome,
            "message": "Tutor já existe"
        }
    
    novo_tutor = Tutor(
        nome=tutor.nome,
        nome_key=_gerar_nome_key(tutor.nome),
        telefone=tutor.telefone,
        whatsapp=tutor.whatsapp or tutor.telefone,
        email=tutor.email,
        ativo=1
    )
    
    db.add(novo_tutor)
    db.commit()
    db.refresh(novo_tutor)
    
    return {
        "id": novo_tutor.id,
        "nome": novo_tutor.nome,
        "message": "Tutor criado com sucesso"
    }


@router.get("/{tutor_id}")
def obter_tutor(
    tutor_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Obtém detalhes de um tutor"""
    tutor = db.query(Tutor).filter(Tutor.id == tutor_id).first()
    
    if not tutor:
        raise HTTPException(status_code=404, detail="Tutor não encontrado")
    
    return {
        "id": tutor.id,
        "nome": tutor.nome,
        "telefone": tutor.telefone,
        "whatsapp": tutor.whatsapp,
        "email": tutor.email
    }


@router.put("/{tutor_id}")
def atualizar_tutor(
    tutor_id: int,
    tutor: TutorUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Atualiza um tutor existente"""
    db_tutor = db.query(Tutor).filter(Tutor.id == tutor_id).first()
    
    if not db_tutor:
        raise HTTPException(status_code=404, detail="Tutor não encontrado")
    
    if tutor.nome is not None:
        db_tutor.nome = tutor.nome
        db_tutor.nome_key = _gerar_nome_key(tutor.nome)
    if tutor.telefone is not None:
        db_tutor.telefone = tutor.telefone
    if tutor.whatsapp is not None:
        db_tutor.whatsapp = tutor.whatsapp
    if tutor.email is not None:
        db_tutor.email = tutor.email
    
    db.commit()
    db.refresh(db_tutor)
    
    return {
        "id": db_tutor.id,
        "nome": db_tutor.nome,
        "message": "Tutor atualizado com sucesso"
    }


@router.delete("/{tutor_id}")
def deletar_tutor(
    tutor_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Remove um tutor (desativa)"""
    db_tutor = db.query(Tutor).filter(Tutor.id == tutor_id).first()
    
    if not db_tutor:
        raise HTTPException(status_code=404, detail="Tutor não encontrado")
    
    db_tutor.ativo = 0
    db.commit()
    
    return {"message": "Tutor removido com sucesso"}
