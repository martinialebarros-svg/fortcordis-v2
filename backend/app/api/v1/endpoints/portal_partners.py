from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.core.security import get_current_user, require_papel
from app.db.database import get_db
from app.models.clinica import Clinica
from app.models.portal_partner import (
    PORTAL_PARTNER_TYPE_CLINICA,
    PORTAL_PARTNER_TYPE_VETERINARIO,
    PortalPartnerProfile,
)
from app.models.user import User
from app.schemas.portal import (
    PortalPartnerProfileCreateRequest,
    PortalPartnerProfileListResponse,
    PortalPartnerProfileResponse,
    PortalPartnerProfileUpdateRequest,
)

router = APIRouter()


def _require_portal_admin(current_user: User = Depends(require_papel("admin"))) -> User:
    return current_user


def _require_portal_operational_user(current_user: User = Depends(get_current_user)) -> User:
    return current_user


def _clean_text(value: str | None) -> str | None:
    normalized = str(value or "").strip()
    return normalized or None


def _normalize_email(value: str | None) -> str | None:
    normalized = str(value or "").strip().lower()
    return normalized or None


def _first_clinic_whatsapp(clinica: Clinica | None) -> str | None:
    if clinica is None:
        return None
    valores = getattr(clinica, "whatsapps", None)
    if isinstance(valores, list):
        for valor in valores:
            texto = _clean_text(valor)
            if texto:
                return texto
    return _clean_text(getattr(clinica, "telefone", None))


def _partner_type_label(tipo: str) -> str:
    if tipo == PORTAL_PARTNER_TYPE_VETERINARIO:
        return "Veterinario parceiro"
    return "Clinica parceira"


def _linked_clinic_by_id(db: Session, clinica_ids: list[int]) -> dict[int, Clinica]:
    if not clinica_ids:
        return {}
    clinicas = db.query(Clinica).filter(Clinica.id.in_(clinica_ids)).all()
    return {clinica.id: clinica for clinica in clinicas}


def _active_clinic_or_404(db: Session, clinica_id: int) -> Clinica:
    clinica = db.query(Clinica).filter(Clinica.id == clinica_id).first()
    if clinica is None or getattr(clinica, "ativo", False) in (False, 0, "0"):
        raise HTTPException(status_code=404, detail="Clinica ativa nao encontrada.")
    return clinica


def _ensure_unique_active_email(
    db: Session,
    *,
    email_login: str | None,
    ativo: bool,
    exclude_partner_id: int | None = None,
) -> None:
    normalized_email = _normalize_email(email_login)
    if not normalized_email or not ativo:
        return

    query = db.query(PortalPartnerProfile).filter(
        PortalPartnerProfile.ativo.is_(True),
        func.lower(PortalPartnerProfile.email_login) == normalized_email,
    )
    if exclude_partner_id is not None:
        query = query.filter(PortalPartnerProfile.id != exclude_partner_id)

    existing = query.first()
    if existing is not None:
        raise HTTPException(
            status_code=409,
            detail="Ja existe um parceiro externo ativo usando este email de login.",
        )


def _serialize_partner(
    partner: PortalPartnerProfile,
    *,
    clinicas_by_id: dict[int, Clinica],
) -> PortalPartnerProfileResponse:
    clinica = clinicas_by_id.get(partner.clinica_id) if partner.clinica_id else None
    return PortalPartnerProfileResponse(
        id=partner.id,
        tipo=partner.tipo,
        tipo_label=_partner_type_label(partner.tipo),
        clinica_id=partner.clinica_id,
        clinica_nome=getattr(clinica, "nome", None),
        nome_exibicao=partner.nome_exibicao,
        email_login=partner.email_login,
        telefone=partner.telefone,
        whatsapp=partner.whatsapp,
        cidade_base=partner.cidade_base,
        estado_base=partner.estado_base,
        crmv=partner.crmv,
        cpf_documento=partner.cpf_documento,
        area_atuacao=partner.area_atuacao,
        observacoes=partner.observacoes,
        ativo=bool(partner.ativo),
        created_at=partner.created_at,
        updated_at=partner.updated_at,
    )


def _resolve_create_payload(
    db: Session,
    payload: PortalPartnerProfileCreateRequest,
) -> dict[str, object]:
    tipo = payload.tipo
    nome_exibicao = _clean_text(payload.nome_exibicao)
    email_login = _normalize_email(payload.email_login)
    telefone = _clean_text(payload.telefone)
    whatsapp = _clean_text(payload.whatsapp)
    cidade_base = _clean_text(payload.cidade_base)
    estado_base = _clean_text(payload.estado_base)
    crmv = _clean_text(payload.crmv)
    cpf_documento = _clean_text(payload.cpf_documento)
    area_atuacao = _clean_text(payload.area_atuacao)
    observacoes = _clean_text(payload.observacoes)
    ativo = bool(payload.ativo)
    clinica_id = payload.clinica_id

    if tipo == PORTAL_PARTNER_TYPE_CLINICA:
        if clinica_id is None:
            raise HTTPException(status_code=422, detail="clinica_id e obrigatorio para parceiro do tipo clinica.")
        if db.query(PortalPartnerProfile).filter(PortalPartnerProfile.clinica_id == clinica_id).first():
            raise HTTPException(
                status_code=409,
                detail="Esta clinica ja possui um parceiro externo vinculado.",
            )

        clinica = _active_clinic_or_404(db, clinica_id)
        nome_exibicao = nome_exibicao or clinica.nome
        email_login = email_login or _normalize_email(getattr(clinica, "email", None))
        telefone = telefone or _clean_text(getattr(clinica, "telefone", None))
        whatsapp = whatsapp or _first_clinic_whatsapp(clinica)
        cidade_base = cidade_base or _clean_text(getattr(clinica, "cidade", None))
        estado_base = estado_base or _clean_text(getattr(clinica, "estado", None))
        observacoes = observacoes or _clean_text(getattr(clinica, "observacoes", None))
    else:
        if clinica_id is not None:
            raise HTTPException(status_code=422, detail="clinica_id nao se aplica ao tipo veterinario.")
        if not nome_exibicao:
            raise HTTPException(status_code=422, detail="nome_exibicao e obrigatorio para veterinario parceiro.")
        if not email_login:
            raise HTTPException(status_code=422, detail="email_login e obrigatorio para veterinario parceiro.")
        if not cidade_base or not estado_base:
            raise HTTPException(
                status_code=422,
                detail="cidade_base e estado_base sao obrigatorios para veterinario parceiro.",
            )
        if not telefone and not whatsapp:
            raise HTTPException(
                status_code=422,
                detail="Informe ao menos telefone ou whatsapp para veterinario parceiro.",
            )

    _ensure_unique_active_email(db, email_login=email_login, ativo=ativo)
    return {
        "tipo": tipo,
        "clinica_id": clinica_id,
        "nome_exibicao": nome_exibicao,
        "email_login": email_login,
        "telefone": telefone,
        "whatsapp": whatsapp,
        "cidade_base": cidade_base,
        "estado_base": estado_base,
        "crmv": crmv,
        "cpf_documento": cpf_documento,
        "area_atuacao": area_atuacao,
        "observacoes": observacoes,
        "ativo": ativo,
    }


def _resolve_update_payload(
    db: Session,
    partner: PortalPartnerProfile,
    payload: PortalPartnerProfileUpdateRequest,
) -> dict[str, object]:
    fields = payload.model_fields_set
    linked_clinic = (
        db.query(Clinica).filter(Clinica.id == partner.clinica_id).first()
        if partner.clinica_id
        else None
    )

    nome_exibicao = partner.nome_exibicao
    if "nome_exibicao" in fields:
        nome_exibicao = _clean_text(payload.nome_exibicao)
        if partner.tipo == PORTAL_PARTNER_TYPE_CLINICA:
            nome_exibicao = nome_exibicao or getattr(linked_clinic, "nome", None)

    email_login = partner.email_login
    if "email_login" in fields:
        email_login = _normalize_email(payload.email_login)
        if partner.tipo == PORTAL_PARTNER_TYPE_CLINICA:
            email_login = email_login or _normalize_email(getattr(linked_clinic, "email", None))

    telefone = partner.telefone
    if "telefone" in fields:
        telefone = _clean_text(payload.telefone)
        if partner.tipo == PORTAL_PARTNER_TYPE_CLINICA:
            telefone = telefone or _clean_text(getattr(linked_clinic, "telefone", None))

    whatsapp = partner.whatsapp
    if "whatsapp" in fields:
        whatsapp = _clean_text(payload.whatsapp)
        if partner.tipo == PORTAL_PARTNER_TYPE_CLINICA:
            whatsapp = whatsapp or _first_clinic_whatsapp(linked_clinic)

    cidade_base = partner.cidade_base
    if "cidade_base" in fields:
        cidade_base = _clean_text(payload.cidade_base)
        if partner.tipo == PORTAL_PARTNER_TYPE_CLINICA:
            cidade_base = cidade_base or _clean_text(getattr(linked_clinic, "cidade", None))

    estado_base = partner.estado_base
    if "estado_base" in fields:
        estado_base = _clean_text(payload.estado_base)
        if partner.tipo == PORTAL_PARTNER_TYPE_CLINICA:
            estado_base = estado_base or _clean_text(getattr(linked_clinic, "estado", None))

    crmv = partner.crmv if "crmv" not in fields else _clean_text(payload.crmv)
    cpf_documento = partner.cpf_documento if "cpf_documento" not in fields else _clean_text(payload.cpf_documento)
    area_atuacao = partner.area_atuacao if "area_atuacao" not in fields else _clean_text(payload.area_atuacao)

    observacoes = partner.observacoes
    if "observacoes" in fields:
        observacoes = _clean_text(payload.observacoes)
        if partner.tipo == PORTAL_PARTNER_TYPE_CLINICA:
            observacoes = observacoes or _clean_text(getattr(linked_clinic, "observacoes", None))

    ativo = bool(partner.ativo if payload.ativo is None else payload.ativo)

    if partner.tipo == PORTAL_PARTNER_TYPE_VETERINARIO:
        if not nome_exibicao:
            raise HTTPException(status_code=422, detail="nome_exibicao e obrigatorio para veterinario parceiro.")
        if not email_login:
            raise HTTPException(status_code=422, detail="email_login e obrigatorio para veterinario parceiro.")
        if not cidade_base or not estado_base:
            raise HTTPException(
                status_code=422,
                detail="cidade_base e estado_base sao obrigatorios para veterinario parceiro.",
            )
        if not telefone and not whatsapp:
            raise HTTPException(
                status_code=422,
                detail="Informe ao menos telefone ou whatsapp para veterinario parceiro.",
            )

    _ensure_unique_active_email(
        db,
        email_login=email_login,
        ativo=ativo,
        exclude_partner_id=partner.id,
    )
    return {
        "nome_exibicao": nome_exibicao,
        "email_login": email_login,
        "telefone": telefone,
        "whatsapp": whatsapp,
        "cidade_base": cidade_base,
        "estado_base": estado_base,
        "crmv": crmv,
        "cpf_documento": cpf_documento,
        "area_atuacao": area_atuacao,
        "observacoes": observacoes,
        "ativo": ativo,
    }


@router.get("/parceiros", response_model=PortalPartnerProfileListResponse)
def listar_parceiros_externos(
    tipo: str | None = Query(default=None, pattern="^(clinica|veterinario)$"),
    ativo: bool | None = Query(default=None),
    clinica_id: int | None = Query(default=None, gt=0),
    q: str | None = Query(default=None, max_length=120),
    db: Session = Depends(get_db),
    current_user: User = Depends(_require_portal_admin),
):
    del current_user
    query = db.query(PortalPartnerProfile)

    if tipo:
        query = query.filter(PortalPartnerProfile.tipo == tipo)
    if ativo is not None:
        query = query.filter(PortalPartnerProfile.ativo.is_(ativo))
    if clinica_id is not None:
        query = query.filter(PortalPartnerProfile.clinica_id == clinica_id)
    if q:
        search = f"%{q.strip().lower()}%"
        query = query.filter(
            or_(
                func.lower(func.coalesce(PortalPartnerProfile.nome_exibicao, "")).like(search),
                func.lower(func.coalesce(PortalPartnerProfile.email_login, "")).like(search),
                func.lower(func.coalesce(PortalPartnerProfile.telefone, "")).like(search),
                func.lower(func.coalesce(PortalPartnerProfile.whatsapp, "")).like(search),
                func.lower(func.coalesce(PortalPartnerProfile.cidade_base, "")).like(search),
                func.lower(func.coalesce(PortalPartnerProfile.estado_base, "")).like(search),
                func.lower(func.coalesce(PortalPartnerProfile.area_atuacao, "")).like(search),
            )
        )

    partners = query.order_by(
        func.lower(PortalPartnerProfile.nome_exibicao).asc(),
        PortalPartnerProfile.id.asc(),
    ).all()

    clinicas_by_id = _linked_clinic_by_id(
        db,
        [partner.clinica_id for partner in partners if partner.clinica_id is not None],
    )
    return PortalPartnerProfileListResponse(
        total=len(partners),
        items=[_serialize_partner(partner, clinicas_by_id=clinicas_by_id) for partner in partners],
    )


@router.get("/parceiros/veterinarios/opcoes", response_model=PortalPartnerProfileListResponse)
def listar_veterinarios_parceiros_para_fluxo(
    q: str | None = Query(default=None, max_length=120),
    limit: int = Query(default=50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(_require_portal_operational_user),
):
    del current_user
    query = db.query(PortalPartnerProfile).filter(
        PortalPartnerProfile.tipo == PORTAL_PARTNER_TYPE_VETERINARIO,
        PortalPartnerProfile.ativo.is_(True),
    )
    if q:
        search = f"%{q.strip().lower()}%"
        query = query.filter(
            or_(
                func.lower(func.coalesce(PortalPartnerProfile.nome_exibicao, "")).like(search),
                func.lower(func.coalesce(PortalPartnerProfile.email_login, "")).like(search),
                func.lower(func.coalesce(PortalPartnerProfile.whatsapp, "")).like(search),
                func.lower(func.coalesce(PortalPartnerProfile.telefone, "")).like(search),
                func.lower(func.coalesce(PortalPartnerProfile.cidade_base, "")).like(search),
                func.lower(func.coalesce(PortalPartnerProfile.area_atuacao, "")).like(search),
            )
        )

    partners = (
        query.order_by(
            func.lower(PortalPartnerProfile.nome_exibicao).asc(),
            PortalPartnerProfile.id.asc(),
        )
        .limit(limit)
        .all()
    )
    return PortalPartnerProfileListResponse(
        total=len(partners),
        items=[_serialize_partner(partner, clinicas_by_id={}) for partner in partners],
    )


@router.post(
    "/parceiros/veterinarios/cadastro-rapido",
    response_model=PortalPartnerProfileResponse,
    status_code=status.HTTP_201_CREATED,
)
def criar_veterinario_parceiro_no_fluxo(
    payload: PortalPartnerProfileCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(_require_portal_operational_user),
):
    del current_user
    payload_data = payload.model_dump()
    payload_data["tipo"] = PORTAL_PARTNER_TYPE_VETERINARIO
    resolved = _resolve_create_payload(db, PortalPartnerProfileCreateRequest(**payload_data))
    partner = PortalPartnerProfile(**resolved)
    db.add(partner)
    db.commit()
    db.refresh(partner)
    return _serialize_partner(partner, clinicas_by_id={})


@router.post("/parceiros", response_model=PortalPartnerProfileResponse, status_code=status.HTTP_201_CREATED)
def criar_parceiro_externo(
    payload: PortalPartnerProfileCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(_require_portal_admin),
):
    del current_user
    resolved = _resolve_create_payload(db, payload)
    partner = PortalPartnerProfile(**resolved)
    db.add(partner)
    db.commit()
    db.refresh(partner)

    clinicas_by_id = _linked_clinic_by_id(db, [partner.clinica_id] if partner.clinica_id else [])
    return _serialize_partner(partner, clinicas_by_id=clinicas_by_id)


@router.patch("/parceiros/{partner_id}", response_model=PortalPartnerProfileResponse)
def atualizar_parceiro_externo(
    partner_id: int,
    payload: PortalPartnerProfileUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(_require_portal_admin),
):
    del current_user
    partner = db.query(PortalPartnerProfile).filter(PortalPartnerProfile.id == partner_id).first()
    if partner is None:
        raise HTTPException(status_code=404, detail="Parceiro externo nao encontrado.")

    resolved = _resolve_update_payload(db, partner, payload)
    for field_name, field_value in resolved.items():
        setattr(partner, field_name, field_value)

    db.add(partner)
    db.commit()
    db.refresh(partner)

    clinicas_by_id = _linked_clinic_by_id(db, [partner.clinica_id] if partner.clinica_id else [])
    return _serialize_partner(partner, clinicas_by_id=clinicas_by_id)
