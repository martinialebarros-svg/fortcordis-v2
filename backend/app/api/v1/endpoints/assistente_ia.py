from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import require_papel
from app.db.database import get_db
from app.models.user import User
from app.schemas.assistente_ia import AssistenteIAAcaoDecisaoRequest, AssistenteIAChatRequest
from app.services.assistente_ia_service import (
    AssistenteIAProviderError,
    conversation_detail,
    create_conversation,
    get_owned_conversation,
    list_conversations,
    run_assistant_turn,
    serialize_conversation,
)
from app.services.assistente_ia_tools import decide_pending_action

router = APIRouter()


@router.get("/status")
def assistente_ia_status(
    current_user: User = Depends(require_papel("admin")),
):
    return {
        "enabled": bool(settings.ASSISTENTE_IA_ENABLED),
        "configured": bool(str(settings.OPENAI_API_KEY or "").strip()),
        "model": str(settings.ASSISTENTE_IA_MODEL),
        "admin_only": True,
        "capabilities": [
            "faturamento",
            "agenda",
            "disponibilidade",
            "criacao_de_horario_com_confirmacao",
            "reserva_com_confirmacao",
            "mensagem_whatsapp_manual",
            "debitos_pendentes",
            "exclusao_com_confirmacao",
        ],
    }


@router.get("/conversas")
def listar_conversas_assistente_ia(
    limit: int = Query(default=40, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_papel("admin")),
):
    return {"items": list_conversations(db, current_user, limit=limit)}


@router.post("/conversas")
def criar_conversa_assistente_ia(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_papel("admin")),
):
    return serialize_conversation(create_conversation(db, current_user))


@router.get("/conversas/{conversation_id}")
def obter_conversa_assistente_ia(
    conversation_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_papel("admin")),
):
    return conversation_detail(db, current_user, conversation_id)


@router.post("/chat")
def conversar_com_assistente_ia(
    payload: AssistenteIAChatRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_papel("admin")),
):
    conversation = (
        get_owned_conversation(db, current_user, payload.conversa_id)
        if payload.conversa_id
        else create_conversation(db, current_user)
    )
    try:
        return run_assistant_turn(
            db=db,
            current_user=current_user,
            request=request,
            message=payload.mensagem,
            conversation=conversation,
        )
    except AssistenteIAProviderError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@router.post("/acoes/{action_id}/decisao")
def decidir_acao_assistente_ia(
    action_id: str,
    payload: AssistenteIAAcaoDecisaoRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_papel("admin")),
):
    action = decide_pending_action(
        db=db,
        current_user=current_user,
        request=request,
        action_id=action_id,
        decision=payload.decisao,
        observation=payload.observacao,
    )
    return {"action": action}
