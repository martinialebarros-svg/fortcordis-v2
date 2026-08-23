from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
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
from app.services.auditoria_service import registrar_auditoria

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


class WhatsAppBotRespostaEnviarRequest(BaseModel):
    texto: Optional[str] = Field(
        default=None,
        max_length=900,
        description="Texto editado pelo atendente; ausente usa o rascunho original.",
    )


def _node_client_config() -> tuple[str, dict[str, str], int]:
    base_url = str(settings.WHATSAPP_AGENDA_SERVICE_URL or "").strip().rstrip("/")
    token = str(settings.WHATSAPP_AGENDA_INTERNAL_TOKEN or "").strip()
    timeout = max(1, int(settings.WHATSAPP_AGENDA_TIMEOUT_SECONDS or 15))
    if not base_url or not token:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Serviço interno do WhatsApp não configurado.",
        )
    return base_url, {"x-whatsapp-internal-token": token}, timeout


def _reset_sending_to_draft(db: Session, resposta_id: int) -> None:
    resposta = db.query(WhatsAppBotResposta).filter(WhatsAppBotResposta.id == resposta_id).first()
    if resposta is not None and resposta.decisao == "sending":
        resposta.decisao = "draft"
        resposta.enviado_por_id = None
        db.commit()


def _sent_payload(resposta: WhatsAppBotResposta, *, idempotent: bool) -> dict:
    return {
        "resposta_id": resposta.id,
        "status": "sent",
        "idempotent": idempotent,
        "texto_enviado": resposta.texto_enviado,
    }


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


@router.post("/respostas/{resposta_id}/enviar")
def enviar_rascunho(
    resposta_id: int,
    payload: WhatsAppBotRespostaEnviarRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_papel(*_WHATSAPP_BOT_PAPEIS)),
):
    """RF-028: envia uma única vez o rascunho revisado pelo atendente.

    A transição condicional `draft -> sending` fecha a corrida entre dois
    cliques/processos. Repetir depois de `sent` é idempotente e não chama o
    serviço Node novamente.
    """
    resposta = db.query(WhatsAppBotResposta).filter(WhatsAppBotResposta.id == resposta_id).first()
    if resposta is None:
        raise HTTPException(status_code=404, detail="Rascunho não encontrado.")
    if resposta.decisao == "sent" and resposta.texto_enviado:
        return _sent_payload(resposta, idempotent=True)
    if resposta.decisao != "draft" or resposta.feedback is not None:
        raise HTTPException(status_code=409, detail="Rascunho não está mais disponível.")

    texto = resposta.texto_gerado if payload.texto is None else payload.texto
    texto = str(texto or "").strip()
    if not texto:
        raise HTTPException(status_code=422, detail="O texto do rascunho não pode ficar vazio.")
    if len(texto) > int(settings.WHATSAPP_BOT_MAX_REPLY_CHARS or 900):
        raise HTTPException(status_code=422, detail="O texto excede o limite configurado do bot.")

    base_url, headers, timeout = _node_client_config()

    claimed = (
        db.query(WhatsAppBotResposta)
        .filter(
            WhatsAppBotResposta.id == resposta_id,
            WhatsAppBotResposta.decisao == "draft",
            WhatsAppBotResposta.feedback.is_(None),
            WhatsAppBotResposta.enviado_por_id.is_(None),
        )
        .update(
            {"decisao": "sending", "enviado_por_id": current_user.id},
            synchronize_session=False,
        )
    )
    db.commit()
    if claimed != 1:
        db.expire_all()
        atual = db.query(WhatsAppBotResposta).filter(WhatsAppBotResposta.id == resposta_id).first()
        if atual is not None and atual.decisao == "sent" and atual.texto_enviado:
            return _sent_payload(atual, idempotent=True)
        raise HTTPException(status_code=409, detail="Rascunho já está sendo processado.")

    node_idempotent = False
    try:
        node_response = httpx.post(
            f"{base_url}/conversations/{resposta.conversation_id}/messages",
            headers=headers,
            json={
                "body": texto,
                "type": "text",
                "metadata": {
                    "origem": "bot",
                    "source": "bot_suggest_reviewed",
                    "resposta_id": str(resposta.id),
                    "idempotency_key": f"whatsapp-bot-resposta-{resposta.id}",
                },
            },
            timeout=timeout,
        )
        node_response.raise_for_status()
        try:
            response_payload = node_response.json()
            node_idempotent = bool(
                isinstance(response_payload, dict) and response_payload.get("idempotent", False)
            )
        except Exception:
            node_idempotent = False
    except httpx.HTTPStatusError as exc:
        _reset_sending_to_draft(db, resposta_id)
        response_status = exc.response.status_code
        if response_status == 409:
            try:
                response_code = exc.response.json().get("code")
            except Exception:
                response_code = None
            if response_code == "MESSAGE_SEND_IN_PROGRESS":
                raise HTTPException(
                    status_code=409,
                    detail="O envio deste rascunho já está em processamento.",
                ) from None
            raise HTTPException(
                status_code=409,
                detail="A janela de atendimento do WhatsApp está fechada.",
            ) from None
        raise HTTPException(status_code=502, detail="Falha ao enviar o rascunho pelo WhatsApp.") from None
    except Exception:
        _reset_sending_to_draft(db, resposta_id)
        raise HTTPException(status_code=502, detail="Falha ao acessar o serviço do WhatsApp.") from None

    db.expire_all()
    resposta = db.query(WhatsAppBotResposta).filter(WhatsAppBotResposta.id == resposta_id).first()
    if resposta is None:
        raise HTTPException(status_code=500, detail="Rascunho desapareceu após o envio.")
    resposta.decisao = "sent"
    resposta.texto_enviado = texto
    resposta.feedback = "positivo"
    resposta.enviado_por_id = current_user.id
    pause_conversation(db, resposta.wa_identity, atualizado_por_id=current_user.id)
    db.commit()
    db.refresh(resposta)
    registrar_auditoria(
        current_user=current_user,
        modulo="whatsapp_chatbot",
        entidade="whatsapp_bot_resposta",
        entidade_id=resposta.id,
        acao="ENVIAR_RASCUNHO",
        descricao="Rascunho do chatbot revisado e enviado por atendente.",
        detalhes={"editado": texto != str(resposta.texto_gerado or "").strip()},
    )
    return _sent_payload(resposta, idempotent=node_idempotent)


@router.post("/respostas/{resposta_id}/descartar")
def descartar_rascunho(
    resposta_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_papel(*_WHATSAPP_BOT_PAPEIS)),
):
    """RF-028: descarta sem enviar e registra feedback negativo."""
    updated = (
        db.query(WhatsAppBotResposta)
        .filter(
            WhatsAppBotResposta.id == resposta_id,
            WhatsAppBotResposta.decisao == "draft",
            WhatsAppBotResposta.feedback.is_(None),
        )
        .update(
            {"feedback": "negativo", "enviado_por_id": current_user.id},
            synchronize_session=False,
        )
    )
    db.commit()
    if updated != 1:
        resposta = db.query(WhatsAppBotResposta).filter(WhatsAppBotResposta.id == resposta_id).first()
        if resposta is None:
            raise HTTPException(status_code=404, detail="Rascunho não encontrado.")
        if resposta.feedback == "negativo":
            return {"resposta_id": resposta.id, "status": "discarded", "idempotent": True}
        raise HTTPException(status_code=409, detail="Rascunho não está mais disponível.")
    registrar_auditoria(
        current_user=current_user,
        modulo="whatsapp_chatbot",
        entidade="whatsapp_bot_resposta",
        entidade_id=resposta_id,
        acao="DESCARTAR_RASCUNHO",
        descricao="Rascunho do chatbot descartado por atendente, sem envio.",
    )
    return {"resposta_id": resposta_id, "status": "discarded", "idempotent": False}


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
