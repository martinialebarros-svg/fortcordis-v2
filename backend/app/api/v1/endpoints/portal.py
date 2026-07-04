from __future__ import annotations

import hashlib
import json
import logging
import re
import secrets
from datetime import datetime, timedelta
from typing import Any, Iterable, Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.portal_security import (
    PORTAL_DOWNLOAD_TOKEN_HEADER,
    PortalDownloadContext,
    PortalSessionContext,
    create_portal_download_token,
    create_portal_session_token,
    get_current_portal_download_token,
    get_current_portal_session,
)
from app.db.database import get_db
from app.models.atendimento_clinico import AnexoAtendimento, AtendimentoClinico
from app.models.clinica import Clinica
from app.models.laudo import Exame, Laudo
from app.models.paciente import Paciente
from app.models.portal_access import PortalAccessChallenge
from app.models.tutor import Tutor
from app.schemas.portal import (
    PortalChallengeResponse,
    PortalClinicaSessionLinkRequest,
    PortalCodeVerifyRequest,
    PortalDownloadLinkItemResponse,
    PortalDownloadUrlResponse,
    PortalExamAttachmentResponse,
    PortalExamListResponse,
    PortalExamSummaryResponse,
    PortalTokenResponse,
    PortalTutorSessionLinkRequest,
)
from app.services.attachment_download_service import (
    attachment_has_download_source,
    build_attachment_download_response,
)
from app.services.auditoria_service import registrar_auditoria
from app.services.portal_delivery_service import (
    PortalChallengeDeliveryRequest,
    PortalDeliveryError,
    send_portal_access_code,
)

router = APIRouter()
logger = logging.getLogger(__name__)

PORTAL_CHALLENGE_STATUS_PENDING = "pending"
PORTAL_CHALLENGE_STATUS_CONSUMED = "consumed"
PORTAL_CHALLENGE_STATUS_EXPIRED = "expired"
PORTAL_CHALLENGE_STATUS_LOCKED = "locked"
PORTAL_SCOPE_TUTOR = ["pet:read", "exam:read", "exam:download"]
PORTAL_SCOPE_CLINICA = ["clinic:read", "exam:read", "exam:download"]


def _utcnow() -> datetime:
    return datetime.utcnow()


def _normalize_email(value: str | None) -> str:
    return str(value or "").strip().lower()


def _normalize_phone(value: str | None) -> str:
    digits = re.sub(r"\D+", "", str(value or ""))
    if digits.startswith("55") and len(digits) > 11:
        digits = digits[2:]
    return digits


def _json_dump(value: Any) -> str:
    return json.dumps(value or {}, ensure_ascii=False, default=str)


def _json_load_dict(value: str | None) -> dict[str, Any]:
    try:
        loaded = json.loads(value or "{}")
    except Exception:
        return {}
    return loaded if isinstance(loaded, dict) else {}


def _json_load_list(value: str | None) -> list[str]:
    try:
        loaded = json.loads(value or "[]")
    except Exception:
        return []
    if not isinstance(loaded, list):
        return []
    return [str(item).strip() for item in loaded if str(item).strip()]


def _mask_email(value: str) -> str:
    normalized = _normalize_email(value)
    if "@" not in normalized:
        return "***"
    local, domain = normalized.split("@", 1)
    local_mask = (local[:2] + "***") if len(local) > 2 else "***"
    return f"{local_mask}@{domain}"


def _mask_phone(value: str) -> str:
    digits = _normalize_phone(value)
    if len(digits) < 4:
        return "***"
    return f"***{digits[-4:]}"


def _mask_contact(canal: str, contato: str) -> str:
    if canal == "email":
        return _mask_email(contato)
    return _mask_phone(contato)


def _hash_challenge_code(challenge_id: str, code: str) -> str:
    raw = f"{challenge_id}:{code}:{settings.SECRET_KEY}".encode("utf-8")
    return hashlib.sha256(raw).hexdigest()


def _generate_challenge_id() -> str:
    return secrets.token_urlsafe(24)


def _generate_challenge_code() -> str:
    return f"{secrets.randbelow(1_000_000):06d}"


def _challenge_response(
    challenge_id: str,
    *,
    debug_code: str | None = None,
) -> PortalChallengeResponse:
    return PortalChallengeResponse(
        challenge_id=challenge_id,
        message="Se os dados corresponderem ao cadastro, enviaremos um codigo temporario.",
        expires_in_seconds=max(60, settings.PORTAL_CHALLENGE_EXPIRE_MINUTES * 60),
        debug_code=debug_code,
    )


def _assert_canal_portal_habilitado(canal: str) -> None:
    if canal == "whatsapp" and not settings.PORTAL_WHATSAPP_ENABLED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Acesso por WhatsApp ainda nao esta disponivel. Use o email cadastrado.",
        )


def _debug_code_for_response(code: str | None) -> str | None:
    if not code:
        return None
    if settings.APP_ENV.lower() in {"production", "stage", "staging"}:
        return None
    if not settings.PORTAL_DEBUG_EXPOSE_CODE:
        return None
    return code


def _is_tutor_active(tutor: Tutor | None) -> bool:
    return tutor is not None and getattr(tutor, "ativo", 0) == 1


def _is_paciente_active(paciente: Paciente | None) -> bool:
    return paciente is not None and getattr(paciente, "ativo", 0) == 1


def _is_clinica_active(clinica: Clinica | None) -> bool:
    ativo = getattr(clinica, "ativo", False)
    return clinica is not None and ativo not in (False, 0, "0")


def _obter_tutor_e_paciente(
    db: Session,
    *,
    tutor_id: int,
    paciente_id: int,
) -> tuple[Tutor | None, Paciente | None]:
    tutor = db.query(Tutor).filter(Tutor.id == tutor_id).first()
    paciente = db.query(Paciente).filter(Paciente.id == paciente_id).first()
    if not _is_tutor_active(tutor) or not _is_paciente_active(paciente):
        return None, None
    if paciente.tutor_id != tutor.id:
        return None, None
    return tutor, paciente


def _contato_tutor_confere(tutor: Tutor, canal: str, contato: str) -> bool:
    if canal == "email":
        return _normalize_email(tutor.email) == _normalize_email(contato)
    destino = tutor.whatsapp or tutor.telefone
    return _normalize_phone(destino) == _normalize_phone(contato)


def _obter_clinica_ativa(db: Session, clinica_id: int) -> Clinica | None:
    clinica = db.query(Clinica).filter(Clinica.id == clinica_id).first()
    if not _is_clinica_active(clinica):
        return None
    return clinica


def _criar_desafio(
    db: Session,
    *,
    actor_type: str,
    actor_id: int,
    canal: str,
    contato_mascarado: str,
    scope: list[str],
    contexto: dict[str, Any],
    paciente_id: int | None = None,
    clinica_id: int | None = None,
    responsavel_nome: str | None = None,
) -> tuple[PortalAccessChallenge, str]:
    challenge_id = _generate_challenge_id()
    code = _generate_challenge_code()
    challenge = PortalAccessChallenge(
        challenge_id=challenge_id,
        actor_type=actor_type,
        actor_id=actor_id,
        paciente_id=paciente_id,
        clinica_id=clinica_id,
        responsavel_nome=(responsavel_nome or "").strip() or None,
        canal=canal,
        contato_mascarado=contato_mascarado,
        scope_json=_json_dump(scope),
        contexto_json=_json_dump(contexto),
        code_hash=_hash_challenge_code(challenge_id, code),
        status=PORTAL_CHALLENGE_STATUS_PENDING,
        failed_attempts=0,
        max_attempts=max(1, int(settings.PORTAL_MAX_CHALLENGE_ATTEMPTS)),
        expires_at=_utcnow() + timedelta(minutes=settings.PORTAL_CHALLENGE_EXPIRE_MINUTES),
    )
    db.add(challenge)
    db.commit()
    db.refresh(challenge)
    return challenge, code


def _expirar_desafio_se_preciso(db: Session, challenge: PortalAccessChallenge) -> bool:
    if challenge.expires_at and challenge.expires_at <= _utcnow():
        if challenge.status == PORTAL_CHALLENGE_STATUS_PENDING:
            challenge.status = PORTAL_CHALLENGE_STATUS_EXPIRED
            db.commit()
        return True
    return False


def _bloquear_desafio_se_preciso(db: Session, challenge: PortalAccessChallenge) -> None:
    if challenge.failed_attempts >= challenge.max_attempts:
        challenge.status = PORTAL_CHALLENGE_STATUS_LOCKED
        db.commit()


def _portal_contexto_exibicao(challenge: PortalAccessChallenge) -> tuple[str | None, list[str]]:
    contexto = _json_load_dict(challenge.contexto_json)
    display_name = str(contexto.get("display_name") or "").strip() or None
    scope = _json_load_list(challenge.scope_json)
    return display_name, scope


def _enviar_desafio_portal(
    *,
    challenge: PortalAccessChallenge,
    code: str,
    channel: str,
    destination: str,
    display_name: str | None,
    paciente_nome: str | None = None,
    clinica_nome: str | None = None,
    responsavel_nome: str | None = None,
) -> str:
    try:
        result = send_portal_access_code(
            PortalChallengeDeliveryRequest(
                challenge_id=challenge.challenge_id,
                actor_type=challenge.actor_type,
                actor_id=challenge.actor_id,
                channel=channel,
                destination=destination,
                code=code,
                expires_in_minutes=max(1, int(settings.PORTAL_CHALLENGE_EXPIRE_MINUTES or 15)),
                display_name=display_name,
                paciente_nome=paciente_nome,
                clinica_nome=clinica_nome,
                responsavel_nome=responsavel_nome,
            )
        )
        return result.provider
    except PortalDeliveryError as exc:
        logger.exception(
            "Falha ao enviar codigo do portal (challenge_id=%s, actor_type=%s, channel=%s)",
            challenge.challenge_id,
            challenge.actor_type,
            channel,
        )
        return f"failed:{exc.__class__.__name__}"


def _emitir_token_desafio(challenge: PortalAccessChallenge) -> PortalTokenResponse:
    display_name, scope = _portal_contexto_exibicao(challenge)
    token, expires_at = create_portal_session_token(
        actor_type=challenge.actor_type,
        actor_id=challenge.actor_id,
        challenge_id=challenge.challenge_id,
        paciente_id=challenge.paciente_id,
        clinica_id=challenge.clinica_id,
        display_name=display_name,
        channel=challenge.canal,
        scope=scope,
    )
    return PortalTokenResponse(
        access_token=token,
        expires_at=expires_at,
        actor_type=challenge.actor_type,
        actor_id=challenge.actor_id,
        paciente_id=challenge.paciente_id,
        clinica_id=challenge.clinica_id,
        scope=scope,
    )


def _assert_tutor_scope(
    db: Session,
    session: PortalSessionContext,
    paciente_id: int,
) -> Paciente:
    if session.actor_type != "tutor" or session.paciente_id != paciente_id:
        raise HTTPException(status_code=403, detail="Sessao do portal sem acesso a este pet.")

    paciente = db.query(Paciente).filter(Paciente.id == paciente_id).first()
    if not _is_paciente_active(paciente) or paciente.tutor_id != session.actor_id:
        raise HTTPException(status_code=403, detail="Sessao do portal sem acesso a este pet.")
    return paciente


def _load_map(db: Session, model, ids: Iterable[int]) -> dict[int, Any]:
    unique_ids = sorted({int(item) for item in ids if item is not None})
    if not unique_ids:
        return {}
    items = db.query(model).filter(model.id.in_(unique_ids)).all()
    return {item.id: item for item in items}


def _resolve_exam_clinica_id(
    exam: Exame,
    atendimentos_map: dict[int, AtendimentoClinico],
    laudos_map: dict[int, Laudo],
) -> int | None:
    if exam.atendimento_id:
        atendimento = atendimentos_map.get(exam.atendimento_id)
        if atendimento and atendimento.clinica_id is not None:
            return int(atendimento.clinica_id)
    if exam.laudo_id:
        laudo = laudos_map.get(exam.laudo_id)
        if laudo and laudo.clinic_id is not None:
            return int(laudo.clinic_id)
    return None


def _assert_clinica_scope_for_exam(
    session: PortalSessionContext,
    exam: Exame,
    atendimentos_map: dict[int, AtendimentoClinico],
    laudos_map: dict[int, Laudo],
) -> None:
    if session.actor_type != "clinica" or session.clinica_id is None:
        raise HTTPException(status_code=403, detail="Sessao do portal sem acesso para clinica.")
    resolved_clinica_id = _resolve_exam_clinica_id(exam, atendimentos_map, laudos_map)
    if resolved_clinica_id is None or resolved_clinica_id != session.clinica_id:
        raise HTTPException(status_code=403, detail="Sessao do portal sem acesso a este exame.")


def _serialize_exam_attachment(anexo: AnexoAtendimento) -> PortalExamAttachmentResponse:
    return PortalExamAttachmentResponse(
        anexo_id=anexo.id,
        nome_original=anexo.nome_original or f"anexo_{anexo.id}",
        mime_type=anexo.mime_type or "application/octet-stream",
        tamanho=anexo.tamanho,
        download_available=attachment_has_download_source(anexo),
    )


def _build_exam_summary(
    exam: Exame,
    attachments: list[AnexoAtendimento],
) -> PortalExamSummaryResponse:
    return PortalExamSummaryResponse(
        id=exam.id,
        paciente_id=exam.paciente_id,
        atendimento_id=exam.atendimento_id,
        laudo_id=exam.laudo_id,
        tipo_exame=exam.tipo_exame,
        categoria_exame=exam.categoria_exame,
        prioridade=exam.prioridade,
        status=exam.status,
        data_solicitacao=exam.data_solicitacao.isoformat() if exam.data_solicitacao else None,
        data_resultado=exam.data_resultado.isoformat() if exam.data_resultado else None,
        observacoes=exam.observacoes,
        anexos=[_serialize_exam_attachment(item) for item in attachments],
    )


def _load_exam_with_context(
    db: Session,
    exame_id: int,
) -> tuple[Exame, dict[int, AtendimentoClinico], dict[int, Laudo]]:
    exam = db.query(Exame).filter(Exame.id == exame_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exame nao encontrado.")
    atendimentos_map = _load_map(db, AtendimentoClinico, [exam.atendimento_id] if exam.atendimento_id else [])
    laudos_map = _load_map(db, Laudo, [exam.laudo_id] if exam.laudo_id else [])
    return exam, atendimentos_map, laudos_map


def _assert_portal_exam_access(
    db: Session,
    session: PortalSessionContext,
    exam: Exame,
    atendimentos_map: dict[int, AtendimentoClinico],
    laudos_map: dict[int, Laudo],
) -> None:
    if session.actor_type == "tutor":
        _assert_tutor_scope(db, session, exam.paciente_id)
        return
    if session.actor_type == "clinica":
        _assert_clinica_scope_for_exam(session, exam, atendimentos_map, laudos_map)
        return
    raise HTTPException(status_code=403, detail="Sessao do portal sem escopo reconhecido.")


@router.post("/tutores/sessao-link", response_model=PortalChallengeResponse, status_code=status.HTTP_202_ACCEPTED)
def solicitar_sessao_tutor(
    payload: PortalTutorSessionLinkRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    challenge_id = _generate_challenge_id()
    debug_code = None
    _assert_canal_portal_habilitado(payload.canal)
    tutor, paciente = _obter_tutor_e_paciente(
        db,
        tutor_id=payload.tutor_id,
        paciente_id=payload.paciente_id,
    )

    if tutor and paciente and _contato_tutor_confere(tutor, payload.canal, payload.contato):
        contexto = {
            "display_name": tutor.nome,
            "tutor_nome": tutor.nome,
            "paciente_nome": paciente.nome,
        }
        challenge, code = _criar_desafio(
            db,
            actor_type="tutor",
            actor_id=tutor.id,
            paciente_id=paciente.id,
            canal=payload.canal,
            contato_mascarado=_mask_contact(payload.canal, payload.contato),
            scope=PORTAL_SCOPE_TUTOR,
            contexto=contexto,
        )
        challenge_id = challenge.challenge_id
        debug_code = _debug_code_for_response(code)
        delivery_provider = _enviar_desafio_portal(
            challenge=challenge,
            code=code,
            channel=payload.canal,
            destination=payload.contato,
            display_name=tutor.nome,
            paciente_nome=paciente.nome,
        )
        registrar_auditoria(
            current_user=None,
            modulo="portal",
            entidade="portal_access_challenge",
            acao="PORTAL_TUTOR_CHALLENGE_CREATED",
            descricao="Desafio do portal criado para tutor.",
            entidade_id=challenge.challenge_id,
            detalhes={
                "actor_type": "tutor",
                "actor_id": tutor.id,
                "paciente_id": paciente.id,
                "canal": payload.canal,
                "delivery_provider": delivery_provider,
            },
            request=request,
        )
    else:
        registrar_auditoria(
            current_user=None,
            modulo="portal",
            entidade="portal_access_challenge",
            acao="PORTAL_TUTOR_CHALLENGE_REQUESTED",
            descricao="Solicitacao de acesso tutor recebida sem confirmacao de match.",
            entidade_id=challenge_id,
            detalhes={
                "actor_type": "tutor",
                "tutor_id": payload.tutor_id,
                "paciente_id": payload.paciente_id,
                "canal": payload.canal,
                "accepted": False,
            },
            request=request,
        )

    return _challenge_response(challenge_id, debug_code=debug_code)


@router.post("/clinicas/sessao-link", response_model=PortalChallengeResponse, status_code=status.HTTP_202_ACCEPTED)
def solicitar_sessao_clinica(
    payload: PortalClinicaSessionLinkRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    if not settings.PORTAL_CLINIC_LEGACY_CODE_LOGIN_ENABLED:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Fluxo legado de codigo da clinica indisponivel.",
        )
    challenge_id = _generate_challenge_id()
    debug_code = None
    clinica = _obter_clinica_ativa(db, payload.clinica_id)

    if clinica and _normalize_email(clinica.email) == _normalize_email(payload.email):
        contexto = {
            "display_name": payload.responsavel_nome.strip(),
            "clinica_nome": clinica.nome,
        }
        challenge, code = _criar_desafio(
            db,
            actor_type="clinica",
            actor_id=clinica.id,
            clinica_id=clinica.id,
            responsavel_nome=payload.responsavel_nome,
            canal="email",
            contato_mascarado=_mask_email(payload.email),
            scope=PORTAL_SCOPE_CLINICA,
            contexto=contexto,
        )
        challenge_id = challenge.challenge_id
        debug_code = _debug_code_for_response(code)
        delivery_provider = _enviar_desafio_portal(
            challenge=challenge,
            code=code,
            channel="email",
            destination=payload.email,
            display_name=payload.responsavel_nome.strip(),
            clinica_nome=clinica.nome,
            responsavel_nome=payload.responsavel_nome.strip(),
        )
        registrar_auditoria(
            current_user=None,
            modulo="portal",
            entidade="portal_access_challenge",
            acao="PORTAL_CLINICA_CHALLENGE_CREATED",
            descricao="Desafio do portal criado para clinica parceira.",
            entidade_id=challenge.challenge_id,
            detalhes={
                "actor_type": "clinica",
                "clinica_id": clinica.id,
                "canal": "email",
                "delivery_provider": delivery_provider,
            },
            request=request,
        )
    else:
        registrar_auditoria(
            current_user=None,
            modulo="portal",
            entidade="portal_access_challenge",
            acao="PORTAL_CLINICA_CHALLENGE_REQUESTED",
            descricao="Solicitacao de acesso de clinica recebida sem confirmacao de match.",
            entidade_id=challenge_id,
            detalhes={
                "actor_type": "clinica",
                "clinica_id": payload.clinica_id,
                "canal": "email",
                "accepted": False,
            },
            request=request,
        )

    return _challenge_response(challenge_id, debug_code=debug_code)


@router.post("/auth/verificar-codigo", response_model=PortalTokenResponse)
def verificar_codigo_portal(
    payload: PortalCodeVerifyRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    challenge = (
        db.query(PortalAccessChallenge)
        .filter(PortalAccessChallenge.challenge_id == payload.challenge_id)
        .first()
    )

    if not challenge:
        raise HTTPException(status_code=401, detail="Codigo invalido ou expirado.")

    if _expirar_desafio_se_preciso(db, challenge):
        raise HTTPException(status_code=410, detail="Codigo expirado.")

    if challenge.status != PORTAL_CHALLENGE_STATUS_PENDING:
        raise HTTPException(status_code=401, detail="Codigo invalido ou expirado.")

    expected_hash = _hash_challenge_code(challenge.challenge_id, payload.codigo.strip())
    if challenge.code_hash != expected_hash:
        challenge.failed_attempts += 1
        db.commit()
        _bloquear_desafio_se_preciso(db, challenge)
        registrar_auditoria(
            current_user=None,
            modulo="portal",
            entidade="portal_access_challenge",
            acao="PORTAL_CODE_REJECTED",
            descricao="Codigo do portal rejeitado.",
            entidade_id=challenge.challenge_id,
            detalhes={
                "actor_type": challenge.actor_type,
                "failed_attempts": challenge.failed_attempts,
            },
            request=request,
        )
        raise HTTPException(status_code=401, detail="Codigo invalido ou expirado.")

    challenge.status = PORTAL_CHALLENGE_STATUS_CONSUMED
    challenge.consumed_at = _utcnow()
    db.commit()

    token_response = _emitir_token_desafio(challenge)
    registrar_auditoria(
        current_user=None,
        modulo="portal",
        entidade="portal_access_challenge",
        acao="PORTAL_CODE_VERIFIED",
        descricao="Codigo do portal validado com sucesso.",
        entidade_id=challenge.challenge_id,
        detalhes={
            "actor_type": challenge.actor_type,
            "actor_id": challenge.actor_id,
            "paciente_id": challenge.paciente_id,
            "clinica_id": challenge.clinica_id,
        },
        request=request,
    )
    return token_response


@router.get("/pets/{paciente_id}/exames", response_model=PortalExamListResponse)
def listar_exames_pet_portal(
    paciente_id: int,
    db: Session = Depends(get_db),
    portal_session: PortalSessionContext = Depends(get_current_portal_session),
):
    if portal_session.actor_type == "tutor":
        _assert_tutor_scope(db, portal_session, paciente_id)

    exams = (
        db.query(Exame)
        .filter(Exame.paciente_id == paciente_id)
        .order_by(Exame.data_resultado.desc(), Exame.id.desc())
        .all()
    )

    exam_ids = [exam.id for exam in exams]
    attachments = []
    if exam_ids:
        attachments = (
            db.query(AnexoAtendimento)
            .filter(AnexoAtendimento.exame_id.in_(exam_ids))
            .order_by(AnexoAtendimento.created_at.desc(), AnexoAtendimento.id.desc())
            .all()
        )
    attachments_by_exam: dict[int, list[AnexoAtendimento]] = {}
    for attachment in attachments:
        attachments_by_exam.setdefault(int(attachment.exame_id or 0), []).append(attachment)

    atendimentos_map = _load_map(db, AtendimentoClinico, [exam.atendimento_id for exam in exams if exam.atendimento_id])
    laudos_map = _load_map(db, Laudo, [exam.laudo_id for exam in exams if exam.laudo_id])

    items: list[PortalExamSummaryResponse] = []
    for exam in exams:
        if portal_session.actor_type == "clinica":
            try:
                _assert_clinica_scope_for_exam(portal_session, exam, atendimentos_map, laudos_map)
            except HTTPException:
                continue
        items.append(_build_exam_summary(exam, attachments_by_exam.get(exam.id, [])))

    return PortalExamListResponse(total=len(items), items=items)


@router.post("/exames/{exame_id}/download-url", response_model=PortalDownloadUrlResponse)
def gerar_download_url_exame_portal(
    exame_id: int,
    db: Session = Depends(get_db),
    portal_session: PortalSessionContext = Depends(get_current_portal_session),
):
    exam, atendimentos_map, laudos_map = _load_exam_with_context(db, exame_id)
    _assert_portal_exam_access(db, portal_session, exam, atendimentos_map, laudos_map)

    attachments = (
        db.query(AnexoAtendimento)
        .filter(AnexoAtendimento.exame_id == exam.id)
        .order_by(AnexoAtendimento.created_at.desc(), AnexoAtendimento.id.desc())
        .all()
    )

    items: list[PortalDownloadLinkItemResponse] = []
    for attachment in attachments:
        if not attachment_has_download_source(attachment):
            continue
        download_token, expires_at = create_portal_download_token(
            portal_session,
            exame_id=exam.id,
            anexo_id=attachment.id,
        )
        items.append(
            PortalDownloadLinkItemResponse(
                anexo_id=attachment.id,
                nome_original=attachment.nome_original or f"anexo_{attachment.id}",
                mime_type=attachment.mime_type or "application/octet-stream",
                download_url=f"/api/v1/portal/anexos/{attachment.id}/arquivo",
                download_token=download_token,
                download_token_header=PORTAL_DOWNLOAD_TOKEN_HEADER,
                expires_at=expires_at,
            )
        )

    if not items:
        raise HTTPException(status_code=404, detail="Nenhum anexo disponivel para este exame.")

    return PortalDownloadUrlResponse(exame_id=exam.id, items=items)


@router.get("/anexos/{anexo_id}/arquivo")
def baixar_arquivo_anexo_portal(
    anexo_id: int,
    request: Request,
    db: Session = Depends(get_db),
):
    attachment = db.query(AnexoAtendimento).filter(AnexoAtendimento.id == anexo_id).first()
    if not attachment:
        raise HTTPException(status_code=404, detail="Anexo nao encontrado.")

    download_context: PortalDownloadContext | None = None
    raw_download_token = (request.headers.get(PORTAL_DOWNLOAD_TOKEN_HEADER) or "").strip()
    if raw_download_token:
        download_context = get_current_portal_download_token(request)
        if download_context.anexo_id != anexo_id:
            raise HTTPException(status_code=403, detail="Token de download sem acesso a este anexo.")
        if attachment.exame_id is None or download_context.exame_id != attachment.exame_id:
            raise HTTPException(status_code=403, detail="Token de download sem acesso a este anexo.")
    else:
        portal_session = get_current_portal_session(request)
        if attachment.exame_id is None:
            raise HTTPException(status_code=403, detail="Anexo sem exame associado para o portal.")
        exam, atendimentos_map, laudos_map = _load_exam_with_context(db, int(attachment.exame_id))
        _assert_portal_exam_access(db, portal_session, exam, atendimentos_map, laudos_map)

    registrar_auditoria(
        current_user=None,
        modulo="portal",
        entidade="anexo_atendimento",
        acao="PORTAL_DOWNLOAD_ARQUIVO",
        descricao="Download de anexo do portal realizado.",
        entidade_id=anexo_id,
        detalhes={
            "exame_id": attachment.exame_id,
            "via_download_token": bool(download_context),
        },
        request=request,
    )

    return build_attachment_download_response(
        attachment,
        missing_detail="Arquivo do anexo nao encontrado.",
    )
