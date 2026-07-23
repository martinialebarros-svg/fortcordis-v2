from __future__ import annotations

import json
import unicodedata
from collections import Counter
from datetime import date, datetime, time, timedelta, timezone
from decimal import Decimal
from typing import Any, Iterable
from zoneinfo import ZoneInfo

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.agendamento import Agendamento
from app.models.assistente_ia import AssistenteIAMemoria
from app.models.clinica import Clinica
from app.models.financeiro import ContaReceber, Transacao
from app.models.ordem_servico import OrdemServico
from app.models.servico import Servico


LOCAL_TZ = ZoneInfo("America/Fortaleza")
ACTIVE_APPOINTMENT_STATUSES = {
    "Agendado",
    "Reservado",
    "Confirmado",
    "Em atendimento",
}
RECEIVED_TRANSACTION_STATUSES = {"Recebido", "Pago"}
PENDING_RECEIVABLE_STATUSES = {"Pendente", "Atrasado"}


def _normalize(value: Any) -> str:
    raw = unicodedata.normalize("NFKD", str(value or "").strip().lower())
    return " ".join(
        "".join(char for char in raw if not unicodedata.combining(char))
        .replace("-", " ")
        .replace("_", " ")
        .split()
    )


def _money(value: Any) -> float:
    if isinstance(value, Decimal):
        value = float(value)
    return round(float(value or 0), 2)


def _local(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=LOCAL_TZ)
    return value.astimezone(LOCAL_TZ)


def _iso(value: datetime | None) -> str | None:
    normalized = _local(value)
    return normalized.isoformat() if normalized else None


def _max_datetime(values: Iterable[datetime | None]) -> datetime | None:
    normalized = [_local(value) for value in values if value is not None]
    return max(normalized) if normalized else None


def _percent_change(current: float, previous: float) -> float | None:
    if previous == 0:
        return None
    return round(((current - previous) / previous) * 100, 2)


def _rate(numerator: int, denominator: int) -> float:
    if denominator <= 0:
        return 0.0
    return round((numerator / denominator) * 100, 2)


def _whatsapps(value: Any) -> list[str]:
    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item).strip()]
    if isinstance(value, str):
        try:
            parsed = json.loads(value)
        except (TypeError, ValueError):
            parsed = None
        if isinstance(parsed, list):
            return [str(item).strip() for item in parsed if str(item).strip()]
        return [value.strip()] if value.strip() else []
    return []


def _period(period_days: int) -> dict[str, Any]:
    days = max(30, min(365, int(period_days or 90)))
    now = datetime.now(LOCAL_TZ)
    today = now.date()
    current_start_date = today - timedelta(days=days - 1)
    current_end_date = today + timedelta(days=1)
    previous_start_date = current_start_date - timedelta(days=days)
    return {
        "days": days,
        "now": now,
        "today": today,
        "current_start": datetime.combine(current_start_date, time.min, tzinfo=LOCAL_TZ),
        "current_end": datetime.combine(current_end_date, time.min, tzinfo=LOCAL_TZ),
        "previous_start": datetime.combine(previous_start_date, time.min, tzinfo=LOCAL_TZ),
        "current_start_date": current_start_date,
        "current_end_date": today,
        "previous_start_date": previous_start_date,
        "previous_end_date": current_start_date - timedelta(days=1),
    }


def _address(clinic: Clinica) -> str | None:
    street = " ".join(
        part for part in [str(clinic.endereco or "").strip(), str(clinic.numero or "").strip()] if part
    )
    locality = " - ".join(
        part for part in [str(clinic.cidade or "").strip(), str(clinic.estado or "").strip()] if part
    )
    parts = [part for part in [street, str(clinic.bairro or "").strip(), locality] if part]
    return ", ".join(parts) or None


def _source(
    key: str,
    label: str,
    *,
    count: int,
    last_updated_at: datetime | None,
) -> dict[str, Any]:
    return {
        "key": key,
        "label": label,
        "record_count": int(count),
        "last_updated_at": _iso(last_updated_at),
        "mode": "live_read_only",
    }


def _load_scope(
    db: Session,
    clinics: list[Clinica],
    period: dict[str, Any],
) -> dict[str, Any]:
    clinic_ids = [int(item.id) for item in clinics]
    if not clinic_ids:
        return {
            "appointments": [],
            "transactions": [],
            "orders": [],
            "receivables": [],
            "last_appointments": {},
            "next_appointments": {},
            "memories": [],
            "service_map": {},
        }

    appointments = (
        db.query(Agendamento)
        .filter(
            Agendamento.clinica_id.in_(clinic_ids),
            Agendamento.inicio >= period["previous_start"],
            Agendamento.inicio < period["current_end"],
        )
        .all()
    )
    transactions = (
        db.query(Transacao)
        .filter(
            Transacao.clinica_id.in_(clinic_ids),
            Transacao.data_transacao >= period["previous_start"],
            Transacao.data_transacao < period["current_end"],
        )
        .all()
    )
    orders = (
        db.query(OrdemServico)
        .filter(
            OrdemServico.clinica_id.in_(clinic_ids),
            (
                (OrdemServico.data_atendimento >= period["current_start"])
                | (OrdemServico.status == "Pendente")
            ),
        )
        .all()
    )
    receivables = (
        db.query(ContaReceber)
        .filter(
            ContaReceber.clinica_id.in_(clinic_ids),
            ContaReceber.status.in_(sorted(PENDING_RECEIVABLE_STATUSES)),
        )
        .all()
    )
    last_appointments = {
        int(clinic_id): value
        for clinic_id, value in (
            db.query(Agendamento.clinica_id, func.max(Agendamento.inicio))
            .filter(Agendamento.clinica_id.in_(clinic_ids), Agendamento.inicio < period["now"])
            .group_by(Agendamento.clinica_id)
            .all()
        )
        if clinic_id is not None
    }
    next_appointments = {
        int(clinic_id): value
        for clinic_id, value in (
            db.query(Agendamento.clinica_id, func.min(Agendamento.inicio))
            .filter(
                Agendamento.clinica_id.in_(clinic_ids),
                Agendamento.inicio >= period["now"],
                Agendamento.status.in_(sorted(ACTIVE_APPOINTMENT_STATUSES)),
            )
            .group_by(Agendamento.clinica_id)
            .all()
        )
        if clinic_id is not None
    }
    memories = (
        db.query(AssistenteIAMemoria)
        .filter(AssistenteIAMemoria.status == "approved")
        .order_by(AssistenteIAMemoria.updated_at.desc(), AssistenteIAMemoria.created_at.desc())
        .limit(500)
        .all()
    )
    service_ids = {
        int(item.servico_id)
        for item in [*appointments, *orders]
        if getattr(item, "servico_id", None)
    }
    service_map = {
        int(item.id): str(item.nome)
        for item in db.query(Servico).filter(Servico.id.in_(service_ids)).all()
    } if service_ids else {}
    return {
        "appointments": appointments,
        "transactions": transactions,
        "orders": orders,
        "receivables": receivables,
        "last_appointments": last_appointments,
        "next_appointments": next_appointments,
        "memories": memories,
        "service_map": service_map,
    }


def _clinic_profile(
    clinic: Clinica,
    scope: dict[str, Any],
    period: dict[str, Any],
) -> dict[str, Any]:
    clinic_id = int(clinic.id)
    appointments = [item for item in scope["appointments"] if int(item.clinica_id) == clinic_id]
    current_appointments = [
        item for item in appointments if _local(item.inicio) >= period["current_start"]
    ]
    previous_appointments = [
        item for item in appointments if _local(item.inicio) < period["current_start"]
    ]
    current_statuses = Counter(str(item.status or "Sem status") for item in current_appointments)
    previous_statuses = Counter(str(item.status or "Sem status") for item in previous_appointments)
    cancelled = int(current_statuses.get("Cancelado", 0))
    no_show = int(current_statuses.get("Faltou", 0))
    realized = int(current_statuses.get("Realizado", 0))

    service_counts = Counter(
        int(item.servico_id)
        for item in current_appointments
        if item.servico_id is not None
    )
    top_services = [
        {
            "service_id": service_id,
            "name": scope["service_map"].get(service_id, f"Servico #{service_id}"),
            "appointments": count,
        }
        for service_id, count in service_counts.most_common(5)
    ]

    transactions = [
        item
        for item in scope["transactions"]
        if int(item.clinica_id) == clinic_id
        and str(item.tipo or "") == "entrada"
        and str(item.status or "") in RECEIVED_TRANSACTION_STATUSES
    ]
    current_transactions = [
        item for item in transactions if _local(item.data_transacao) >= period["current_start"]
    ]
    previous_transactions = [
        item for item in transactions if _local(item.data_transacao) < period["current_start"]
    ]
    current_revenue = _money(sum(float(item.valor_final or 0) for item in current_transactions))
    previous_revenue = _money(sum(float(item.valor_final or 0) for item in previous_transactions))
    revenue_change = _percent_change(current_revenue, previous_revenue)

    orders = [item for item in scope["orders"] if int(item.clinica_id) == clinic_id]
    current_orders = [
        item
        for item in orders
        if item.data_atendimento is not None
        and _local(item.data_atendimento) >= period["current_start"]
        and _local(item.data_atendimento) < period["current_end"]
        and str(item.status or "") != "Cancelado"
    ]
    pending_orders = [item for item in orders if str(item.status or "") == "Pendente"]
    receivables = [item for item in scope["receivables"] if int(item.clinica_id) == clinic_id]
    overdue_receivables = [
        item
        for item in receivables
        if str(item.status or "") == "Atrasado"
        or (
            item.data_vencimento is not None
            and _local(item.data_vencimento).date() < period["today"]
        )
    ]
    pending_order_total = _money(sum(float(item.valor_final or 0) for item in pending_orders))
    receivable_total = _money(sum(float(item.valor or 0) for item in receivables))
    overdue_total = _money(sum(float(item.valor or 0) for item in overdue_receivables))

    clinic_key = _normalize(clinic.nome)
    clinic_memories = [
        item
        for item in scope["memories"]
        if clinic_key and clinic_key in _normalize(f"{item.titulo} {item.conteudo}")
    ][:10]
    preferences = [
        {
            "id": str(item.id),
            "title": str(item.titulo),
            "content": str(item.conteudo),
            "category": str(item.categoria),
            "approved_at": _iso(item.aprovado_em),
            "updated_at": _iso(item.updated_at),
        }
        for item in clinic_memories
    ]

    last_appointment = scope["last_appointments"].get(clinic_id)
    next_appointment = scope["next_appointments"].get(clinic_id)
    last_activity = _max_datetime(
        [
            last_appointment,
            *[item.updated_at or item.created_at for item in transactions],
            *[item.updated_at or item.created_at for item in orders],
            *[item.created_at for item in receivables],
        ]
    )
    days_since_activity = (
        max(0, (period["today"] - last_activity.date()).days) if last_activity else None
    )

    alerts: list[dict[str, Any]] = []
    if revenue_change is not None and revenue_change <= -20:
        alerts.append(
            {
                "key": "revenue_drop",
                "level": "attention",
                "title": "Faturamento em queda",
                "evidence": f"Variacao de {revenue_change:.1f}% contra o periodo anterior.",
            }
        )
    cancellation_rate = _rate(cancelled, len(current_appointments))
    if len(current_appointments) >= 5 and cancellation_rate >= 20:
        alerts.append(
            {
                "key": "cancellation_rate",
                "level": "attention",
                "title": "Cancelamentos elevados",
                "evidence": f"{cancellation_rate:.1f}% dos agendamentos do periodo foram cancelados.",
            }
        )
    if overdue_total > 0:
        alerts.append(
            {
                "key": "overdue_debt",
                "level": "critical",
                "title": "Debitos vencidos",
                "evidence": f"R$ {overdue_total:,.2f} vencidos em contas a receber.",
            }
        )
    if days_since_activity is None or days_since_activity >= 30:
        alerts.append(
            {
                "key": "inactivity",
                "level": "attention",
                "title": "Relacionamento sem atividade recente",
                "evidence": (
                    "Nenhuma atividade operacional localizada."
                    if days_since_activity is None
                    else f"Ultima atividade ha {days_since_activity} dias."
                ),
            }
        )

    source_updates = {
        "appointments": _max_datetime([item.updated_at or item.created_at for item in appointments]),
        "transactions": _max_datetime([item.updated_at or item.created_at for item in transactions]),
        "orders": _max_datetime([item.updated_at or item.created_at for item in orders]),
        "receivables": _max_datetime([item.created_at for item in receivables]),
        "memories": _max_datetime([item.updated_at or item.created_at for item in clinic_memories]),
    }
    sources = [
        _source("clinics", "Cadastro de clinicas", count=1, last_updated_at=clinic.updated_at or clinic.created_at),
        _source("appointments", "Agenda", count=len(appointments), last_updated_at=source_updates["appointments"]),
        _source("transactions", "Transacoes recebidas", count=len(transactions), last_updated_at=source_updates["transactions"]),
        _source("service_orders", "Ordens de servico", count=len(orders), last_updated_at=source_updates["orders"]),
        _source("receivables", "Contas a receber pendentes", count=len(receivables), last_updated_at=source_updates["receivables"]),
        _source("approved_memories", "Memorias aprovadas", count=len(preferences), last_updated_at=source_updates["memories"]),
    ]

    return {
        "clinic": {
            "id": clinic_id,
            "name": str(clinic.nome),
            "legal_name": str(clinic.razao_social or "") or None,
            "active": bool(clinic.ativo),
            "region": str(clinic.regiao_operacional or "") or None,
            "city": str(clinic.cidade or "") or None,
            "state": str(clinic.estado or "") or None,
            "address": _address(clinic),
            "contact": {
                "phone": str(clinic.telefone or "") or None,
                "whatsapps": _whatsapps(clinic.whatsapps),
                "email": str(clinic.email or "") or None,
            },
        },
        "period": {
            "days": period["days"],
            "current": {
                "start": period["current_start_date"].isoformat(),
                "end": period["current_end_date"].isoformat(),
            },
            "previous": {
                "start": period["previous_start_date"].isoformat(),
                "end": period["previous_end_date"].isoformat(),
            },
        },
        "appointments": {
            "total": len(current_appointments),
            "previous_total": len(previous_appointments),
            "change_percent": _percent_change(len(current_appointments), len(previous_appointments)),
            "realized": realized,
            "cancelled": cancelled,
            "no_show": no_show,
            "cancellation_rate": cancellation_rate,
            "no_show_rate": _rate(no_show, len(current_appointments)),
            "by_status": dict(sorted(current_statuses.items())),
            "top_services": top_services,
            "last_appointment_at": _iso(last_appointment),
            "next_appointment_at": _iso(next_appointment),
        },
        "finance": {
            "revenue": current_revenue,
            "previous_revenue": previous_revenue,
            "revenue_change_percent": revenue_change,
            "receipts": len(current_transactions),
            "average_ticket": _money(current_revenue / len(current_transactions)) if current_transactions else 0.0,
            "fees": _money(sum(float(item.valor_taxa or 0) for item in current_transactions)),
            "service_order_production": _money(sum(float(item.valor_final or 0) for item in current_orders)),
            "service_orders": len(current_orders),
        },
        "debts": {
            "pending_service_orders": {"count": len(pending_orders), "total": pending_order_total},
            "pending_receivables": {"count": len(receivables), "total": receivable_total},
            "overdue_receivables": {"count": len(overdue_receivables), "total": overdue_total},
            "estimated_total_without_deduplication": _money(pending_order_total + receivable_total),
            "warning": "Ordens de servico e contas a receber sao fontes separadas e podem representar o mesmo debito.",
        },
        "relationship": {
            "last_activity_at": _iso(last_activity),
            "days_since_activity": days_since_activity,
            "approved_preferences": preferences,
        },
        "alerts": alerts,
        "attention_score": sum(2 if item["level"] == "critical" else 1 for item in alerts),
        "provenance": {
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "data_through": period["today"].isoformat(),
            "sources": sources,
            "read_only": True,
            "contains_patient_or_tutor_data": False,
            "method": "Indicadores deterministicos calculados ao vivo sobre fontes oficiais.",
        },
    }


def _decorate_rankings(items: list[dict[str, Any]]) -> None:
    by_revenue = sorted(items, key=lambda item: (-item["finance"]["revenue"], item["clinic"]["name"]))
    by_attention = sorted(items, key=lambda item: (-item["attention_score"], item["clinic"]["name"]))
    revenue_ranks = {item["clinic"]["id"]: index + 1 for index, item in enumerate(by_revenue)}
    attention_ranks = {item["clinic"]["id"]: index + 1 for index, item in enumerate(by_attention)}
    for item in items:
        item["ranking"] = {
            "revenue": revenue_ranks[item["clinic"]["id"]],
            "attention": attention_ranks[item["clinic"]["id"]],
        }


def list_clinics_360(
    db: Session,
    *,
    period_days: int = 90,
    include_inactive: bool = False,
    limit: int = 100,
) -> dict[str, Any]:
    period = _period(period_days)
    query = db.query(Clinica)
    if not include_inactive:
        query = query.filter(Clinica.ativo.in_([True, 1]))
    clinics = query.order_by(Clinica.nome.asc(), Clinica.id.asc()).limit(max(1, min(200, int(limit)))).all()
    scope = _load_scope(db, clinics, period)
    items = [_clinic_profile(clinic, scope, period) for clinic in clinics]
    _decorate_rankings(items)
    items.sort(key=lambda item: (-item["attention_score"], item["clinic"]["name"]))
    return {
        "ok": True,
        "period": items[0]["period"] if items else {
            "days": period["days"],
            "current": {"start": period["current_start_date"].isoformat(), "end": period["current_end_date"].isoformat()},
            "previous": {"start": period["previous_start_date"].isoformat(), "end": period["previous_end_date"].isoformat()},
        },
        "portfolio": {
            "clinics": len(items),
            "with_alerts": sum(1 for item in items if item["alerts"]),
            "revenue": _money(sum(item["finance"]["revenue"] for item in items)),
            "appointments": sum(item["appointments"]["total"] for item in items),
            "overdue_receivables": _money(sum(item["debts"]["overdue_receivables"]["total"] for item in items)),
        },
        "items": items,
        "provenance": {
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "data_through": period["today"].isoformat(),
            "read_only": True,
            "contains_patient_or_tutor_data": False,
        },
    }


def clinic_360_profile(db: Session, clinic_id: int, *, period_days: int = 90) -> dict[str, Any]:
    clinic = db.query(Clinica).filter(Clinica.id == int(clinic_id)).first()
    if clinic is None:
        return {"ok": False, "error": "Clinica nao encontrada."}
    period = _period(period_days)
    return {"ok": True, "profile": _clinic_profile(clinic, _load_scope(db, [clinic], period), period)}


def compare_clinics_360(
    db: Session,
    clinic_ids: list[int],
    *,
    period_days: int = 90,
) -> dict[str, Any]:
    ids = list(dict.fromkeys(int(item) for item in clinic_ids if int(item) > 0))[:10]
    if len(ids) < 2:
        return {"ok": False, "error": "Selecione ao menos duas clinicas para comparar."}
    clinics = db.query(Clinica).filter(Clinica.id.in_(ids)).all()
    clinic_map = {int(item.id): item for item in clinics}
    missing = [item for item in ids if item not in clinic_map]
    if missing:
        return {"ok": False, "error": "Uma ou mais clinicas nao foram encontradas.", "missing_ids": missing}
    period = _period(period_days)
    scope = _load_scope(db, [clinic_map[item] for item in ids], period)
    items = [_clinic_profile(clinic_map[item], scope, period) for item in ids]
    _decorate_rankings(items)
    revenue_leader = max(items, key=lambda item: item["finance"]["revenue"])
    activity_leader = max(items, key=lambda item: item["appointments"]["total"])
    attention_leader = max(items, key=lambda item: item["attention_score"])
    return {
        "ok": True,
        "period": items[0]["period"],
        "items": items,
        "insights": [
            {
                "key": "revenue_leader",
                "label": "Maior faturamento",
                "clinic_id": revenue_leader["clinic"]["id"],
                "clinic_name": revenue_leader["clinic"]["name"],
                "value": revenue_leader["finance"]["revenue"],
            },
            {
                "key": "appointment_leader",
                "label": "Maior volume de agenda",
                "clinic_id": activity_leader["clinic"]["id"],
                "clinic_name": activity_leader["clinic"]["name"],
                "value": activity_leader["appointments"]["total"],
            },
            {
                "key": "attention_priority",
                "label": "Maior prioridade de atencao",
                "clinic_id": attention_leader["clinic"]["id"],
                "clinic_name": attention_leader["clinic"]["name"],
                "value": attention_leader["attention_score"],
            },
        ],
        "provenance": {
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "read_only": True,
            "contains_patient_or_tutor_data": False,
            "comparison_method": "Ranking deterministico restrito as clinicas selecionadas.",
        },
    }
