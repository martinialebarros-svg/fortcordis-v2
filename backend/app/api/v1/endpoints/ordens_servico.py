"""Endpoints para gerenciamento de Ordens de Serviço"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime

from app.db.database import get_db
from app.models.ordem_servico import OrdemServico
from app.models.paciente import Paciente
from app.models.clinica import Clinica
from app.models.servico import Servico
from app.core.security import get_current_user
from app.models.user import User

router = APIRouter()


class OrdemServicoUpdate(BaseModel):
    desconto: Optional[float] = 0
    observacoes: Optional[str] = ""
    status: Optional[str] = None  # Pendente, Pago, Cancelado


@router.get("")
def listar_ordens(
    status: Optional[str] = None,
    clinica_id: Optional[int] = None,
    data_inicio: Optional[str] = None,
    data_fim: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Lista ordens de serviço com filtros"""
    query = db.query(
        OrdemServico,
        Paciente.nome.label('paciente_nome'),
        Clinica.nome.label('clinica_nome'),
        Servico.nome.label('servico_nome')
    ).outerjoin(Paciente, OrdemServico.paciente_id == Paciente.id)\
     .outerjoin(Clinica, OrdemServico.clinica_id == Clinica.id)\
     .outerjoin(Servico, OrdemServico.servico_id == Servico.id)
    
    if status:
        query = query.filter(OrdemServico.status == status)
    if clinica_id:
        query = query.filter(OrdemServico.clinica_id == clinica_id)
    if data_inicio:
        query = query.filter(OrdemServico.data_atendimento >= data_inicio)
    if data_fim:
        query = query.filter(OrdemServico.data_atendimento <= data_fim)
    
    total = query.count()
    results = query.order_by(OrdemServico.id.desc()).offset(skip).limit(limit).all()
    
    items = []
    for os, paciente_nome, clinica_nome, servico_nome in results:
        items.append({
            "id": os.id,
            "numero_os": os.numero_os,
            "paciente": paciente_nome or "",
            "clinica": clinica_nome or "",
            "servico": servico_nome or "",
            "data_atendimento": str(os.data_atendimento) if os.data_atendimento else None,
            "tipo_horario": os.tipo_horario,
            "valor_servico": float(os.valor_servico) if os.valor_servico else 0,
            "desconto": float(os.desconto) if os.desconto else 0,
            "valor_final": float(os.valor_final) if os.valor_final else 0,
            "status": os.status,
            "created_at": str(os.created_at) if os.created_at else None,
        })
    
    return {"total": total, "items": items}


@router.get("/{os_id}")
def obter_ordem(
    os_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Obtém uma ordem de serviço específica"""
    os = db.query(
        OrdemServico,
        Paciente.nome.label('paciente_nome'),
        Clinica.nome.label('clinica_nome'),
        Servico.nome.label('servico_nome')
    ).outerjoin(Paciente, OrdemServico.paciente_id == Paciente.id)\
     .outerjoin(Clinica, OrdemServico.clinica_id == Clinica.id)\
     .outerjoin(Servico, OrdemServico.servico_id == Servico.id)\
     .filter(OrdemServico.id == os_id).first()
    
    if not os:
        raise HTTPException(status_code=404, detail="Ordem de serviço não encontrada")
    
    os_data, paciente_nome, clinica_nome, servico_nome = os
    
    return {
        "id": os_data.id,
        "numero_os": os_data.numero_os,
        "paciente_id": os_data.paciente_id,
        "paciente": paciente_nome or "",
        "clinica_id": os_data.clinica_id,
        "clinica": clinica_nome or "",
        "servico_id": os_data.servico_id,
        "servico": servico_nome or "",
        "data_atendimento": str(os_data.data_atendimento) if os_data.data_atendimento else None,
        "tipo_horario": os_data.tipo_horario,
        "valor_servico": float(os_data.valor_servico) if os_data.valor_servico else 0,
        "desconto": float(os_data.desconto) if os_data.desconto else 0,
        "valor_final": float(os_data.valor_final) if os_data.valor_final else 0,
        "status": os_data.status,
        "observacoes": os_data.observacoes,
        "criado_por_nome": os_data.criado_por_nome,
        "created_at": str(os_data.created_at) if os_data.created_at else None,
    }


@router.put("/{os_id}")
def atualizar_ordem(
    os_id: int,
    dados: OrdemServicoUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Atualiza uma ordem de serviço (aplica desconto, altera status)"""
    from decimal import Decimal
    
    os = db.query(OrdemServico).filter(OrdemServico.id == os_id).first()
    if not os:
        raise HTTPException(status_code=404, detail="Ordem de serviço não encontrada")
    
    if dados.desconto is not None:
        os.desconto = Decimal(str(dados.desconto))
        # Recalcular valor final
        os.valor_final = os.valor_servico - os.desconto
    
    if dados.status:
        os.status = dados.status
    
    if dados.observacoes is not None:
        os.observacoes = dados.observacoes
    
    os.updated_at = datetime.now()
    
    db.commit()
    db.refresh(os)
    
    return {
        "id": os.id,
        "numero_os": os.numero_os,
        "valor_final": float(os.valor_final),
        "status": os.status,
        "mensagem": "Ordem de serviço atualizada com sucesso"
    }


@router.delete("/{os_id}", status_code=status.HTTP_204_NO_CONTENT)
def deletar_ordem(
    os_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Remove uma ordem de serviço"""
    os = db.query(OrdemServico).filter(OrdemServico.id == os_id).first()
    if not os:
        raise HTTPException(status_code=404, detail="Ordem de serviço não encontrada")
    
    db.delete(os)
    db.commit()
    
    return None


@router.get("/clinica/{clinica_id}/pendentes")
def ordens_pendentes_clinica(
    clinica_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Lista ordens de serviço pendentes de uma clínica específica"""
    ordens = db.query(
        OrdemServico,
        Paciente.nome.label('paciente_nome'),
        Servico.nome.label('servico_nome')
    ).outerjoin(Paciente, OrdemServico.paciente_id == Paciente.id)\
     .outerjoin(Servico, OrdemServico.servico_id == Servico.id)\
     .filter(
        OrdemServico.clinica_id == clinica_id,
        OrdemServico.status == 'Pendente'
    ).order_by(OrdemServico.data_atendimento.desc()).all()
    
    return {
        "total": len(ordens),
        "items": [{
            "id": os.OrdemServico.id,
            "numero_os": os.OrdemServico.numero_os,
            "paciente": os.paciente_nome or "",
            "servico": os.servico_nome or "",
            "data_atendimento": str(os.OrdemServico.data_atendimento) if os.OrdemServico.data_atendimento else None,
            "valor_final": float(os.OrdemServico.valor_final) if os.OrdemServico.valor_final else 0,
        } for os in ordens]
    }


@router.get("/dashboard/resumo")
def resumo_os(
    mes: Optional[int] = None,
    ano: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Retorna resumo de OS para dashboard"""
    from sqlalchemy import func
    
    query = db.query(OrdemServico)
    
    if mes and ano:
        # Filtrar por mês/ano
        data_inicio = f"{ano}-{mes:02d}-01"
        if mes == 12:
            data_fim = f"{ano+1}-01-01"
        else:
            data_fim = f"{ano}-{mes+1:02d}-01"
        
        query = query.filter(
            OrdemServico.data_atendimento >= data_inicio,
            OrdemServico.data_atendimento < data_fim
        )
    
    # Totais por status
    pendentes = query.filter(OrdemServico.status == 'Pendente').count()
    pagas = query.filter(OrdemServico.status == 'Pago').count()
    canceladas = query.filter(OrdemServico.status == 'Cancelado').count()
    
    # Valor total
    valor_total = db.query(func.sum(OrdemServico.valor_final)).filter(
        OrdemServico.status == 'Pago'
    ).scalar() or 0
    
    # Valor pendente
    valor_pendente = db.query(func.sum(OrdemServico.valor_final)).filter(
        OrdemServico.status == 'Pendente'
    ).scalar() or 0
    
    return {
        "total_os": pendentes + pagas + canceladas,
        "pendentes": pendentes,
        "pagas": pagas,
        "canceladas": canceladas,
        "valor_total_recebido": float(valor_total),
        "valor_pendente": float(valor_pendente)
    }
