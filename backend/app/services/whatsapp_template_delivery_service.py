from __future__ import annotations

from typing import Any, Literal, Sequence

import httpx
from fastapi import HTTPException

from app.core.config import settings


ApprovedUtilityTemplateKey = Literal[
    "appointmentReminder",
    "appointmentChange",
    "appointmentCancellation",
    "appointmentMissingData",
    "portalReportAvailable",
    "receiptAvailable",
    "pendingPaymentReminder",
]
ApprovedTemplateSubject = Literal["agendamento", "exame", "ordem_servico"]


class WhatsAppTemplateDeliveryError(RuntimeError):
    pass


def send_approved_utility_template(
    *,
    template_key: ApprovedUtilityTemplateKey,
    subject_type: ApprovedTemplateSubject,
    subject_id: int,
    destination: str,
    parameters: Sequence[str],
    idempotency_key: str,
) -> dict[str, Any]:
    if not settings.WHATSAPP_AGENDA_ENABLED:
        raise HTTPException(status_code=503, detail="Envio automatico do WhatsApp ainda nao esta habilitado.")

    token = str(settings.WHATSAPP_AGENDA_INTERNAL_TOKEN or "").strip()
    base_url = str(settings.WHATSAPP_AGENDA_SERVICE_URL or "").strip().rstrip("/")
    if not token or not base_url:
        raise HTTPException(status_code=503, detail="Integracao interna do WhatsApp nao configurada.")

    body = {
        "template_key": template_key,
        "subject_type": subject_type,
        "subject_id": subject_id,
        "destination": destination,
        "idempotency_key": idempotency_key,
        "parameters": list(parameters),
    }
    try:
        response = httpx.post(
            f"{base_url}/automation/templates",
            json=body,
            headers={"X-WhatsApp-Internal-Token": token},
            timeout=max(1, int(settings.WHATSAPP_AGENDA_TIMEOUT_SECONDS or 15)),
        )
    except httpx.HTTPError as exc:
        raise WhatsAppTemplateDeliveryError("Servico do WhatsApp indisponivel.") from exc

    if response.status_code >= 400:
        try:
            provider_detail = response.json().get("error")
        except Exception:
            provider_detail = None
        raise WhatsAppTemplateDeliveryError(str(provider_detail or "Falha ao enviar o modelo pelo WhatsApp."))

    payload = response.json()
    if not isinstance(payload, dict) or not payload.get("message_id"):
        raise WhatsAppTemplateDeliveryError("Resposta invalida do servico do WhatsApp.")
    return payload
