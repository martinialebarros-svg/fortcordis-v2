from __future__ import annotations

import logging
import threading
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

import httpx
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.database import SessionLocal
from app.models.configuracao import Configuracao
from app.models.whatsapp_bot import WhatsAppBotJob, WhatsAppBotResposta
from app.services.whatsapp_bot_queue_service import enqueue_job_for_inbound_message

logger = logging.getLogger(__name__)

_WORKER_THREAD: Optional[threading.Thread] = None
_WORKER_LOCK = threading.Lock()
_WORKER_STOP_EVENT = threading.Event()
_WORKER_RUN_LOCK = threading.Lock()
_CYCLE_COUNT = 0
_LAST_CYCLE_AT: Optional[datetime] = None


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _safe_int(value: Any, default: int) -> int:
    try:
        return int(value)
    except Exception:
        return default


def _is_postgres(db: Session) -> bool:
    bind = db.get_bind()
    return bool(bind and bind.dialect.name == "postgresql")


def _distributed_lock_enabled() -> bool:
    return bool(settings.WHATSAPP_BOT_SCHEDULER_DISTRIBUTED_LOCK_ENABLED)


def _distributed_lock_key() -> int:
    parsed = _safe_int(settings.WHATSAPP_BOT_SCHEDULER_DISTRIBUTED_LOCK_KEY, 80433003)
    return parsed if parsed > 0 else 80433003


def _try_acquire_pg_lock(db: Session, *, lock_key: int) -> bool:
    row = db.execute(
        text("SELECT pg_try_advisory_lock(:lock_key) AS locked"),
        {"lock_key": lock_key},
    ).fetchone()
    if not row:
        return False
    if hasattr(row, "_mapping"):
        return bool(row._mapping.get("locked"))
    return bool(row[0])


def _release_pg_lock(db: Session, *, lock_key: int) -> None:
    db.execute(text("SELECT pg_advisory_unlock(:lock_key)"), {"lock_key": lock_key})


def _max_attempts() -> int:
    parsed = _safe_int(settings.WHATSAPP_BOT_MAX_ATTEMPTS, 3)
    return parsed if parsed > 0 else 3


def _worker_poll_seconds() -> int:
    parsed = _safe_int(settings.WHATSAPP_BOT_SCHEDULER_POLL_SECONDS, 5)
    if parsed < 1:
        return 1
    if parsed > 300:
        return 300
    return parsed


def _reconcile_every_cycles() -> int:
    parsed = _safe_int(settings.WHATSAPP_BOT_RECONCILE_EVERY_CYCLES, 60)
    return parsed if parsed > 0 else 60


def _reconcile_window_minutes() -> int:
    parsed = _safe_int(settings.WHATSAPP_BOT_RECONCILE_WINDOW_MINUTES, 30)
    return parsed if parsed > 0 else 30


def is_whatsapp_bot_enabled() -> bool:
    """Fonte de verdade do RF-008 para observabilidade (NFR-003).

    Nao usado ainda para bloquear o processamento nesta fase (Fase 2 nunca
    gera nem envia nada, so prova o caminho fila -> worker -> registro); o
    gate de verdade e implementado na Fase 3 (portoes). Falha fecha (retorna
    False), no mesmo espirito do lembrete automatico.
    """
    if not settings.WHATSAPP_BOT_ENABLED:
        return False
    db = SessionLocal()
    try:
        config = db.query(Configuracao).first()
        return bool(config and config.whatsapp_bot_atendimento_habilitado)
    except Exception:
        logger.exception("Falha ao consultar configuracao do bot de atendimento do WhatsApp.")
        return False
    finally:
        db.close()


def _fetch_next_due_job(db: Session, *, now: datetime) -> Optional[WhatsAppBotJob]:
    query = (
        db.query(WhatsAppBotJob)
        .filter(
            WhatsAppBotJob.status == "pending",
            WhatsAppBotJob.scheduled_for <= now,
            WhatsAppBotJob.attempts < _max_attempts(),
        )
        .order_by(WhatsAppBotJob.scheduled_for.asc(), WhatsAppBotJob.id.asc())
    )
    if _is_postgres(db):
        query = query.with_for_update(skip_locked=True)
    return query.first()


def _process_job(db: Session, job: WhatsAppBotJob) -> str:
    """Fase 2 (P2.4): gerador stub - so prova o caminho fila -> worker ->

    registro. Nenhuma geracao real (Fase 4) nem envio (Fase 6) acontece
    aqui; todo job processado termina como `suppressed`.
    """
    db.add(
        WhatsAppBotResposta(
            job_id=job.id,
            wa_identity=job.wa_identity,
            conversation_id=job.conversation_id,
            decisao="suppressed",
            motivo="fase_2_gerador_stub_sem_geracao_real",
        )
    )
    job.status = "done"
    return "done"


def run_whatsapp_bot_worker_due_once(*, limit: int = 50) -> dict[str, int]:
    if not _WORKER_RUN_LOCK.acquire(blocking=False):
        return {"processed": 0, "done": 0, "errors": 0}

    db = SessionLocal()
    pg_lock_key: Optional[int] = None
    pg_lock_acquired = False
    done = 0
    errors = 0
    processed = 0
    try:
        if _distributed_lock_enabled() and _is_postgres(db):
            pg_lock_key = _distributed_lock_key()
            pg_lock_acquired = _try_acquire_pg_lock(db, lock_key=pg_lock_key)
            if not pg_lock_acquired:
                logger.info(
                    "Worker do bot de atendimento WhatsApp ignorou ciclo: lock distribuido ocupado (key=%s).",
                    pg_lock_key,
                )
                return {"processed": 0, "done": 0, "errors": 0}

        max_rows = max(1, int(limit))
        while processed < max_rows:
            job = _fetch_next_due_job(db, now=_utc_now())
            if job is None:
                break
            processed += 1
            job.status = "processing"
            db.commit()

            try:
                result = _process_job(db, job)
            except Exception as exc:
                logger.exception(
                    "Falha inesperada ao processar job do bot de atendimento WhatsApp id=%s",
                    job.id,
                )
                job.attempts = int(job.attempts or 0) + 1
                job.last_error = str(exc)[:800]
                if job.attempts >= _max_attempts():
                    job.status = "error"
                else:
                    # Retry no proximo ciclo do worker, nao dentro desta mesma
                    # chamada - senao o job devido reentraria no `while` e
                    # queimaria todas as tentativas de uma vez.
                    job.status = "pending"
                    job.scheduled_for = _utc_now() + timedelta(seconds=_worker_poll_seconds())
                result = "error"

            if result == "done":
                done += 1
            else:
                errors += 1

            db.commit()

        return {"processed": processed, "done": done, "errors": errors}
    finally:
        if pg_lock_key is not None and pg_lock_acquired:
            try:
                _release_pg_lock(db, lock_key=pg_lock_key)
            except Exception:
                logger.exception("Falha ao liberar lock distribuido do worker do bot de atendimento WhatsApp.")
        db.close()
        _WORKER_RUN_LOCK.release()


def _bot_internal_client_config() -> Optional[tuple[str, dict[str, str], int]]:
    base_url = str(settings.WHATSAPP_AGENDA_SERVICE_URL or "").strip().rstrip("/")
    token = str(settings.WHATSAPP_AGENDA_INTERNAL_TOKEN or "").strip()
    if not base_url or not token:
        return None
    timeout = max(1, int(settings.WHATSAPP_AGENDA_TIMEOUT_SECONDS or 15))
    return base_url, {"x-whatsapp-internal-token": token}, timeout


def _parse_conversation_timestamp(value: Any) -> Optional[datetime]:
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed


def _fetch_recently_active_conversations(
    *, base_url: str, headers: dict[str, str], timeout: int, window_minutes: int
) -> list[dict[str, Any]]:
    cutoff = _utc_now() - timedelta(minutes=window_minutes)
    try:
        response = httpx.get(
            f"{base_url}/conversations",
            params={"limit": 100},
            headers=headers,
            timeout=timeout,
        )
        response.raise_for_status()
        payload = response.json()
    except Exception:
        logger.exception("Falha ao consultar conversas do WhatsApp para reconciliacao do bot.")
        return []

    candidates: list[dict[str, Any]] = []
    for row in payload.get("data") or []:
        last_inbound_at = _parse_conversation_timestamp(row.get("last_inbound_at"))
        if last_inbound_at is not None and last_inbound_at >= cutoff:
            candidates.append(row)
    return candidates


def _fetch_last_message(
    *, base_url: str, headers: dict[str, str], timeout: int, conversation_id: str
) -> Optional[dict[str, Any]]:
    try:
        response = httpx.get(
            f"{base_url}/conversations/{conversation_id}/messages",
            params={"limit": 200, "page": 1},
            headers=headers,
            timeout=timeout,
        )
        response.raise_for_status()
        payload = response.json()
    except Exception:
        logger.exception(
            "Falha ao consultar mensagens da conversa %s para reconciliacao do bot.", conversation_id
        )
        return None

    rows = payload.get("data") or []
    return rows[-1] if rows else None


def run_reconciliation_sweep(db: Session) -> dict[str, int]:
    """RF-006: cobre o caso do backend principal estar fora do ar no momento

    do webhook. So enfileira a ultima mensagem inbound de conversas ativas
    dentro da janela configurada, quando ainda nao existe job para ela -
    `enqueue_job_for_inbound_message` ja cuida do dedupe por wa_message_id.
    """
    client_config = _bot_internal_client_config()
    if client_config is None:
        return {"checked": 0, "enqueued": 0}
    base_url, headers, timeout = client_config

    candidates = _fetch_recently_active_conversations(
        base_url=base_url,
        headers=headers,
        timeout=timeout,
        window_minutes=_reconcile_window_minutes(),
    )

    enqueued = 0
    for conversation in candidates:
        conversation_id = str(conversation.get("id") or "").strip()
        wa_identity = str(conversation.get("wa_phone_number") or "").strip()
        if not conversation_id or not wa_identity:
            continue

        last_message = _fetch_last_message(
            base_url=base_url, headers=headers, timeout=timeout, conversation_id=conversation_id
        )
        if not last_message or last_message.get("from_me"):
            continue

        wa_message_id = str(last_message.get("wa_message_id") or "").strip()
        if not wa_message_id:
            continue

        if enqueue_job_for_inbound_message(
            db,
            wa_identity=wa_identity,
            conversation_id=conversation_id,
            wa_message_id=wa_message_id,
        ):
            enqueued += 1

    return {"checked": len(candidates), "enqueued": enqueued}


def _run_reconciliation_cycle() -> None:
    db = SessionLocal()
    try:
        result = run_reconciliation_sweep(db)
        if result.get("enqueued"):
            logger.info(
                "Reconciliacao do bot de atendimento WhatsApp enfileirou %s job(s) de %s conversa(s) verificada(s).",
                result.get("enqueued"),
                result.get("checked"),
            )
    except Exception:
        logger.exception("Falha na reconciliacao do bot de atendimento WhatsApp.")
    finally:
        db.close()


def _count_pending_jobs() -> int:
    db = SessionLocal()
    try:
        return db.query(WhatsAppBotJob).filter(WhatsAppBotJob.status == "pending").count()
    except Exception:
        logger.exception("Falha ao contar jobs pendentes do bot de atendimento WhatsApp.")
        return 0
    finally:
        db.close()


def _worker_main() -> None:
    global _CYCLE_COUNT, _LAST_CYCLE_AT
    while not _WORKER_STOP_EVENT.is_set():
        try:
            run_whatsapp_bot_worker_due_once(limit=50)
            _CYCLE_COUNT += 1
            if _CYCLE_COUNT % _reconcile_every_cycles() == 0:
                _run_reconciliation_cycle()
        except Exception:
            logger.exception("Falha no worker do bot de atendimento do WhatsApp.")
        finally:
            _LAST_CYCLE_AT = _utc_now()
        if _WORKER_STOP_EVENT.wait(_worker_poll_seconds()):
            break


def get_whatsapp_bot_worker_runtime_state() -> dict[str, Any]:
    with _WORKER_LOCK:
        thread = _WORKER_THREAD
        thread_alive = bool(thread and thread.is_alive())
        worker_started = thread is not None
        stop_signal_set = _WORKER_STOP_EVENT.is_set()
        last_cycle_at = _LAST_CYCLE_AT

    enabled = is_whatsapp_bot_enabled()
    if not thread_alive:
        status = "stopped"
    elif enabled:
        status = "running"
    else:
        status = "idle"

    return {
        "enabled": enabled,
        "status": status,
        "thread_alive": thread_alive,
        "worker_started": worker_started,
        "stop_signal_set": stop_signal_set,
        "poll_seconds": _worker_poll_seconds(),
        "pending_jobs": _count_pending_jobs(),
        "last_cycle_at": last_cycle_at.isoformat() if last_cycle_at else None,
    }


def start_whatsapp_bot_worker() -> None:
    global _WORKER_THREAD
    with _WORKER_LOCK:
        if _WORKER_THREAD and _WORKER_THREAD.is_alive():
            return
        _WORKER_STOP_EVENT.clear()
        _WORKER_THREAD = threading.Thread(
            target=_worker_main,
            name="whatsapp-bot-worker",
            daemon=True,
        )
        _WORKER_THREAD.start()


def shutdown_whatsapp_bot_worker() -> None:
    global _WORKER_THREAD
    with _WORKER_LOCK:
        thread = _WORKER_THREAD
        if not thread:
            return
        _WORKER_STOP_EVENT.set()
    thread.join(timeout=5)
    with _WORKER_LOCK:
        _WORKER_THREAD = None
