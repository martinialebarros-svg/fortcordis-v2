from __future__ import annotations

import json
import re
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
    "receiptPdf",
    "receiptPdfBulk",
    "pendingPaymentReminder",
    "pendingPaymentReminderBulk",
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
    subject_ids: Sequence[int] | None = None,
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
        "subject_ids": list(subject_ids or [subject_id]),
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


def send_approved_document_template(
    *,
    template_key: Literal["receiptPdf", "receiptPdfBulk"],
    subject_id: int,
    subject_ids: Sequence[int],
    destination: str,
    parameters: Sequence[str],
    idempotency_key: str,
    document_bytes: bytes,
    filename: str,
) -> dict[str, Any]:
    if not settings.WHATSAPP_AGENDA_ENABLED:
        raise HTTPException(status_code=503, detail="Envio automatico do WhatsApp ainda nao esta habilitado.")

    token = str(settings.WHATSAPP_AGENDA_INTERNAL_TOKEN or "").strip()
    base_url = str(settings.WHATSAPP_AGENDA_SERVICE_URL or "").strip().rstrip("/")
    if not token or not base_url:
        raise HTTPException(status_code=503, detail="Integracao interna do WhatsApp nao configurada.")

    normalized_ids = list(dict.fromkeys(int(item) for item in subject_ids))
    if not normalized_ids or subject_id not in normalized_ids:
        raise WhatsAppTemplateDeliveryError("Referencias de OS invalidas para o recibo PDF.")
    if not document_bytes or len(document_bytes) > 8 * 1024 * 1024 or not document_bytes.startswith(b"%PDF"):
        raise WhatsAppTemplateDeliveryError("O recibo precisa ser um PDF valido de ate 8 MiB.")

    safe_filename = re.sub(r"[^a-zA-Z0-9._-]+", "_", str(filename or "").strip()).lstrip(".")
    if not safe_filename or not safe_filename.lower().endswith(".pdf"):
        raise WhatsAppTemplateDeliveryError("Nome de arquivo PDF invalido.")

    form = {
        "template_key": template_key,
        "subject_type": "ordem_servico",
        "subject_id": str(subject_id),
        "subject_ids": json.dumps(normalized_ids),
        "destination": destination,
        "idempotency_key": idempotency_key,
        "parameters": json.dumps(list(parameters), ensure_ascii=False),
        "filename": safe_filename,
    }
    try:
        response = httpx.post(
            f"{base_url}/automation/document-templates",
            data=form,
            files={"document": (safe_filename, document_bytes, "application/pdf")},
            headers={"X-WhatsApp-Internal-Token": token},
            timeout=max(30, int(settings.WHATSAPP_AGENDA_TIMEOUT_SECONDS or 15)),
        )
    except httpx.HTTPError as exc:
        raise WhatsAppTemplateDeliveryError("Servico do WhatsApp indisponivel para enviar o PDF.") from exc

    if response.status_code >= 400:
        try:
            provider_detail = response.json().get("error")
        except Exception:
            provider_detail = None
        raise WhatsAppTemplateDeliveryError(str(provider_detail or "Falha ao enviar o recibo PDF pelo WhatsApp."))

    payload = response.json()
    if not isinstance(payload, dict) or not payload.get("message_id") or not payload.get("media_id"):
        raise WhatsAppTemplateDeliveryError("Resposta invalida do servico do WhatsApp para o PDF.")
    return payload
