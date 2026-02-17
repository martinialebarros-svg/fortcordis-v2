from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import Optional
from pydantic import BaseModel
from datetime import date, datetime

from app.db.database import get_db
from app.models.paciente import Paciente
from app.models.tutor import Tutor
from app.core.security import get_current_user
from app.models.user import User

router = APIRouter()

# Schemas
class PacienteCreate(BaseModel):
    nome: str
    tutor: Optional[str] = None
    especie: Optional[str] = "Canina"
    raca: Optional[str] = ""
    sexo: Optional[str] = "Macho"
    peso_kg: Optional[float] = None
    data_nascimento: Optional[str] = None  # formato string
    microchip: Optional[str] = ""
    observacoes: Optional[str] = ""

class PacienteResponse(BaseModel):
    id: int
    nome: str
    tutor: str
    especie: Optional[str] = None
    raca: Optional[str] = None
    sexo: Optional[str] = None
    peso_kg: Optional[float] = None

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


@router.post("", response_model=PacienteResponse, status_code=status.HTTP_201_CREATED)
def criar_paciente(
    paciente: PacienteCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Cria um novo paciente"""
    # Verificar se já existe paciente com mesmo nome e tutor
    existing = db.query(Paciente).filter(
        Paciente.nome.ilike(paciente.nome)
    ).first()
    
    # Buscar ou criar tutor
    tutor_id = None
    if paciente.tutor:
        tutor = db.query(Tutor).filter(Tutor.nome.ilike(paciente.tutor)).first()
        if not tutor:
            # Criar novo tutor
            tutor = Tutor(
                nome=paciente.tutor,
                email="",
                telefone=""
            )
            db.add(tutor)
            db.commit()
            db.refresh(tutor)
        tutor_id = tutor.id
    
    # Criar paciente
    db_paciente = Paciente(
        nome=paciente.nome,
        tutor_id=tutor_id,
        especie=paciente.especie,
        raca=paciente.raca,
        sexo=paciente.sexo,
        peso=paciente.peso_kg,
        nascimento=paciente.data_nascimento,
        microchip=paciente.microchip,
        observacoes=paciente.observacoes
    )
    
    db.add(db_paciente)
    db.commit()
    db.refresh(db_paciente)
    
    return {
        "id": db_paciente.id,
        "nome": db_paciente.nome,
        "tutor": paciente.tutor or "",
        "especie": db_paciente.especie,
        "raca": db_paciente.raca,
        "sexo": db_paciente.sexo,
        "peso_kg": db_paciente.peso_kg
    }


@router.get("/{paciente_id}")
def obter_paciente(
    paciente_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Obtém detalhes de um paciente"""
    paciente = db.query(
        Paciente,
        Tutor.nome.label('tutor_nome')
    ).outerjoin(Tutor, Paciente.tutor_id == Tutor.id).filter(
        Paciente.id == paciente_id
    ).first()
    
    if not paciente:
        raise HTTPException(status_code=404, detail="Paciente não encontrado")
    
    p, tutor_nome = paciente
    
    return {
        "id": p.id,
        "nome": p.nome,
        "tutor": tutor_nome or "",
        "especie": p.especie,
        "raca": p.raca,
        "sexo": p.sexo,
        "peso_kg": p.peso_kg,
        "data_nascimento": p.nascimento,
        "microchip": p.microchip,
        "observacoes": p.observacoes
    }


@router.put("/{paciente_id}")
def atualizar_paciente(
    paciente_id: int,
    paciente: PacienteCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Atualiza um paciente existente"""
    db_paciente = db.query(Paciente).filter(Paciente.id == paciente_id).first()
    
    if not db_paciente:
        raise HTTPException(status_code=404, detail="Paciente não encontrado")
    
    # Atualizar tutor se fornecido
    if paciente.tutor:
        tutor = db.query(Tutor).filter(Tutor.nome.ilike(paciente.tutor)).first()
        if not tutor:
            tutor = Tutor(nome=paciente.tutor, email="", telefone="")
            db.add(tutor)
            db.commit()
            db.refresh(tutor)
        db_paciente.tutor_id = tutor.id
    
    # Atualizar campos
    db_paciente.nome = paciente.nome
    db_paciente.especie = paciente.especie
    db_paciente.raca = paciente.raca
    db_paciente.sexo = paciente.sexo
    db_paciente.peso_kg = paciente.peso_kg
    db_paciente.nascimento = paciente.data_nascimento
    db_paciente.microchip = paciente.microchip
    db_paciente.observacoes = paciente.observacoes
    
    db.commit()
    db.refresh(db_paciente)
    
    return {
        "id": db_paciente.id,
        "nome": db_paciente.nome,
        "message": "Paciente atualizado com sucesso"
    }


@router.delete("/{paciente_id}")
def deletar_paciente(
    paciente_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Remove um paciente"""
    db_paciente = db.query(Paciente).filter(Paciente.id == paciente_id).first()
    
    if not db_paciente:
        raise HTTPException(status_code=404, detail="Paciente não encontrado")
    
    db.delete(db_paciente)
    db.commit()
    
    return {"message": "Paciente removido com sucesso"}
