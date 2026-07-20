from __future__ import annotations

import json
import unicodedata
import uuid
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta, timezone
from difflib import SequenceMatcher
from typing import Any, Optional
from zoneinfo import ZoneInfo

from fastapi import HTTPException, Request
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.v1.endpoints import agenda
from app.core.config import settings
from app.models.agendamento import Agendamento
from app.models.assistente_ia import AssistenteIAAcaoPendente, AssistenteIAConversa
from app.models.clinica import Clinica
from app.models.financeiro import ContaReceber, Transacao
from app.models.ordem_servico import OrdemServico
from app.models.paciente import Paciente
from app.models.servico import Servico
from app.models.user import User
from app.services.auditoria_service import registrar_auditoria

LOCAL_TZ = ZoneInfo("America/Fortaleza")
ACTIVE_APPOINTMENT_STATUSES = {
    "Agendado",
    "Reservado",
    "Confirmado",
    "Em atendimento",
    "Realizado",
    "Faltou",
}


@dataclass(slots=True)
class AssistenteIAToolContext:
    db: Session
    current_user: User
    conversa: AssistenteIAConversa
    request: Optional[Request] = None


def _json_dumps(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, default=str)


def _json_loads(value: Optional[str], fallback: Any) -> Any:
    if not value:
        return fallback
    try:
        return json.loads(value)
    except (TypeError, ValueError):
        return fallback


def _normalize_text(value: Any) -> str:
    raw = str(value or "").strip().lower()
    normalized = unicodedata.normalize("NFKD", raw)
    without_accents = "".join(char for char in normalized if not unicodedata.combining(char))
    return " ".join(without_accents.replace("-", " ").replace("_", " ").split())


def _resolve_named_record(
    db: Session,
    model: Any,
    requested_name: str,
    *,
    entity_label: str,
) -> tuple[Any | None, dict[str, Any] | None]:
    normalized_request = _normalize_text(requested_name)
    if not normalized_request:
        return None, {
            "ok": False,
            "error": f"Informe o nome de {entity_label}.",
        }

    query = db.query(model)
    if hasattr(model, "ativo"):
        query = query.filter(model.ativo.in_([True, 1]))
    records = query.order_by(model.nome.asc()).all()
    names = [(record, _normalize_text(getattr(record, "nome", ""))) for record in records]

    exact = [record for record, name in names if name == normalized_request]
    if len(exact) == 1:
        return exact[0], None

    contains = [
        record
        for record, name in names
        if normalized_request in name or name in normalized_request
    ]
    if len(contains) == 1:
        return contains[0], None

    request_tokens = set(normalized_request.split())
    token_matches = [
        record
        for record, name in names
        if request_tokens and request_tokens.issubset(set(name.split()))
    ]
    if len(token_matches) == 1:
        return token_matches[0], None

    ambiguous = exact or contains or token_matches
    if len(ambiguous) > 1:
        return None, {
            "ok": False,
            "error": f"Nome de {entity_label} ambiguo.",
            "matches": [
                {"id": int(record.id), "nome": str(record.nome)}
                for record in ambiguous[:8]
            ],
        }

    ranked = sorted(
        (
            (SequenceMatcher(None, normalized_request, name).ratio(), record)
            for record, name in names
        ),
        key=lambda item: item[0],
        reverse=True,
    )
    suggestions = [
        {"id": int(record.id), "nome": str(record.nome)}
        for score, record in ranked[:5]
        if score >= 0.35
    ]
    return None, {
        "ok": False,
        "error": f"{entity_label.capitalize()} nao encontrada.",
        "matches": suggestions,
    }


def _parse_iso_date(value: Optional[str], *, default: Optional[date] = None) -> date:
    raw = str(value or "").strip()
    if not raw and default is not None:
        return default
    try:
        return date.fromisoformat(raw)
    except ValueError as exc:
        raise ValueError("Data invalida. Use YYYY-MM-DD.") from exc


def _parse_hhmm(value: Optional[str]) -> Optional[time]:
    raw = str(value or "").strip()
    if not raw:
        return None
    for pattern in ("%H:%M", "%Hh%M", "%Hh"):
        try:
            return datetime.strptime(raw, pattern).time().replace(second=0, microsecond=0)
        except ValueError:
            continue
    raise ValueError("Horario invalido. Use HH:MM.")


def _as_local_datetime(value: Optional[datetime]) -> Optional[datetime]:
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=LOCAL_TZ)
    return value.astimezone(LOCAL_TZ)


def _as_utc_datetime(value: Optional[datetime]) -> Optional[datetime]:
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _first_day_shifted(reference: date, month_delta: int) -> date:
    absolute_month = (reference.year * 12 + reference.month - 1) + month_delta
    year, month_zero = divmod(absolute_month, 12)
    return date(year, month_zero + 1, 1)


def analisar_faturamento(
    ctx: AssistenteIAToolContext,
    *,
    meses: int,
    clinica: Optional[str],
) -> dict[str, Any]:
    meses = max(2, min(24, int(meses or 5)))
    clinica_obj: Optional[Clinica] = None
    if str(clinica or "").strip():
        clinica_obj, error = _resolve_named_record(
            ctx.db,
            Clinica,
            str(clinica),
            entity_label="clinica",
        )
        if error:
            return error

    hoje = datetime.now(LOCAL_TZ).date()
    primeiro_mes = _first_day_shifted(hoje.replace(day=1), -(meses - 1))
    series: list[dict[str, Any]] = []

    for offset in range(meses):
        inicio = _first_day_shifted(primeiro_mes, offset)
        proximo = _first_day_shifted(inicio, 1)
        fim = min(hoje, proximo - timedelta(days=1))
        filtros = [
            Transacao.tipo == "entrada",
            Transacao.status.in_(["Recebido", "Pago"]),
            func.date(Transacao.data_transacao) >= inicio.isoformat(),
            func.date(Transacao.data_transacao) < proximo.isoformat(),
        ]
        if clinica_obj is not None:
            filtros.append(Transacao.clinica_id == clinica_obj.id)

        total, quantidade, taxas = (
            ctx.db.query(
                func.coalesce(func.sum(Transacao.valor_final), 0),
                func.count(Transacao.id),
                func.coalesce(func.sum(Transacao.valor_taxa), 0),
            )
            .filter(*filtros)
            .one()
        )
        total_float = round(float(total or 0), 2)
        taxas_float = round(float(taxas or 0), 2)
        item = {
            "competencia": inicio.strftime("%Y-%m"),
            "inicio": inicio.isoformat(),
            "fim": fim.isoformat(),
            "parcial": inicio.year == hoje.year and inicio.month == hoje.month,
            "faturamento_liquido": total_float,
            "taxas": taxas_float,
            "recebimentos": int(quantidade or 0),
            "ticket_medio": round(total_float / int(quantidade), 2) if quantidade else 0.0,
            "variacao_percentual": None,
        }
        if series and float(series[-1]["faturamento_liquido"]) != 0:
            previous = float(series[-1]["faturamento_liquido"])
            item["variacao_percentual"] = round(((total_float - previous) / previous) * 100, 2)
        series.append(item)

    total_periodo = round(sum(float(item["faturamento_liquido"]) for item in series), 2)
    values = [float(item["faturamento_liquido"]) for item in series]
    best = max(series, key=lambda item: float(item["faturamento_liquido"])) if series else None
    worst = min(series, key=lambda item: float(item["faturamento_liquido"])) if series else None
    crescimento = None
    if len(values) >= 2 and values[0] != 0:
        crescimento = round(((values[-1] - values[0]) / values[0]) * 100, 2)

    return {
        "ok": True,
        "fonte": "transacoes recebidas do modulo financeiro",
        "clinica": (
            {"id": int(clinica_obj.id), "nome": str(clinica_obj.nome)}
            if clinica_obj is not None
            else None
        ),
        "periodo": {
            "meses": meses,
            "inicio": primeiro_mes.isoformat(),
            "fim": hoje.isoformat(),
            "mes_atual_parcial": True,
        },
        "resumo": {
            "faturamento_total": total_periodo,
            "media_mensal": round(total_periodo / meses, 2),
            "crescimento_primeiro_ultimo_percentual": crescimento,
            "melhor_mes": best,
            "menor_mes": worst,
        },
        "serie_mensal": series,
    }


def localizar_agendamentos(
    ctx: AssistenteIAToolContext,
    *,
    data: str,
    horario: Optional[str],
    clinica: Optional[str],
    servico: Optional[str],
) -> dict[str, Any]:
    try:
        data_ref = _parse_iso_date(data)
        horario_ref = _parse_hhmm(horario)
    except ValueError as exc:
        return {"ok": False, "error": str(exc)}

    clinica_obj: Optional[Clinica] = None
    servico_obj: Optional[Servico] = None
    if str(clinica or "").strip():
        clinica_obj, error = _resolve_named_record(
            ctx.db,
            Clinica,
            str(clinica),
            entity_label="clinica",
        )
        if error:
            return error
    if str(servico or "").strip():
        servico_obj, error = _resolve_named_record(
            ctx.db,
            Servico,
            str(servico),
            entity_label="servico",
        )
        if error:
            return error

    query = ctx.db.query(Agendamento).filter(
        func.date(Agendamento.inicio) == data_ref.isoformat(),
        Agendamento.status.in_(sorted(ACTIVE_APPOINTMENT_STATUSES)),
    )
    if clinica_obj is not None:
        query = query.filter(Agendamento.clinica_id == clinica_obj.id)
    if servico_obj is not None:
        query = query.filter(Agendamento.servico_id == servico_obj.id)
    appointments = query.order_by(Agendamento.inicio.asc(), Agendamento.id.asc()).limit(100).all()

    if horario_ref is not None:
        appointments = [
            item
            for item in appointments
            if (_as_local_datetime(item.inicio) or datetime.min.replace(tzinfo=LOCAL_TZ)).time().replace(
                second=0,
                microsecond=0,
            )
            == horario_ref
        ]

    clinic_ids = {int(item.clinica_id) for item in appointments if item.clinica_id}
    service_ids = {int(item.servico_id) for item in appointments if item.servico_id}
    patient_ids = {int(item.paciente_id) for item in appointments if item.paciente_id}
    clinic_map = {
        int(item.id): str(item.nome)
        for item in ctx.db.query(Clinica).filter(Clinica.id.in_(clinic_ids)).all()
    } if clinic_ids else {}
    service_map = {
        int(item.id): str(item.nome)
        for item in ctx.db.query(Servico).filter(Servico.id.in_(service_ids)).all()
    } if service_ids else {}
    patient_map = {
        int(item.id): str(item.nome or "").strip().split()[0]
        for item in ctx.db.query(Paciente).filter(Paciente.id.in_(patient_ids)).all()
    } if patient_ids else {}

    matches = []
    for item in appointments[:20]:
        inicio = _as_local_datetime(item.inicio)
        fim = _as_local_datetime(item.fim)
        matches.append(
            {
                "agendamento_id": int(item.id),
                "inicio": inicio.isoformat() if inicio else None,
                "fim": fim.isoformat() if fim else None,
                "horario": inicio.strftime("%H:%M") if inicio else str(item.hora or ""),
                "status": str(item.status or ""),
                "clinica": {
                    "id": int(item.clinica_id) if item.clinica_id else None,
                    "nome": clinic_map.get(int(item.clinica_id)) if item.clinica_id else str(item.clinica or ""),
                },
                "servico": {
                    "id": int(item.servico_id) if item.servico_id else None,
                    "nome": service_map.get(int(item.servico_id)) if item.servico_id else str(item.servico or ""),
                },
                "paciente_primeiro_nome": (
                    patient_map.get(int(item.paciente_id))
                    if item.paciente_id
                    else str(item.paciente or "").strip().split()[0] if str(item.paciente or "").strip() else None
                ),
            }
        )

    return {
        "ok": True,
        "data": data_ref.isoformat(),
        "horario": horario_ref.strftime("%H:%M") if horario_ref else None,
        "total": len(appointments),
        "matches": matches,
        "truncado": len(appointments) > len(matches),
        "orientacao": (
            "Ha mais de um candidato. Solicite desambiguacao antes de preparar qualquer exclusao."
            if len(appointments) > 1
            else "Use o agendamento_id retornado para preparar uma acao, se solicitado."
        ),
    }


def verificar_disponibilidade(
    ctx: AssistenteIAToolContext,
    *,
    clinica: str,
    servico: str,
    data_inicio: Optional[str],
    dias: int,
) -> dict[str, Any]:
    clinica_obj, error = _resolve_named_record(
        ctx.db,
        Clinica,
        clinica,
        entity_label="clinica",
    )
    if error:
        return error
    servico_obj, error = _resolve_named_record(
        ctx.db,
        Servico,
        servico,
        entity_label="servico",
    )
    if error:
        return error

    try:
        inicio = _parse_iso_date(data_inicio, default=datetime.now(LOCAL_TZ).date())
    except ValueError as exc:
        return {"ok": False, "error": str(exc)}
    hoje = datetime.now(LOCAL_TZ).date()
    if inicio < hoje:
        inicio = hoje
    dias = max(1, min(14, int(dias or 7)))

    slots: list[dict[str, Any]] = []
    dias_consultados: list[dict[str, Any]] = []
    for offset in range(dias):
        data_ref = inicio + timedelta(days=offset)
        payload = agenda.SugestaoHorarioPayload(
            data=data_ref.isoformat(),
            origem_atendimento="clinica_parceira",
            clinica_id=int(clinica_obj.id),
            servico_id=int(servico_obj.id),
            duracao_minutos=int(servico_obj.duracao_minutos or 30),
            intervalo_minutos=30,
            limite=6,
            perfil_deslocamento="comercial",
        )
        try:
            result = agenda.sugerir_horarios_agenda(
                payload=payload,
                db=ctx.db,
                current_user=ctx.current_user,
            )
        except HTTPException as exc:
            dias_consultados.append(
                {
                    "data": data_ref.isoformat(),
                    "total": 0,
                    "motivo": str(exc.detail),
                }
            )
            continue

        day_items = result.get("items") if isinstance(result, dict) else []
        day_items = day_items if isinstance(day_items, list) else []
        dias_consultados.append(
            {
                "data": data_ref.isoformat(),
                "total": len(day_items),
                "motivo": str(result.get("motivo") or "") if isinstance(result, dict) else "",
            }
        )
        for item in day_items[:4]:
            if not isinstance(item, dict):
                continue
            slots.append(
                {
                    "inicio": item.get("inicio"),
                    "fim": item.get("fim"),
                    "risco": item.get("risco"),
                    "score_operacional": item.get("score"),
                    "deslocamento_total_min": item.get("tempo_deslocamento_total_min"),
                    "destino": item.get("destino_operacional"),
                }
            )
            if len(slots) >= 12:
                break
        if len(slots) >= 12:
            break

    return {
        "ok": True,
        "clinica": {"id": int(clinica_obj.id), "nome": str(clinica_obj.nome)},
        "servico": {
            "id": int(servico_obj.id),
            "nome": str(servico_obj.nome),
            "duracao_minutos": int(servico_obj.duracao_minutos or 30),
        },
        "periodo": {
            "inicio": inicio.isoformat(),
            "dias_solicitados": dias,
        },
        "slots": slots,
        "dias_consultados": dias_consultados,
        "dados_pessoais_incluidos": False,
        "orientacao": "Os slots sao candidatos operacionais e devem ser confirmados novamente antes de criar um agendamento.",
    }


def relatorio_debitos_pendentes(
    ctx: AssistenteIAToolContext,
    *,
    clinica: str,
    somente_vencidos: bool,
) -> dict[str, Any]:
    clinica_obj, error = _resolve_named_record(
        ctx.db,
        Clinica,
        clinica,
        entity_label="clinica",
    )
    if error:
        return error

    hoje = datetime.now(LOCAL_TZ).date()
    os_query = ctx.db.query(OrdemServico).filter(
        OrdemServico.clinica_id == clinica_obj.id,
        OrdemServico.status == "Pendente",
    )
    if somente_vencidos:
        os_query = os_query.filter(func.date(OrdemServico.data_atendimento) <= hoje.isoformat())
    orders = os_query.order_by(OrdemServico.data_atendimento.asc(), OrdemServico.id.asc()).limit(200).all()

    service_ids = {int(item.servico_id) for item in orders if item.servico_id}
    service_map = {
        int(item.id): str(item.nome)
        for item in ctx.db.query(Servico).filter(Servico.id.in_(service_ids)).all()
    } if service_ids else {}
    order_items: list[dict[str, Any]] = []
    for item in orders:
        atendimento = _as_local_datetime(item.data_atendimento)
        atendimento_data = atendimento.date() if atendimento else None
        order_items.append(
            {
                "ordem_servico_id": int(item.id),
                "numero_os": str(item.numero_os),
                "data_atendimento": atendimento_data.isoformat() if atendimento_data else None,
                "dias_pendente": max(0, (hoje - atendimento_data).days) if atendimento_data else None,
                "servico": service_map.get(int(item.servico_id), f"Servico #{item.servico_id}"),
                "valor": round(float(item.valor_final or 0), 2),
            }
        )

    account_query = ctx.db.query(ContaReceber).filter(
        ContaReceber.clinica_id == clinica_obj.id,
        ContaReceber.status.in_(["Pendente", "Atrasado"]),
    )
    if somente_vencidos:
        account_query = account_query.filter(func.date(ContaReceber.data_vencimento) < hoje.isoformat())
    accounts = account_query.order_by(ContaReceber.data_vencimento.asc(), ContaReceber.id.asc()).limit(200).all()
    account_items: list[dict[str, Any]] = []
    for item in accounts:
        due = _as_local_datetime(item.data_vencimento)
        due_date = due.date() if due else None
        account_items.append(
            {
                "conta_receber_id": int(item.id),
                "descricao": str(item.descricao or ""),
                "cliente": str(item.cliente or "") or None,
                "vencimento": due_date.isoformat() if due_date else None,
                "dias_em_atraso": max(0, (hoje - due_date).days) if due_date else None,
                "status": str(item.status or "Pendente"),
                "valor": round(float(item.valor or 0), 2),
            }
        )

    total_orders = round(sum(float(item["valor"]) for item in order_items), 2)
    total_accounts = round(sum(float(item["valor"]) for item in account_items), 2)
    return {
        "ok": True,
        "clinica": {"id": int(clinica_obj.id), "nome": str(clinica_obj.nome)},
        "data_referencia": hoje.isoformat(),
        "somente_vencidos": bool(somente_vencidos),
        "ordens_servico_pendentes": {
            "quantidade": len(order_items),
            "total": total_orders,
            "items": order_items[:100],
            "truncado": len(order_items) > 100,
        },
        "contas_receber_pendentes": {
            "quantidade": len(account_items),
            "total": total_accounts,
            "items": account_items[:100],
            "truncado": len(account_items) > 100,
        },
        "total_estimado_sem_deduplicacao": round(total_orders + total_accounts, 2),
        "aviso": "Ordens de servico e contas a receber sao fontes separadas e podem representar o mesmo debito; apresente os subtotais antes do total estimado.",
    }


def _appointment_snapshot(db: Session, appointment: Agendamento) -> dict[str, Any]:
    clinic = db.query(Clinica).filter(Clinica.id == appointment.clinica_id).first() if appointment.clinica_id else None
    service = db.query(Servico).filter(Servico.id == appointment.servico_id).first() if appointment.servico_id else None
    patient = db.query(Paciente).filter(Paciente.id == appointment.paciente_id).first() if appointment.paciente_id else None
    inicio = _as_local_datetime(appointment.inicio)
    fim = _as_local_datetime(appointment.fim)
    return {
        "agendamento_id": int(appointment.id),
        "inicio": inicio.isoformat() if inicio else None,
        "fim": fim.isoformat() if fim else None,
        "status": str(appointment.status or ""),
        "clinica_id": int(appointment.clinica_id) if appointment.clinica_id else None,
        "clinica_nome": str(clinic.nome) if clinic else str(appointment.clinica or ""),
        "servico_id": int(appointment.servico_id) if appointment.servico_id else None,
        "servico_nome": str(service.nome) if service else str(appointment.servico or ""),
        "paciente_primeiro_nome": (
            str(patient.nome or "").strip().split()[0]
            if patient and str(patient.nome or "").strip()
            else str(appointment.paciente or "").strip().split()[0]
            if str(appointment.paciente or "").strip()
            else None
        ),
    }


def _snapshot_fingerprint(snapshot: dict[str, Any]) -> tuple[Any, ...]:
    return (
        snapshot.get("agendamento_id"),
        snapshot.get("inicio"),
        snapshot.get("fim"),
        snapshot.get("status"),
        snapshot.get("clinica_id"),
        snapshot.get("servico_id"),
    )


def solicitar_exclusao_agendamento(
    ctx: AssistenteIAToolContext,
    *,
    agendamento_id: int,
    motivo: str,
) -> dict[str, Any]:
    if not ctx.current_user.tem_papel("admin"):
        return {"ok": False, "error": "Apenas administradores podem preparar exclusoes."}
    motivo = str(motivo or "").strip()
    if len(motivo) < 5:
        return {"ok": False, "error": "Informe um motivo claro para a exclusao."}

    appointment = ctx.db.query(Agendamento).filter(Agendamento.id == int(agendamento_id)).first()
    if appointment is None:
        return {"ok": False, "error": "Agendamento nao encontrado."}

    now_utc = datetime.now(timezone.utc)
    existing = (
        ctx.db.query(AssistenteIAAcaoPendente)
        .filter(
            AssistenteIAAcaoPendente.usuario_id == ctx.current_user.id,
            AssistenteIAAcaoPendente.conversa_id == ctx.conversa.id,
            AssistenteIAAcaoPendente.tipo_acao == "delete_appointment",
            AssistenteIAAcaoPendente.status == "pending",
        )
        .order_by(AssistenteIAAcaoPendente.created_at.desc())
        .all()
    )
    for action in existing:
        args = _json_loads(action.argumentos_json, {})
        expires_at = _as_utc_datetime(action.expires_at)
        if int(args.get("agendamento_id") or 0) == int(agendamento_id) and expires_at and expires_at > now_utc:
            return {
                "ok": True,
                "requires_approval": True,
                "pending_action": serialize_pending_action(action),
                "message": "Esta exclusao ja esta aguardando confirmacao do administrador.",
            }

    snapshot = _appointment_snapshot(ctx.db, appointment)
    action = AssistenteIAAcaoPendente(
        id=str(uuid.uuid4()),
        conversa_id=ctx.conversa.id,
        usuario_id=int(ctx.current_user.id),
        tipo_acao="delete_appointment",
        argumentos_json=_json_dumps(
            {
                "agendamento_id": int(agendamento_id),
                "motivo": motivo,
            }
        ),
        alvo_snapshot_json=_json_dumps(snapshot),
        status="pending",
        expires_at=now_utc + timedelta(minutes=max(5, int(settings.ASSISTENTE_IA_ACTION_TTL_MINUTES))),
    )
    ctx.db.add(action)
    ctx.db.commit()
    ctx.db.refresh(action)

    registrar_auditoria(
        current_user=ctx.current_user,
        modulo="assistente_ia",
        entidade="agendamento",
        entidade_id=agendamento_id,
        acao="ASSISTENTE_IA_EXCLUSAO_SOLICITADA",
        descricao="Assistente IA preparou exclusao de agendamento para confirmacao do admin.",
        detalhes={
            "acao_pendente_id": action.id,
            "motivo": motivo,
            "snapshot": snapshot,
        },
        request=ctx.request,
    )
    return {
        "ok": True,
        "requires_approval": True,
        "pending_action": serialize_pending_action(action),
        "message": "A exclusao foi apenas preparada. O agendamento continua intacto ate a confirmacao explicita.",
    }


def serialize_pending_action(action: AssistenteIAAcaoPendente) -> dict[str, Any]:
    return {
        "id": str(action.id),
        "conversation_id": str(action.conversa_id),
        "type": str(action.tipo_acao),
        "status": str(action.status),
        "arguments": _json_loads(action.argumentos_json, {}),
        "target": _json_loads(action.alvo_snapshot_json, {}),
        "result": _json_loads(action.resultado_json, None),
        "expires_at": action.expires_at.isoformat() if action.expires_at else None,
        "decided_at": action.decided_at.isoformat() if action.decided_at else None,
        "executed_at": action.executed_at.isoformat() if action.executed_at else None,
        "created_at": action.created_at.isoformat() if action.created_at else None,
    }


def decide_pending_action(
    *,
    db: Session,
    current_user: User,
    request: Optional[Request],
    action_id: str,
    decision: str,
    observation: Optional[str] = None,
) -> dict[str, Any]:
    action = (
        db.query(AssistenteIAAcaoPendente)
        .filter(
            AssistenteIAAcaoPendente.id == action_id,
            AssistenteIAAcaoPendente.usuario_id == current_user.id,
        )
        .with_for_update()
        .first()
    )
    if action is None:
        raise HTTPException(status_code=404, detail="Acao pendente nao encontrada.")
    if action.status != "pending":
        raise HTTPException(status_code=409, detail="Esta acao ja foi decidida ou processada.")

    now_utc = datetime.now(timezone.utc)
    expires_at = _as_utc_datetime(action.expires_at)
    if expires_at is None or expires_at <= now_utc:
        action.status = "expired"
        action.decided_at = now_utc
        action.resultado_json = _json_dumps({"ok": False, "reason": "approval_expired"})
        db.commit()
        raise HTTPException(status_code=409, detail="A confirmacao expirou. Solicite a acao novamente.")

    if decision == "reject":
        action.status = "rejected"
        action.decided_at = now_utc
        action.resultado_json = _json_dumps(
            {"ok": True, "decision": "rejected", "observation": str(observation or "").strip() or None}
        )
        db.commit()
        db.refresh(action)
        registrar_auditoria(
            current_user=current_user,
            modulo="assistente_ia",
            entidade="acao_pendente",
            entidade_id=action.id,
            acao="ASSISTENTE_IA_ACAO_REJEITADA",
            descricao="Administrador rejeitou acao preparada pela IA.",
            detalhes={"tipo_acao": action.tipo_acao, "observacao": observation},
            request=request,
        )
        return serialize_pending_action(action)

    if decision != "approve":
        raise HTTPException(status_code=422, detail="Decisao invalida.")
    if action.tipo_acao != "delete_appointment":
        raise HTTPException(status_code=422, detail="Tipo de acao ainda nao suportado.")

    arguments = _json_loads(action.argumentos_json, {})
    snapshot = _json_loads(action.alvo_snapshot_json, {})
    appointment_id = int(arguments.get("agendamento_id") or 0)
    appointment = db.query(Agendamento).filter(Agendamento.id == appointment_id).first()
    if appointment is None:
        action.status = "invalidated"
        action.decided_at = now_utc
        action.resultado_json = _json_dumps({"ok": False, "reason": "target_missing"})
        db.commit()
        raise HTTPException(status_code=409, detail="O agendamento nao existe mais; a acao foi invalidada.")

    current_snapshot = _appointment_snapshot(db, appointment)
    if _snapshot_fingerprint(current_snapshot) != _snapshot_fingerprint(snapshot):
        action.status = "invalidated"
        action.decided_at = now_utc
        action.resultado_json = _json_dumps(
            {
                "ok": False,
                "reason": "target_changed",
                "current_snapshot": current_snapshot,
            }
        )
        db.commit()
        raise HTTPException(
            status_code=409,
            detail="O agendamento mudou depois da solicitacao. Revise os dados e solicite novamente.",
        )

    agenda.deletar_agendamento(
        agendamento_id=appointment_id,
        request=request,
        db=db,
        current_user=current_user,
    )
    action.status = "executed"
    action.decided_at = now_utc
    action.executed_at = now_utc
    action.resultado_json = _json_dumps(
        {
            "ok": True,
            "decision": "approved",
            "message": "Agendamento excluido com sucesso.",
            "observation": str(observation or "").strip() or None,
        }
    )
    db.add(action)
    db.commit()
    db.refresh(action)
    registrar_auditoria(
        current_user=current_user,
        modulo="assistente_ia",
        entidade="acao_pendente",
        entidade_id=action.id,
        acao="ASSISTENTE_IA_ACAO_EXECUTADA",
        descricao="Administrador aprovou e executou acao preparada pela IA.",
        detalhes={
            "tipo_acao": action.tipo_acao,
            "agendamento_id": appointment_id,
            "observacao": observation,
        },
        request=request,
    )
    return serialize_pending_action(action)


TOOL_DEFINITIONS: list[dict[str, Any]] = [
    {
        "type": "function",
        "name": "analisar_faturamento",
        "description": "Analisa faturamento recebido por mes. Use para dinamica, tendencia, crescimento e comparacao financeira. O mes atual e parcial.",
        "parameters": {
            "type": "object",
            "properties": {
                "meses": {"type": "integer", "minimum": 2, "maximum": 24},
                "clinica": {
                    "type": ["string", "null"],
                    "description": "Nome da clinica ou null para toda a FortCordis.",
                },
            },
            "required": ["meses", "clinica"],
            "additionalProperties": False,
        },
        "strict": True,
    },
    {
        "type": "function",
        "name": "localizar_agendamentos",
        "description": "Localiza agendamentos ativos por data, horario, clinica e servico. Use antes de qualquer pedido de exclusao. Se houver mais de um resultado, peca desambiguacao.",
        "parameters": {
            "type": "object",
            "properties": {
                "data": {"type": "string", "description": "Data YYYY-MM-DD."},
                "horario": {"type": ["string", "null"], "description": "Horario HH:MM ou null."},
                "clinica": {"type": ["string", "null"]},
                "servico": {"type": ["string", "null"]},
            },
            "required": ["data", "horario", "clinica", "servico"],
            "additionalProperties": False,
        },
        "strict": True,
    },
    {
        "type": "function",
        "name": "verificar_disponibilidade",
        "description": "Consulta slots futuros com as regras reais de agenda, duracao e deslocamento. Nao cria nem reserva horario.",
        "parameters": {
            "type": "object",
            "properties": {
                "clinica": {"type": "string"},
                "servico": {"type": "string"},
                "data_inicio": {"type": ["string", "null"], "description": "Data YYYY-MM-DD ou null para hoje."},
                "dias": {"type": "integer", "minimum": 1, "maximum": 14},
            },
            "required": ["clinica", "servico", "data_inicio", "dias"],
            "additionalProperties": False,
        },
        "strict": True,
    },
    {
        "type": "function",
        "name": "relatorio_debitos_pendentes",
        "description": "Gera relatorio de ordens de servico e contas a receber pendentes de uma clinica. As fontes sao separadas para evitar conclusoes incorretas.",
        "parameters": {
            "type": "object",
            "properties": {
                "clinica": {"type": "string"},
                "somente_vencidos": {"type": "boolean"},
            },
            "required": ["clinica", "somente_vencidos"],
            "additionalProperties": False,
        },
        "strict": True,
    },
    {
        "type": "function",
        "name": "solicitar_exclusao_agendamento",
        "description": "Prepara a exclusao de um agendamento ja identificado. Esta ferramenta nunca exclui: cria uma acao pendente para confirmacao explicita do admin.",
        "parameters": {
            "type": "object",
            "properties": {
                "agendamento_id": {"type": "integer", "minimum": 1},
                "motivo": {"type": "string", "minLength": 5, "maxLength": 500},
            },
            "required": ["agendamento_id", "motivo"],
            "additionalProperties": False,
        },
        "strict": True,
    },
]


def execute_tool(
    ctx: AssistenteIAToolContext,
    *,
    name: str,
    arguments: dict[str, Any],
) -> dict[str, Any]:
    if name == "analisar_faturamento":
        return analisar_faturamento(ctx, meses=arguments["meses"], clinica=arguments.get("clinica"))
    if name == "localizar_agendamentos":
        return localizar_agendamentos(
            ctx,
            data=arguments["data"],
            horario=arguments.get("horario"),
            clinica=arguments.get("clinica"),
            servico=arguments.get("servico"),
        )
    if name == "verificar_disponibilidade":
        return verificar_disponibilidade(
            ctx,
            clinica=arguments["clinica"],
            servico=arguments["servico"],
            data_inicio=arguments.get("data_inicio"),
            dias=arguments["dias"],
        )
    if name == "relatorio_debitos_pendentes":
        return relatorio_debitos_pendentes(
            ctx,
            clinica=arguments["clinica"],
            somente_vencidos=bool(arguments["somente_vencidos"]),
        )
    if name == "solicitar_exclusao_agendamento":
        return solicitar_exclusao_agendamento(
            ctx,
            agendamento_id=int(arguments["agendamento_id"]),
            motivo=arguments["motivo"],
        )
    return {"ok": False, "error": f"Ferramenta desconhecida: {name}"}


def tool_result_summary(name: str, result: dict[str, Any]) -> str:
    if not bool(result.get("ok")):
        return str(result.get("error") or "Falha na ferramenta")[:180]
    if name == "analisar_faturamento":
        return f"{result.get('periodo', {}).get('meses', 0)} meses analisados"
    if name == "localizar_agendamentos":
        return f"{result.get('total', 0)} agendamento(s) localizado(s)"
    if name == "verificar_disponibilidade":
        return f"{len(result.get('slots') or [])} slot(s) candidato(s)"
    if name == "relatorio_debitos_pendentes":
        orders = result.get("ordens_servico_pendentes") or {}
        accounts = result.get("contas_receber_pendentes") or {}
        return f"{orders.get('quantidade', 0)} OS e {accounts.get('quantidade', 0)} conta(s) pendente(s)"
    if name == "solicitar_exclusao_agendamento":
        return "Aguardando confirmacao do administrador"
    return "Ferramenta executada"
