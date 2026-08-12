from __future__ import annotations

import secrets
from typing import Literal

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import get_current_user
from app.db.database import get_db
from app.models.agendamento import Agendamento
from app.models.user import User
from app.services.auditoria_service import registrar_auditoria
from app.services.whatsapp_agenda_service import (
    WhatsAppAgendaDeliveryError,
    build_reservation_template,
    process_button_response,
    send_reservation_template,
)


router = APIRouter()


class ReservationSendRequest(BaseModel):
    destination: str = Field(..., min_length=10, max_length=32)
    recipient_type: Literal["clinica", "tutor"]
    idempotency_key: str = Field(..., min_length=8, max_length=128)


class ReservationButtonResponseRequest(BaseModel):
    provider_message_id: str = Field(..., min_length=8, max_length=160)
    outbound_message_id: str | None = Field(default=None, max_length=160)
    agendamento_id: int = Field(..., gt=0)
    action: Literal["confirmar", "solicitar_alteracao"]
    from_phone: str = Field(..., min_length=10, max_length=32)


def _require_internal_token(
    x_fortcordis_whatsapp_token: str | None = Header(default=None),
) -> None:
    configured = str(settings.WHATSAPP_AGENDA_INTERNAL_TOKEN or "").strip()
    supplied = str(x_fortcordis_whatsapp_token or "").strip()
    if not configured or not supplied or not secrets.compare_digest(configured, supplied):
        raise HTTPException(status_code=401, detail="Credencial interna do WhatsApp invalida.")


@router.post("/agenda/{agendamento_id}/whatsapp/reserva")
def send_reservation(
    agendamento_id: int,
    payload: ReservationSendRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    agendamento = db.query(Agendamento).filter(Agendamento.id == agendamento_id).first()
    if agendamento is None:
        raise HTTPException(status_code=404, detail="Agendamento nao encontrado.")

    template = build_reservation_template(
        db,
        agendamento=agendamento,
        destination=payload.destination,
        recipient_type=payload.recipient_type,
    )
    try:
        result = send_reservation_template(
            agendamento_id=agendamento.id,
            template=template,
            idempotency_key=payload.idempotency_key,
        )
    except WhatsAppAgendaDeliveryError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    registrar_auditoria(
        current_user=current_user,
        modulo="agenda",
        entidade="agendamento",
        entidade_id=agendamento.id,
        acao="RESERVA_WHATSAPP_TEMPLATE_ENVIADO",
        descricao="Modelo de reserva enviado pela WhatsApp Cloud API.",
        detalhes={
            "recipient_type": payload.recipient_type,
            "destination_suffix": template.destination[-4:],
            "provider_message_id": result.get("message_id"),
            "idempotent": bool(result.get("idempotent")),
        },
        request=request,
    )
    return result


@router.post("/integracoes/whatsapp/agenda/respostas")
def receive_button_response(
    payload: ReservationButtonResponseRequest,
    request: Request,
    _authenticated: None = Depends(_require_internal_token),
    db: Session = Depends(get_db),
):
    result, idempotent = process_button_response(
        db,
        provider_message_id=payload.provider_message_id,
        outbound_message_id=payload.outbound_message_id,
        agendamento_id=payload.agendamento_id,
        action=payload.action,
        from_phone=payload.from_phone,
    )
    result = {**result, "idempotent": idempotent}

    registrar_auditoria(
        current_user=None,
        modulo="agenda",
        entidade="agendamento",
        entidade_id=payload.agendamento_id,
        acao="RESERVA_WHATSAPP_RESPOSTA_PROCESSADA",
        descricao="Resposta de botao do WhatsApp processada.",
        detalhes={
            "provider_message_id": payload.provider_message_id,
            "action": payload.action,
            "result": result.get("result"),
            "idempotent": idempotent,
        },
        request=request,
    )

    if not idempotent:
        try:
            from app.api.v1.endpoints.agenda import _notificar_agenda_update

            _notificar_agenda_update(
                db,
                action="whatsapp_reserva_resposta",
                agendamento_id=payload.agendamento_id,
                data=result,
            )
        except Exception:
            pass
    return result
