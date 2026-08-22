from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import require_any_papel
from app.db.database import get_db
from app.models.configuracao import Configuracao
from app.models.user import User
from app.models.whatsapp_bot import WhatsAppBotConversaEstado, WhatsAppBotJob, WhatsAppBotResposta
from app.services.whatsapp_bot_gates import (
    MODOS_VALIDOS,
    is_locally_paused,
    is_whatsapp_bot_enabled,
    pause_conversation,
    resolve_conversation_mode,
    resolve_conversation_state,
)

router = APIRouter()

_WHATSAPP_BOT_PAPEIS = ("admin", "recepcao", "veterinario", "cardiologista")


class WhatsAppBotConversaEstadoUpdateRequest(BaseModel):
    modo: Optional[str] = Field(default=None)
    pausar: Optional[bool] = Field(
        default=None,
        description=(
            "true pausa a conversa por WHATSAPP_BOT_HANDOFF_PAUSE_HOURS; "
            "false limpa a pausa vigente (RF-030)."
        ),
    )


def _estado_payload(db: Session, wa_identity: str) -> dict:
    estado = resolve_conversation_state(db, wa_identity)
    modo = resolve_conversation_mode(db, wa_identity, estado=estado)
    rascunho = (
        db.query(WhatsAppBotResposta)
        .filter(
            WhatsAppBotResposta.wa_identity == wa_identity,
            WhatsAppBotResposta.decisao == "draft",
            WhatsAppBotResposta.feedback.is_(None),
        )
        .order_by(WhatsAppBotResposta.id.desc())
        .first()
    )
    return {
        "wa_identity": wa_identity,
        "modo": modo,
        "modo_origem": "conversa" if estado is not None and estado.modo else "institucional",
        "pausado_ate": estado.pausado_ate.isoformat() if estado and estado.pausado_ate else None,
        "pausado": is_locally_paused(estado),
        "handoff_motivo": estado.handoff_motivo if estado else None,
        "rascunho_pendente": (
            {
                "resposta_id": rascunho.id,
                "texto_gerado": rascunho.texto_gerado,
                "criado_em": rascunho.created_at.isoformat() if rascunho.created_at else None,
            }
            if rascunho is not None
            else None
        ),
    }


@router.get("/conversas/{wa_identity}/estado")
def get_conversa_estado(
    wa_identity: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_papel(*_WHATSAPP_BOT_PAPEIS)),
):
    del current_user
    return _estado_payload(db, wa_identity)


@router.patch("/conversas/{wa_identity}/estado")
def atualizar_conversa_estado(
    wa_identity: str,
    payload: WhatsAppBotConversaEstadoUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_papel(*_WHATSAPP_BOT_PAPEIS)),
):
    """RF-030: por conversa, a central permite alternar `auto`/`suggest`/`off`

    e pausar o bot - sem exigir papel de admin (esse e o controle operacional
    do dia a dia; o toggle institucional em Configuracoes e que e admin-only).
    """
    if payload.modo is not None:
        modo_normalizado = payload.modo.strip().lower()
        if modo_normalizado not in MODOS_VALIDOS:
            raise HTTPException(
                status_code=422, detail="modo deve ser 'off', 'suggest' ou 'auto'."
            )
        estado = resolve_conversation_state(db, wa_identity)
        if estado is None:
            estado = WhatsAppBotConversaEstado(wa_identity=wa_identity)
            db.add(estado)
        estado.modo = modo_normalizado
        estado.atualizado_por_id = current_user.id

    if payload.pausar is True:
        pause_conversation(db, wa_identity, atualizado_por_id=current_user.id)
    elif payload.pausar is False:
        estado = resolve_conversation_state(db, wa_identity)
        if estado is not None:
            estado.pausado_ate = None
            estado.atualizado_por_id = current_user.id

    db.commit()
    return _estado_payload(db, wa_identity)


@router.get("/preview")
def preview_whatsapp_bot(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_papel(*_WHATSAPP_BOT_PAPEIS)),
):
    """CA-019: somente leitura - nenhum job e alterado, nada e gerado nem

    enviado. Serve para inspecionar o estado atual antes/depois de habilitar
    o bot, no mesmo espirito do `lembrete-preview`.
    """
    del current_user
    config = db.query(Configuracao).first()

    jobs_por_status = dict(
        db.query(WhatsAppBotJob.status, func.count(WhatsAppBotJob.id))
        .group_by(WhatsAppBotJob.status)
        .all()
    )
    respostas_por_decisao = dict(
        db.query(WhatsAppBotResposta.decisao, func.count(WhatsAppBotResposta.id))
        .group_by(WhatsAppBotResposta.decisao)
        .all()
    )

    return {
        "checked_at": datetime.now(timezone.utc).isoformat(),
        "whatsapp_bot_enabled_env": bool(settings.WHATSAPP_BOT_ENABLED),
        "whatsapp_bot_atendimento_habilitado_banco": bool(
            getattr(config, "whatsapp_bot_atendimento_habilitado", False)
        ),
        "whatsapp_bot_ativo": is_whatsapp_bot_enabled(),
        "whatsapp_bot_modo_institucional": getattr(config, "whatsapp_bot_modo", None) or "suggest",
        "jobs_por_status": jobs_por_status,
        "respostas_por_decisao": respostas_por_decisao,
    }
