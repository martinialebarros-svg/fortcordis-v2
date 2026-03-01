from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models.agendamento import Agendamento
from app.models.paciente import Paciente
from app.models.clinica import Clinica
from app.models.servico import Servico
from app.models.ordem_servico import OrdemServico
from app.models.user import User
from app.models.tutor import Tutor
from app.schemas.agendamento import (
    AgendamentoCreate,
    AgendamentoLista,
    AgendamentoResponse,
    AgendamentoUpdate,
)
from app.core.security import get_current_user
from app.services.precos_service import calcular_preco_servico

router = APIRouter()
# Horario de Brasilia (UTC-3). Evita dependencia de tzdata no Windows local.
LOCAL_TZ = timezone(timedelta(hours=-3))


def _parse_iso_datetime(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None

    raw = value.strip()
    if raw.endswith("Z"):
        raw = raw[:-1] + "+00:00"

    try:
        return datetime.fromisoformat(raw)
    except ValueError:
        return None


def _to_local_naive(value: Optional[datetime]) -> Optional[datetime]:
    if value is None:
        return None
    if value.tzinfo is None:
        return value
    return value.astimezone(LOCAL_TZ).replace(tzinfo=None)


def _to_local_aware(value: Optional[datetime]) -> Optional[datetime]:
    if value is None:
        return None
    if value.tzinfo is None:
        # Interpreta datetimes sem timezone como horario local de Brasilia.
        return value.replace(tzinfo=LOCAL_TZ)
    return value.astimezone(LOCAL_TZ)


def _extract_date_filter(value: Optional[str]) -> Optional[str]:
    if not value:
        return None

    parsed = _parse_iso_datetime(value)
    if parsed is not None:
        return parsed.date().isoformat()

    # Fallback para valores no formato YYYY-MM-DD...
    candidate = value.strip().split("T", 1)[0].split(" ", 1)[0]
    if len(candidate) == 10:
        return candidate
    return None


def _coerce_datetime(value) -> Optional[datetime]:
    if isinstance(value, datetime):
        return _to_local_aware(value)
    if isinstance(value, str):
        parsed = _parse_iso_datetime(value.replace(" ", "T", 1))
        return _to_local_aware(parsed)
    return None


def _fill_data_hora_from_inicio(agendamento: Agendamento) -> None:
    inicio_dt = _coerce_datetime(agendamento.inicio)
    if inicio_dt is None:
        return
    agendamento.data = inicio_dt.strftime("%Y-%m-%d")
    agendamento.hora = inicio_dt.strftime("%H:%M")


def _apply_service_duration_if_needed(db: Session, agendamento: Agendamento) -> None:
    inicio_dt = _coerce_datetime(agendamento.inicio)
    if inicio_dt is None:
        return

    fim_dt = _coerce_datetime(agendamento.fim)
    if fim_dt is not None and fim_dt > inicio_dt:
        return

    duracao_minutos = 30
    if agendamento.servico_id:
        servico = db.query(Servico).filter(Servico.id == agendamento.servico_id).first()
        if servico and servico.duracao_minutos and servico.duracao_minutos > 0:
            duracao_minutos = int(servico.duracao_minutos)

    agendamento.fim = inicio_dt + timedelta(minutes=duracao_minutos)


def _fetch_related_names(db: Session, agendamento: Agendamento) -> dict:
    paciente_nome = None
    tutor_nome = None
    tutor_telefone = None
    clinica_nome = None
    servico_nome = None

    if agendamento.paciente_id:
        paciente = db.query(Paciente).filter(Paciente.id == agendamento.paciente_id).first()
        if paciente:
            paciente_nome = paciente.nome
            if paciente.tutor_id:
                tutor = db.query(Tutor).filter(Tutor.id == paciente.tutor_id).first()
                if tutor:
                    tutor_nome = tutor.nome
                    tutor_telefone = tutor.telefone

    if agendamento.clinica_id:
        clinica = db.query(Clinica).filter(Clinica.id == agendamento.clinica_id).first()
        if clinica:
            clinica_nome = clinica.nome

    if agendamento.servico_id:
        servico = db.query(Servico).filter(Servico.id == agendamento.servico_id).first()
        if servico:
            servico_nome = servico.nome

    return {
        "paciente_nome": paciente_nome,
        "tutor_nome": tutor_nome,
        "tutor_telefone": tutor_telefone,
        "clinica_nome": clinica_nome,
        "servico_nome": servico_nome,
    }


def _sync_denormalized_fields(agendamento: Agendamento, related: dict) -> None:
    paciente_nome = related.get("paciente_nome")
    tutor_nome = related.get("tutor_nome")
    tutor_telefone = related.get("tutor_telefone")
    clinica_nome = related.get("clinica_nome")
    servico_nome = related.get("servico_nome")

    if paciente_nome:
        agendamento.paciente = paciente_nome
    if tutor_nome:
        agendamento.tutor = tutor_nome
    if tutor_telefone:
        agendamento.telefone = tutor_telefone
    if clinica_nome:
        agendamento.clinica = clinica_nome
    if servico_nome:
        agendamento.servico = servico_nome


def _serialize_agendamento(
    agendamento: Agendamento,
    *,
    paciente_nome: Optional[str] = None,
    tutor_nome: Optional[str] = None,
    tutor_telefone: Optional[str] = None,
    clinica_nome: Optional[str] = None,
    servico_nome: Optional[str] = None,
) -> dict:
    inicio_dt = _coerce_datetime(agendamento.inicio)
    fim_dt = _coerce_datetime(agendamento.fim)

    data = agendamento.data
    hora = agendamento.hora
    if inicio_dt is not None:
        if not data:
            data = inicio_dt.strftime("%Y-%m-%d")
        if not hora:
            hora = inicio_dt.strftime("%H:%M")

    return {
        "id": agendamento.id,
        "paciente_id": agendamento.paciente_id,
        "clinica_id": agendamento.clinica_id,
        "servico_id": agendamento.servico_id,
        "inicio": inicio_dt.strftime("%Y-%m-%d %H:%M:%S") if inicio_dt else None,
        "fim": fim_dt.strftime("%Y-%m-%d %H:%M:%S") if fim_dt else None,
        "status": agendamento.status,
        "observacoes": agendamento.observacoes,
        "data": data,
        "hora": hora,
        "paciente": paciente_nome or agendamento.paciente or "Paciente nao informado",
        "tutor": tutor_nome or agendamento.tutor or "Tutor nao informado",
        "telefone": tutor_telefone or agendamento.telefone or "",
        "servico": servico_nome or agendamento.servico or "",
        "clinica": clinica_nome or agendamento.clinica or "Clinica nao informada",
        "criado_por_nome": agendamento.criado_por_nome,
        "confirmado_por_nome": agendamento.confirmado_por_nome,
        "created_at": str(agendamento.created_at) if agendamento.created_at else None,
    }

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
        Paciente.nome.label("paciente_nome"),
        Clinica.nome.label("clinica_nome"),
        Servico.nome.label("servico_nome"),
        Tutor.nome.label("tutor_nome"),
        Tutor.telefone.label("tutor_telefone"),
    ).outerjoin(Paciente, Agendamento.paciente_id == Paciente.id)\
     .outerjoin(Clinica, Agendamento.clinica_id == Clinica.id)\
     .outerjoin(Servico, Agendamento.servico_id == Servico.id)\
     .outerjoin(Tutor, Paciente.tutor_id == Tutor.id)

    # Filtra por coluna data (YYYY-MM-DD) para evitar drift de timezone entre navegador e servidor.
    data_inicio_filtro = _extract_date_filter(data_inicio)
    data_fim_filtro = _extract_date_filter(data_fim)
    if data_inicio_filtro:
        query = query.filter(Agendamento.data >= data_inicio_filtro)
    if data_fim_filtro:
        query = query.filter(Agendamento.data <= data_fim_filtro)
    if status:
        query = query.filter(Agendamento.status == status)
    if clinica_id:
        query = query.filter(Agendamento.clinica_id == clinica_id)
    if paciente_id:
        query = query.filter(Agendamento.paciente_id == paciente_id)

    total = query.count()
    results = query.offset(skip).limit(limit).all()

    items = [
        _serialize_agendamento(
            ag,
            paciente_nome=paciente_nome,
            clinica_nome=clinica_nome,
            servico_nome=servico_nome,
            tutor_nome=tutor_nome,
            tutor_telefone=tutor_telefone,
        )
        for ag, paciente_nome, clinica_nome, servico_nome, tutor_nome, tutor_telefone in results
    ]

    return {"total": total, "items": items}


def _calcular_previsao_agendamento(db: Session, agendamento: Agendamento) -> Decimal:
    if not agendamento.clinica_id or not agendamento.servico_id:
        return Decimal("0.00")

    try:
        return calcular_preco_servico(
            db=db,
            clinica_id=agendamento.clinica_id,
            servico_id=agendamento.servico_id,
            tipo_horario="comercial",
            usar_preco_clinica=True,
        )
    except HTTPException:
        return Decimal("0.00")


@router.get("/resumo-financeiro")
def resumo_financeiro_agenda(
    data: Optional[str] = None,
    data_inicio: Optional[str] = None,
    data_fim: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Resumo financeiro da agenda para admin (realizado x agendado)."""
    if not current_user.tem_papel("admin"):
        raise HTTPException(status_code=403, detail="Apenas administradores podem acessar este resumo.")

    if data:
        inicio = _extract_date_filter(data)
        fim = inicio
    else:
        inicio = _extract_date_filter(data_inicio)
        fim = _extract_date_filter(data_fim)

    if not inicio:
        hoje = datetime.now(LOCAL_TZ).date().isoformat()
        inicio = hoje
    if not fim:
        fim = inicio

    agendamentos = (
        db.query(Agendamento)
        .filter(Agendamento.data >= inicio, Agendamento.data <= fim)
        .all()
    )

    ids_agendamento = [ag.id for ag in agendamentos]
    mapa_os: dict[int, OrdemServico] = {}
    if ids_agendamento:
        ordens = (
            db.query(OrdemServico)
            .filter(
                OrdemServico.agendamento_id.in_(ids_agendamento),
                OrdemServico.status != "Cancelado",
            )
            .order_by(OrdemServico.id.desc())
            .all()
        )
        for os_data in ordens:
            if os_data.agendamento_id not in mapa_os:
                mapa_os[os_data.agendamento_id] = os_data

    valor_realizado = Decimal("0.00")
    valor_agendado = Decimal("0.00")
    qtd_realizados = 0
    qtd_agendados = 0

    for ag in agendamentos:
        os_vinculada = mapa_os.get(ag.id)
        valor_base = (
            Decimal(str(os_vinculada.valor_final))
            if os_vinculada and os_vinculada.valor_final is not None
            else _calcular_previsao_agendamento(db, ag)
        )

        if ag.status == "Realizado":
            qtd_realizados += 1
            valor_realizado += valor_base
        elif ag.status in ("Agendado", "Confirmado", "Em atendimento"):
            qtd_agendados += 1
            valor_agendado += valor_base

    return {
        "data_inicio": inicio,
        "data_fim": fim,
        "qtd_realizados": qtd_realizados,
        "qtd_agendados": qtd_agendados,
        "valor_realizado": float(valor_realizado),
        "valor_agendado": float(valor_agendado),
    }


@router.get("/hoje", response_model=AgendamentoLista)
def agendamentos_hoje(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Lista agendamentos de hoje"""
    hoje_str = datetime.now().strftime("%Y-%m-%d")
    agendamentos = db.query(Agendamento).filter(Agendamento.data == hoje_str).all()
    items = [_serialize_agendamento(agendamento) for agendamento in agendamentos]
    return {"total": len(items), "items": items}

@router.get("/{agendamento_id}", response_model=AgendamentoResponse)
def obter_agendamento(
    agendamento_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Obtem um agendamento especifico"""
    agendamento = db.query(Agendamento).filter(Agendamento.id == agendamento_id).first()
    if not agendamento:
        raise HTTPException(status_code=404, detail="Agendamento nao encontrado")
    related = _fetch_related_names(db, agendamento)
    return _serialize_agendamento(agendamento, **related)

@router.post("", response_model=AgendamentoResponse, status_code=status.HTTP_201_CREATED)
def criar_agendamento(
    agendamento: AgendamentoCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Cria novo agendamento"""
    now = datetime.now()

    db_agendamento = Agendamento(**agendamento.model_dump())
    db_agendamento.inicio = _coerce_datetime(db_agendamento.inicio)
    db_agendamento.fim = _coerce_datetime(db_agendamento.fim)
    db_agendamento.criado_por_id = current_user.id
    db_agendamento.criado_por_nome = current_user.nome
    db_agendamento.criado_em = now
    db_agendamento.created_at = now
    db_agendamento.updated_at = now

    _apply_service_duration_if_needed(db, db_agendamento)
    _fill_data_hora_from_inicio(db_agendamento)
    related = _fetch_related_names(db, db_agendamento)
    _sync_denormalized_fields(db_agendamento, related)

    db.add(db_agendamento)
    db.commit()
    db.refresh(db_agendamento)

    return _serialize_agendamento(db_agendamento, **related)

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

    update_data = agendamento.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_agendamento, field, value)

    if "inicio" in update_data:
        db_agendamento.inicio = _coerce_datetime(db_agendamento.inicio)
    if "fim" in update_data:
        db_agendamento.fim = _coerce_datetime(db_agendamento.fim)

    if "inicio" in update_data or "fim" in update_data or "servico_id" in update_data:
        _apply_service_duration_if_needed(db, db_agendamento)
    if "inicio" in update_data:
        _fill_data_hora_from_inicio(db_agendamento)

    related = _fetch_related_names(db, db_agendamento)
    _sync_denormalized_fields(db_agendamento, related)

    db_agendamento.atualizado_em = datetime.now()
    db_agendamento.updated_at = datetime.now()

    db.commit()
    db.refresh(db_agendamento)

    return _serialize_agendamento(db_agendamento, **related)

@router.patch("/{agendamento_id}/status")
def atualizar_status(
    agendamento_id: int,
    status: str,
    tipo_horario: Optional[str] = "comercial",  # 'comercial' ou 'plantao'
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Atualiza apenas o status do agendamento."""
    from decimal import Decimal
    from app.models.ordem_servico import OrdemServico

    def _gerar_numero_os() -> str:
        mes_ano = datetime.now().strftime("%Y%m")
        ultima_os = (
            db.query(OrdemServico)
            .filter(OrdemServico.numero_os.like(f"OS{mes_ano}%"))
            .order_by(OrdemServico.id.desc())
            .first()
        )

        seq = 1
        if ultima_os and ultima_os.numero_os:
            sufixo = "".join(ch for ch in str(ultima_os.numero_os)[-4:] if ch.isdigit())
            if len(sufixo) == 4:
                seq = int(sufixo) + 1

        while (
            db.query(OrdemServico)
            .filter(OrdemServico.numero_os == f"OS{mes_ano}{seq:04d}")
            .first()
        ):
            seq += 1

        return f"OS{mes_ano}{seq:04d}"

    db_agendamento = db.query(Agendamento).filter(Agendamento.id == agendamento_id).first()
    if not db_agendamento:
        raise HTTPException(status_code=404, detail="Agendamento nao encontrado")

    status_permitidos = ["Agendado", "Confirmado", "Em atendimento", "Realizado", "Cancelado", "Faltou"]
    if status not in status_permitidos:
        raise HTTPException(status_code=400, detail=f"Status invalido. Use: {', '.join(status_permitidos)}")

    status_anterior = db_agendamento.status

    db_agendamento.status = status
    db_agendamento.atualizado_em = datetime.now()
    db_agendamento.updated_at = datetime.now()

    if status == "Confirmado":
        db_agendamento.confirmado_por_id = current_user.id
        db_agendamento.confirmado_por_nome = current_user.nome
        db_agendamento.confirmado_em = datetime.now()

    os_gerada = None
    os_reutilizada = False
    mensagens_adicionais: list[str] = []

    try:
        db.commit()
        db.refresh(db_agendamento)
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(status_code=500, detail="Erro ao atualizar status no banco de dados.")

    if status_anterior == "Realizado" and status == "Em atendimento":
        from app.models.financeiro import Transacao

        try:
            ordens_vinculadas = (
                db.query(OrdemServico)
                .filter(
                    OrdemServico.agendamento_id == agendamento_id,
                    OrdemServico.status != "Cancelado",
                )
                .order_by(OrdemServico.id.desc())
                .all()
            )

            os_removidas: list[str] = []
            transacoes_canceladas = 0
            momento_desfazer = datetime.now()

            for os_data in ordens_vinculadas:
                marker = f"OS_ID={os_data.id};TIPO=RECEBIMENTO_OS"
                transacoes = (
                    db.query(Transacao)
                    .filter(
                        Transacao.tipo == "entrada",
                        Transacao.status.in_(["Recebido", "Pago"]),
                        Transacao.observacoes.like(f"%{marker}%"),
                    )
                    .all()
                )

                if not transacoes and os_data.numero_os:
                    transacoes = (
                        db.query(Transacao)
                        .filter(
                            Transacao.tipo == "entrada",
                            Transacao.status.in_(["Recebido", "Pago"]),
                            Transacao.descricao.like(f"%{os_data.numero_os}%"),
                        )
                        .all()
                    )

                for transacao in transacoes:
                    transacao.status = "Cancelado"
                    transacao.data_pagamento = None
                    transacao.updated_at = momento_desfazer
                    observacao_base = (transacao.observacoes or "").strip()
                    observacao_auto = (
                        f"Cancelada automaticamente ao desfazer realizado do agendamento {agendamento_id}"
                    )
                    transacao.observacoes = (
                        f"{observacao_base} | {observacao_auto}" if observacao_base else observacao_auto
                    )
                    transacoes_canceladas += 1

                os_removidas.append(os_data.numero_os or f"ID {os_data.id}")
                db.delete(os_data)

            db.commit()
            mensagens_adicionais.append("Marcacao de realizado desfeita.")
            if os_removidas:
                mensagens_adicionais.append(
                    f"OS removida(s) automaticamente: {', '.join(os_removidas)}."
                )
            if transacoes_canceladas:
                mensagens_adicionais.append(
                    f"Transacao(oes) de recebimento cancelada(s): {transacoes_canceladas}."
                )
        except SQLAlchemyError:
            db.rollback()
            try:
                agendamento_restaurado = (
                    db.query(Agendamento)
                    .filter(Agendamento.id == agendamento_id)
                    .first()
                )
                if agendamento_restaurado:
                    agendamento_restaurado.status = "Realizado"
                    agendamento_restaurado.atualizado_em = datetime.now()
                    agendamento_restaurado.updated_at = datetime.now()
                    db.commit()
            except SQLAlchemyError:
                db.rollback()
            raise HTTPException(
                status_code=500,
                detail=(
                    "Nao foi possivel desfazer a ordem de servico automaticamente. "
                    "O status foi restaurado para Realizado."
                ),
            )

    # Se status for "Realizado", tenta gerar Ordem de Servico automaticamente.
    if status == "Realizado":
        try:
            os_existente = (
                db.query(OrdemServico)
                .filter(
                    OrdemServico.agendamento_id == agendamento_id,
                    OrdemServico.status != "Cancelado",
                )
                .order_by(OrdemServico.id.desc())
                .first()
            )

            if os_existente:
                os_gerada = {
                    "id": os_existente.id,
                    "numero_os": os_existente.numero_os,
                    "valor_final": float(os_existente.valor_final or 0),
                }
                os_reutilizada = True
            elif not (db_agendamento.paciente_id and db_agendamento.clinica_id and db_agendamento.servico_id):
                mensagens_adicionais.append(
                    "Status atualizado, mas OS nao foi gerada por falta de paciente, clinica ou servico."
                )
            else:
                valor_servico = Decimal("0.00")
                pode_gerar_os = True
                try:
                    valor_servico = calcular_preco_servico(
                        db=db,
                        clinica_id=db_agendamento.clinica_id,
                        servico_id=db_agendamento.servico_id,
                        tipo_horario=tipo_horario or "comercial",
                        usar_preco_clinica=True,
                    )
                except HTTPException as exc:
                    if exc.status_code in (404, 422):
                        mensagens_adicionais.append(
                            f"Status atualizado, mas OS nao foi gerada ({exc.detail})."
                        )
                        pode_gerar_os = False
                    else:
                        raise

                if pode_gerar_os:
                    nova_os = OrdemServico(
                        numero_os=_gerar_numero_os(),
                        agendamento_id=agendamento_id,
                        paciente_id=db_agendamento.paciente_id,
                        clinica_id=db_agendamento.clinica_id,
                        servico_id=db_agendamento.servico_id,
                        data_atendimento=db_agendamento.inicio,
                        tipo_horario=tipo_horario or "comercial",
                        valor_servico=valor_servico,
                        desconto=Decimal("0.00"),
                        valor_final=valor_servico,
                        status="Pendente",
                        observacoes=f"OS gerada automaticamente do agendamento {agendamento_id}",
                        criado_por_id=current_user.id,
                        criado_por_nome=current_user.nome,
                    )
                    db.add(nova_os)
                    db.commit()
                    db.refresh(nova_os)

                    os_gerada = {
                        "id": nova_os.id,
                        "numero_os": nova_os.numero_os,
                        "valor_final": float(nova_os.valor_final),
                    }
        except SQLAlchemyError:
            db.rollback()
            mensagens_adicionais.append("Status atualizado, mas houve erro ao processar a OS.")

    paciente = db.query(Paciente).filter(Paciente.id == db_agendamento.paciente_id).first()
    clinica = db.query(Clinica).filter(Clinica.id == db_agendamento.clinica_id).first() if db_agendamento.clinica_id else None
    servico = db.query(Servico).filter(Servico.id == db_agendamento.servico_id).first() if db_agendamento.servico_id else None

    resposta = {
        "id": db_agendamento.id,
        "status": db_agendamento.status,
        "paciente": paciente.nome if paciente else "",
        "clinica": clinica.nome if clinica else "",
        "servico": servico.nome if servico else "",
        "mensagem": f"Status atualizado para {status}",
    }

    if os_gerada:
        resposta["os_gerada"] = os_gerada
        if os_reutilizada:
            resposta["mensagem"] += f". OS {os_gerada['numero_os']} ja vinculada"
        else:
            resposta["mensagem"] += f". OS {os_gerada['numero_os']} gerada com valor R$ {os_gerada['valor_final']:.2f}"
    if mensagens_adicionais:
        resposta["mensagem"] += ". " + " ".join(mensagens_adicionais)

    return resposta
@router.delete("/{agendamento_id}")
def deletar_agendamento(
    agendamento_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Deleta agendamento (sÃƒÂ³ admin)"""
    from sqlalchemy import text
    papel = db.execute(
        text("SELECT p.nome FROM papeis p JOIN usuario_papel up ON p.id = up.papel_id WHERE up.usuario_id = :uid"),
        {"uid": current_user.id}
    ).fetchone()
    if not papel or papel[0] != "admin":
        raise HTTPException(status_code=403, detail="Apenas administradores podem excluir agendamentos")

    db_agendamento = db.query(Agendamento).filter(Agendamento.id == agendamento_id).first()
    if not db_agendamento:
        raise HTTPException(status_code=404, detail="Agendamento nao encontrado")

    db.delete(db_agendamento)
    db.commit()
    return {"message": "Agendamento deletado com sucesso"}
