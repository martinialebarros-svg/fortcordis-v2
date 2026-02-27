"""Pricing helpers for clinic and service combinations."""
from __future__ import annotations

from decimal import Decimal, InvalidOperation

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.clinica import Clinica
from app.models.servico import Servico
from app.models.tabela_preco import PrecoServico, PrecoServicoClinica


def to_decimal(value, default: Decimal = Decimal("0.00")) -> Decimal:
    if value is None:
        return default
    try:
        return Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError):
        return default


def _normalize_tipo_horario(tipo_horario: str) -> str:
    return "plantao" if str(tipo_horario or "").lower() == "plantao" else "comercial"


def _preco_tabela_padrao(
    db: Session,
    clinica: Clinica,
    servico: Servico,
    tipo_horario: str,
) -> Decimal:
    tabela_id = clinica.tabela_preco_id or 1
    if tabela_id == 1:
        return to_decimal(
            servico.preco_fortaleza_plantao if tipo_horario == "plantao" else servico.preco_fortaleza_comercial
        )
    if tabela_id == 2:
        return to_decimal(servico.preco_rm_plantao if tipo_horario == "plantao" else servico.preco_rm_comercial)
    if tabela_id == 3:
        return to_decimal(
            servico.preco_domiciliar_plantao if tipo_horario == "plantao" else servico.preco_domiciliar_comercial
        )

    preco_custom_tabela = db.query(PrecoServico).filter(
        PrecoServico.tabela_preco_id == tabela_id,
        PrecoServico.servico_id == servico.id,
    ).first()
    if preco_custom_tabela:
        field = preco_custom_tabela.preco_plantao if tipo_horario == "plantao" else preco_custom_tabela.preco_comercial
        if field is not None:
            return to_decimal(field)

    return to_decimal(servico.preco)


def calcular_preco_servico(
    db: Session,
    clinica_id: int,
    servico_id: int,
    tipo_horario: str = "comercial",
    *,
    usar_preco_clinica: bool = True,
) -> Decimal:
    """Calcula preco final para OS/agendamento.

    Prioridade:
    1) Preco negociado da clinica para o servico (quando existir)
    2) Preco da tabela da clinica
    """
    clinica = db.query(Clinica).filter(Clinica.id == clinica_id).first()
    if not clinica:
        raise HTTPException(status_code=404, detail="Clinica nao encontrada")

    servico = db.query(Servico).filter(Servico.id == servico_id).first()
    if not servico:
        raise HTTPException(status_code=404, detail="Servico nao encontrado")

    horario = _normalize_tipo_horario(tipo_horario)

    if usar_preco_clinica:
        preco_clinica = db.query(PrecoServicoClinica).filter(
            PrecoServicoClinica.clinica_id == clinica_id,
            PrecoServicoClinica.servico_id == servico_id,
            PrecoServicoClinica.ativo == 1,
        ).first()
        if preco_clinica:
            field = preco_clinica.preco_plantao if horario == "plantao" else preco_clinica.preco_comercial
            if field is not None:
                return to_decimal(field)

    return _preco_tabela_padrao(db, clinica, servico, horario)

