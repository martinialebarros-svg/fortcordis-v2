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
from app.models.tutor import Tutor
from app.models.user import User
from app.schemas.agendamento import AgendamentoCreate
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
    filters: Optional[list[Any]] = None,
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
    if filters:
        query = query.filter(*filters)
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


def _record_version(record: Any | None) -> dict[str, Any] | None:
    if record is None:
        return None
    updated_at = getattr(record, "updated_at", None)
    return {
        "id": int(record.id),
        "updated_at": updated_at.isoformat() if isinstance(updated_at, datetime) else str(updated_at or ""),
    }


def _contact_numbers(*values: Any) -> list[str]:
    numbers: list[str] = []
    seen: set[str] = set()
    for value in values:
        candidates = value if isinstance(value, list) else [value]
        for candidate in candidates:
            raw = str(candidate or "").strip()
            digits = "".join(char for char in raw if char.isdigit())
            key = digits or raw
            if not raw or not key or key in seen:
                continue
            seen.add(key)
            numbers.append(raw)
    return numbers[:10]


def _resolve_patient_record(
    db: Session,
    requested_name: str,
    *,
    tutor: Optional[Tutor],
) -> tuple[Paciente | None, dict[str, Any] | None]:
    filters = [Paciente.tutor_id == tutor.id] if tutor is not None else None
    patient, error = _resolve_named_record(
        db,
        Paciente,
        requested_name,
        entity_label="paciente",
        filters=filters,
    )
    if not error or not isinstance(error.get("matches"), list):
        return patient, error

    patient_ids = [int(item.get("id") or 0) for item in error["matches"] if int(item.get("id") or 0) > 0]
    rows = db.query(Paciente).filter(Paciente.id.in_(patient_ids)).all() if patient_ids else []
    tutor_ids = {int(row.tutor_id) for row in rows if row.tutor_id}
    tutor_map = {
        int(row.id): str(row.nome or "")
        for row in db.query(Tutor).filter(Tutor.id.in_(tutor_ids)).all()
    } if tutor_ids else {}
    by_id = {int(row.id): row for row in rows}
    enriched = []
    for item in error["matches"]:
        row = by_id.get(int(item.get("id") or 0))
        enriched.append(
            {
                **item,
                "tutor": tutor_map.get(int(row.tutor_id)) if row is not None and row.tutor_id else None,
            }
        )
    return patient, {**error, "matches": enriched}


def _build_appointment_candidate(
    *,
    clinic: Optional[Clinica],
    service: Servico,
    patient: Optional[Paciente],
    tutor: Optional[Tutor],
    appointment_type: str,
    origin: str,
    start: datetime,
    reservation_expires_at: Optional[datetime],
    notes: Optional[str],
) -> Agendamento:
    return Agendamento(
        paciente_id=int(patient.id) if patient is not None else None,
        tutor_id=int(tutor.id) if tutor is not None else None,
        clinica_id=int(clinic.id) if clinic is not None else None,
        servico_id=int(service.id),
        origem_atendimento=origin,
        inicio=start,
        fim=start + timedelta(minutes=max(5, int(service.duracao_minutos or 30))),
        status="Reservado" if appointment_type == "reserva" else "Agendado",
        reserva_expira_em=reservation_expires_at,
        observacoes=str(notes or "").strip() or None,
    )


def _validate_appointment_candidate(db: Session, candidate: Agendamento) -> None:
    agenda._validar_regras_origem_agendamento(db, candidate, contexto="preparar o agendamento pela Mente FortCordis")
    agenda._apply_service_duration_if_needed(db, candidate, force_from_service=True)
    agenda._validar_prazo_reserva(candidate)
    agenda._validar_agendamento_no_funcionamento(db, candidate)
    agenda._validar_slot_disponivel(db, candidate)
    agenda._validar_deslocamento_agendamento(
        db,
        candidate,
        confirmar_conflito_deslocamento=False,
    )
    related = agenda._fetch_related_names(db, candidate)
    agenda._validar_paciente_tutor_para_status(
        db,
        candidate,
        status_destino=candidate.status,
        related=related,
    )


def _appointment_creation_snapshot(
    *,
    clinic: Optional[Clinica],
    service: Servico,
    patient: Optional[Paciente],
    tutor: Optional[Tutor],
    candidate: Agendamento,
    recipient_type: str,
) -> dict[str, Any]:
    recipient = clinic if recipient_type == "clinica" else tutor
    recipient_numbers = (
        _contact_numbers(getattr(clinic, "whatsapps", None), getattr(clinic, "telefone", None))
        if recipient_type == "clinica"
        else _contact_numbers(getattr(tutor, "whatsapp", None), getattr(tutor, "telefone", None))
    )
    inicio = _as_local_datetime(candidate.inicio)
    fim = _as_local_datetime(candidate.fim)
    expires_at = _as_local_datetime(candidate.reserva_expira_em)
    return {
        "status": str(candidate.status),
        "tipo": "reserva" if str(candidate.status) == "Reservado" else "agendamento",
        "origem_atendimento": str(candidate.origem_atendimento),
        "inicio": inicio.isoformat() if inicio else None,
        "fim": fim.isoformat() if fim else None,
        "reserva_expira_em": expires_at.isoformat() if expires_at else None,
        "clinica_id": int(clinic.id) if clinic is not None else None,
        "clinica_nome": str(clinic.nome) if clinic is not None else None,
        "servico_id": int(service.id),
        "servico_nome": str(service.nome),
        "duracao_minutos": int(service.duracao_minutos or 30),
        "paciente_id": int(patient.id) if patient is not None else None,
        "paciente_nome": str(patient.nome) if patient is not None else None,
        "paciente_primeiro_nome": (
            str(patient.nome or "").strip().split()[0]
            if patient is not None and str(patient.nome or "").strip()
            else None
        ),
        "tutor_id": int(tutor.id) if tutor is not None else None,
        "tutor_nome": str(tutor.nome) if tutor is not None else None,
        "destinatario_mensagem": {
            "tipo": recipient_type,
            "nome": str(getattr(recipient, "nome", None) or "").strip() or None,
            "telefones": recipient_numbers,
        },
        "referencias": {
            "clinica": _record_version(clinic),
            "servico": _record_version(service),
            "paciente": _record_version(patient),
            "tutor": _record_version(tutor),
        },
    }


def _creation_signature(arguments: dict[str, Any]) -> tuple[Any, ...]:
    return (
        arguments.get("tipo"),
        arguments.get("origem_atendimento"),
        arguments.get("clinica_id"),
        arguments.get("servico_id"),
        arguments.get("paciente_id"),
        arguments.get("tutor_id"),
        arguments.get("inicio"),
        arguments.get("destinatario_mensagem"),
        arguments.get("prazo_confirmacao_horas"),
        arguments.get("observacoes"),
    )


def solicitar_criacao_agendamento(
    ctx: AssistenteIAToolContext,
    *,
    tipo: str,
    origem_atendimento: str,
    clinica: Optional[str],
    tutor: Optional[str],
    paciente: Optional[str],
    servico: str,
    data: str,
    horario: str,
    destinatario_mensagem: str,
    prazo_confirmacao_horas: Optional[float],
    observacoes: Optional[str],
) -> dict[str, Any]:
    if not ctx.current_user.tem_papel("admin"):
        return {"ok": False, "error": "Apenas administradores podem preparar agendamentos."}

    appointment_type = _normalize_text(tipo)
    if appointment_type not in {"agendamento", "reserva"}:
        return {"ok": False, "error": "Tipo invalido. Use agendamento ou reserva."}
    origin = _normalize_text(origem_atendimento).replace(" ", "_") or "clinica_parceira"
    if origin not in {"clinica_parceira", "domiciliar"}:
        return {"ok": False, "error": "Origem invalida. Use clinica_parceira ou domiciliar."}
    recipient_type = _normalize_text(destinatario_mensagem)
    if recipient_type not in {"clinica", "tutor"}:
        return {"ok": False, "error": "Destinatario invalido. Use clinica ou tutor."}

    clinic_obj: Optional[Clinica] = None
    if origin == "clinica_parceira":
        clinic_obj, error = _resolve_named_record(
            ctx.db,
            Clinica,
            str(clinica or ""),
            entity_label="clinica",
        )
        if error:
            return error
    elif recipient_type == "clinica":
        return {"ok": False, "error": "Atendimento domiciliar nao possui clinica destinataria; escolha o tutor."}

    service_obj, error = _resolve_named_record(
        ctx.db,
        Servico,
        servico,
        entity_label="servico",
    )
    if error:
        return error

    tutor_obj: Optional[Tutor] = None
    if str(tutor or "").strip():
        tutor_obj, error = _resolve_named_record(
            ctx.db,
            Tutor,
            str(tutor),
            entity_label="tutor",
        )
        if error:
            return error

    patient_obj: Optional[Paciente] = None
    if str(paciente or "").strip():
        patient_obj, error = _resolve_patient_record(
            ctx.db,
            str(paciente),
            tutor=tutor_obj,
        )
        if error:
            return error
        if tutor_obj is not None and patient_obj.tutor_id and int(patient_obj.tutor_id) != int(tutor_obj.id):
            return {"ok": False, "error": "O paciente informado nao pertence ao tutor selecionado."}
        if tutor_obj is None and patient_obj.tutor_id:
            tutor_obj = (
                ctx.db.query(Tutor)
                .filter(Tutor.id == int(patient_obj.tutor_id), Tutor.ativo.in_([True, 1]))
                .first()
            )

    if appointment_type == "agendamento" and patient_obj is None:
        return {"ok": False, "error": "Informe o paciente para criar um agendamento confirmado."}
    if appointment_type == "agendamento" and tutor_obj is None:
        return {"ok": False, "error": "O paciente precisa ter um tutor ativo para criar o agendamento."}
    if origin == "domiciliar" and tutor_obj is None:
        return {"ok": False, "error": "Informe o tutor para o atendimento domiciliar."}
    if recipient_type == "tutor" and tutor_obj is None:
        return {"ok": False, "error": "Informe um tutor para preparar a mensagem ao tutor."}

    try:
        start_date = _parse_iso_date(data)
        start_time = _parse_hhmm(horario)
        if start_time is None:
            raise ValueError("Informe o horario no formato HH:MM.")
    except ValueError as exc:
        return {"ok": False, "error": str(exc)}

    start = datetime.combine(start_date, start_time, tzinfo=LOCAL_TZ)
    now_local = datetime.now(LOCAL_TZ)
    if start <= now_local:
        return {"ok": False, "error": "O horario do agendamento deve estar no futuro."}

    reservation_expires_at: Optional[datetime] = None
    reservation_hours: Optional[float] = None
    if appointment_type == "reserva":
        try:
            reservation_hours = float(prazo_confirmacao_horas or 3)
        except (TypeError, ValueError):
            return {"ok": False, "error": "Prazo de confirmacao invalido."}
        if reservation_hours < 0.5 or reservation_hours > 72:
            return {"ok": False, "error": "O prazo da reserva deve ficar entre 0,5 e 72 horas."}
        reservation_expires_at = now_local + timedelta(hours=reservation_hours)
        if reservation_expires_at >= start:
            return {"ok": False, "error": "O prazo de confirmacao precisa terminar antes do horario reservado."}

    clean_notes = str(observacoes or "").strip()[:2000] or None
    candidate = _build_appointment_candidate(
        clinic=clinic_obj,
        service=service_obj,
        patient=patient_obj,
        tutor=tutor_obj,
        appointment_type=appointment_type,
        origin=origin,
        start=start,
        reservation_expires_at=reservation_expires_at,
        notes=clean_notes,
    )
    try:
        _validate_appointment_candidate(ctx.db, candidate)
    except HTTPException as exc:
        return {"ok": False, "error": str(exc.detail)}

    snapshot = _appointment_creation_snapshot(
        clinic=clinic_obj,
        service=service_obj,
        patient=patient_obj,
        tutor=tutor_obj,
        candidate=candidate,
        recipient_type=recipient_type,
    )
    arguments = {
        "tipo": appointment_type,
        "origem_atendimento": origin,
        "clinica_id": int(clinic_obj.id) if clinic_obj is not None else None,
        "servico_id": int(service_obj.id),
        "paciente_id": int(patient_obj.id) if patient_obj is not None else None,
        "tutor_id": int(tutor_obj.id) if tutor_obj is not None else None,
        "inicio": snapshot["inicio"],
        "fim": snapshot["fim"],
        "reserva_expira_em": snapshot["reserva_expira_em"],
        "destinatario_mensagem": recipient_type,
        "prazo_confirmacao_horas": reservation_hours,
        "observacoes": clean_notes,
    }

    now_utc = datetime.now(timezone.utc)
    existing = (
        ctx.db.query(AssistenteIAAcaoPendente)
        .filter(
            AssistenteIAAcaoPendente.usuario_id == ctx.current_user.id,
            AssistenteIAAcaoPendente.conversa_id == ctx.conversa.id,
            AssistenteIAAcaoPendente.tipo_acao == "create_appointment",
            AssistenteIAAcaoPendente.status == "pending",
        )
        .order_by(AssistenteIAAcaoPendente.created_at.desc())
        .all()
    )
    for action in existing:
        expires_at = _as_utc_datetime(action.expires_at)
        if (
            _creation_signature(_json_loads(action.argumentos_json, {})) == _creation_signature(arguments)
            and expires_at
            and expires_at > now_utc
        ):
            return {
                "ok": True,
                "requires_approval": True,
                "pending_action": serialize_pending_action(action),
                "message": "Esta criacao ja esta aguardando confirmacao do administrador.",
            }

    action = AssistenteIAAcaoPendente(
        id=str(uuid.uuid4()),
        conversa_id=ctx.conversa.id,
        usuario_id=int(ctx.current_user.id),
        tipo_acao="create_appointment",
        argumentos_json=_json_dumps(arguments),
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
        acao="ASSISTENTE_IA_AGENDAMENTO_SOLICITADO",
        descricao="Mente FortCordis preparou criacao de horario para confirmacao do admin.",
        detalhes={
            "acao_pendente_id": action.id,
            "tipo": appointment_type,
            "clinica_id": snapshot.get("clinica_id"),
            "servico_id": snapshot.get("servico_id"),
            "paciente_id": snapshot.get("paciente_id"),
            "tutor_id": snapshot.get("tutor_id"),
            "inicio": snapshot.get("inicio"),
            "destinatario_mensagem": recipient_type,
        },
        request=ctx.request,
    )
    return {
        "ok": True,
        "requires_approval": True,
        "pending_action": serialize_pending_action(action),
        "message": "A acao foi preparada. O horario so sera criado depois da confirmacao explicita.",
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


def _stored_datetime(value: Any, *, field_label: str) -> datetime:
    raw = str(value or "").strip()
    try:
        parsed = datetime.fromisoformat(raw.replace("Z", "+00:00"))
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=f"{field_label} da acao preparada e invalido.") from exc
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=LOCAL_TZ)
    return parsed.astimezone(LOCAL_TZ)


def _load_creation_records(
    db: Session,
    arguments: dict[str, Any],
) -> tuple[Optional[Clinica], Servico, Optional[Paciente], Optional[Tutor]]:
    clinic_id = int(arguments.get("clinica_id") or 0)
    service_id = int(arguments.get("servico_id") or 0)
    patient_id = int(arguments.get("paciente_id") or 0)
    tutor_id = int(arguments.get("tutor_id") or 0)

    clinic = (
        db.query(Clinica).filter(Clinica.id == clinic_id, Clinica.ativo.in_([True, 1])).first()
        if clinic_id > 0
        else None
    )
    service = (
        db.query(Servico).filter(Servico.id == service_id, Servico.ativo.in_([True, 1])).first()
        if service_id > 0
        else None
    )
    patient = (
        db.query(Paciente).filter(Paciente.id == patient_id, Paciente.ativo.in_([True, 1])).first()
        if patient_id > 0
        else None
    )
    tutor = (
        db.query(Tutor).filter(Tutor.id == tutor_id, Tutor.ativo.in_([True, 1])).first()
        if tutor_id > 0
        else None
    )
    if service is None:
        raise HTTPException(status_code=409, detail="O servico da acao preparada nao esta mais ativo.")
    if clinic_id > 0 and clinic is None:
        raise HTTPException(status_code=409, detail="A clinica da acao preparada nao esta mais ativa.")
    if patient_id > 0 and patient is None:
        raise HTTPException(status_code=409, detail="O paciente da acao preparada nao esta mais ativo.")
    if tutor_id > 0 and tutor is None:
        raise HTTPException(status_code=409, detail="O tutor da acao preparada nao esta mais ativo.")
    if patient is not None and tutor is not None and patient.tutor_id and int(patient.tutor_id) != int(tutor.id):
        raise HTTPException(status_code=409, detail="O vinculo entre paciente e tutor mudou depois da solicitacao.")
    return clinic, service, patient, tutor


def _references_snapshot(
    clinic: Optional[Clinica],
    service: Servico,
    patient: Optional[Paciente],
    tutor: Optional[Tutor],
) -> dict[str, Any]:
    return {
        "clinica": _record_version(clinic),
        "servico": _record_version(service),
        "paciente": _record_version(patient),
        "tutor": _record_version(tutor),
    }


def _format_message_date(value: datetime) -> str:
    return value.astimezone(LOCAL_TZ).strftime("%d/%m/%Y")


def _format_message_datetime(value: Optional[datetime]) -> str:
    return value.astimezone(LOCAL_TZ).strftime("%d/%m/%Y às %H:%M") if value is not None else ""


def _build_manual_appointment_message(
    *,
    appointment_type: str,
    start: datetime,
    reservation_expires_at: Optional[datetime],
    service: Servico,
    patient: Optional[Paciente],
    tutor: Optional[Tutor],
    clinic: Optional[Clinica],
) -> str:
    patient_name = str(getattr(patient, "nome", None) or "").strip()
    patient_label = f"{patient_name} ({int(patient.id)})" if patient is not None and patient_name else "Pendente"
    tutor_label = str(getattr(tutor, "nome", None) or "").strip() or "Pendente"
    clinic_label = str(getattr(clinic, "nome", None) or "").strip() or "Pendente"
    title = "*RESERVA DE HORÁRIO* 🐶 🐱" if appointment_type == "reserva" else "*AGENDAMENTO* 🐶 🐱"
    lines = [
        title,
        "",
        "*Médico Veterinário:* Dr Martiniano",
        f"*Atendimento:* {str(service.nome or '').strip() or 'Pendente'}",
        f"*Data:* {_format_message_date(start)}",
        f"*Horário:* {start.astimezone(LOCAL_TZ).strftime('%H:%M')}",
        f"*Paciente:* {patient_label}",
        f"*Tutor:* {tutor_label}",
        "*Especialista:* Cardiologista",
        f"*Clinica:* {clinic_label}",
        "",
    ]
    if appointment_type == "reserva":
        lines.extend(
            [
                f"⚠️ *ATENÇÃO:* Confirme esta reserva até {_format_message_datetime(reservation_expires_at)}.",
                "Sem confirmação até esse prazo, o horário voltará a ficar disponível para outros clientes.",
            ]
        )
    else:
        lines.append("✅ *CONFIRMAÇÃO:* O horário solicitado foi agendado.")
    return "\n".join(lines)


def _invalidate_pending_action(
    db: Session,
    action: AssistenteIAAcaoPendente,
    *,
    now_utc: datetime,
    reason: str,
    detail: str,
) -> None:
    action.status = "invalidated"
    action.decided_at = now_utc
    action.resultado_json = _json_dumps({"ok": False, "reason": reason, "detail": detail})
    db.add(action)
    db.commit()


def _approve_appointment_creation(
    *,
    db: Session,
    current_user: User,
    request: Optional[Request],
    action: AssistenteIAAcaoPendente,
    now_utc: datetime,
    observation: Optional[str],
) -> dict[str, Any]:
    arguments = _json_loads(action.argumentos_json, {})
    snapshot = _json_loads(action.alvo_snapshot_json, {})
    try:
        clinic, service, patient, tutor = _load_creation_records(db, arguments)
    except HTTPException as exc:
        _invalidate_pending_action(
            db,
            action,
            now_utc=now_utc,
            reason="reference_changed",
            detail=str(exc.detail),
        )
        raise

    if _references_snapshot(clinic, service, patient, tutor) != snapshot.get("referencias"):
        detail = "Clinica, servico, paciente ou tutor mudou depois da solicitacao. Revise e solicite novamente."
        _invalidate_pending_action(
            db,
            action,
            now_utc=now_utc,
            reason="reference_changed",
            detail=detail,
        )
        raise HTTPException(status_code=409, detail=detail)

    appointment_type = str(arguments.get("tipo") or "").strip()
    start = _stored_datetime(arguments.get("inicio"), field_label="Horario")
    end = _stored_datetime(arguments.get("fim"), field_label="Horario final")
    reservation_expires_at = (
        _stored_datetime(arguments.get("reserva_expira_em"), field_label="Prazo da reserva")
        if arguments.get("reserva_expira_em")
        else None
    )
    payload = AgendamentoCreate(
        paciente_id=int(patient.id) if patient is not None else None,
        tutor_id=int(tutor.id) if tutor is not None else None,
        clinica_id=int(clinic.id) if clinic is not None else None,
        servico_id=int(service.id),
        origem_atendimento=str(arguments.get("origem_atendimento") or "clinica_parceira"),
        inicio=start,
        fim=end,
        status="Reservado" if appointment_type == "reserva" else "Agendado",
        reserva_expira_em=reservation_expires_at,
        observacoes=str(arguments.get("observacoes") or "").strip() or None,
        confirmar_conflito_deslocamento=False,
        excecao_operacional_concedida=False,
    )

    action.status = "processing"
    action.decided_at = now_utc
    db.add(action)
    db.flush()
    try:
        created = agenda.criar_agendamento(
            agendamento=payload,
            request=request,
            db=db,
            current_user=current_user,
        )
    except HTTPException as exc:
        _invalidate_pending_action(
            db,
            action,
            now_utc=now_utc,
            reason="agenda_validation_failed",
            detail=str(exc.detail),
        )
        raise HTTPException(
            status_code=409,
            detail=f"A agenda mudou ou a regra operacional bloqueou a criacao: {exc.detail}",
        ) from exc

    recipient_type = str(arguments.get("destinatario_mensagem") or "clinica")
    recipient = clinic if recipient_type == "clinica" else tutor
    phones = (
        _contact_numbers(getattr(clinic, "whatsapps", None), getattr(clinic, "telefone", None))
        if recipient_type == "clinica"
        else _contact_numbers(getattr(tutor, "whatsapp", None), getattr(tutor, "telefone", None))
    )
    message = _build_manual_appointment_message(
        appointment_type=appointment_type,
        start=start,
        reservation_expires_at=reservation_expires_at,
        service=service,
        patient=patient,
        tutor=tutor,
        clinic=clinic,
    )
    created_payload = created if isinstance(created, dict) else {"id": getattr(created, "id", None)}
    action.status = "executed"
    action.executed_at = now_utc
    action.resultado_json = _json_dumps(
        {
            "ok": True,
            "decision": "approved",
            "message": "Reserva criada com sucesso." if appointment_type == "reserva" else "Agendamento criado com sucesso.",
            "observation": str(observation or "").strip() or None,
            "agendamento": created_payload,
            "comunicacao": {
                "destinatario_tipo": recipient_type,
                "destinatario_nome": str(getattr(recipient, "nome", None) or "").strip() or None,
                "telefones": phones,
                "mensagem": message,
                "envio_manual": True,
            },
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
        descricao="Administrador aprovou criacao de horario preparada pela Mente FortCordis.",
        detalhes={
            "tipo_acao": action.tipo_acao,
            "tipo_agendamento": appointment_type,
            "agendamento_id": created_payload.get("id"),
            "destinatario_mensagem": recipient_type,
            "observacao": observation,
        },
        request=request,
    )
    return serialize_pending_action(action)


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
    if action.tipo_acao == "create_appointment":
        return _approve_appointment_creation(
            db=db,
            current_user=current_user,
            request=request,
            action=action,
            now_utc=now_utc,
            observation=observation,
        )
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
        "name": "solicitar_criacao_agendamento",
        "description": "Prepara um agendamento ou uma reserva depois de resolver os cadastros e validar as regras reais da agenda. Nunca cria o horario diretamente: gera uma acao pendente para confirmacao explicita do admin.",
        "parameters": {
            "type": "object",
            "properties": {
                "tipo": {"type": "string", "enum": ["agendamento", "reserva"]},
                "origem_atendimento": {
                    "type": "string",
                    "enum": ["clinica_parceira", "domiciliar"],
                },
                "clinica": {
                    "type": ["string", "null"],
                    "description": "Nome da clinica para atendimento em clinica parceira; null para domiciliar.",
                },
                "tutor": {"type": ["string", "null"], "description": "Nome do tutor ou null."},
                "paciente": {"type": ["string", "null"], "description": "Nome do paciente ou null apenas para reserva."},
                "servico": {"type": "string"},
                "data": {"type": "string", "description": "Data futura YYYY-MM-DD."},
                "horario": {"type": "string", "description": "Horario HH:MM."},
                "destinatario_mensagem": {"type": "string", "enum": ["clinica", "tutor"]},
                "prazo_confirmacao_horas": {
                    "type": ["number", "null"],
                    "minimum": 0.5,
                    "maximum": 72,
                    "description": "Prazo da reserva em horas; null para usar 3 horas ou para agendamento.",
                },
                "observacoes": {"type": ["string", "null"], "maxLength": 2000},
            },
            "required": [
                "tipo",
                "origem_atendimento",
                "clinica",
                "tutor",
                "paciente",
                "servico",
                "data",
                "horario",
                "destinatario_mensagem",
                "prazo_confirmacao_horas",
                "observacoes",
            ],
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
    if name == "solicitar_criacao_agendamento":
        return solicitar_criacao_agendamento(
            ctx,
            tipo=arguments["tipo"],
            origem_atendimento=arguments["origem_atendimento"],
            clinica=arguments.get("clinica"),
            tutor=arguments.get("tutor"),
            paciente=arguments.get("paciente"),
            servico=arguments["servico"],
            data=arguments["data"],
            horario=arguments["horario"],
            destinatario_mensagem=arguments["destinatario_mensagem"],
            prazo_confirmacao_horas=arguments.get("prazo_confirmacao_horas"),
            observacoes=arguments.get("observacoes"),
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
    if name == "solicitar_criacao_agendamento":
        return "Aguardando confirmacao para criar o horario"
    if name == "solicitar_exclusao_agendamento":
        return "Aguardando confirmacao do administrador"
    return "Ferramenta executada"


def tool_result_for_model(name: str, result: dict[str, Any]) -> dict[str, Any]:
    if name != "solicitar_criacao_agendamento" or not isinstance(result.get("pending_action"), dict):
        return result
    action = result["pending_action"]
    target = action.get("target") if isinstance(action.get("target"), dict) else {}
    recipient = (
        target.get("destinatario_mensagem")
        if isinstance(target.get("destinatario_mensagem"), dict)
        else {}
    )
    phones = recipient.get("telefones") if isinstance(recipient.get("telefones"), list) else []
    return {
        "ok": bool(result.get("ok")),
        "requires_approval": bool(result.get("requires_approval")),
        "message": result.get("message"),
        "pending_action": {
            "id": action.get("id"),
            "type": action.get("type"),
            "status": action.get("status"),
            "target": {
                "tipo": target.get("tipo"),
                "status": target.get("status"),
                "inicio": target.get("inicio"),
                "fim": target.get("fim"),
                "reserva_expira_em": target.get("reserva_expira_em"),
                "clinica_nome": target.get("clinica_nome"),
                "servico_nome": target.get("servico_nome"),
                "paciente_nome": target.get("paciente_nome"),
                "tutor_nome": target.get("tutor_nome"),
                "destinatario_mensagem": {
                    "tipo": recipient.get("tipo"),
                    "nome": recipient.get("nome"),
                    "possui_contato": bool(phones),
                    "quantidade_contatos": len(phones),
                },
            },
        },
    }
