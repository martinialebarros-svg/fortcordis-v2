"""Endpoints para gerenciamento de ordens de servico."""

from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.security import get_current_user
from app.db.database import get_db
from app.models.clinica import Clinica
from app.models.financeiro import Transacao
from app.models.ordem_servico import OrdemServico
from app.models.paciente import Paciente
from app.models.servico import Servico
from app.models.tutor import Tutor
from app.models.user import User
from app.services.precos_service import calcular_preco_servico

router = APIRouter()

OS_STATUSES = {"Pendente", "Pago", "Cancelado"}


class OrdemServicoUpdate(BaseModel):
    paciente_id: Optional[int] = None
    clinica_id: Optional[int] = None
    servico_id: Optional[int] = None
    data_atendimento: Optional[datetime] = None
    tipo_horario: Optional[str] = Field(default=None, pattern="^(comercial|plantao)$")

    valor_servico: Optional[float] = Field(default=None, ge=0)
    desconto: Optional[float] = Field(default=None, ge=0)

    observacoes: Optional[str] = None
    status: Optional[str] = None
    recalcular_preco: bool = False


class OrdemServicoReceberInput(BaseModel):
    forma_pagamento: str = "dinheiro"
    data_recebimento: Optional[date] = None


def _to_decimal(value, default: Decimal = Decimal("0.00")) -> Decimal:
    if value is None:
        return default
    try:
        return Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError):
        return default


def _serialize_os(
    os_data: OrdemServico,
    paciente_nome: Optional[str] = None,
    tutor_nome: Optional[str] = None,
    clinica_nome: Optional[str] = None,
    servico_nome: Optional[str] = None,
) -> dict:
    return {
        "id": os_data.id,
        "numero_os": os_data.numero_os,
        "agendamento_id": os_data.agendamento_id,
        "paciente_id": os_data.paciente_id,
        "clinica_id": os_data.clinica_id,
        "servico_id": os_data.servico_id,
        "paciente": paciente_nome or "",
        "tutor": tutor_nome or "",
        "clinica": clinica_nome or "",
        "servico": servico_nome or "",
        "data_atendimento": str(os_data.data_atendimento) if os_data.data_atendimento else None,
        "tipo_horario": os_data.tipo_horario,
        "valor_servico": float(os_data.valor_servico) if os_data.valor_servico else 0,
        "desconto": float(os_data.desconto) if os_data.desconto else 0,
        "valor_final": float(os_data.valor_final) if os_data.valor_final else 0,
        "status": os_data.status,
        "observacoes": os_data.observacoes,
        "created_at": str(os_data.created_at) if os_data.created_at else None,
    }


def _calcular_valor_servico(
    db: Session,
    clinica_id: int,
    servico_id: int,
    tipo_horario: str,
) -> Decimal:
    return calcular_preco_servico(
        db=db,
        clinica_id=clinica_id,
        servico_id=servico_id,
        tipo_horario=tipo_horario,
        usar_preco_clinica=True,
    )


def _find_os_with_names(db: Session, os_id: int):
    return (
        db.query(
            OrdemServico,
            Paciente.nome.label("paciente_nome"),
            Tutor.nome.label("tutor_nome"),
            Clinica.nome.label("clinica_nome"),
            Servico.nome.label("servico_nome"),
        )
        .outerjoin(Paciente, OrdemServico.paciente_id == Paciente.id)
        .outerjoin(Tutor, Paciente.tutor_id == Tutor.id)
        .outerjoin(Clinica, OrdemServico.clinica_id == Clinica.id)
        .outerjoin(Servico, OrdemServico.servico_id == Servico.id)
        .filter(OrdemServico.id == os_id)
        .first()
    )


@router.get("")
def listar_ordens(
    status: Optional[str] = None,
    clinica_id: Optional[int] = None,
    data_inicio: Optional[str] = None,
    data_fim: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Lista ordens de servico com filtros."""
    query = (
        db.query(
            OrdemServico,
            Paciente.nome.label("paciente_nome"),
            Tutor.nome.label("tutor_nome"),
            Clinica.nome.label("clinica_nome"),
            Servico.nome.label("servico_nome"),
        )
        .outerjoin(Paciente, OrdemServico.paciente_id == Paciente.id)
        .outerjoin(Tutor, Paciente.tutor_id == Tutor.id)
        .outerjoin(Clinica, OrdemServico.clinica_id == Clinica.id)
        .outerjoin(Servico, OrdemServico.servico_id == Servico.id)
    )

    if status:
        query = query.filter(OrdemServico.status == status)
    if clinica_id:
        query = query.filter(OrdemServico.clinica_id == clinica_id)
    if data_inicio:
        query = query.filter(func.date(OrdemServico.data_atendimento) >= data_inicio)
    if data_fim:
        query = query.filter(func.date(OrdemServico.data_atendimento) <= data_fim)

    total = query.count()
    results = (
        query.order_by(OrdemServico.data_atendimento.desc(), OrdemServico.id.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )

    items = [
        _serialize_os(
            os_data,
            paciente_nome=paciente_nome,
            tutor_nome=tutor_nome,
            clinica_nome=clinica_nome,
            servico_nome=servico_nome,
        )
        for os_data, paciente_nome, tutor_nome, clinica_nome, servico_nome in results
    ]

    return {"total": total, "items": items}


@router.get("/{os_id}")
def obter_ordem(
    os_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Obtem uma ordem de servico especifica."""
    os_row = _find_os_with_names(db, os_id)
    if not os_row:
        raise HTTPException(status_code=404, detail="Ordem de servico nao encontrada")

    os_data, paciente_nome, tutor_nome, clinica_nome, servico_nome = os_row
    return _serialize_os(
        os_data,
        paciente_nome=paciente_nome,
        tutor_nome=tutor_nome,
        clinica_nome=clinica_nome,
        servico_nome=servico_nome,
    )


@router.put("/{os_id}")
def atualizar_ordem(
    os_id: int,
    dados: OrdemServicoUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Atualiza ordem de servico."""
    os_data = db.query(OrdemServico).filter(OrdemServico.id == os_id).first()
    if not os_data:
        raise HTTPException(status_code=404, detail="Ordem de servico nao encontrada")

    if dados.status is not None and dados.status not in OS_STATUSES:
        raise HTTPException(status_code=400, detail="Status invalido para ordem de servico")

    altera_preco = any(
        [
            dados.clinica_id is not None,
            dados.servico_id is not None,
            dados.tipo_horario is not None,
            dados.valor_servico is not None,
            dados.desconto is not None,
            dados.recalcular_preco,
        ]
    )

    if os_data.status == "Pago" and altera_preco:
        raise HTTPException(
            status_code=400,
            detail="OS ja recebida. Desfaca o recebimento antes de editar valores.",
        )

    if dados.paciente_id is not None:
        os_data.paciente_id = dados.paciente_id
    if dados.clinica_id is not None:
        os_data.clinica_id = dados.clinica_id
    if dados.servico_id is not None:
        os_data.servico_id = dados.servico_id
    if dados.data_atendimento is not None:
        os_data.data_atendimento = dados.data_atendimento
    if dados.tipo_horario is not None:
        os_data.tipo_horario = dados.tipo_horario

    if dados.observacoes is not None:
        os_data.observacoes = dados.observacoes

    if dados.status is not None:
        if os_data.status == "Pago" and dados.status == "Pendente":
            raise HTTPException(
                status_code=400,
                detail="Para voltar para pendente use a opcao de desfazer recebimento.",
            )
        if os_data.status != "Pago" and dados.status == "Pago":
            raise HTTPException(
                status_code=400,
                detail="Use a acao Receber para marcar a OS como paga.",
            )
        os_data.status = dados.status

    if dados.recalcular_preco or dados.clinica_id is not None or dados.servico_id is not None or dados.tipo_horario is not None:
        os_data.valor_servico = _calcular_valor_servico(
            db=db,
            clinica_id=os_data.clinica_id,
            servico_id=os_data.servico_id,
            tipo_horario=os_data.tipo_horario or "comercial",
        )

    if dados.valor_servico is not None:
        os_data.valor_servico = _to_decimal(dados.valor_servico)

    if dados.desconto is not None:
        os_data.desconto = _to_decimal(dados.desconto)

    valor_servico = _to_decimal(os_data.valor_servico)
    desconto = _to_decimal(os_data.desconto)
    if desconto > valor_servico:
        raise HTTPException(status_code=400, detail="Desconto nao pode ser maior que o valor do servico.")

    os_data.valor_final = valor_servico - desconto
    os_data.updated_at = datetime.now()

    db.commit()

    os_row = _find_os_with_names(db, os_id)
    os_updated, paciente_nome, tutor_nome, clinica_nome, servico_nome = os_row
    payload = _serialize_os(
        os_updated,
        paciente_nome=paciente_nome,
        tutor_nome=tutor_nome,
        clinica_nome=clinica_nome,
        servico_nome=servico_nome,
    )
    payload["mensagem"] = "Ordem de servico atualizada com sucesso"
    return payload


@router.patch("/{os_id}/receber")
def receber_ordem(
    os_id: int,
    dados: OrdemServicoReceberInput,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Marca OS como recebida e cria transacao vinculada."""
    os_row = _find_os_with_names(db, os_id)
    if not os_row:
        raise HTTPException(status_code=404, detail="Ordem de servico nao encontrada")

    os_data, paciente_nome, _tutor_nome, _clinica_nome, servico_nome = os_row
    if os_data.status == "Pago":
        raise HTTPException(status_code=400, detail="OS ja esta com status Pago.")
    if os_data.status == "Cancelado":
        raise HTTPException(status_code=400, detail="OS cancelada nao pode ser recebida.")

    marker = f"OS_ID={os_data.id};TIPO=RECEBIMENTO_OS"
    transacao_existente = (
        db.query(Transacao)
        .filter(
            Transacao.tipo == "entrada",
            Transacao.status.in_(["Recebido", "Pago"]),
            Transacao.observacoes.like(f"%{marker}%"),
        )
        .order_by(Transacao.id.desc())
        .first()
    )
    if transacao_existente:
        raise HTTPException(status_code=400, detail="Ja existe recebimento ativo para esta OS.")

    now = datetime.now()
    momento_recebimento = now
    if dados.data_recebimento is not None:
        momento_recebimento = datetime.combine(
            dados.data_recebimento,
            now.time().replace(microsecond=0),
        )

    os_data.status = "Pago"
    os_data.updated_at = now

    transacao = Transacao(
        tipo="entrada",
        categoria="consulta",
        valor=float(os_data.valor_final or 0),
        desconto=0,
        valor_final=float(os_data.valor_final or 0),
        forma_pagamento=dados.forma_pagamento,
        status="Recebido",
        descricao=f"Recebimento OS {os_data.numero_os} - {paciente_nome or 'Paciente'}",
        data_transacao=momento_recebimento,
        data_pagamento=momento_recebimento,
        observacoes=(
            f"{marker};OS_NUMERO={os_data.numero_os};SERVICO={servico_nome or ''};"
            f"DATA_RECEBIMENTO={momento_recebimento.date().isoformat()}"
        ),
        paciente_id=os_data.paciente_id,
        paciente_nome=paciente_nome or "",
        agendamento_id=os_data.agendamento_id,
        criado_por_id=current_user.id,
        criado_por_nome=current_user.nome,
        created_at=now,
        updated_at=now,
    )

    db.add(transacao)
    db.commit()
    db.refresh(transacao)

    return {
        "mensagem": "Ordem de servico recebida com sucesso.",
        "os_id": os_data.id,
        "status": os_data.status,
        "transacao_id": transacao.id,
        "data_recebimento": momento_recebimento.isoformat(),
    }


@router.patch("/{os_id}/desfazer-recebimento")
def desfazer_recebimento_ordem(
    os_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Desfaz recebimento da OS e cancela transacao vinculada."""
    os_data = db.query(OrdemServico).filter(OrdemServico.id == os_id).first()
    if not os_data:
        raise HTTPException(status_code=404, detail="Ordem de servico nao encontrada")
    if os_data.status != "Pago":
        raise HTTPException(status_code=400, detail="Apenas OS com status Pago podem ser desfeitas.")

    marker = f"OS_ID={os_data.id};TIPO=RECEBIMENTO_OS"
    transacao = (
        db.query(Transacao)
        .filter(
            Transacao.tipo == "entrada",
            Transacao.status.in_(["Recebido", "Pago"]),
            Transacao.observacoes.like(f"%{marker}%"),
        )
        .order_by(Transacao.id.desc())
        .first()
    )

    if not transacao:
        transacao = (
            db.query(Transacao)
            .filter(
                Transacao.tipo == "entrada",
                Transacao.status.in_(["Recebido", "Pago"]),
                Transacao.descricao.like(f"%{os_data.numero_os}%"),
            )
            .order_by(Transacao.id.desc())
            .first()
        )

    now = datetime.now()
    os_data.status = "Pendente"
    os_data.updated_at = now

    transacao_id = None
    if transacao:
        transacao.status = "Cancelado"
        transacao.data_pagamento = None
        transacao.updated_at = now
        transacao.observacoes = (transacao.observacoes or "") + f" | Recebimento desfeito em {now.isoformat()}"
        transacao_id = transacao.id

    db.commit()

    return {
        "mensagem": "Recebimento desfeito com sucesso.",
        "os_id": os_data.id,
        "status": os_data.status,
        "transacao_cancelada_id": transacao_id,
    }


@router.delete("/{os_id}", status_code=status.HTTP_204_NO_CONTENT)
def deletar_ordem(
    os_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Remove uma ordem de servico."""
    os_data = db.query(OrdemServico).filter(OrdemServico.id == os_id).first()
    if not os_data:
        raise HTTPException(status_code=404, detail="Ordem de servico nao encontrada")

    db.delete(os_data)
    db.commit()
    return None


@router.get("/clinica/{clinica_id}/pendentes")
def ordens_pendentes_clinica(
    clinica_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Lista ordens pendentes de uma clinica."""
    ordens = (
        db.query(
            OrdemServico,
            Paciente.nome.label("paciente_nome"),
            Tutor.nome.label("tutor_nome"),
            Servico.nome.label("servico_nome"),
        )
        .outerjoin(Paciente, OrdemServico.paciente_id == Paciente.id)
        .outerjoin(Tutor, Paciente.tutor_id == Tutor.id)
        .outerjoin(Servico, OrdemServico.servico_id == Servico.id)
        .filter(
            OrdemServico.clinica_id == clinica_id,
            OrdemServico.status == "Pendente",
        )
        .order_by(OrdemServico.data_atendimento.desc())
        .all()
    )

    return {
        "total": len(ordens),
        "items": [
            {
                "id": os_data.id,
                "numero_os": os_data.numero_os,
                "paciente": paciente_nome or "",
                "tutor": tutor_nome or "",
                "servico": servico_nome or "",
                "data_atendimento": str(os_data.data_atendimento) if os_data.data_atendimento else None,
                "valor_final": float(os_data.valor_final) if os_data.valor_final else 0,
            }
            for os_data, paciente_nome, tutor_nome, servico_nome in ordens
        ],
    }


@router.get("/dashboard/resumo")
def resumo_os(
    mes: Optional[int] = None,
    ano: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Resumo de ordens de servico para dashboard."""
    query = db.query(OrdemServico)

    if mes and ano:
        data_inicio = f"{ano}-{mes:02d}-01"
        if mes == 12:
            data_fim = f"{ano + 1}-01-01"
        else:
            data_fim = f"{ano}-{mes + 1:02d}-01"

        query = query.filter(
            OrdemServico.data_atendimento >= data_inicio,
            OrdemServico.data_atendimento < data_fim,
        )

    pendentes = query.filter(OrdemServico.status == "Pendente").count()
    pagas = query.filter(OrdemServico.status == "Pago").count()
    canceladas = query.filter(OrdemServico.status == "Cancelado").count()

    valor_total = (
        db.query(func.sum(OrdemServico.valor_final))
        .filter(OrdemServico.status == "Pago")
        .scalar()
        or 0
    )
    valor_pendente = (
        db.query(func.sum(OrdemServico.valor_final))
        .filter(OrdemServico.status == "Pendente")
        .scalar()
        or 0
    )

    return {
        "total_os": pendentes + pagas + canceladas,
        "pendentes": pendentes,
        "pagas": pagas,
        "canceladas": canceladas,
        "valor_total_recebido": float(valor_total),
        "valor_pendente": float(valor_pendente),
    }
