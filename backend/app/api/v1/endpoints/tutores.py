from datetime import datetime
import re
import unicodedata
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.security import get_current_user
from app.db.database import get_db
from app.models.tutor import Tutor
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


def _legacy_now_dt() -> datetime:
    return datetime.utcnow()


class TutorCreate(BaseModel):
    nome: str
    telefone: Optional[str] = None
    whatsapp: Optional[str] = None
    email: Optional[str] = None
    cpf: Optional[str] = None
    cep: Optional[str] = None
    endereco: Optional[str] = None
    numero: Optional[str] = None
    complemento: Optional[str] = None
    bairro: Optional[str] = None
    cidade: Optional[str] = None
    estado: Optional[str] = None


class TutorUpdate(BaseModel):
    nome: Optional[str] = None
    telefone: Optional[str] = None
    whatsapp: Optional[str] = None
    email: Optional[str] = None
    cpf: Optional[str] = None
    cep: Optional[str] = None
    endereco: Optional[str] = None
    numero: Optional[str] = None
    complemento: Optional[str] = None
    bairro: Optional[str] = None
    cidade: Optional[str] = None
    estado: Optional[str] = None


@router.get("")
@router.get("/")
def listar_tutores(
    skip: int = 0,
    limit: int = 100,
    busca: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Lista todos os tutores."""
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
    """Cria um novo tutor."""
    nome = tutor.nome.strip()
    nome_key = _gerar_nome_key(nome)

    # Evita colisão no índice único de nome_key.
    existente = db.query(Tutor).filter(Tutor.nome_key == nome_key).first()
    if not existente:
        existente = db.query(Tutor).filter(Tutor.nome.ilike(nome)).first()

    if existente:
        return {
            "id": existente.id,
            "nome": existente.nome,
            "message": "Tutor já existe"
        }

    novo_tutor = Tutor(
        nome=nome,
        nome_key=nome_key,
        telefone=tutor.telefone,
        whatsapp=tutor.whatsapp or tutor.telefone,
        email=tutor.email,
        cpf=tutor.cpf,
        cep=tutor.cep,
        endereco=tutor.endereco,
        numero=tutor.numero,
        complemento=tutor.complemento,
        bairro=tutor.bairro,
        cidade=tutor.cidade,
        estado=tutor.estado,
        ativo=1,
        created_at=_legacy_now_dt(),
    )

    db.add(novo_tutor)
    try:
        db.commit()
        db.refresh(novo_tutor)
    except IntegrityError:
        db.rollback()
        existente = db.query(Tutor).filter(Tutor.nome_key == nome_key).first()
        if not existente:
            existente = db.query(Tutor).filter(Tutor.nome.ilike(nome)).first()
        if existente:
            return {
                "id": existente.id,
                "nome": existente.nome,
                "message": "Tutor já existe"
            }
        raise HTTPException(status_code=500, detail="Erro ao criar tutor")

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
    """Obtém detalhes de um tutor."""
    tutor = db.query(Tutor).filter(Tutor.id == tutor_id).first()

    if not tutor:
        raise HTTPException(status_code=404, detail="Tutor não encontrado")

    return {
        "id": tutor.id,
        "nome": tutor.nome,
        "telefone": tutor.telefone,
        "whatsapp": tutor.whatsapp,
        "email": tutor.email,
        "cpf": tutor.cpf,
        "cep": tutor.cep,
        "endereco": tutor.endereco,
        "numero": tutor.numero,
        "complemento": tutor.complemento,
        "bairro": tutor.bairro,
        "cidade": tutor.cidade,
        "estado": tutor.estado,
    }


@router.put("/{tutor_id}")
def atualizar_tutor(
    tutor_id: int,
    tutor: TutorUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Atualiza um tutor existente."""
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
    if tutor.cpf is not None:
        db_tutor.cpf = tutor.cpf
    if tutor.cep is not None:
        db_tutor.cep = tutor.cep
    if tutor.endereco is not None:
        db_tutor.endereco = tutor.endereco
    if tutor.numero is not None:
        db_tutor.numero = tutor.numero
    if tutor.complemento is not None:
        db_tutor.complemento = tutor.complemento
    if tutor.bairro is not None:
        db_tutor.bairro = tutor.bairro
    if tutor.cidade is not None:
        db_tutor.cidade = tutor.cidade
    if tutor.estado is not None:
        db_tutor.estado = tutor.estado

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
    """Remove um tutor (desativa)."""
    db_tutor = db.query(Tutor).filter(Tutor.id == tutor_id).first()

    if not db_tutor:
        raise HTTPException(status_code=404, detail="Tutor não encontrado")

    db_tutor.ativo = 0
    db.commit()

    return {"message": "Tutor removido com sucesso"}
