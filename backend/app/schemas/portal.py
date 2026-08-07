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
    partner_id: Optional[int] = None
    partner_nome: Optional[str] = None
    partner_tipo: Optional[str] = None
    partner_tipo_label: Optional[str] = None
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


class PortalClinicOperationalSummaryResponse(BaseModel):
    realizados_hoje: int = 0
    em_laudo: int = 0
    aguardando_liberacao: int = 0
    liberados_hoje: int = 0
    sla_horas: int = 48


class PortalClinicOperationalItemResponse(BaseModel):
    item_id: str
    origem: Literal["laudo", "exame"]
    paciente_id: Optional[int] = None
    paciente_nome: Optional[str] = None
    tutor_nome: Optional[str] = None
    especie: Optional[str] = None
    tipo_exame: str
    status_key: str
    status_label: str
    data_realizacao: Optional[str] = None
    data_liberacao: Optional[str] = None
    previsao_liberacao: Optional[str] = None
    observacoes: Optional[str] = None


class PortalExamListResponse(BaseModel):
    total: int
    clinica_id: Optional[int] = None
    clinica_nome: Optional[str] = None
    partner_id: Optional[int] = None
    partner_nome: Optional[str] = None
    partner_tipo: Optional[str] = None
    partner_tipo_label: Optional[str] = None
    operational_summary: Optional[PortalClinicOperationalSummaryResponse] = None
    operational_items: list[PortalClinicOperationalItemResponse] = Field(default_factory=list)
    items: list[PortalExamSummaryResponse] = Field(default_factory=list)


class PortalClinicaAgendamentoItemResponse(BaseModel):
    id: int
    data: Optional[str] = None
    hora: Optional[str] = None
    inicio: Optional[datetime] = None
    fim: Optional[datetime] = None
    status: str
    paciente_nome: Optional[str] = None
    tutor_nome: Optional[str] = None
    servico_nome: Optional[str] = None
    pode_cancelar: bool = False


class PortalClinicaAgendamentoListResponse(BaseModel):
    total: int
    clinica_id: int
    clinica_nome: str
    items: list[PortalClinicaAgendamentoItemResponse] = Field(default_factory=list)


class PortalClinicaAgendamentoCancelResponse(BaseModel):
    item: PortalClinicaAgendamentoItemResponse
    message: str


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
    invite_id: Optional[int] = None
    status: str
    expires_at: Optional[datetime] = None
    activation_url: str
    access_mode: Literal["activation", "login"] = "activation"
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
    account_id: Optional[int] = None
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
    invites: list[PortalAdminClinicInviteSnapshot] = Field(default_factory=list)
    accounts: list[PortalAdminClinicAccountSnapshot] = Field(default_factory=list)
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
    login_email: Optional[str] = None
    invite: Optional[PortalAdminClinicInviteSnapshot] = None
    invite_account_email_masked: Optional[str] = None
    account: Optional[PortalAdminClinicAccountSnapshot] = None
    active_session_count: int = 0
    active_accounts_count: int = 0
    status_key: str
    status_label: str
    needs_email_definition: bool = False
    download_count: int = 0
    last_download_at: Optional[datetime] = None
    first_download_at: Optional[datetime] = None
    last_access_at: Optional[datetime] = None
    days_since_last_activity: Optional[int] = None
    timeline: list["PortalAdminClinicTimelineEventResponse"] = Field(default_factory=list)


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
    is_first_download: bool = False


class PortalAdminClinicTimelineEventResponse(BaseModel):
    event_id: str
    event_type: str
    title: str
    description: Optional[str] = None
    occurred_at: datetime
    tone: Literal["neutral", "success", "warning", "danger"] = "neutral"


class PortalAdminClinicAccessOverviewResponse(BaseModel):
    generated_at: datetime
    metrics: PortalAdminClinicAccessOverviewMetrics
    items: list[PortalAdminClinicAccessOverviewItem] = Field(default_factory=list)
    recent_downloads: list[PortalAdminClinicDownloadEventResponse] = Field(default_factory=list)


class PortalPartnerProfileResponse(BaseModel):
    id: int
    tipo: Literal["clinica", "veterinario"]
    tipo_label: str
    clinica_id: Optional[int] = None
    clinica_nome: Optional[str] = None
    nome_exibicao: str
    email_login: Optional[str] = None
    telefone: Optional[str] = None
    whatsapp: Optional[str] = None
    cidade_base: Optional[str] = None
    estado_base: Optional[str] = None
    crmv: Optional[str] = None
    cpf_documento: Optional[str] = None
    area_atuacao: Optional[str] = None
    observacoes: Optional[str] = None
    ativo: bool = True
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class PortalPartnerProfileListResponse(BaseModel):
    total: int
    items: list[PortalPartnerProfileResponse] = Field(default_factory=list)


class PortalPartnerProfileCreateRequest(BaseModel):
    tipo: Literal["clinica", "veterinario"]
    clinica_id: Optional[int] = Field(default=None, gt=0)
    nome_exibicao: Optional[str] = Field(default=None, min_length=2, max_length=255)
    email_login: Optional[str] = Field(default=None, min_length=5, max_length=255)
    telefone: Optional[str] = Field(default=None, min_length=8, max_length=50)
    whatsapp: Optional[str] = Field(default=None, min_length=8, max_length=50)
    cidade_base: Optional[str] = Field(default=None, min_length=2, max_length=120)
    estado_base: Optional[str] = Field(default=None, min_length=2, max_length=20)
    crmv: Optional[str] = Field(default=None, min_length=2, max_length=80)
    cpf_documento: Optional[str] = Field(default=None, min_length=11, max_length=40)
    area_atuacao: Optional[str] = Field(default=None, min_length=2, max_length=120)
    observacoes: Optional[str] = Field(default=None, max_length=4000)
    ativo: bool = True


class PortalPartnerProfileUpdateRequest(BaseModel):
    nome_exibicao: Optional[str] = Field(default=None, min_length=2, max_length=255)
    email_login: Optional[str] = Field(default=None, min_length=5, max_length=255)
    telefone: Optional[str] = Field(default=None, min_length=8, max_length=50)
    whatsapp: Optional[str] = Field(default=None, min_length=8, max_length=50)
    cidade_base: Optional[str] = Field(default=None, min_length=2, max_length=120)
    estado_base: Optional[str] = Field(default=None, min_length=2, max_length=20)
    crmv: Optional[str] = Field(default=None, min_length=2, max_length=80)
    cpf_documento: Optional[str] = Field(default=None, min_length=11, max_length=40)
    area_atuacao: Optional[str] = Field(default=None, min_length=2, max_length=120)
    observacoes: Optional[str] = Field(default=None, max_length=4000)
    ativo: Optional[bool] = None


class PortalPartnerInviteCreateRequest(BaseModel):
    delivery_channel: Literal["whatsapp"] = "whatsapp"
    delivery_target: str = Field(..., min_length=8, max_length=50)
    expires_in_hours: int = Field(default=72, ge=1, le=240)
    allow_manual_copy: bool = True


class PortalPartnerInviteResponse(BaseModel):
    invite_id: Optional[int] = None
    status: str
    expires_at: Optional[datetime] = None
    activation_url: str
    access_mode: Literal["activation", "login"]
    delivery_channel: str
    delivery_target_masked: Optional[str] = None
    account_email_masked: Optional[str] = None
    delivery_status: str
    delivery_provider: Optional[str] = None


class PortalPartnerInviteStatusResponse(BaseModel):
    status: str
    partner_id: int
    partner_nome: str
    partner_tipo: Literal["clinica", "veterinario"]
    partner_tipo_label: str
    expires_at: datetime
    can_activate: bool
    email_hint: Optional[str] = None


PORTAL_CLINIC_PASSWORD_MIN_LENGTH = 8
PORTAL_PARTNER_PASSWORD_MIN_LENGTH = PORTAL_CLINIC_PASSWORD_MIN_LENGTH


class PortalPartnerActivationRequest(BaseModel):
    invite_token: str = Field(..., min_length=16, max_length=255)
    responsavel_nome: str = Field(..., min_length=2, max_length=255)
    password: str = Field(..., min_length=PORTAL_PARTNER_PASSWORD_MIN_LENGTH, max_length=255)
    password_confirmation: str = Field(..., min_length=PORTAL_PARTNER_PASSWORD_MIN_LENGTH, max_length=255)


class PortalPartnerAuthResponse(BaseModel):
    access_token: Optional[str] = None
    token_type: str = "bearer"
    expires_at: Optional[datetime] = None
    actor_type: Optional[str] = None
    actor_id: Optional[int] = None
    partner_id: Optional[int] = None
    partner_nome: Optional[str] = None
    partner_tipo: Optional[str] = None
    partner_tipo_label: Optional[str] = None
    clinica_id: Optional[int] = None
    account_id: Optional[int] = None
    auth_method: Optional[str] = None
    trusted_session_expires_at: Optional[datetime] = None
    scope: list[str] = Field(default_factory=list)
    mfa_required: bool = False
    challenge_id: Optional[str] = None
    message: Optional[str] = None


class PortalPartnerActivationResponse(PortalPartnerAuthResponse):
    activation_id: int


class PortalPartnerLoginRequest(BaseModel):
    email: str = Field(..., min_length=5, max_length=255)
    password: str = Field(..., min_length=1, max_length=255)
    remember_device_until_shift_end: bool = False


class PortalPartnerMfaVerifyRequest(BaseModel):
    challenge_id: str = Field(..., min_length=16, max_length=128)
    codigo: str = Field(..., min_length=4, max_length=12)
    remember_device_until_shift_end: bool = False


class PortalPartnerPasswordResetRequest(BaseModel):
    email: str = Field(..., min_length=5, max_length=255)


class PortalPartnerPasswordResetConfirmRequest(BaseModel):
    reset_token: str = Field(..., min_length=16, max_length=255)
    password: str = Field(..., min_length=PORTAL_PARTNER_PASSWORD_MIN_LENGTH, max_length=255)
    password_confirmation: str = Field(..., min_length=PORTAL_PARTNER_PASSWORD_MIN_LENGTH, max_length=255)


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
    password: str = Field(..., min_length=PORTAL_CLINIC_PASSWORD_MIN_LENGTH, max_length=255)
    password_confirmation: str = Field(..., min_length=PORTAL_CLINIC_PASSWORD_MIN_LENGTH, max_length=255)


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
    password: str = Field(..., min_length=PORTAL_CLINIC_PASSWORD_MIN_LENGTH, max_length=255)
    password_confirmation: str = Field(..., min_length=PORTAL_CLINIC_PASSWORD_MIN_LENGTH, max_length=255)
