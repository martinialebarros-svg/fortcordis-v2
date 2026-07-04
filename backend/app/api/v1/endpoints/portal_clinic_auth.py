from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import require_papel
from app.db.database import get_db
from app.models.portal_clinic_auth import (
    PortalAuthChallenge,
    PortalClinicAccount,
    PortalClinicInvite,
    PortalClinicSession,
)
from app.models.user import User
from app.schemas.portal import (
    PortalAdminClinicAccessSummaryResponse,
    PortalAdminClinicAccountRevokeRequest,
    PortalAdminClinicAccountRevokeResponse,
    PortalAdminClinicInviteCreateRequest,
    PortalAdminClinicInviteRevokeRequest,
    PortalAdminClinicInviteRevokeResponse,
    PortalAdminClinicInviteResponse,
    PortalAdminClinicInviteSnapshot,
    PortalAdminClinicAccountSnapshot,
    PortalAdminClinicSessionSnapshot,
    PortalAdminClinicSessionsRevokeRequest,
    PortalAdminClinicSessionsRevokeResponse,
    PortalChallengeResponse,
    PortalClinicActivationRequest,
    PortalClinicActivationResponse,
    PortalClinicAuthResponse,
    PortalClinicInviteStatusResponse,
    PortalClinicLoginRequest,
    PortalClinicMfaVerifyRequest,
    PortalCodeVerifyRequest,
    PortalPasswordResetConfirmRequest,
    PortalPasswordResetRequest,
    PortalSimpleAcceptedResponse,
)
from app.services.auditoria_service import registrar_auditoria
from app.services.portal_clinic_auth_service import (
    ACCOUNT_STATUS_ACTIVE,
    ACCOUNT_STATUS_LOCKED,
    ACCOUNT_STATUS_PENDING,
    ACCOUNT_STATUS_REVOKED,
    CHALLENGE_TYPE_EMAIL_VERIFICATION,
    CHALLENGE_TYPE_LOGIN_MFA,
    INVITE_STATUS_PENDING,
    INVITE_STATUS_REVOKED,
    INVITE_STATUS_USED,
    SESSION_STATUS_ACTIVE,
    SESSION_STATUS_LOGGED_OUT,
    build_activation_url,
    build_password_reset_url,
    clear_portal_refresh_cookie,
    create_auth_challenge,
    create_clinic_invite,
    create_or_replace_pending_account,
    create_password_reset_token,
    expire_invite_if_needed,
    get_account_by_email,
    get_active_clinica_or_404,
    get_invite_by_raw_token,
    get_password_reset_token,
    get_portal_refresh_cookie,
    get_session_by_refresh_token,
    generate_opaque_token,
    hash_password,
    hash_secret,
    issue_clinic_session,
    json_load_dict,
    mask_email,
    maybe_require_mfa,
    normalize_email,
    request_user_agent_hash,
    revoke_session,
    revoke_sessions_for_clinica,
    send_login_mfa_code,
    send_password_reset_email,
    send_whatsapp_invite,
    set_portal_refresh_cookie,
    utcnow,
    validate_password_reset_token_or_401,
    verify_auth_challenge_code,
    verify_password,
)

router = APIRouter()


def _require_portal_admin(current_user: User = Depends(require_papel("admin"))) -> User:
    return current_user


def _assert_invite_auth_enabled() -> None:
    if not settings.PORTAL_CLINIC_INVITE_AUTH_ENABLED:
        raise HTTPException(status_code=404, detail="Fluxo de convite da clinica indisponivel.")


def _assert_password_login_enabled() -> None:
    _assert_invite_auth_enabled()
    if not settings.PORTAL_CLINIC_PASSWORD_LOGIN_ENABLED:
        raise HTTPException(status_code=404, detail="Login de clinica por senha indisponivel.")


def _generic_reset_response() -> PortalSimpleAcceptedResponse:
    return PortalSimpleAcceptedResponse(
        message="Se existir uma conta ativa para este email, enviaremos as instrucoes de redefinicao.",
    )


def _invite_snapshot(invite: PortalClinicInvite | None) -> PortalAdminClinicInviteSnapshot | None:
    if invite is None:
        return None
    return PortalAdminClinicInviteSnapshot(
        id=invite.id,
        status=invite.status,
        delivery_channel=invite.delivery_channel,
        delivery_target_masked=invite.delivery_target_masked,
        expires_at=invite.expires_at,
        created_at=invite.created_at,
        delivered_at=invite.delivered_at,
        used_at=invite.used_at,
        revoked_at=invite.revoked_at,
    )


def _account_snapshot(account: PortalClinicAccount | None) -> PortalAdminClinicAccountSnapshot | None:
    if account is None:
        return None
    return PortalAdminClinicAccountSnapshot(
        id=account.id,
        status=account.status,
        email_masked=mask_email(account.email_normalized),
        responsavel_nome=account.responsavel_nome,
        email_verified_at=account.email_verified_at,
        activated_at=account.activated_at,
        last_login_at=account.last_login_at,
        force_mfa_on_next_login=bool(account.force_mfa_on_next_login),
        revoked_at=account.revoked_at,
    )


def _session_snapshot(session: PortalClinicSession) -> PortalAdminClinicSessionSnapshot:
    return PortalAdminClinicSessionSnapshot(
        id=session.id,
        status=session.status,
        trusted_until=session.trusted_until,
        created_at=session.created_at,
        last_seen_at=session.last_seen_at,
        revoked_at=session.revoked_at,
        device_label=session.device_label,
    )


def _login_result_response(result, *, message: str | None = None) -> PortalClinicAuthResponse:
    return PortalClinicAuthResponse(
        access_token=result.access_token,
        expires_at=result.expires_at,
        actor_type="clinica",
        actor_id=result.clinica_id,
        clinica_id=result.clinica_id,
        account_id=result.account_id,
        auth_method=result.auth_method,
        trusted_session_expires_at=result.trusted_session_expires_at,
        scope=result.scope,
        message=message,
    )


@router.get("/admin/clinicas/{clinica_id}/acesso", response_model=PortalAdminClinicAccessSummaryResponse)
def consultar_acesso_clinica_admin(
    clinica_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(_require_portal_admin),
):
    _assert_invite_auth_enabled()
    clinica = get_active_clinica_or_404(db, clinica_id)

    latest_invite = (
        db.query(PortalClinicInvite)
        .filter(PortalClinicInvite.clinica_id == clinica.id)
        .order_by(PortalClinicInvite.id.desc())
        .first()
    )
    if latest_invite:
        expire_invite_if_needed(db, latest_invite)
        db.refresh(latest_invite)

    latest_account = (
        db.query(PortalClinicAccount)
        .filter(PortalClinicAccount.clinica_id == clinica.id)
        .order_by(PortalClinicAccount.id.desc())
        .first()
    )
    active_sessions = (
        db.query(PortalClinicSession)
        .filter(
            PortalClinicSession.clinica_id == clinica.id,
            PortalClinicSession.status == SESSION_STATUS_ACTIVE,
        )
        .order_by(PortalClinicSession.trusted_until.desc(), PortalClinicSession.id.desc())
        .all()
    )

    return PortalAdminClinicAccessSummaryResponse(
        clinica_id=clinica.id,
        clinica_nome=clinica.nome,
        invite=_invite_snapshot(latest_invite),
        account=_account_snapshot(latest_account),
        active_session_count=len(active_sessions),
        active_sessions=[_session_snapshot(session) for session in active_sessions],
    )


@router.post("/admin/clinicas/{clinica_id}/convites", response_model=PortalAdminClinicInviteResponse)
def criar_convite_clinica(
    clinica_id: int,
    payload: PortalAdminClinicInviteCreateRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(_require_portal_admin),
):
    _assert_invite_auth_enabled()
    clinica = get_active_clinica_or_404(db, clinica_id)
    invite, raw_token = create_clinic_invite(
        db,
        clinica_id=clinica.id,
        delivery_channel=payload.delivery_channel,
        delivery_target=payload.delivery_target,
        account_email=payload.account_email,
        expires_in_hours=payload.expires_in_hours,
        created_by_user_id=current_user.id,
    )
    activation_url = build_activation_url(request, raw_token)
    delivery_status = "manual_copy"
    delivery_provider = None

    if settings.PORTAL_WHATSAPP_ENABLED:
        try:
            result = send_whatsapp_invite(
                destination=payload.delivery_target,
                clinica_nome=clinica.nome,
                activation_url=activation_url,
                expires_in_hours=payload.expires_in_hours,
            )
            invite.delivered_at = utcnow()
            db.commit()
            delivery_status = "sent"
            delivery_provider = result.provider
        except Exception:
            if not payload.allow_manual_copy:
                raise HTTPException(
                    status_code=502,
                    detail="Nao foi possivel enviar o convite por WhatsApp.",
                )
    elif not payload.allow_manual_copy:
        raise HTTPException(
            status_code=400,
            detail="Envio automatico por WhatsApp indisponivel neste ambiente.",
        )

    registrar_auditoria(
        current_user=current_user,
        modulo="portal",
        entidade="portal_clinic_invite",
        acao="PORTAL_CLINIC_INVITE_CREATED",
        descricao="Convite da clinica parceira criado.",
        entidade_id=invite.id,
        detalhes={
            "clinica_id": clinica.id,
            "delivery_channel": payload.delivery_channel,
            "delivery_status": delivery_status,
        },
        request=request,
    )
    return PortalAdminClinicInviteResponse(
        invite_id=invite.id,
        status=invite.status,
        expires_at=invite.expires_at,
        activation_url=activation_url,
        delivery_channel=invite.delivery_channel,
        delivery_target_masked=invite.delivery_target_masked,
        account_email_masked=mask_email(payload.account_email) if payload.account_email else None,
        delivery_status=delivery_status,
        delivery_provider=delivery_provider,
    )


@router.post(
    "/admin/clinicas/{clinica_id}/convites/{invite_id}/revogar",
    response_model=PortalAdminClinicInviteRevokeResponse,
)
def revogar_convite_clinica(
    clinica_id: int,
    invite_id: int,
    payload: PortalAdminClinicInviteRevokeRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(_require_portal_admin),
):
    _assert_invite_auth_enabled()
    clinica = get_active_clinica_or_404(db, clinica_id)
    invite = (
        db.query(PortalClinicInvite)
        .filter(
            PortalClinicInvite.id == invite_id,
            PortalClinicInvite.clinica_id == clinica.id,
        )
        .first()
    )
    if not invite:
        raise HTTPException(status_code=404, detail="Convite da clinica nao encontrado.")
    expire_invite_if_needed(db, invite)
    if invite.status != INVITE_STATUS_PENDING:
        raise HTTPException(status_code=409, detail="Convite da clinica nao pode mais ser revogado.")

    invite.status = INVITE_STATUS_REVOKED
    invite.revoked_at = utcnow()
    db.commit()
    db.refresh(invite)

    registrar_auditoria(
        current_user=current_user,
        modulo="portal",
        entidade="portal_clinic_invite",
        acao="PORTAL_CLINIC_INVITE_REVOKED",
        descricao="Convite da clinica revogado pela operacao.",
        entidade_id=invite.id,
        detalhes={
            "clinica_id": clinica.id,
            "reason": payload.reason,
        },
        request=request,
    )
    return PortalAdminClinicInviteRevokeResponse(
        status=invite.status,
        revoked_at=invite.revoked_at or utcnow(),
    )


@router.post("/admin/clinica-accounts/{account_id}/revogar", response_model=PortalAdminClinicAccountRevokeResponse)
def revogar_conta_clinica(
    account_id: int,
    payload: PortalAdminClinicAccountRevokeRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(_require_portal_admin),
):
    _assert_invite_auth_enabled()
    account = db.query(PortalClinicAccount).filter(PortalClinicAccount.id == account_id).first()
    if not account:
        raise HTTPException(status_code=404, detail="Conta da clinica nao encontrada.")

    account.status = ACCOUNT_STATUS_REVOKED
    account.revoked_at = utcnow()
    db.commit()
    if payload.revoke_sessions:
        revoke_sessions_for_clinica(
            db,
            clinica_id=account.clinica_id,
            reason=payload.reason,
        )

    registrar_auditoria(
        current_user=current_user,
        modulo="portal",
        entidade="portal_clinic_account",
        acao="PORTAL_CLINIC_ACCOUNT_REVOKED",
        descricao="Conta da clinica revogada pela operacao.",
        entidade_id=account.id,
        detalhes={
            "clinica_id": account.clinica_id,
            "revoke_sessions": payload.revoke_sessions,
        },
        request=request,
    )
    return PortalAdminClinicAccountRevokeResponse(
        status=account.status,
        revoked_at=account.revoked_at or utcnow(),
    )


@router.post("/admin/clinica-sessions/revogar", response_model=PortalAdminClinicSessionsRevokeResponse)
def revogar_sessoes_clinica(
    payload: PortalAdminClinicSessionsRevokeRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(_require_portal_admin),
):
    _assert_invite_auth_enabled()
    revoked_count = revoke_sessions_for_clinica(
        db,
        clinica_id=payload.clinica_id,
        session_id=payload.session_id,
        reason=payload.reason,
    )
    registrar_auditoria(
        current_user=current_user,
        modulo="portal",
        entidade="portal_clinic_session",
        acao="PORTAL_CLINIC_SESSION_REVOKED",
        descricao="Sessao(oes) da clinica revogada(s) pela operacao.",
        entidade_id=payload.session_id or payload.clinica_id,
        detalhes={
            "clinica_id": payload.clinica_id,
            "session_id": payload.session_id,
            "revoked_count": revoked_count,
        },
        request=request,
    )
    return PortalAdminClinicSessionsRevokeResponse(revoked_count=revoked_count)


@router.get("/clinicas/convites/{invite_token}", response_model=PortalClinicInviteStatusResponse)
def consultar_convite_clinica(
    invite_token: str,
    db: Session = Depends(get_db),
):
    _assert_invite_auth_enabled()
    invite = get_invite_by_raw_token(db, invite_token)
    if not invite:
        raise HTTPException(status_code=404, detail="Convite da clinica nao encontrado.")
    clinica = get_active_clinica_or_404(db, invite.clinica_id)
    account = (
        db.query(PortalClinicAccount)
        .filter(
            PortalClinicAccount.clinica_id == clinica.id,
            PortalClinicAccount.status.in_([ACCOUNT_STATUS_PENDING, ACCOUNT_STATUS_ACTIVE]),
        )
        .order_by(PortalClinicAccount.id.desc())
        .first()
    )
    invite_context = json_load_dict(invite.contexto_json)
    invite_account_email = invite_context.get("account_email")
    if account:
        email_hint = mask_email(account.email_normalized)
    elif invite_account_email:
        email_hint = mask_email(invite_account_email)
    else:
        email_hint = None
    return PortalClinicInviteStatusResponse(
        status=invite.status,
        clinica_id=clinica.id,
        clinica_nome=clinica.nome,
        unidade_nome=clinica.nome,
        expires_at=invite.expires_at,
        can_activate=invite.status == INVITE_STATUS_PENDING and not expire_invite_if_needed(db, invite),
        email_hint=email_hint,
    )


@router.post("/clinicas/ativacao", response_model=PortalClinicActivationResponse)
def ativar_conta_clinica(
    payload: PortalClinicActivationRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    _assert_invite_auth_enabled()
    if payload.password != payload.password_confirmation:
        raise HTTPException(status_code=422, detail="A confirmacao de senha nao confere.")

    invite = get_invite_by_raw_token(db, payload.invite_token)
    if not invite:
        raise HTTPException(status_code=404, detail="Convite da clinica nao encontrado.")
    if expire_invite_if_needed(db, invite) or invite.status != INVITE_STATUS_PENDING:
        raise HTTPException(status_code=409, detail="Convite da clinica indisponivel para ativacao.")

    clinica = get_active_clinica_or_404(db, invite.clinica_id)
    invite_context = json_load_dict(invite.contexto_json)
    invite_email = normalize_email(invite_context.get("account_email"))
    requested_email = normalize_email(payload.email)
    account_email = invite_email or requested_email
    if not account_email:
        raise HTTPException(status_code=422, detail="Informe o email institucional da clinica.")
    if invite_email and requested_email and requested_email != invite_email:
        raise HTTPException(status_code=422, detail="Email institucional diferente do convite.")

    account = create_or_replace_pending_account(
        db,
        clinica_id=clinica.id,
        email=account_email,
        responsavel_nome=payload.responsavel_nome,
        password=payload.password,
    )
    now = utcnow()
    account.status = ACCOUNT_STATUS_ACTIVE
    account.email_verified_at = now
    account.activated_at = now
    account.force_mfa_on_next_login = False
    invite.status = INVITE_STATUS_USED
    invite.used_at = now
    db.commit()

    result = issue_clinic_session(
        db,
        account=account,
        request=request,
        remember_device_until_shift_end=True,
        auth_reference=f"invite:{invite.id}:{account.id}:{int(datetime.utcnow().timestamp())}",
        auth_method="invite_activation",
    )
    if result.refresh_token and result.trusted_session_expires_at:
        set_portal_refresh_cookie(
            response,
            result.refresh_token,
            expires_at=result.trusted_session_expires_at,
            request=request,
        )
    account.last_login_at = utcnow()
    db.commit()

    registrar_auditoria(
        current_user=None,
        modulo="portal",
        entidade="portal_clinic_account",
        acao="PORTAL_CLINIC_ACCOUNT_ACTIVATED_BY_INVITE",
        descricao="Conta da clinica ativada por convite seguro.",
        entidade_id=account.id,
        detalhes={
            "clinica_id": clinica.id,
            "invite_id": invite.id,
            "auto_session": True,
        },
        request=request,
    )
    return PortalClinicActivationResponse(
        activation_id=account.id,
        access_token=result.access_token,
        expires_at=result.expires_at,
        actor_type="clinica",
        actor_id=result.clinica_id,
        clinica_id=result.clinica_id,
        account_id=result.account_id,
        auth_method=result.auth_method,
        trusted_session_expires_at=result.trusted_session_expires_at,
        scope=result.scope,
        message="Conta da clinica criada com sucesso. Acesso liberado neste computador.",
    )


@router.post("/auth/email/verificar", response_model=PortalChallengeResponse)
def verificar_email_conta_clinica(
    payload: PortalCodeVerifyRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    _assert_invite_auth_enabled()
    challenge = (
        db.query(PortalAuthChallenge)
        .filter(PortalAuthChallenge.challenge_id == payload.challenge_id)
        .first()
    )
    if not challenge or challenge.challenge_type != CHALLENGE_TYPE_EMAIL_VERIFICATION:
        raise HTTPException(status_code=401, detail="Codigo invalido ou expirado.")

    verify_auth_challenge_code(db, challenge=challenge, code=payload.codigo)
    account = db.query(PortalClinicAccount).filter(PortalClinicAccount.id == challenge.account_id).first()
    if not account:
        raise HTTPException(status_code=404, detail="Conta da clinica nao encontrada.")
    account.status = ACCOUNT_STATUS_ACTIVE
    account.email_verified_at = utcnow()
    account.activated_at = utcnow()
    account.force_mfa_on_next_login = False
    db.commit()

    invite_id = json_load_dict(challenge.contexto_json).get("invite_id")
    if invite_id:
        from app.models.portal_clinic_auth import PortalClinicInvite

        invite = db.query(PortalClinicInvite).filter(PortalClinicInvite.id == int(invite_id)).first()
        if invite and invite.status == INVITE_STATUS_PENDING:
            invite.status = INVITE_STATUS_USED
            invite.used_at = utcnow()
            db.commit()

    registrar_auditoria(
        current_user=None,
        modulo="portal",
        entidade="portal_clinic_account",
        acao="PORTAL_CLINIC_EMAIL_VERIFIED",
        descricao="Email institucional da clinica verificado com sucesso.",
        entidade_id=account.id,
        detalhes={"clinica_id": account.clinica_id},
        request=request,
    )
    return PortalChallengeResponse(
        challenge_id=challenge.challenge_id,
        message="Email institucional verificado com sucesso.",
        expires_in_seconds=0,
        debug_code=None,
    )


@router.post("/auth/login", response_model=PortalClinicAuthResponse)
def login_clinica_com_senha(
    payload: PortalClinicLoginRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    _assert_password_login_enabled()
    account = get_account_by_email(db, payload.email)
    if not account or account.status not in {ACCOUNT_STATUS_ACTIVE, ACCOUNT_STATUS_LOCKED}:
        raise HTTPException(status_code=401, detail="Email ou senha incorretos.")
    if account.status == ACCOUNT_STATUS_REVOKED:
        raise HTTPException(status_code=403, detail="Conta da clinica indisponivel.")
    if account.email_verified_at is None:
        raise HTTPException(status_code=403, detail="Email institucional ainda nao verificado.")
    if not verify_password(payload.password, account.password_hash):
        raise HTTPException(status_code=401, detail="Email ou senha incorretos.")

    clinica = get_active_clinica_or_404(db, account.clinica_id)
    if maybe_require_mfa(account, remember_device_until_shift_end=payload.remember_device_until_shift_end):
        challenge, raw_code = create_auth_challenge(
            db,
            account_id=account.id,
            clinica_id=clinica.id,
            challenge_type=CHALLENGE_TYPE_LOGIN_MFA,
            context={"remember_device_until_shift_end": payload.remember_device_until_shift_end},
            expires_minutes=settings.PORTAL_CLINIC_MFA_EXPIRE_MINUTES,
        )
        try:
            send_login_mfa_code(
                destination=account.email_normalized,
                responsavel_nome=account.responsavel_nome,
                clinica_nome=clinica.nome,
                code=raw_code,
                expires_in_minutes=settings.PORTAL_CLINIC_MFA_EXPIRE_MINUTES,
            )
        except Exception:
            challenge.status = "expired"
            db.commit()
            raise HTTPException(
                status_code=502,
                detail="Nao foi possivel enviar o codigo adicional de acesso.",
            )

        registrar_auditoria(
            current_user=None,
            modulo="portal",
            entidade="portal_auth_challenge",
            acao="PORTAL_CLINIC_MFA_CHALLENGE_CREATED",
            descricao="Codigo adicional de login da clinica emitido.",
            entidade_id=challenge.challenge_id,
            detalhes={"clinica_id": clinica.id, "account_id": account.id},
            request=request,
        )
        clear_portal_refresh_cookie(response, request)
        return PortalClinicAuthResponse(
            mfa_required=True,
            challenge_id=challenge.challenge_id,
            message="Enviamos um codigo adicional para confirmar o acesso da clinica.",
        )

    result = issue_clinic_session(
        db,
        account=account,
        request=request,
        remember_device_until_shift_end=payload.remember_device_until_shift_end,
        auth_reference=f"login:{account.id}:{int(datetime.utcnow().timestamp())}",
        auth_method="password",
    )
    if result.refresh_token and result.trusted_session_expires_at:
        set_portal_refresh_cookie(
            response,
            result.refresh_token,
            expires_at=result.trusted_session_expires_at,
            request=request,
        )
    else:
        clear_portal_refresh_cookie(response, request)
    account.last_login_at = utcnow()
    db.commit()
    registrar_auditoria(
        current_user=None,
        modulo="portal",
        entidade="portal_clinic_account",
        acao="PORTAL_CLINIC_PASSWORD_LOGIN_SUCCEEDED",
        descricao="Login da clinica por email e senha concluido.",
        entidade_id=account.id,
        detalhes={"clinica_id": clinica.id},
        request=request,
    )
    return _login_result_response(result, message="Sessao da clinica iniciada com sucesso.")


@router.post("/auth/mfa/verificar", response_model=PortalClinicAuthResponse)
def verificar_mfa_clinica(
    payload: PortalClinicMfaVerifyRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    _assert_password_login_enabled()
    challenge = (
        db.query(PortalAuthChallenge)
        .filter(PortalAuthChallenge.challenge_id == payload.challenge_id)
        .first()
    )
    if not challenge or challenge.challenge_type != CHALLENGE_TYPE_LOGIN_MFA:
        raise HTTPException(status_code=401, detail="Codigo invalido ou expirado.")

    verify_auth_challenge_code(db, challenge=challenge, code=payload.codigo)
    account = db.query(PortalClinicAccount).filter(PortalClinicAccount.id == challenge.account_id).first()
    if not account or account.status != ACCOUNT_STATUS_ACTIVE:
        raise HTTPException(status_code=403, detail="Conta da clinica indisponivel.")

    result = issue_clinic_session(
        db,
        account=account,
        request=request,
        remember_device_until_shift_end=payload.remember_device_until_shift_end,
        auth_reference=challenge.challenge_id,
        auth_method="password_mfa",
    )
    if result.refresh_token and result.trusted_session_expires_at:
        set_portal_refresh_cookie(
            response,
            result.refresh_token,
            expires_at=result.trusted_session_expires_at,
            request=request,
        )

    account.last_login_at = utcnow()
    account.force_mfa_on_next_login = False
    db.commit()
    registrar_auditoria(
        current_user=None,
        modulo="portal",
        entidade="portal_clinic_account",
        acao="PORTAL_CLINIC_MFA_LOGIN_VERIFIED",
        descricao="Login da clinica confirmado por MFA.",
        entidade_id=account.id,
        detalhes={"clinica_id": account.clinica_id, "trusted_session": bool(result.refresh_token)},
        request=request,
    )
    return _login_result_response(result, message="Sessao da clinica iniciada com sucesso.")


@router.post("/auth/refresh", response_model=PortalClinicAuthResponse)
def refresh_login_clinica(
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    _assert_password_login_enabled()
    raw_refresh_token = get_portal_refresh_cookie(request)
    session = get_session_by_refresh_token(db, raw_refresh_token)
    if not session or session.status != SESSION_STATUS_ACTIVE:
        clear_portal_refresh_cookie(response, request)
        raise HTTPException(status_code=401, detail="Sessao da clinica expirada.")

    current_user_agent_hash = request_user_agent_hash(request)
    if session.user_agent_hash and current_user_agent_hash and session.user_agent_hash != current_user_agent_hash:
        revoke_session(db, session, reason="mudanca-de-dispositivo")
        clear_portal_refresh_cookie(response, request)
        raise HTTPException(status_code=401, detail="Sessao da clinica expirada.")

    account = db.query(PortalClinicAccount).filter(PortalClinicAccount.id == session.account_id).first()
    if not account or account.status != ACCOUNT_STATUS_ACTIVE:
        revoke_session(db, session, reason="conta-inativa")
        clear_portal_refresh_cookie(response, request)
        raise HTTPException(status_code=401, detail="Sessao da clinica expirada.")

    new_raw_refresh_token = generate_opaque_token()
    session.refresh_token_hash = hash_secret("portal_clinic_refresh", new_raw_refresh_token)
    session.last_seen_at = utcnow()
    db.commit()

    result = issue_clinic_session(
        db,
        account=account,
        request=request,
        remember_device_until_shift_end=False,
        auth_reference=f"session:{session.id}",
        auth_method="refresh",
    )
    set_portal_refresh_cookie(
        response,
        new_raw_refresh_token,
        expires_at=session.trusted_until,
        request=request,
    )
    registrar_auditoria(
        current_user=None,
        modulo="portal",
        entidade="portal_clinic_session",
        acao="PORTAL_CLINIC_SESSION_REFRESHED",
        descricao="Sessao da clinica renovada via refresh seguro.",
        entidade_id=session.id,
        detalhes={"clinica_id": session.clinica_id, "account_id": session.account_id},
        request=request,
    )
    return _login_result_response(result, message="Sessao da clinica renovada.")


@router.post("/auth/logout", response_model=PortalSimpleAcceptedResponse)
def logout_clinica(
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    _assert_password_login_enabled()
    raw_refresh_token = get_portal_refresh_cookie(request)
    if raw_refresh_token:
        session = get_session_by_refresh_token(db, raw_refresh_token)
        if session and session.status == SESSION_STATUS_ACTIVE:
            revoke_session(db, session, reason="logout-manual", status_value=SESSION_STATUS_LOGGED_OUT)
    clear_portal_refresh_cookie(response, request)
    return PortalSimpleAcceptedResponse(message="Sessao da clinica encerrada neste dispositivo.")


@router.post("/auth/esqueci-senha", response_model=PortalSimpleAcceptedResponse)
def esqueci_senha_clinica(
    payload: PortalPasswordResetRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    _assert_password_login_enabled()
    account = get_account_by_email(db, payload.email)
    if not account or account.status != ACCOUNT_STATUS_ACTIVE:
        return _generic_reset_response()

    clinica = get_active_clinica_or_404(db, account.clinica_id)
    _, raw_reset_token = create_password_reset_token(db, account_id=account.id)
    reset_url = build_password_reset_url(request, raw_reset_token)
    try:
        send_password_reset_email(
            destination=account.email_normalized,
            responsavel_nome=account.responsavel_nome,
            clinica_nome=clinica.nome,
            reset_url=reset_url,
            expires_in_minutes=settings.PORTAL_CLINIC_PASSWORD_RESET_EXPIRE_MINUTES,
        )
    except Exception:
        return _generic_reset_response()

    registrar_auditoria(
        current_user=None,
        modulo="portal",
        entidade="portal_password_reset",
        acao="PORTAL_CLINIC_PASSWORD_RESET_REQUESTED",
        descricao="Pedido de redefinicao de senha da clinica registrado.",
        entidade_id=account.id,
        detalhes={"clinica_id": account.clinica_id},
        request=request,
    )
    return _generic_reset_response()


@router.post("/auth/redefinir-senha", response_model=PortalSimpleAcceptedResponse)
def redefinir_senha_clinica(
    payload: PortalPasswordResetConfirmRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    _assert_password_login_enabled()
    if payload.password != payload.password_confirmation:
        raise HTTPException(status_code=422, detail="A confirmacao de senha nao confere.")

    reset_token = validate_password_reset_token_or_401(get_password_reset_token(db, payload.reset_token))
    account = db.query(PortalClinicAccount).filter(PortalClinicAccount.id == reset_token.account_id).first()
    if not account or account.status != ACCOUNT_STATUS_ACTIVE:
        raise HTTPException(status_code=403, detail="Conta da clinica indisponivel.")

    account.password_hash = hash_password(payload.password)
    account.password_changed_at = utcnow()
    account.force_mfa_on_next_login = True
    reset_token.used_at = utcnow()
    db.commit()
    revoke_sessions_for_clinica(
        db,
        clinica_id=account.clinica_id,
        reason="password-reset",
    )

    registrar_auditoria(
        current_user=None,
        modulo="portal",
        entidade="portal_clinic_account",
        acao="PORTAL_CLINIC_PASSWORD_RESET_COMPLETED",
        descricao="Senha da clinica redefinida com sucesso.",
        entidade_id=account.id,
        detalhes={"clinica_id": account.clinica_id},
        request=request,
    )
    return PortalSimpleAcceptedResponse(message="Senha redefinida com sucesso.")
