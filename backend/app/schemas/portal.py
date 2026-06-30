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
    atendimento_id: Optional[int] = None
    laudo_id: Optional[int] = None
    tipo_exame: str
    categoria_exame: Optional[str] = None
    prioridade: Optional[str] = None
    status: Optional[str] = None
    data_solicitacao: Optional[str] = None
    data_resultado: Optional[str] = None
    observacoes: Optional[str] = None
    anexos: list[PortalExamAttachmentResponse] = Field(default_factory=list)


class PortalExamListResponse(BaseModel):
    total: int
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
