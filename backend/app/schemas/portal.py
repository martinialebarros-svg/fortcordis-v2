from __future__ import annotations

from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field

from app.core.portal_security import PORTAL_DOWNLOAD_TOKEN_HEADER


class PortalTutorSessionLinkRequest(BaseModel):
    tutor_id: int = Field(..., gt=0)
    paciente_id: int = Field(..., gt=0)
    canal: Literal["email", "whatsapp"]
    contato: str = Field(..., min_length=3, max_length=255)


class PortalClinicaSessionLinkRequest(BaseModel):
    clinica_id: int = Field(..., gt=0)
    email: str = Field(..., min_length=5, max_length=255)
    responsavel_nome: str = Field(..., min_length=2, max_length=255)


class PortalChallengeResponse(BaseModel):
    accepted: bool = True
    challenge_id: str
    message: str
    expires_in_seconds: int
    debug_code: Optional[str] = None


class PortalCodeVerifyRequest(BaseModel):
    challenge_id: str = Field(..., min_length=16, max_length=128)
    codigo: str = Field(..., min_length=4, max_length=12)


class PortalTokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_at: datetime
    actor_type: str
    actor_id: int
    paciente_id: Optional[int] = None
    clinica_id: Optional[int] = None
    account_id: Optional[int] = None
    auth_method: Optional[str] = None
    trusted_session_expires_at: Optional[datetime] = None
    scope: list[str] = Field(default_factory=list)


class PortalExamAttachmentResponse(BaseModel):
    anexo_id: int
    nome_original: str
    mime_type: str
    tamanho: Optional[int] = None
    download_available: bool


class PortalExamSummaryResponse(BaseModel):
    id: int
    paciente_id: int
    paciente_nome: Optional[str] = None
    tutor_nome: Optional[str] = None
    especie: Optional[str] = None
    atendimento_id: Optional[int] = None
    laudo_id: Optional[int] = None
    tipo_exame: str
    categoria_exame: Optional[str] = None
    prioridade: Optional[str] = None
    status: Optional[str] = None
    data_exame: Optional[str] = None
    data_solicitacao: Optional[str] = None
    data_resultado: Optional[str] = None
    observacoes: Optional[str] = None
    anexos: list[PortalExamAttachmentResponse] = Field(default_factory=list)


class PortalExamListResponse(BaseModel):
    total: int
    clinica_id: Optional[int] = None
    clinica_nome: Optional[str] = None
    items: list[PortalExamSummaryResponse] = Field(default_factory=list)


class PortalDownloadLinkItemResponse(BaseModel):
    anexo_id: int
    nome_original: str
    mime_type: str
    download_url: str
    download_token: str
    download_token_header: str = PORTAL_DOWNLOAD_TOKEN_HEADER
    expires_at: datetime


class PortalDownloadUrlResponse(BaseModel):
    exame_id: int
    items: list[PortalDownloadLinkItemResponse] = Field(default_factory=list)


class PortalAdminClinicInviteCreateRequest(BaseModel):
    delivery_channel: Literal["whatsapp"] = "whatsapp"
    delivery_target: str = Field(..., min_length=8, max_length=255)
    account_email: Optional[str] = Field(default=None, min_length=5, max_length=255)
    expires_in_hours: int = Field(default=72, ge=1, le=168)
    allow_manual_copy: bool = True


class PortalAdminClinicInviteResponse(BaseModel):
    invite_id: int
    status: str
    expires_at: datetime
    activation_url: str
    delivery_channel: str
    delivery_target_masked: Optional[str] = None
    account_email_masked: Optional[str] = None
    delivery_status: str = "manual_copy"
    delivery_provider: Optional[str] = None


class PortalAdminClinicInviteRevokeRequest(BaseModel):
    reason: str = Field(default="revogado pela operacao", min_length=3, max_length=255)


class PortalAdminClinicInviteRevokeResponse(BaseModel):
    status: str
    revoked_at: datetime


class PortalAdminClinicInviteSnapshot(BaseModel):
    id: int
    status: str
    delivery_channel: str
    delivery_target_masked: Optional[str] = None
    expires_at: datetime
    created_at: datetime
    delivered_at: Optional[datetime] = None
    used_at: Optional[datetime] = None
    revoked_at: Optional[datetime] = None


class PortalAdminClinicAccountSnapshot(BaseModel):
    id: int
    status: str
    email_masked: Optional[str] = None
    responsavel_nome: str
    email_verified_at: Optional[datetime] = None
    activated_at: Optional[datetime] = None
    last_login_at: Optional[datetime] = None
    force_mfa_on_next_login: bool = False
    revoked_at: Optional[datetime] = None


class PortalAdminClinicSessionSnapshot(BaseModel):
    id: int
    status: str
    trusted_until: datetime
    created_at: datetime
    last_seen_at: Optional[datetime] = None
    revoked_at: Optional[datetime] = None
    device_label: Optional[str] = None


class PortalAdminClinicAccessSummaryResponse(BaseModel):
    clinica_id: int
    clinica_nome: str
    invite: Optional[PortalAdminClinicInviteSnapshot] = None
    account: Optional[PortalAdminClinicAccountSnapshot] = None
    active_session_count: int = 0
    active_sessions: list[PortalAdminClinicSessionSnapshot] = Field(default_factory=list)


class PortalAdminClinicAccessOverviewMetrics(BaseModel):
    total_clinicas: int = 0
    convites_pendentes: int = 0
    contas_ativas: int = 0
    clinicas_sem_convite: int = 0
    clinicas_precisam_email: int = 0
    sessoes_ativas: int = 0
    clinicas_com_downloads: int = 0
    downloads_total: int = 0
    downloads_ultimos_30_dias: int = 0


class PortalAdminClinicAccessOverviewItem(BaseModel):
    clinica_id: int
    clinica_nome: str
    cidade: Optional[str] = None
    estado: Optional[str] = None
    contato_email: Optional[str] = None
    contato_whatsapp: Optional[str] = None
    invite: Optional[PortalAdminClinicInviteSnapshot] = None
    invite_account_email_masked: Optional[str] = None
    account: Optional[PortalAdminClinicAccountSnapshot] = None
    active_session_count: int = 0
    status_key: str
    status_label: str
    needs_email_definition: bool = False
    download_count: int = 0
    last_download_at: Optional[datetime] = None


class PortalAdminClinicDownloadEventResponse(BaseModel):
    audit_event_id: int
    clinica_id: int
    clinica_nome: str
    account_email_masked: Optional[str] = None
    exame_id: Optional[int] = None
    paciente_nome: Optional[str] = None
    tutor_nome: Optional[str] = None
    tipo_exame: Optional[str] = None
    anexo_nome: Optional[str] = None
    downloaded_at: datetime


class PortalAdminClinicAccessOverviewResponse(BaseModel):
    generated_at: datetime
    metrics: PortalAdminClinicAccessOverviewMetrics
    items: list[PortalAdminClinicAccessOverviewItem] = Field(default_factory=list)
    recent_downloads: list[PortalAdminClinicDownloadEventResponse] = Field(default_factory=list)


class PortalAdminClinicAccountRevokeRequest(BaseModel):
    reason: str = Field(default="revogada pela operacao", min_length=3, max_length=255)
    revoke_sessions: bool = True


class PortalAdminClinicAccountRevokeResponse(BaseModel):
    status: str
    revoked_at: datetime


class PortalAdminClinicSessionsRevokeRequest(BaseModel):
    clinica_id: int = Field(..., gt=0)
    session_id: Optional[int] = Field(default=None, gt=0)
    reason: str = Field(default="revogada pela operacao", min_length=3, max_length=255)


class PortalAdminClinicSessionsRevokeResponse(BaseModel):
    revoked_count: int


class PortalClinicInviteStatusResponse(BaseModel):
    status: str
    clinica_id: int
    clinica_nome: str
    unidade_nome: str
    expires_at: datetime
    can_activate: bool
    email_hint: Optional[str] = None


class PortalClinicActivationRequest(BaseModel):
    invite_token: str = Field(..., min_length=16, max_length=255)
    email: Optional[str] = Field(default=None, min_length=5, max_length=255)
    responsavel_nome: str = Field(..., min_length=2, max_length=255)
    password: str = Field(..., min_length=12, max_length=255)
    password_confirmation: str = Field(..., min_length=12, max_length=255)


class PortalClinicActivationResponse(BaseModel):
    activation_id: int
    access_token: Optional[str] = None
    token_type: str = "bearer"
    expires_at: Optional[datetime] = None
    actor_type: Optional[str] = None
    actor_id: Optional[int] = None
    clinica_id: Optional[int] = None
    account_id: Optional[int] = None
    auth_method: Optional[str] = None
    trusted_session_expires_at: Optional[datetime] = None
    scope: list[str] = Field(default_factory=list)
    message: str


class PortalClinicLoginRequest(BaseModel):
    email: str = Field(..., min_length=5, max_length=255)
    password: str = Field(..., min_length=1, max_length=255)
    remember_device_until_shift_end: bool = False


class PortalClinicMfaVerifyRequest(BaseModel):
    challenge_id: str = Field(..., min_length=16, max_length=128)
    codigo: str = Field(..., min_length=4, max_length=12)
    remember_device_until_shift_end: bool = False


class PortalClinicAuthResponse(BaseModel):
    access_token: Optional[str] = None
    token_type: str = "bearer"
    expires_at: Optional[datetime] = None
    actor_type: Optional[str] = None
    actor_id: Optional[int] = None
    clinica_id: Optional[int] = None
    account_id: Optional[int] = None
    auth_method: Optional[str] = None
    trusted_session_expires_at: Optional[datetime] = None
    scope: list[str] = Field(default_factory=list)
    mfa_required: bool = False
    challenge_id: Optional[str] = None
    message: Optional[str] = None


class PortalSimpleAcceptedResponse(BaseModel):
    accepted: bool = True
    message: str


class PortalPasswordResetRequest(BaseModel):
    email: str = Field(..., min_length=5, max_length=255)


class PortalPasswordResetConfirmRequest(BaseModel):
    reset_token: str = Field(..., min_length=16, max_length=255)
    password: str = Field(..., min_length=12, max_length=255)
    password_confirmation: str = Field(..., min_length=12, max_length=255)
