from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from datetime import datetime, date, timedelta

from app.db.database import get_db
from app.models.financeiro import Transacao, ContaPagar, ContaReceber
from app.models.user import User
from app.core.security import get_current_user

router = APIRouter()

# Transações
@router.get("/transacoes")
def listar_transacoes(
    tipo: Optional[str] = None,
    categoria: Optional[str] = None,
    status: Optional[str] = None,
    data_inicio: Optional[str] = None,
    data_fim: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Lista transações financeiras"""
    query = db.query(Transacao)
    
    if tipo:
        query = query.filter(Transacao.tipo == tipo)
    if categoria:
        query = query.filter(Transacao.categoria == categoria)
    if status:
        query = query.filter(Transacao.status == status)
    if data_inicio:
        query = query.filter(Transacao.data_transacao >= data_inicio)
    if data_fim:
        query = query.filter(Transacao.data_transacao <= data_fim)
    
    total = query.count()
    items = query.order_by(Transacao.data_transacao.desc()).offset(skip).limit(limit).all()
    
    return {"total": total, "items": items}

@router.post("/transacoes", status_code=status.HTTP_201_CREATED)
def criar_transacao(
    transacao_data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Cria nova transação"""
    valor = float(transacao_data.get("valor", 0))
    desconto = float(transacao_data.get("desconto", 0))
    
    transacao = Transacao(
        tipo=transacao_data.get("tipo"),
        categoria=transacao_data.get("categoria"),
        valor=valor,
        desconto=desconto,
        valor_final=valor - desconto,
        forma_pagamento=transacao_data.get("forma_pagamento"),
        status=transacao_data.get("status", "Pendente"),
        paciente_id=transacao_data.get("paciente_id"),
        paciente_nome=transacao_data.get("paciente_nome"),
        agendamento_id=transacao_data.get("agendamento_id"),
        descricao=transacao_data.get("descricao"),
        data_transacao=transacao_data.get("data_transacao", datetime.now()),
        data_vencimento=transacao_data.get("data_vencimento"),
        parcelas=transacao_data.get("parcelas", 1),
        observacoes=transacao_data.get("observacoes"),
        criado_por_id=current_user.id,
        criado_por_nome=current_user.nome
    )
    
    db.add(transacao)
    db.commit()
    db.refresh(transacao)
    
    return transacao

@router.patch("/transacoes/{transacao_id}/pagar")
def pagar_transacao(
    transacao_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Marca transação como paga/recebida"""
    transacao = db.query(Transacao).filter(Transacao.id == transacao_id).first()
    if not transacao:
        raise HTTPException(status_code=404, detail="Transação não encontrada")
    
    transacao.status = "Pago" if transacao.tipo == "saida" else "Recebido"
    transacao.data_pagamento = datetime.now()
    
    db.commit()
    db.refresh(transacao)
    return transacao

# Resumo Financeiro
@router.get("/resumo")
def resumo_financeiro(
    periodo: str = "mes",  # dia, semana, mes, ano
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Retorna resumo financeiro do período"""
    hoje = date.today()
    
    if periodo == "dia":
        data_inicio = hoje
        data_fim = hoje
    elif periodo == "semana":
        data_inicio = hoje - timedelta(days=hoje.weekday())
        data_fim = hoje
    elif periodo == "mes":
        data_inicio = hoje.replace(day=1)
        data_fim = hoje
    else:  # ano
        data_inicio = hoje.replace(month=1, day=1)
        data_fim = hoje
    
    # Entradas
    entradas = db.query(func.sum(Transacao.valor_final)).filter(
        Transacao.tipo == "entrada",
        Transacao.status == "Recebido",
        func.date(Transacao.data_transacao) >= data_inicio,
        func.date(Transacao.data_transacao) <= data_fim
    ).scalar() or 0
    
    # Saídas
    saidas = db.query(func.sum(Transacao.valor_final)).filter(
        Transacao.tipo == "saida",
        Transacao.status == "Pago",
        func.date(Transacao.data_transacao) >= data_inicio,
        func.date(Transacao.data_transacao) <= data_fim
    ).scalar() or 0
    
    # Pendente
    pendente_entrada = db.query(func.sum(Transacao.valor_final)).filter(
        Transacao.tipo == "entrada",
        Transacao.status == "Pendente"
    ).scalar() or 0
    
    pendente_saida = db.query(func.sum(Transacao.valor_final)).filter(
        Transacao.tipo == "saida",
        Transacao.status == "Pendente"
    ).scalar() or 0
    
    return {
        "periodo": periodo,
        "data_inicio": str(data_inicio),
        "data_fim": str(data_fim),
        "entradas": float(entradas),
        "saidas": float(saidas),
        "saldo": float(entradas - saidas),
        "pendente_entrada": float(pendente_entrada),
        "pendente_saida": float(pendente_saida),
        "a_receber": float(pendente_entrada),
        "a_pagar": float(pendente_saida)
    }

# Contas a Pagar
@router.get("/contas-pagar")
def listar_contas_pagar(
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Lista contas a pagar"""
    query = db.query(ContaPagar)
    if status:
        query = query.filter(ContaPagar.status == status)
    
    return {"items": query.all()}

@router.post("/contas-pagar", status_code=status.HTTP_201_CREATED)
def criar_conta_pagar(
    conta_data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Cria conta a pagar"""
    conta = ContaPagar(
        descricao=conta_data.get("descricao"),
        fornecedor=conta_data.get("fornecedor"),
        categoria=conta_data.get("categoria"),
        valor=conta_data.get("valor"),
        data_vencimento=conta_data.get("data_vencimento"),
        observacoes=conta_data.get("observacoes"),
        criado_por_id=current_user.id
    )
    
    db.add(conta)
    db.commit()
    db.refresh(conta)
    return conta

# Contas a Receber
@router.get("/contas-receber")
def listar_contas_receber(
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Lista contas a receber"""
    query = db.query(ContaReceber)
    if status:
        query = query.filter(ContaReceber.status == status)
    
    return {"items": query.all()}

@router.post("/contas-receber", status_code=status.HTTP_201_CREATED)
def criar_conta_receber(
    conta_data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Cria conta a receber"""
    conta = ContaReceber(
        descricao=conta_data.get("descricao"),
        cliente=conta_data.get("cliente"),
        categoria=conta_data.get("categoria"),
        valor=conta_data.get("valor"),
        data_vencimento=conta_data.get("data_vencimento"),
        paciente_id=conta_data.get("paciente_id"),
        agendamento_id=conta_data.get("agendamento_id"),
        observacoes=conta_data.get("observacoes"),
        criado_por_id=current_user.id
    )
    
    db.add(conta)
    db.commit()
    db.refresh(conta)
    return conta
