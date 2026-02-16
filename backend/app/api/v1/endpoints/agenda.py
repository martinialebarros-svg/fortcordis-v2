from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func
from typing import List, Optional
from datetime import datetime, timedelta

from app.db.database import get_db
from app.models.agendamento import Agendamento
from app.models.paciente import Paciente
from app.models.clinica import Clinica
from app.models.servico import Servico
from app.models.user import User
from app.schemas.agendamento import AgendamentoCreate, AgendamentoUpdate, AgendamentoResponse, AgendamentoLista
from app.core.security import get_current_user, require_papel

router = APIRouter()

@router.get("", response_model=AgendamentoLista)
def listar_agendamentos(
    data_inicio: Optional[str] = None,
    data_fim: Optional[str] = None,
    status: Optional[str] = None,
    clinica_id: Optional[int] = None,
    paciente_id: Optional[int] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Lista agendamentos com filtros e nomes dos relacionados"""
    query = db.query(
        Agendamento,
        Paciente.nome.label('paciente_nome'),
        Clinica.nome.label('clinica_nome'),
        Servico.nome.label('servico_nome')
    ).outerjoin(Paciente, Agendamento.paciente_id == Paciente.id)\
     .outerjoin(Clinica, Agendamento.clinica_id == Clinica.id)\
     .outerjoin(Servico, Agendamento.servico_id == Servico.id)

    if data_inicio:
        query = query.filter(Agendamento.inicio >= data_inicio)
    if data_fim:
        query = query.filter(Agendamento.inicio <= data_fim)
    if status:
        query = query.filter(Agendamento.status == status)
    if clinica_id:
        query = query.filter(Agendamento.clinica_id == clinica_id)
    if paciente_id:
        query = query.filter(Agendamento.paciente_id == paciente_id)

    total = query.count()
    results = query.offset(skip).limit(limit).all()
    
    # Montar resposta com nomes
    items = []
    for ag, paciente_nome, clinica_nome, servico_nome in results:
        items.append({
            "id": ag.id,
            "paciente_id": ag.paciente_id,
            "clinica_id": ag.clinica_id,
            "servico_id": ag.servico_id,
            "inicio": str(ag.inicio) if ag.inicio else None,
            "fim": str(ag.fim) if ag.fim else None,
            "status": ag.status,
            "observacoes": ag.observacoes,
            "data": ag.data,
            "hora": ag.hora,
            "paciente": paciente_nome or "Paciente não informado",
            "tutor": "",
            "telefone": "",
            "servico": servico_nome or "",
            "clinica": clinica_nome or "Clínica não informada",
            "criado_por_nome": ag.criado_por_nome,
            "confirmado_por_nome": ag.confirmado_por_nome,
            "created_at": str(ag.created_at) if ag.created_at else None,
        })

    return {"total": total, "items": items}

@router.get("/hoje", response_model=AgendamentoLista)
def agendamentos_hoje(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Lista agendamentos de hoje"""
    hoje_str = datetime.now().strftime('%Y-%m-%d')

    agendamentos = db.query(Agendamento).filter(
        Agendamento.inicio.like(f"{hoje_str}%")
    ).all()

    return {"total": len(agendamentos), "items": agendamentos}

@router.get("/{agendamento_id}", response_model=AgendamentoResponse)
def obter_agendamento(
    agendamento_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Obtém um agendamento específico"""
    agendamento = db.query(Agendamento).filter(Agendamento.id == agendamento_id).first()
    if not agendamento:
        raise HTTPException(status_code=404, detail="Agendamento não encontrado")
    return agendamento

@router.post("", response_model=AgendamentoResponse, status_code=status.HTTP_201_CREATED)
def criar_agendamento(
    agendamento: AgendamentoCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Cria novo agendamento"""
    now = datetime.now()

    db_agendamento = Agendamento(**agendamento.dict())
    db_agendamento.criado_por_id = current_user.id
    db_agendamento.criado_por_nome = current_user.nome
    db_agendamento.criado_em = now
    db_agendamento.created_at = now
    db_agendamento.updated_at = now

    db.add(db_agendamento)
    db.commit()
    db.refresh(db_agendamento)
    return db_agendamento

@router.put("/{agendamento_id}", response_model=AgendamentoResponse)
def atualizar_agendamento(
    agendamento_id: int,
    agendamento: AgendamentoUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Atualiza agendamento"""
    db_agendamento = db.query(Agendamento).filter(Agendamento.id == agendamento_id).first()
    if not db_agendamento:
        raise HTTPException(status_code=404, detail="Agendamento não encontrado")

    update_data = agendamento.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_agendamento, field, value)

    db_agendamento.atualizado_em = datetime.now()
    db_agendamento.updated_at = datetime.now()

    db.commit()
    db.refresh(db_agendamento)
    return db_agendamento

@router.patch("/{agendamento_id}/status")
def atualizar_status(
    agendamento_id: int,
    status: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Atualiza apenas o status do agendamento"""
    db_agendamento = db.query(Agendamento).filter(Agendamento.id == agendamento_id).first()
    if not db_agendamento:
        raise HTTPException(status_code=404, detail="Agendamento não encontrado")

    db_agendamento.status = status
    db_agendamento.atualizado_em = datetime.now()
    db_agendamento.updated_at = datetime.now()

    if status == "Confirmado":
        db_agendamento.confirmado_por_id = current_user.id
        db_agendamento.confirmado_por_nome = current_user.nome
        db_agendamento.confirmado_em = datetime.now()

    db.commit()
    db.refresh(db_agendamento)
    return db_agendamento

@router.delete("/{agendamento_id}")
def deletar_agendamento(
    agendamento_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_papel("admin"))
):
    """Deleta agendamento (só admin)"""
    db_agendamento = db.query(Agendamento).filter(Agendamento.id == agendamento_id).first()
    if not db_agendamento:
        raise HTTPException(status_code=404, detail="Agendamento não encontrado")

    db.delete(db_agendamento)
    db.commit()
    return {"message": "Agendamento deletado com sucesso"}
