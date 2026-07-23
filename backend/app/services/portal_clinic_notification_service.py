from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from fastapi import Request
from sqlalchemy.orm import Session

from app.models.clinica import Clinica
from app.models.portal_clinic_auth import PortalClinicAccount, PortalClinicInvite
from app.services.portal_clinic_auth_service import mask_email, normalize_email
from app.services.portal_delivery_service import PortalDeliveryError, send_portal_email_message

LOCAL_TZ = timezone(timedelta(hours=-3))


@dataclass(frozen=True)
class PortalClinicReleaseNotificationResult:
    status: str
    destination_masked: str | None = None
    provider: str | None = None
    reason: str | None = None


def _as_local_datetime(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    if value.tzinfo is None or value.tzinfo.utcoffset(value) is None:
        return value.replace(tzinfo=LOCAL_TZ)
    return value.astimezone(LOCAL_TZ)


def _format_datetime(value: datetime | None) -> str:
    local_value = _as_local_datetime(value)
    if local_value is None:
        return "agora"
    return local_value.strftime("%d/%m/%Y às %H:%M")


def _build_clinic_portal_url(request: Request | None) -> str:
    if request is None:
        return "/clinica-parceira"
    return f"{str(request.base_url).rstrip('/')}/clinica-parceira"


def resolve_clinic_release_notification_email(db: Session, clinica_id: int) -> str | None:
    account = (
        db.query(PortalClinicAccount)
        .filter(
            PortalClinicAccount.clinica_id == clinica_id,
            PortalClinicAccount.revoked_at.is_(None),
        )
        .order_by(PortalClinicAccount.id.desc())
        .first()
    )
    account_email = normalize_email(getattr(account, "email_normalized", None))
    if account_email:
        return account_email

    invite = (
        db.query(PortalClinicInvite)
        .filter(PortalClinicInvite.clinica_id == clinica_id)
        .order_by(PortalClinicInvite.id.desc())
        .first()
    )
    if invite and invite.contexto_json:
        try:
            context = invite.contexto_json if isinstance(invite.contexto_json, dict) else {}
        except Exception:
            context = {}
        if not context and isinstance(invite.contexto_json, str):
            import json

            try:
                parsed = json.loads(invite.contexto_json or "{}")
            except Exception:
                parsed = {}
            context = parsed if isinstance(parsed, dict) else {}
        invite_email = normalize_email(context.get("account_email"))
        if invite_email:
            return invite_email

    clinica = db.query(Clinica).filter(Clinica.id == clinica_id).first()
    fallback_email = normalize_email(getattr(clinica, "email", None))
    return fallback_email or None


def notify_clinic_report_released(
    *,
    db: Session,
    request: Request | None,
    clinica_id: int,
    clinica_nome: str | None,
    tipo_exame: str,
    paciente_nome: str | None,
    tutor_nome: str | None = None,
    released_at: datetime | None = None,
) -> PortalClinicReleaseNotificationResult:
    destination = resolve_clinic_release_notification_email(db, clinica_id)
    if not destination:
        return PortalClinicReleaseNotificationResult(status="skipped", reason="no_recipient")

    subject = f"Novo laudo liberado no portal - {tipo_exame}"
    body_lines = [
        f"Ola, equipe {clinica_nome or 'parceira'}.",
        "",
        "A Fort Cordis liberou um novo laudo no portal da clinica parceira.",
        f"Exame: {tipo_exame}",
    ]
    if paciente_nome:
        body_lines.append(f"Pet: {paciente_nome}")
    if tutor_nome:
        body_lines.append(f"Tutor: {tutor_nome}")
    body_lines.extend(
        [
            f"Liberado em: {_format_datetime(released_at)}",
            "",
            "Acesse o portal para consultar o resultado e baixar o PDF:",
            _build_clinic_portal_url(request),
            "",
            "Se a unidade ainda nao tiver acesso configurado, responda este email ou fale com a Fort Cordis.",
        ]
    )

    try:
        result = send_portal_email_message(
            destination=destination,
            subject=subject,
            body="\n".join(body_lines),
        )
    except PortalDeliveryError as exc:
        return PortalClinicReleaseNotificationResult(
            status="failed",
            destination_masked=mask_email(destination),
            reason=exc.__class__.__name__,
        )

    return PortalClinicReleaseNotificationResult(
        status="sent",
        destination_masked=mask_email(destination),
        provider=result.provider,
    )
