from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile, status
from sqlalchemy import func, or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from typing import Any, Dict, List, Optional
from datetime import date, datetime
from io import BytesIO
import json
import os
import re
import unicodedata
from zoneinfo import ZoneInfo

from app.api.v1.endpoints.atendimento import (
    _excluir_anexos_por_exame,
    _motivo_bloqueio_exclusao_exame,
    revogar_liberacao_exame_no_portal,
)
from app.db.database import get_db
from app.core.portal_release import PORTAL_RELEASED_STATUS, is_portal_released_status
from app.models.atendimento_clinico import AnexoAtendimento, AtendimentoClinico
from app.models.laudo import Laudo, Exame
from app.models.portal_partner import (
    PORTAL_PARTNER_TYPE_VETERINARIO,
    PortalPartnerProfile,
    PortalPartnerReleaseTarget,
)
from app.models.user import User
from app.core.security import get_current_user
from app.services.attachment_download_service import build_attachment_download_response
from app.services.auditoria_service import registrar_auditoria
from app.services.atendimento_upload_service import (
    AttachmentTooLargeError,
    AttachmentTypeError,
    build_upload_dedupe_key,
    calculate_attachment_sha256,
    remove_atendimento_attachment_file,
    store_atendimento_attachment_file,
)
from app.services.laudo_pdf_jobs import (
    JOB_STATUS_COMPLETED,
    JOB_STATUS_PENDING,
    enqueue_laudo_pdf_job,
    get_cached_laudo_pdf_job,
    get_laudo_pdf_job_for_user,
    serialize_laudo_pdf_job,
    submit_laudo_pdf_job,
)
from app.services.laudo_pdf_service import compute_laudo_pdf_cache_key, render_laudo_pdf
from app.services.portal_clinic_notification_service import notify_clinic_report_released
from app.services.portal_partner_notification_service import notify_partner_report_released
from app.utils.ecocardiograma_medidas import (
    extrair_medidas_ecocardiograma_da_descricao,
)
from app.utils.paciente_helpers import (
    atualizar_observacoes_com_idade,
    extrair_idade_paciente,
    normalizar_sexo_paciente,
)

router = APIRouter()


_ANEXOS_UNSET = object()

PORTAL_LAUDO_RELEASE_MESSAGE = "Laudo liberado no portal para destinatarios autorizados."
PORTAL_LAUDO_ATTACHMENT_DESCRIPTION = "PDF do laudo liberado no portal para destinatarios autorizados."
PORTAL_LAUDO_ATTACHMENT_ORIGIN = "portal_laudo"
TIPO_LAUDO_ELETROCARDIOGRAMA = "eletrocardiograma"
ELETROCARDIOGRAMA_EXTERNAL_PDF_KEY = "eletrocardiograma_pdf"
ELETROCARDIOGRAMA_UPLOAD_ORIGIN = "laudo_eletrocardiograma_upload"
ELETROCARDIOGRAMA_UPLOAD_ATTACHMENT_DESCRIPTION = "PDF do eletrocardiograma."
OPERATIONAL_TIME_ZONE = ZoneInfo("America/Fortaleza")
DATE_ONLY_PATTERN = re.compile(r"^\d{4}-\d{2}-\d{2}$")

ULTRASSOM_ORGAOS_ABDOMINAIS = [
    ("figado", "Figado"),
    ("vesicula_biliar", "Vesicula biliar"),
    ("estomago", "Estomago"),
    ("alcas_intestinais", "Alcas intestinais"),
    ("duodeno", "Duodeno"),
    ("colon", "Colon"),
    ("juncao_ileo_ceco_colica", "Juncao ileo-ceco-colica"),
    ("baco", "Baco"),
    ("rins", "Rins"),
    ("bexiga", "Bexiga"),
    ("pancreas", "Pancreas"),
    ("adrenais", "Adrenais"),
    ("prostata", "Prostata"),
    ("testiculos", "Testiculos"),
    ("utero", "Utero"),
    ("ovarios", "Ovários"),
]

ULTRASSOM_ORGAOS_LABELS = {key: label for key, label in ULTRASSOM_ORGAOS_ABDOMINAIS}


def _gerar_nome_key(nome: Optional[str]) -> str:
    """Gera chave normalizada para compatibilidade com schema legado."""
    if not nome:
        return ""
    texto = unicodedata.normalize("NFKD", nome)
    texto = "".join(c for c in texto if not unicodedata.combining(c))
    texto = texto.lower().strip()
    texto = re.sub(r"[^a-z0-9\s]", "", texto)
    texto = re.sub(r"\s+", " ", texto)
    return texto


def _legacy_now_dt() -> datetime:
    return datetime.utcnow()


def _to_float_or_none(value: Any) -> Optional[float]:
    if value in (None, ""):
        return None
    try:
        if isinstance(value, str):
            value = value.replace(",", ".").strip()
        return float(value)
    except (TypeError, ValueError):
        return None


def _to_int_or_none(value: Any) -> Optional[int]:
    if value in (None, ""):
        return None
    try:
        if isinstance(value, str):
            value = value.replace(",", ".").strip()
        return int(round(float(value)))
    except (TypeError, ValueError):
        return None


def _parse_data_exame(value: Any) -> Optional[datetime]:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value
    if isinstance(value, date):
        return datetime(value.year, value.month, value.day, tzinfo=OPERATIONAL_TIME_ZONE)
    if isinstance(value, str):
        value = value.strip()
        if not value:
            return None
        if DATE_ONLY_PATTERN.fullmatch(value):
            parsed_date = datetime.strptime(value, "%Y-%m-%d")
            return parsed_date.replace(tzinfo=OPERATIONAL_TIME_ZONE)
        try:
            return datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError:
            return None
    return None


def _label_tipo_exame_portal(laudo: Laudo) -> str:
    tipo = str(laudo.tipo or "").strip().lower()
    labels = {
        "ecocardiograma": "Ecocardiograma",
        TIPO_LAUDO_ELETROCARDIOGRAMA: "Eletrocardiograma",
        "pressao_arterial": "Pressao arterial",
        "ultrassonografia_abdominal": "Ultrassonografia abdominal",
    }
    if tipo in labels:
        return labels[tipo]
    return str(laudo.titulo or laudo.tipo or "Laudo").strip() or "Laudo"


def _sincronizar_exame_liberado_para_portal(
    db: Session,
    laudo: Laudo,
    current_user: User,
    released_at: datetime,
    *,
    preserve_release_timestamp: bool = False,
) -> Exame:
    exame = (
        db.query(Exame)
        .filter(Exame.laudo_id == laudo.id)
        .order_by(Exame.id.desc())
        .first()
    )
    if not exame:
        exame = Exame(
            laudo_id=laudo.id,
            paciente_id=laudo.paciente_id,
            tipo_exame=_label_tipo_exame_portal(laudo),
            categoria_exame="Laudo",
            prioridade="Rotina",
            status=PORTAL_RELEASED_STATUS,
            valor=0,
            criado_por_id=getattr(current_user, "id", None),
            criado_por_nome=getattr(current_user, "nome", None),
        )
        db.add(exame)

    exame.laudo_id = laudo.id
    exame.paciente_id = laudo.paciente_id
    exame.tipo_exame = _label_tipo_exame_portal(laudo)
    exame.categoria_exame = exame.categoria_exame or "Laudo"
    exame.prioridade = exame.prioridade or "Rotina"
    exame.status = PORTAL_RELEASED_STATUS
    exame.data_solicitacao = laudo.data_exame or laudo.data_laudo or released_at
    if not preserve_release_timestamp or not exame.data_resultado:
        exame.data_resultado = released_at
    exame.observacoes = PORTAL_LAUDO_RELEASE_MESSAGE
    if not exame.criado_por_id:
        exame.criado_por_id = getattr(current_user, "id", None)
    if not exame.criado_por_nome:
        exame.criado_por_nome = getattr(current_user, "nome", None)
    return exame


def _resolver_atendimento_id_para_anexo_portal(
    db: Session,
    laudo: Laudo,
    exame: Exame,
) -> int:
    if exame.atendimento_id:
        return int(exame.atendimento_id)

    if laudo.agendamento_id:
        atendimento = (
            db.query(AtendimentoClinico)
            .filter(
                AtendimentoClinico.agendamento_id == laudo.agendamento_id,
                AtendimentoClinico.paciente_id == laudo.paciente_id,
            )
            .order_by(AtendimentoClinico.id.desc())
            .first()
        )
        if atendimento:
            exame.atendimento_id = atendimento.id
            return int(atendimento.id)

    return 0


def _buscar_anexo_portal_laudo_existente(
    db: Session,
    *,
    exame_id: int,
    dedupe_key: str,
) -> AnexoAtendimento | None:
    return (
        db.query(AnexoAtendimento)
        .filter(
            AnexoAtendimento.exame_id == exame_id,
            AnexoAtendimento.origem == PORTAL_LAUDO_ATTACHMENT_ORIGIN,
            AnexoAtendimento.dedupe_key == dedupe_key,
        )
        .order_by(AnexoAtendimento.id.desc())
        .first()
    )


def _buscar_anexo_portal_laudo_atual(
    db: Session,
    *,
    exame_id: int,
) -> AnexoAtendimento | None:
    return (
        db.query(AnexoAtendimento)
        .filter(
            AnexoAtendimento.exame_id == exame_id,
            AnexoAtendimento.origem == PORTAL_LAUDO_ATTACHMENT_ORIGIN,
        )
        .order_by(AnexoAtendimento.id.desc())
        .first()
    )


def _buscar_anexo_pdf_externo_laudo(
    db: Session,
    laudo: Laudo,
    *,
    require_existing_file: bool = True,
) -> AnexoAtendimento | None:
    pdf_externo = _extrair_pdf_externo_laudo(laudo.anexos)
    if not pdf_externo:
        return None

    anexo_id = _to_optional_int(pdf_externo.get("anexo_id"))
    if not anexo_id:
        return None

    anexo = db.query(AnexoAtendimento).filter(AnexoAtendimento.id == anexo_id).first()
    if not anexo:
        return None
    if require_existing_file and (not anexo.caminho_arquivo or not os.path.exists(anexo.caminho_arquivo)):
        return None
    return anexo


def _resolver_atendimento_id_para_anexo_laudo(
    db: Session,
    *,
    laudo: Laudo,
    anexo: AnexoAtendimento | None = None,
    exame: Exame | None = None,
) -> int:
    if anexo and anexo.atendimento_id is not None:
        return int(anexo.atendimento_id)

    if exame and exame.atendimento_id is not None:
        return int(exame.atendimento_id)

    if laudo.agendamento_id and laudo.paciente_id:
        atendimento = (
            db.query(AtendimentoClinico)
            .filter(
                AtendimentoClinico.agendamento_id == laudo.agendamento_id,
                AtendimentoClinico.paciente_id == laudo.paciente_id,
            )
            .order_by(AtendimentoClinico.id.desc())
            .first()
        )
        if atendimento:
            return int(atendimento.id)

    return 0


def _vincular_pdf_externo_ao_portal(
    db: Session,
    *,
    laudo: Laudo,
    exame: Exame,
    anexo: AnexoAtendimento,
) -> AnexoAtendimento:
    if not exame.id:
        db.flush()

    atendimento_id = _resolver_atendimento_id_para_anexo_portal(db, laudo, exame)
    anexo.atendimento_id = atendimento_id
    anexo.exame_id = exame.id
    anexo.tipo = "documento"
    anexo.descricao = ELETROCARDIOGRAMA_UPLOAD_ATTACHMENT_DESCRIPTION
    anexo.mime_type = anexo.mime_type or "application/pdf"
    anexo.origem = PORTAL_LAUDO_ATTACHMENT_ORIGIN
    if anexo.arquivo_hash:
        anexo.dedupe_key = build_upload_dedupe_key(exame.id, anexo.arquivo_hash)
    anexo.url = f"/api/v1/portal/anexos/{anexo.id}/arquivo"
    return anexo


def _persistir_pdf_laudo_para_portal(
    db: Session,
    *,
    laudo: Laudo,
    exame: Exame,
    current_user: User,
) -> tuple[AnexoAtendimento, Optional[str], Optional[str]]:
    if not exame.id:
        db.flush()

    pdf_externo = _buscar_anexo_pdf_externo_laudo(db, laudo)
    if pdf_externo:
        return (
            _vincular_pdf_externo_ao_portal(
                db,
                laudo=laudo,
                exame=exame,
                anexo=pdf_externo,
            ),
            None,
            None,
        )

    pdf = render_laudo_pdf(db, laudo.id, current_user)
    arquivo_hash = calculate_attachment_sha256(pdf.content)
    dedupe_key = build_upload_dedupe_key(exame.id, arquivo_hash)
    anexo_existente = _buscar_anexo_portal_laudo_existente(
        db,
        exame_id=exame.id,
        dedupe_key=dedupe_key,
    )
    if anexo_existente and anexo_existente.caminho_arquivo and os.path.exists(anexo_existente.caminho_arquivo):
        return anexo_existente, None, None

    anexo_atual = _buscar_anexo_portal_laudo_atual(db, exame_id=exame.id)

    atendimento_id = _resolver_atendimento_id_para_anexo_portal(db, laudo, exame)
    storage_path = None
    try:
        storage_path, normalized_name, normalized_mime_type = store_atendimento_attachment_file(
            atendimento_id,
            pdf.filename,
            pdf.content,
            "application/pdf",
        )
        anexo = anexo_existente or anexo_atual
        old_path = None
        if anexo is None:
            anexo = AnexoAtendimento(
                atendimento_id=atendimento_id,
                exame_id=exame.id,
                origem=PORTAL_LAUDO_ATTACHMENT_ORIGIN,
            )
        elif anexo.caminho_arquivo and anexo.caminho_arquivo != storage_path:
            old_path = anexo.caminho_arquivo
        anexo.atendimento_id = atendimento_id
        anexo.exame_id = exame.id
        anexo.tipo = "documento"
        anexo.descricao = PORTAL_LAUDO_ATTACHMENT_DESCRIPTION
        anexo.nome_original = normalized_name
        anexo.tamanho = len(pdf.content)
        anexo.mime_type = normalized_mime_type
        anexo.arquivo_hash = arquivo_hash
        anexo.dedupe_key = dedupe_key
        anexo.caminho_arquivo = storage_path
        anexo.origem = PORTAL_LAUDO_ATTACHMENT_ORIGIN
        if anexo.id is None:
            anexo.url = ""
            db.add(anexo)
            db.flush()
        anexo.url = f"/api/v1/portal/anexos/{anexo.id}/arquivo"
        return anexo, old_path, storage_path
    except Exception:
        remove_atendimento_attachment_file(storage_path)
        raise


def _sincronizar_publicacao_laudo_no_portal(
    db: Session,
    *,
    laudo: Laudo,
    current_user: User,
) -> tuple[Exame | None, AnexoAtendimento | None, Optional[str], Optional[str]]:
    exame = (
        db.query(Exame)
        .filter(Exame.laudo_id == laudo.id)
        .order_by(Exame.id.desc())
        .first()
    )
    if laudo.status != PORTAL_RELEASED_STATUS and exame is None:
        return None, None, None, None

    released_at = exame.data_resultado if exame and exame.data_resultado else datetime.utcnow()
    laudo.status = PORTAL_RELEASED_STATUS
    exame = _sincronizar_exame_liberado_para_portal(
        db,
        laudo,
        current_user,
        released_at,
        preserve_release_timestamp=True,
    )
    anexo, old_path, new_path = _persistir_pdf_laudo_para_portal(
        db,
        laudo=laudo,
        exame=exame,
        current_user=current_user,
    )
    return exame, anexo, old_path, new_path


def _parse_filtro_data(value: Optional[str]) -> Optional[date]:
    if value is None:
        return None

    texto = str(value).strip()
    if not texto:
        return None

    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y", "%Y/%m/%d"):
        try:
            return datetime.strptime(texto, fmt).date()
        except ValueError:
            continue

    return None


def _extrair_clinic_id(clinica: Any) -> Optional[int]:
    if isinstance(clinica, dict):
        clinic_id = clinica.get("id")
        try:
            return int(clinic_id) if clinic_id not in (None, "") else None
        except (TypeError, ValueError):
            return None
    if isinstance(clinica, (int, str)):
        try:
            return int(clinica)
        except (TypeError, ValueError):
            return None
    return None


def _normalizar_pressao_arterial(raw: Any) -> Optional[Dict[str, Any]]:
    if not isinstance(raw, dict):
        return None

    pas_1 = _to_int_or_none(raw.get("pas_1"))
    pas_2 = _to_int_or_none(raw.get("pas_2"))
    pas_3 = _to_int_or_none(raw.get("pas_3"))

    medidas_validas = [v for v in (pas_1, pas_2, pas_3) if isinstance(v, int) and v > 0]
    pas_media = _to_int_or_none(raw.get("pas_media"))
    if pas_media is not None and pas_media <= 0:
        pas_media = None
    if pas_media is None and medidas_validas:
        pas_media = int(round(sum(medidas_validas) / len(medidas_validas)))

    manguito = (raw.get("manguito") or "").strip()
    membro = (raw.get("membro") or "").strip()
    decubito = (raw.get("decubito") or "").strip()
    obs_extra = (raw.get("obs_extra") or "").strip()
    metodo = (raw.get("metodo") or "Doppler").strip() or "Doppler"

    # Evita anexar pressão em laudos eco quando apenas campos padrão foram enviados.
    # Para considerar pressão válida, é obrigatório ter ao menos uma PAS/média > 0.
    if not (medidas_validas or pas_media):
        return None

    return {
        "pas_1": pas_1,
        "pas_2": pas_2,
        "pas_3": pas_3,
        "pas_media": pas_media,
        "metodo": metodo,
        "manguito": manguito,
        "membro": membro,
        "decubito": decubito,
        "obs_extra": obs_extra,
    }


def _normalizar_sexo_paciente(sexo: Any) -> str:
    return normalizar_sexo_paciente(sexo)


def _normalizar_ecocardiograma_cabecalho(raw: Any) -> Optional[Dict[str, Any]]:
    if not isinstance(raw, dict):
        return None

    ritmo = str(raw.get("ritmo") or "").strip()
    estado = str(raw.get("estado") or "").strip()
    fc = str(raw.get("fc") or "").strip()
    versao = _to_int_or_none(raw.get("versao")) or 1

    if not ritmo and not estado and not fc:
        return None

    return {
        "versao": versao,
        "ritmo": ritmo,
        "estado": estado,
        "fc": fc,
    }


def _carregar_anexos_dict(anexos_raw: Any) -> Dict[str, Any]:
    anexos_data: Dict[str, Any] = {}
    if isinstance(anexos_raw, dict):
        anexos_data = dict(anexos_raw)
    elif isinstance(anexos_raw, str) and anexos_raw.strip():
        try:
            parsed = json.loads(anexos_raw)
            if isinstance(parsed, dict):
                anexos_data = parsed
        except json.JSONDecodeError:
            anexos_data = {}
    return anexos_data


def _serializar_pdf_externo_laudo(
    anexos_raw: Any,
    payload: Dict[str, Any],
) -> str:
    anexos_data = _carregar_anexos_dict(anexos_raw)
    anexos_data[ELETROCARDIOGRAMA_EXTERNAL_PDF_KEY] = payload
    return json.dumps(anexos_data, ensure_ascii=False)


def _extrair_pdf_externo_laudo(anexos_raw: Any) -> Optional[Dict[str, Any]]:
    anexos_data = _carregar_anexos_dict(anexos_raw)
    pdf_data = anexos_data.get(ELETROCARDIOGRAMA_EXTERNAL_PDF_KEY)
    return pdf_data if isinstance(pdf_data, dict) else None


def _to_optional_int(value: Any) -> Optional[int]:
    if value in (None, ""):
        return None
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        return None
    return parsed if parsed > 0 else None


def _load_veterinario_parceiro_or_422(
    db: Session,
    partner_id: Any,
) -> tuple[Optional[int], Optional[PortalPartnerProfile]]:
    resolved_partner_id = _to_optional_int(partner_id)
    if resolved_partner_id is None:
        return None, None

    partner = db.query(PortalPartnerProfile).filter(PortalPartnerProfile.id == resolved_partner_id).first()
    if partner is None or not bool(partner.ativo) or partner.tipo != PORTAL_PARTNER_TYPE_VETERINARIO:
        raise HTTPException(
            status_code=422,
            detail="Selecione um veterinario parceiro ativo para vincular o encaminhamento.",
        )
    return resolved_partner_id, partner


def _portal_veterinario_liberado(
    db: Session,
    *,
    laudo_id: int,
    veterinario_parceiro_id: Any,
    exame_id_by_laudo_id: dict[int, int] | None = None,
) -> bool:
    resolved_partner_id = _to_optional_int(veterinario_parceiro_id)
    if resolved_partner_id is None:
        return False

    exame_id = None
    if exame_id_by_laudo_id is not None:
        exame_id = exame_id_by_laudo_id.get(int(laudo_id))
    if exame_id is None:
        exame = (
            db.query(Exame)
            .filter(Exame.laudo_id == laudo_id)
            .order_by(Exame.id.desc())
            .first()
        )
        exame_id = getattr(exame, "id", None)
    if exame_id is None:
        return False

    target = (
        db.query(PortalPartnerReleaseTarget.id)
        .filter(
            PortalPartnerReleaseTarget.partner_id == resolved_partner_id,
            PortalPartnerReleaseTarget.exame_id == exame_id,
            PortalPartnerReleaseTarget.revoked_at.is_(None),
        )
        .first()
    )
    return target is not None


def _load_exam_id_by_laudo_id_map(db: Session, laudo_ids: list[int]) -> dict[int, int]:
    unique_ids = sorted({int(item) for item in laudo_ids if item})
    if not unique_ids:
        return {}

    exams = (
        db.query(Exame.laudo_id, Exame.id)
        .filter(Exame.laudo_id.in_(unique_ids))
        .order_by(Exame.id.desc())
        .all()
    )
    exam_id_by_laudo_id: dict[int, int] = {}
    for laudo_id, exam_id in exams:
        if laudo_id is None or exam_id is None:
            continue
        exam_id_by_laudo_id.setdefault(int(laudo_id), int(exam_id))
    return exam_id_by_laudo_id


def _serialize_portal_release_state(
    db: Session,
    *,
    laudo: Laudo,
    portal_veterinario_liberado: bool | None = None,
    exame_id_by_laudo_id: dict[int, int] | None = None,
) -> dict[str, Any]:
    clinic_available = _to_optional_int(laudo.clinic_id) is not None
    vet_available = _to_optional_int(laudo.veterinario_parceiro_id) is not None
    clinic_released = clinic_available and is_portal_released_status(laudo.status, kind="laudo")
    if portal_veterinario_liberado is None:
        portal_veterinario_liberado = _portal_veterinario_liberado(
            db,
            laudo_id=laudo.id,
            veterinario_parceiro_id=laudo.veterinario_parceiro_id,
            exame_id_by_laudo_id=exame_id_by_laudo_id,
        )
    pending_destinations: list[str] = []
    if clinic_available and not clinic_released:
        pending_destinations.append("clinica")
    if vet_available and not portal_veterinario_liberado:
        pending_destinations.append("veterinario_parceiro")
    return {
        "portal_clinica_disponivel": clinic_available,
        "portal_clinica_liberado": clinic_released,
        "portal_veterinario_disponivel": vet_available,
        "portal_veterinario_liberado": bool(portal_veterinario_liberado),
        "portal_destinos_pendentes": pending_destinations,
        "portal_pode_liberar": bool(pending_destinations),
    }


def _upsert_portal_partner_release_target(
    db: Session,
    *,
    partner_id: int,
    exame_id: int,
    laudo_id: int,
    created_by_user_id: int | None,
    released_at: datetime,
    contexto: dict[str, Any],
) -> tuple[PortalPartnerReleaseTarget, bool]:
    target = (
        db.query(PortalPartnerReleaseTarget)
        .filter(
            PortalPartnerReleaseTarget.partner_id == partner_id,
            PortalPartnerReleaseTarget.exame_id == exame_id,
        )
        .first()
    )
    contexto_json = json.dumps(contexto or {}, ensure_ascii=False, default=str)
    if target is None:
        target = PortalPartnerReleaseTarget(
            partner_id=partner_id,
            exame_id=exame_id,
            laudo_id=laudo_id,
            permitir_download=True,
            released_at=released_at,
            created_by_user_id=created_by_user_id,
            contexto_json=contexto_json,
        )
        db.add(target)
        db.flush()
        return target, True

    was_inactive = target.revoked_at is not None
    target.laudo_id = laudo_id
    target.permitir_download = True
    target.contexto_json = contexto_json
    if target.created_by_user_id is None:
        target.created_by_user_id = created_by_user_id
    if was_inactive:
        target.revoked_at = None
        target.released_at = released_at
    return target, was_inactive


def _build_portal_release_success_message(
    *,
    clinic_released_now: bool,
    partner_released_now: bool,
    clinic_notification_destination: str | None,
    partner_notification_destination: str | None,
) -> str:
    if clinic_released_now and partner_released_now:
        if clinic_notification_destination and partner_notification_destination:
            return (
                "Laudo liberado no portal da clinica parceira e do veterinario parceiro. "
                f"Emails enviados para {clinic_notification_destination} e {partner_notification_destination}."
            )
        return "Laudo liberado no portal da clinica parceira e do veterinario parceiro."
    if clinic_released_now:
        if clinic_notification_destination:
            return f"Laudo liberado no portal da clinica parceira. Email enviado para {clinic_notification_destination}."
        return "Laudo liberado no portal da clinica parceira."
    if partner_released_now:
        if partner_notification_destination:
            return f"Laudo liberado no portal do veterinario parceiro. Email enviado para {partner_notification_destination}."
        return "Laudo liberado no portal do veterinario parceiro."
    return "Portal atualizado para os destinatarios ja vinculados."


def _normalizar_ultrassonografia_abdominal(raw: Any) -> Optional[Dict[str, Any]]:
    if not isinstance(raw, dict):
        return None

    qualitativa_raw = raw.get("qualitativa")
    if not isinstance(qualitativa_raw, dict):
        qualitativa_raw = raw

    qualitativa: Dict[str, str] = {}
    for key, _label in ULTRASSOM_ORGAOS_ABDOMINAIS:
        texto = str(qualitativa_raw.get(key) or "").strip()
        if texto:
            qualitativa[key] = texto

    observacoes_gerais = str(raw.get("observacoes_gerais") or raw.get("observacoes") or "").strip()
    sexo_paciente = _normalizar_sexo_paciente(raw.get("sexo_paciente") or raw.get("sexo"))

    if not qualitativa and not observacoes_gerais and not sexo_paciente:
        return None

    return {
        "versao": 1,
        "sexo_paciente": sexo_paciente,
        "qualitativa": qualitativa,
        "observacoes_gerais": observacoes_gerais,
    }


def _montar_descricao_ultrassonografia_abdominal(data: Optional[Dict[str, Any]]) -> str:
    if not data:
        return ""

    qualitativa = data.get("qualitativa") or {}
    observacoes_gerais = str(data.get("observacoes_gerais") or "").strip()

    linhas = ["## Ultrassonografia Abdominal"]
    for key, label in ULTRASSOM_ORGAOS_ABDOMINAIS:
        texto = str(qualitativa.get(key) or "").strip()
        if texto:
            linhas.append(f"- {label}: {texto}")

    if observacoes_gerais:
        linhas.extend(["", "## Observacoes Gerais", observacoes_gerais])

    return "\n".join(linhas).strip()


def _listar_campos_qualitativa_ecocardiograma() -> List[str]:
    return ["valvas", "camaras", "funcao", "pericardio", "vasos", "ad_vd"]


def _montar_descricao_ecocardiograma(
    medidas: Optional[Dict[str, Any]],
    qualitativa: Optional[Dict[str, Any]],
) -> str:
    medidas = medidas or {}
    qualitativa = qualitativa or {}

    descricao_parts = ["## Medidas Ecocardiograficas\n"]
    for key, value in medidas.items():
        if value:
            descricao_parts.append(f"- {key}: {value}")

    descricao_parts.append("\n## Avaliacao Qualitativa\n")
    for key, value in qualitativa.items():
        texto_original = str(value or "")
        texto = texto_original.strip()
        if texto:
            if "\n" in texto:
                descricao_parts.append(f"- {key}:")
                descricao_parts.extend(texto_original.strip("\n").splitlines())
            else:
                descricao_parts.append(f"- {key}: {texto}")

    return "\n".join(descricao_parts)


def _get_ecocardiograma_estruturado_aspectos() -> List[Dict[str, str]]:
    from app.services.frases_ecocardiograma_estruturado_teste_service import DEFAULT_ASPECTS

    return [
        {
            "key": str(item.get("key") or "").strip(),
            "label": str(item.get("label") or "").strip(),
            "legacy_field": str(item.get("legacy_field") or "").strip(),
        }
        for item in DEFAULT_ASPECTS
        if str(item.get("key") or "").strip()
    ]


def _normalizar_ecocardiograma_estruturado(raw: Any) -> Optional[Dict[str, Any]]:
    if not isinstance(raw, dict):
        return None

    aspectos = _get_ecocardiograma_estruturado_aspectos()
    aspectos_map = {item["key"]: item for item in aspectos}
    textos_raw = raw.get("textos")
    if not isinstance(textos_raw, dict):
        textos_raw = {}
    preset_textos_raw = raw.get("preset_textos")
    if not isinstance(preset_textos_raw, dict):
        preset_textos_raw = {}

    textos: Dict[str, str] = {}
    preset_textos: Dict[str, str] = {}
    for aspecto_key in aspectos_map:
        texto = str(textos_raw.get(aspecto_key) or "").strip()
        if texto:
            textos[aspecto_key] = texto
        preset_texto = str(preset_textos_raw.get(aspecto_key) or "").strip()
        if preset_texto:
            preset_textos[aspecto_key] = preset_texto

    preset_id = _to_int_or_none(raw.get("preset_id"))
    preset_label = str(raw.get("preset_label") or "").strip()
    usar_no_laudo = bool(raw.get("usar_no_laudo"))
    modo = str(raw.get("modo") or "teste").strip() or "teste"
    versao = _to_int_or_none(raw.get("versao")) or 1
    updated_at = str(raw.get("updated_at") or "").strip() or datetime.now().isoformat()

    if not textos and preset_id is None and not preset_label:
        return None

    return {
        "versao": versao,
        "modo": modo,
        "usar_no_laudo": usar_no_laudo,
        "preset_id": preset_id,
        "preset_label": preset_label,
        "preset_textos": preset_textos,
        "updated_at": updated_at,
        "textos": textos,
    }


def _montar_bloco_legado_ecocardiograma_estruturado(
    itens: List[Dict[str, str]],
) -> str:
    if not itens:
        return ""
    if len(itens) == 1:
        return itens[0]["texto"]
    linhas: List[str] = []
    for item in itens:
        texto = str(item["texto"] or "").strip().replace("\n", "\n    ")
        linhas.append(f'  - {item["label"]}: {texto}')
    return "\n".join(linhas)


def _derivar_legado_de_ecocardiograma_estruturado(
    data: Optional[Dict[str, Any]],
) -> Dict[str, Any]:
    qualitativa = {campo: "" for campo in _listar_campos_qualitativa_ecocardiograma()}
    conclusao = ""

    if not data:
        return {"qualitativa": qualitativa, "conclusao": conclusao}

    textos = data.get("textos") or {}
    if not isinstance(textos, dict):
        textos = {}

    agrupados: Dict[str, List[Dict[str, str]]] = {}
    for aspecto in _get_ecocardiograma_estruturado_aspectos():
        legacy_field = aspecto["legacy_field"]
        if legacy_field == "conclusao":
            conclusao = str(textos.get(aspecto["key"]) or "").strip()
            continue

        if legacy_field not in qualitativa:
            continue

        texto = str(textos.get(aspecto["key"]) or "").strip()
        if not texto:
            continue

        agrupados.setdefault(legacy_field, []).append(
            {"label": aspecto["label"], "texto": texto}
        )

    for legacy_field in qualitativa:
        qualitativa[legacy_field] = _montar_bloco_legado_ecocardiograma_estruturado(
            agrupados.get(legacy_field, [])
        )

    return {"qualitativa": qualitativa, "conclusao": conclusao}


def _serializar_anexos(
    anexos_raw: Any,
    pressao_arterial: Any = _ANEXOS_UNSET,
    ultrassonografia_abdominal: Any = _ANEXOS_UNSET,
    ecocardiograma_cabecalho: Any = _ANEXOS_UNSET,
    ecocardiograma_estruturado: Any = _ANEXOS_UNSET,
) -> Optional[str]:
    anexos_data = _carregar_anexos_dict(anexos_raw)

    if pressao_arterial is not _ANEXOS_UNSET:
        if pressao_arterial:
            anexos_data["pressao_arterial"] = pressao_arterial
        else:
            anexos_data.pop("pressao_arterial", None)

    if ultrassonografia_abdominal is not _ANEXOS_UNSET:
        if ultrassonografia_abdominal:
            anexos_data["ultrassonografia_abdominal"] = ultrassonografia_abdominal
        else:
            anexos_data.pop("ultrassonografia_abdominal", None)

    if ecocardiograma_cabecalho is not _ANEXOS_UNSET:
        if ecocardiograma_cabecalho:
            anexos_data["ecocardiograma_cabecalho"] = ecocardiograma_cabecalho
        else:
            anexos_data.pop("ecocardiograma_cabecalho", None)

    if ecocardiograma_estruturado is not _ANEXOS_UNSET:
        if ecocardiograma_estruturado:
            anexos_data["ecocardiograma_estruturado"] = ecocardiograma_estruturado
        else:
            anexos_data.pop("ecocardiograma_estruturado", None)

    if not anexos_data:
        return None
    return json.dumps(anexos_data, ensure_ascii=False)


def _extrair_pressao_arterial_de_anexos(anexos_raw: Any) -> Optional[Dict[str, Any]]:
    if not anexos_raw:
        return None
    if isinstance(anexos_raw, dict):
        return _normalizar_pressao_arterial(anexos_raw.get("pressao_arterial"))
    if isinstance(anexos_raw, str):
        try:
            parsed = json.loads(anexos_raw)
            if isinstance(parsed, dict):
                return _normalizar_pressao_arterial(parsed.get("pressao_arterial"))
        except json.JSONDecodeError:
            return None
    return None


def _extrair_ultrassonografia_abdominal_de_anexos(anexos_raw: Any) -> Optional[Dict[str, Any]]:
    if not anexos_raw:
        return None
    if isinstance(anexos_raw, dict):
        return _normalizar_ultrassonografia_abdominal(anexos_raw.get("ultrassonografia_abdominal"))
    if isinstance(anexos_raw, str):
        try:
            parsed = json.loads(anexos_raw)
            if isinstance(parsed, dict):
                return _normalizar_ultrassonografia_abdominal(parsed.get("ultrassonografia_abdominal"))
        except json.JSONDecodeError:
            return None
    return None


def _extrair_ecocardiograma_cabecalho_de_anexos(anexos_raw: Any) -> Optional[Dict[str, Any]]:
    if not anexos_raw:
        return None
    if isinstance(anexos_raw, dict):
        return _normalizar_ecocardiograma_cabecalho(anexos_raw.get("ecocardiograma_cabecalho"))
    if isinstance(anexos_raw, str):
        try:
            parsed = json.loads(anexos_raw)
            if isinstance(parsed, dict):
                return _normalizar_ecocardiograma_cabecalho(parsed.get("ecocardiograma_cabecalho"))
        except json.JSONDecodeError:
            return None
    return None


def _extrair_ecocardiograma_estruturado_de_anexos(anexos_raw: Any) -> Optional[Dict[str, Any]]:
    if not anexos_raw:
        return None
    if isinstance(anexos_raw, dict):
        return _normalizar_ecocardiograma_estruturado(anexos_raw.get("ecocardiograma_estruturado"))
    if isinstance(anexos_raw, str):
        try:
            parsed = json.loads(anexos_raw)
            if isinstance(parsed, dict):
                return _normalizar_ecocardiograma_estruturado(parsed.get("ecocardiograma_estruturado"))
        except json.JSONDecodeError:
            return None
    return None


def _extrair_ultrassonografia_abdominal_do_descricao(descricao_raw: Any) -> Optional[Dict[str, Any]]:
    descricao = str(descricao_raw or "").strip()
    if not descricao:
        return None

    qualitativa: Dict[str, str] = {}
    for key, label in ULTRASSOM_ORGAOS_ABDOMINAIS:
        pattern = rf"-\s*{re.escape(label)}:\s*(.+?)(?=\n-|\n##|\Z)"
        match = re.search(pattern, descricao, re.DOTALL | re.IGNORECASE)
        if match:
            qualitativa[key] = match.group(1).strip()

    observacoes_gerais = ""
    observacoes_match = re.search(r"## Observacoes Gerais\s*(.+)$", descricao, re.DOTALL | re.IGNORECASE)
    if observacoes_match:
        observacoes_gerais = observacoes_match.group(1).strip()

    if not qualitativa and not observacoes_gerais:
        return None

    return {
        "versao": 1,
        "sexo_paciente": "",
        "qualitativa": qualitativa,
        "observacoes_gerais": observacoes_gerais,
    }


def _classificar_pressao_media(pas_media: Optional[int]) -> str:
    if pas_media is None or pas_media <= 0:
        return "Sem classificação (média indisponível)"
    if pas_media <= 140:
        return "Normal (110 a 140 mmHg)"
    if pas_media <= 159:
        return "Levemente elevada (141 a 159 mmHg)"
    if pas_media <= 179:
        return "Moderadamente elevada (160 a 179 mmHg)"
    return "Severamente elevada (>=180 mmHg)"


def _resolver_ou_criar_paciente(paciente: Dict[str, Any], db: Session) -> int:
    from app.models.paciente import Paciente
    from app.models.tutor import Tutor

    tutor_id = None
    tutor_nome = (paciente.get("tutor") or "").strip()
    if tutor_nome:
        tutor_nome_key = _gerar_nome_key(tutor_nome)
        tutor = db.query(Tutor).filter(Tutor.nome_key == tutor_nome_key).first()
        if not tutor:
            tutor = db.query(Tutor).filter(Tutor.nome.ilike(tutor_nome)).first()

        if not tutor:
            tutor = Tutor(
                nome=tutor_nome,
                nome_key=tutor_nome_key,
                telefone=paciente.get("telefone", ""),
                ativo=1,
                created_at=_legacy_now_dt(),
            )
            db.add(tutor)
            try:
                db.commit()
                db.refresh(tutor)
            except IntegrityError:
                db.rollback()
                tutor = db.query(Tutor).filter(Tutor.nome_key == tutor_nome_key).first()
                if not tutor:
                    tutor = db.query(Tutor).filter(Tutor.nome.ilike(tutor_nome)).first()
                if not tutor:
                    raise
        tutor_id = tutor.id

    def _atualizar_paciente_existente_sem_limpar_campos(db_paciente: Any) -> None:
        houve_alteracao = False

        nome_payload = (paciente.get("nome") or "").strip()
        if nome_payload and nome_payload != (db_paciente.nome or ""):
            db_paciente.nome = nome_payload
            db_paciente.nome_key = _gerar_nome_key(nome_payload)
            houve_alteracao = True

        especie_payload = (paciente.get("especie") or "").strip()
        if especie_payload and especie_payload != (db_paciente.especie or ""):
            db_paciente.especie = especie_payload
            houve_alteracao = True

        raca_payload = (paciente.get("raca") or "").strip()
        if raca_payload and raca_payload != (db_paciente.raca or ""):
            db_paciente.raca = raca_payload
            houve_alteracao = True

        sexo_payload = normalizar_sexo_paciente(paciente.get("sexo"))
        if sexo_payload and sexo_payload != (db_paciente.sexo or ""):
            db_paciente.sexo = sexo_payload
            houve_alteracao = True

        peso_payload = _to_float_or_none(paciente.get("peso"))
        if peso_payload is not None:
            peso_atual = _to_float_or_none(db_paciente.peso_kg)
            if peso_atual is None or abs(peso_atual - peso_payload) > 0.000001:
                db_paciente.peso_kg = peso_payload
                houve_alteracao = True

        if tutor_id is not None and tutor_id != db_paciente.tutor_id:
            db_paciente.tutor_id = tutor_id
            houve_alteracao = True

        idade_payload = str(paciente.get("idade") or "").strip()
        if idade_payload:
            observacoes_atualizadas = atualizar_observacoes_com_idade(
                db_paciente.observacoes,
                idade_payload,
            )
            if observacoes_atualizadas != str(db_paciente.observacoes or "").strip():
                db_paciente.observacoes = observacoes_atualizadas or None
                houve_alteracao = True

        if db_paciente.ativo != 1:
            db_paciente.ativo = 1
            houve_alteracao = True

        if houve_alteracao:
            db_paciente.updated_at = _legacy_now_dt()

    paciente_id = paciente.get("id")
    if paciente_id not in (None, ""):
        try:
            paciente_id = int(paciente_id)
        except (TypeError, ValueError):
            raise HTTPException(status_code=422, detail="ID do paciente invalido.")

        paciente_existente = db.query(Paciente).filter(Paciente.id == paciente_id).first()
        if not paciente_existente:
            raise HTTPException(status_code=404, detail="Paciente informado nao encontrado.")

        _atualizar_paciente_existente_sem_limpar_campos(paciente_existente)
        return paciente_existente.id

    paciente_nome_input = (paciente.get("nome") or "").strip()
    if not paciente_nome_input:
        raise HTTPException(status_code=422, detail="Nome do paciente e obrigatorio para salvar o laudo.")

    if tutor_id is None:
        raise HTTPException(
            status_code=422,
            detail="Informe o tutor do paciente antes de salvar o laudo.",
        )

    paciente_nome = paciente_nome_input or "Paciente sem nome"
    paciente_nome_key = _gerar_nome_key(paciente_nome)
    paciente_especie = (paciente.get("especie") or "Canina").strip() or "Canina"

    paciente_query = db.query(Paciente).filter(Paciente.nome_key == paciente_nome_key)
    if tutor_id is None:
        paciente_query = paciente_query.filter(Paciente.tutor_id.is_(None))
    else:
        paciente_query = paciente_query.filter(Paciente.tutor_id == tutor_id)
    paciente_query = paciente_query.filter(Paciente.especie.ilike(paciente_especie))

    paciente_existente = paciente_query.order_by(Paciente.id.desc()).first()
    if paciente_existente:
        _atualizar_paciente_existente_sem_limpar_campos(paciente_existente)
        return paciente_existente.id

    observacoes = atualizar_observacoes_com_idade("", paciente.get("idade"))

    novo_paciente = Paciente(
        nome=paciente_nome,
        nome_key=paciente_nome_key,
        especie=paciente_especie,
        raca=paciente.get("raca", ""),
        sexo=normalizar_sexo_paciente(paciente.get("sexo", "")),
        peso_kg=_to_float_or_none(paciente.get("peso")),
        tutor_id=tutor_id,
        observacoes=observacoes if observacoes else None,
        ativo=1,
        created_at=_legacy_now_dt(),
    )
    db.add(novo_paciente)
    try:
        db.commit()
        db.refresh(novo_paciente)
        return novo_paciente.id
    except IntegrityError:
        db.rollback()
        paciente_query = db.query(Paciente).filter(Paciente.nome_key == paciente_nome_key)
        if tutor_id is None:
            paciente_query = paciente_query.filter(Paciente.tutor_id.is_(None))
        else:
            paciente_query = paciente_query.filter(Paciente.tutor_id == tutor_id)
        paciente_query = paciente_query.filter(Paciente.especie.ilike(paciente_especie))
        paciente_existente = paciente_query.order_by(Paciente.id.desc()).first()
        if not paciente_existente:
            raise
        return paciente_existente.id


@router.get("/laudos")
def listar_laudos(
    paciente_id: Optional[int] = None,
    tipo: Optional[str] = None,
    status: Optional[str] = None,
    search: Optional[str] = None,
    data: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Lista laudos com filtros e dados do paciente/tutor"""
    from app.models.paciente import Paciente
    from app.models.tutor import Tutor
    from app.models.clinica import Clinica

    def _iso_or_str(value: Any) -> Optional[str]:
        if value is None:
            return None
        if hasattr(value, "isoformat"):
            try:
                return value.isoformat()
            except Exception:
                return str(value)
        return str(value)
    
    query = (
        db.query(
            Laudo,
            Paciente.nome.label("paciente_nome"),
            Tutor.nome.label("tutor_nome"),
            Clinica.nome.label("clinica_nome"),
            PortalPartnerProfile.nome_exibicao.label("veterinario_parceiro_nome"),
        )
        .outerjoin(Paciente, Laudo.paciente_id == Paciente.id)
        .outerjoin(Tutor, Paciente.tutor_id == Tutor.id)
        .outerjoin(Clinica, Laudo.clinic_id == Clinica.id)
        .outerjoin(PortalPartnerProfile, Laudo.veterinario_parceiro_id == PortalPartnerProfile.id)
    )
    
    if paciente_id:
        query = query.filter(Laudo.paciente_id == paciente_id)
    if tipo:
        query = query.filter(Laudo.tipo == tipo)
    if status:
        query = query.filter(Laudo.status == status)

    data_filtro = _parse_filtro_data(data)
    if data_filtro:
        query = query.filter(
            or_(
                func.date(Laudo.data_exame) == data_filtro,
                func.date(Laudo.data_laudo) == data_filtro,
            )
        )

    termos_busca = [termo for termo in re.split(r"\s+", (search or "").strip()) if termo]
    for termo_bruto in termos_busca:
        data_termo = _parse_filtro_data(termo_bruto)
        if data_termo:
            query = query.filter(
                or_(
                    func.date(Laudo.data_exame) == data_termo,
                    func.date(Laudo.data_laudo) == data_termo,
                )
            )
            continue

        termo = f"%{termo_bruto}%"
        termo_key = f"%{_gerar_nome_key(termo_bruto)}%"
        query = query.filter(
            or_(
                func.coalesce(Laudo.titulo, "").ilike(termo),
                func.coalesce(Laudo.tipo, "").ilike(termo),
                func.coalesce(Laudo.status, "").ilike(termo),
                func.coalesce(Laudo.medico_solicitante, "").ilike(termo),
                func.coalesce(Paciente.nome, "").ilike(termo),
                func.coalesce(Tutor.nome, "").ilike(termo),
                func.coalesce(Clinica.nome, "").ilike(termo),
                func.coalesce(PortalPartnerProfile.nome_exibicao, "").ilike(termo),
                func.coalesce(Paciente.nome_key, "").ilike(termo_key),
                func.coalesce(Tutor.nome_key, "").ilike(termo_key),
            )
        )
    
    total = query.count()
    # Ordena por recência real para evitar "sumiço" em bases com sequência de ID legada/desalinhada.
    rows = query.order_by(
        Laudo.created_at.desc(),
        Laudo.data_laudo.desc(),
        Laudo.id.desc(),
    ).offset(skip).limit(limit).all()
    laudos_rows = [laudo for laudo, *_rest in rows]
    exame_id_by_laudo_id = _load_exam_id_by_laudo_id_map(
        db,
        [laudo.id for laudo in laudos_rows],
    )
    
    resultado = []
    for laudo, paciente_nome, tutor_nome, clinica_nome, veterinario_parceiro_nome in rows:
        resultado.append({
            "id": laudo.id,
            "paciente_id": laudo.paciente_id,
            "agendamento_id": laudo.agendamento_id,
            "paciente_nome": paciente_nome or "Desconhecido",
            "paciente_tutor": tutor_nome or "",
            "clinica": clinica_nome or "",
            "clinic_id": laudo.clinic_id,
            "veterinario_parceiro_id": laudo.veterinario_parceiro_id,
            "veterinario_parceiro_nome": veterinario_parceiro_nome or "",
            "tipo": laudo.tipo,
            "titulo": laudo.titulo,
            "status": laudo.status,
            "data_exame": _iso_or_str(laudo.data_exame),
            "data_laudo": _iso_or_str(laudo.data_laudo),
            "created_at": _iso_or_str(laudo.created_at),
            "tem_pdf_externo": bool(_extrair_pdf_externo_laudo(laudo.anexos)),
            **_serialize_portal_release_state(
                db,
                laudo=laudo,
                exame_id_by_laudo_id=exame_id_by_laudo_id,
            ),
        })
    
    return {"total": total, "items": resultado}


@router.post("/laudos/eletrocardiograma/upload-pdf", status_code=status.HTTP_201_CREATED)
async def criar_laudo_eletrocardiograma_por_pdf(
    arquivo: UploadFile = File(...),
    agendamento_id: Optional[int] = Form(None),
    atendimento_id: Optional[int] = Form(None),
    paciente_id: Optional[int] = Form(None),
    clinic_id: Optional[int] = Form(None),
    veterinario_parceiro_id: Optional[int] = Form(None),
    data_exame: Optional[str] = Form(None),
    observacoes: str = Form(""),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Cria um laudo de eletrocardiograma a partir de um PDF externo."""
    from app.models.agendamento import Agendamento
    from app.models.paciente import Paciente

    agendamento_id = _to_optional_int(agendamento_id)
    atendimento_id = _to_optional_int(atendimento_id)
    paciente_id = _to_optional_int(paciente_id)
    clinic_id = _to_optional_int(clinic_id)
    veterinario_parceiro_id, veterinario_parceiro = _load_veterinario_parceiro_or_422(
        db,
        veterinario_parceiro_id,
    )

    atendimento = None
    if atendimento_id:
        atendimento = db.query(AtendimentoClinico).filter(AtendimentoClinico.id == atendimento_id).first()
        if not atendimento:
            raise HTTPException(status_code=404, detail="Atendimento nao encontrado.")
        paciente_id = paciente_id or atendimento.paciente_id
        clinic_id = clinic_id or atendimento.clinica_id
        agendamento_id = agendamento_id or atendimento.agendamento_id

    agendamento = None
    if agendamento_id:
        agendamento = db.query(Agendamento).filter(Agendamento.id == agendamento_id).first()
        if not agendamento:
            raise HTTPException(status_code=404, detail="Agendamento nao encontrado.")
        paciente_id = paciente_id or agendamento.paciente_id
        clinic_id = clinic_id or agendamento.clinica_id

    if not atendimento and agendamento_id and paciente_id:
        atendimento = (
            db.query(AtendimentoClinico)
            .filter(
                AtendimentoClinico.agendamento_id == agendamento_id,
                AtendimentoClinico.paciente_id == paciente_id,
            )
            .order_by(AtendimentoClinico.id.desc())
            .first()
        )
        if atendimento:
            atendimento_id = atendimento.id
            clinic_id = clinic_id or atendimento.clinica_id

    if not paciente_id:
        raise HTTPException(status_code=422, detail="Informe o paciente antes de enviar o eletrocardiograma.")
    if not clinic_id and not veterinario_parceiro_id:
        raise HTTPException(
            status_code=422,
            detail="Selecione a clinica parceira ou o veterinario parceiro antes de salvar o laudo.",
        )

    paciente = db.query(Paciente).filter(Paciente.id == paciente_id).first()
    if not paciente:
        raise HTTPException(status_code=404, detail="Paciente nao encontrado.")

    content = await arquivo.read()
    if not content:
        raise HTTPException(status_code=400, detail="Arquivo vazio.")

    data_exame_final = (
        _parse_data_exame(data_exame)
        or (atendimento.data_atendimento if atendimento else None)
        or (agendamento.inicio if agendamento else None)
        or datetime.utcnow()
    )
    atendimento_id_storage = atendimento_id or 0
    storage_path = None

    try:
        storage_path, normalized_name, normalized_mime_type = store_atendimento_attachment_file(
            atendimento_id_storage,
            arquivo.filename,
            content,
            arquivo.content_type,
        )
    except AttachmentTooLargeError as exc:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail=str(exc)) from exc
    except AttachmentTypeError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    arquivo_hash = calculate_attachment_sha256(content)
    try:
        laudo = Laudo(
            paciente_id=paciente_id,
            agendamento_id=agendamento_id,
            veterinario_id=current_user.id,
            tipo=TIPO_LAUDO_ELETROCARDIOGRAMA,
            titulo=f"Laudo de Eletrocardiograma - {paciente.nome or 'Paciente'}",
            descricao="PDF de eletrocardiograma anexado ao laudo.",
            diagnostico="",
            observacoes=(observacoes or "").strip(),
            status="Finalizado",
            clinic_id=clinic_id,
            veterinario_parceiro_id=veterinario_parceiro_id,
            data_exame=data_exame_final,
            medico_solicitante=veterinario_parceiro.nome_exibicao if veterinario_parceiro else None,
            criado_por_id=current_user.id,
            criado_por_nome=current_user.nome,
        )
        db.add(laudo)
        db.flush()

        anexo = AnexoAtendimento(
            atendimento_id=atendimento_id_storage,
            exame_id=None,
            tipo="documento",
            descricao=ELETROCARDIOGRAMA_UPLOAD_ATTACHMENT_DESCRIPTION,
            url="",
            nome_original=normalized_name,
            tamanho=len(content),
            mime_type=normalized_mime_type,
            arquivo_hash=arquivo_hash,
            dedupe_key=f"laudo:{laudo.id}|sha256:{arquivo_hash}",
            caminho_arquivo=storage_path,
            origem=ELETROCARDIOGRAMA_UPLOAD_ORIGIN,
        )
        db.add(anexo)
        db.flush()
        anexo.url = f"/api/v1/atendimentos/anexos/{anexo.id}/arquivo"
        laudo.anexos = _serializar_pdf_externo_laudo(
            laudo.anexos,
            {
                "anexo_id": anexo.id,
                "nome_original": normalized_name,
                "mime_type": normalized_mime_type,
                "tamanho": len(content),
                "arquivo_hash": arquivo_hash,
            },
        )

        db.commit()
        db.refresh(laudo)
        db.refresh(anexo)
    except Exception:
        db.rollback()
        remove_atendimento_attachment_file(storage_path)
        raise

    return {
        "id": laudo.id,
        "tipo": laudo.tipo,
        "titulo": laudo.titulo,
        "status": laudo.status,
        "paciente_id": laudo.paciente_id,
        "clinic_id": laudo.clinic_id,
        "veterinario_parceiro_id": laudo.veterinario_parceiro_id,
        "veterinario_parceiro_nome": veterinario_parceiro.nome_exibicao if veterinario_parceiro else None,
        "agendamento_id": laudo.agendamento_id,
        "anexo_id": anexo.id,
        "message": "Laudo de eletrocardiograma criado com PDF anexado.",
    }


@router.put("/laudos/{laudo_id}/eletrocardiograma/pdf")
async def substituir_pdf_eletrocardiograma(
    laudo_id: int,
    request: Request,
    arquivo: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    laudo = db.query(Laudo).filter(Laudo.id == laudo_id).first()
    if not laudo:
        raise HTTPException(status_code=404, detail="Laudo nao encontrado.")

    if (laudo.tipo or "").strip().lower() != TIPO_LAUDO_ELETROCARDIOGRAMA:
        raise HTTPException(
            status_code=422,
            detail="A troca de PDF esta disponivel apenas para laudos de eletrocardiograma.",
        )

    content = await arquivo.read()
    if not content:
        raise HTTPException(status_code=400, detail="Arquivo vazio.")

    anexo_existente = _buscar_anexo_pdf_externo_laudo(db, laudo, require_existing_file=False)
    exame_portal = (
        db.query(Exame)
        .filter(Exame.laudo_id == laudo.id)
        .order_by(Exame.id.desc())
        .first()
    )

    released_to_portal = (
        laudo.status == PORTAL_RELEASED_STATUS
        or (anexo_existente and anexo_existente.origem == PORTAL_LAUDO_ATTACHMENT_ORIGIN)
        or exame_portal is not None
    )
    if released_to_portal and not exame_portal:
        exame_portal = _sincronizar_exame_liberado_para_portal(
            db,
            laudo,
            current_user,
            datetime.utcnow(),
        )
        db.flush()

    atendimento_id_storage = _resolver_atendimento_id_para_anexo_laudo(
        db,
        laudo=laudo,
        anexo=anexo_existente,
        exame=exame_portal,
    )

    try:
        storage_path, normalized_name, normalized_mime_type = store_atendimento_attachment_file(
            atendimento_id_storage,
            arquivo.filename,
            content,
            arquivo.content_type,
        )
    except AttachmentTooLargeError as exc:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail=str(exc)) from exc
    except AttachmentTypeError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    arquivo_hash = calculate_attachment_sha256(content)
    old_path = anexo_existente.caminho_arquivo if anexo_existente else None
    old_nome = anexo_existente.nome_original if anexo_existente else None
    old_hash = anexo_existente.arquivo_hash if anexo_existente else None

    try:
        anexo = anexo_existente or AnexoAtendimento(
            atendimento_id=atendimento_id_storage,
            exame_id=exame_portal.id if exame_portal else None,
            tipo="documento",
            descricao=ELETROCARDIOGRAMA_UPLOAD_ATTACHMENT_DESCRIPTION,
            url="",
            origem=ELETROCARDIOGRAMA_UPLOAD_ORIGIN,
        )
        if anexo_existente is None:
            db.add(anexo)
            db.flush()

        anexo.atendimento_id = atendimento_id_storage
        anexo.exame_id = exame_portal.id if exame_portal else None
        anexo.tipo = "documento"
        anexo.descricao = ELETROCARDIOGRAMA_UPLOAD_ATTACHMENT_DESCRIPTION
        anexo.nome_original = normalized_name
        anexo.tamanho = len(content)
        anexo.mime_type = normalized_mime_type
        anexo.arquivo_hash = arquivo_hash
        anexo.caminho_arquivo = storage_path

        if exame_portal is not None:
            anexo.origem = PORTAL_LAUDO_ATTACHMENT_ORIGIN
            anexo.dedupe_key = build_upload_dedupe_key(exame_portal.id, arquivo_hash)
            anexo.url = f"/api/v1/portal/anexos/{anexo.id}/arquivo"
        else:
            anexo.origem = ELETROCARDIOGRAMA_UPLOAD_ORIGIN
            anexo.dedupe_key = f"laudo:{laudo.id}|sha256:{arquivo_hash}"
            anexo.url = f"/api/v1/atendimentos/anexos/{anexo.id}/arquivo"

        laudo.anexos = _serializar_pdf_externo_laudo(
            laudo.anexos,
            {
                "anexo_id": anexo.id,
                "nome_original": normalized_name,
                "mime_type": normalized_mime_type,
                "tamanho": len(content),
                "arquivo_hash": arquivo_hash,
            },
        )
        laudo.updated_at = datetime.utcnow()

        db.commit()
        db.refresh(laudo)
        db.refresh(anexo)
        if exame_portal is not None:
            db.refresh(exame_portal)
    except Exception:
        db.rollback()
        remove_atendimento_attachment_file(storage_path)
        raise

    if old_path and old_path != storage_path:
        remove_atendimento_attachment_file(old_path)

    registrar_auditoria(
        current_user=current_user,
        modulo="laudos",
        entidade="laudo",
        acao="LAUDO_ELETROCARDIOGRAMA_PDF_SUBSTITUIDO",
        descricao="PDF do eletrocardiograma substituido no laudo.",
        entidade_id=laudo.id,
        detalhes={
            "laudo_id": laudo.id,
            "anexo_id": anexo.id,
            "exame_id": exame_portal.id if exame_portal else None,
            "paciente_id": laudo.paciente_id,
            "clinic_id": laudo.clinic_id,
            "status": laudo.status,
            "liberado_no_portal": exame_portal is not None,
            "pdf_nome_anterior": old_nome,
            "pdf_hash_anterior": old_hash,
            "pdf_nome_novo": anexo.nome_original,
            "pdf_hash_novo": anexo.arquivo_hash,
            "pdf_tamanho_novo": anexo.tamanho,
        },
        request=request,
    )

    return {
        "message": "PDF do eletrocardiograma atualizado com sucesso.",
        "laudo_id": laudo.id,
        "anexo_id": anexo.id,
        "exame_id": exame_portal.id if exame_portal else None,
        "status": laudo.status,
        "pdf_nome": anexo.nome_original,
        "pdf_tamanho": anexo.tamanho,
        "liberado_no_portal": exame_portal is not None,
    }


@router.post("/laudos", status_code=status.HTTP_201_CREATED)
def criar_laudo(
    laudo_data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Cria novo laudo"""
    import traceback
    try:
        # Verificar se é um laudo de ecocardiograma (com estrutura complexa)
        if "paciente" in laudo_data and isinstance(laudo_data["paciente"], dict):
            tipo_laudo = (laudo_data.get("tipo_laudo") or laudo_data.get("tipo") or "").strip().lower()
            if tipo_laudo == "pressao_arterial":
                return criar_laudo_pressao_arterial(laudo_data, db, current_user)
            if tipo_laudo == "ultrassonografia_abdominal":
                return criar_laudo_ultrassonografia_abdominal(laudo_data, db, current_user)
            return criar_laudo_ecocardiograma(laudo_data, db, current_user)
        
        # Laudo padrão
        laudo = Laudo(
            paciente_id=laudo_data.get("paciente_id"),
            agendamento_id=laudo_data.get("agendamento_id"),
            veterinario_id=current_user.id,
            tipo=laudo_data.get("tipo", "exame"),
            titulo=laudo_data.get("titulo"),
            descricao=laudo_data.get("descricao"),
            diagnostico=laudo_data.get("diagnostico"),
            observacoes=laudo_data.get("observacoes"),
            anexos=laudo_data.get("anexos"),
            status=laudo_data.get("status", "Rascunho"),
            criado_por_id=current_user.id,
            criado_por_nome=current_user.nome
        )
        
        db.add(laudo)
        db.commit()
        db.refresh(laudo)
        
        return laudo
    except HTTPException:
        raise
    except Exception as e:
        print(f"ERRO AO CRIAR LAUDO: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Erro interno: {str(e)}")


def criar_laudo_ecocardiograma(laudo_data: dict, db: Session, current_user: User):
    """Cria um laudo de ecocardiograma com a estrutura especifica."""
    import traceback

    try:
        paciente = laudo_data.get("paciente", {}) or {}
        medidas = laudo_data.get("medidas", {}) or {}
        qualitativa = laudo_data.get("qualitativa", {}) or {}
        conteudo = laudo_data.get("conteudo", {}) or {}
        clinica = laudo_data.get("clinica", {})
        veterinario = laudo_data.get("veterinario", {})

        paciente_id = _resolver_ou_criar_paciente(paciente, db)
        pressao_arterial = _normalizar_pressao_arterial(laudo_data.get("pressao_arterial"))
        ecocardiograma_cabecalho = _normalizar_ecocardiograma_cabecalho(
            laudo_data.get("ecocardiograma_cabecalho")
        )
        ecocardiograma_estruturado = _normalizar_ecocardiograma_estruturado(
            laudo_data.get("ecocardiograma_estruturado")
        )
        if ecocardiograma_estruturado and ecocardiograma_estruturado.get("usar_no_laudo"):
            legado = _derivar_legado_de_ecocardiograma_estruturado(ecocardiograma_estruturado)
            qualitativa = legado["qualitativa"]
            conteudo = dict(conteudo)
            if legado["conclusao"]:
                conteudo["conclusao"] = legado["conclusao"]

        descricao = _montar_descricao_ecocardiograma(medidas, qualitativa)

        diagnostico = conteudo.get("conclusao", "")
        observacoes = conteudo.get("observacoes", "")
        clinic_id = _extrair_clinic_id(clinica)
        veterinario_parceiro_id, veterinario_parceiro = _load_veterinario_parceiro_or_422(
            db,
            laudo_data.get("veterinario_parceiro_id"),
        )
        data_exame = _parse_data_exame(paciente.get("data_exame") or paciente.get("data"))
        anexos_json = _serializar_anexos(
            laudo_data.get("anexos"),
            pressao_arterial=pressao_arterial,
            ecocardiograma_cabecalho=ecocardiograma_cabecalho,
            ecocardiograma_estruturado=ecocardiograma_estruturado,
        )

        agendamento_id = laudo_data.get("agendamento_id")
        if agendamento_id in ("", 0):
            agendamento_id = None
        if agendamento_id is not None:
            try:
                agendamento_id = int(agendamento_id)
            except Exception:
                agendamento_id = None

        laudo = Laudo(
            paciente_id=paciente_id,
            agendamento_id=agendamento_id,
            veterinario_id=current_user.id,
            tipo="ecocardiograma",
            titulo=f"Laudo de Ecocardiograma - {paciente.get('nome', 'Paciente')}",
            descricao=descricao,
            diagnostico=diagnostico,
            observacoes=observacoes,
            anexos=anexos_json,
            status=laudo_data.get("status", "Finalizado"),
            clinic_id=clinic_id,
            veterinario_parceiro_id=veterinario_parceiro_id,
            data_exame=data_exame,
            medico_solicitante=(
                (veterinario.get("nome") if isinstance(veterinario, dict) else None)
                or (veterinario_parceiro.nome_exibicao if veterinario_parceiro else None)
            ),
            criado_por_id=current_user.id,
            criado_por_nome=current_user.nome,
        )

        db.add(laudo)
        db.commit()
        db.refresh(laudo)

        return {
            "id": laudo.id,
            "agendamento_id": laudo.agendamento_id,
            "mensagem": "Laudo de ecocardiograma salvo com sucesso",
            "paciente": paciente.get("nome") if isinstance(paciente, dict) else None,
            "tipo": "ecocardiograma",
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"ERRO AO CRIAR LAUDO ECO: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Erro ao criar laudo: {str(e)}")


def criar_laudo_pressao_arterial(laudo_data: dict, db: Session, current_user: User):
    """Cria laudo de pressao arterial."""
    import traceback

    try:
        paciente = laudo_data.get("paciente", {}) or {}
        conteudo = laudo_data.get("conteudo", {}) or {}
        clinica = laudo_data.get("clinica", {})
        veterinario = laudo_data.get("veterinario", {})

        paciente_id = _resolver_ou_criar_paciente(paciente, db)
        pressao_arterial = _normalizar_pressao_arterial(laudo_data.get("pressao_arterial"))
        if not pressao_arterial:
            raise HTTPException(
                status_code=422,
                detail="Informe pelo menos uma afericao de pressao para salvar o laudo de pressao arterial.",
            )

        pas_1 = pressao_arterial.get("pas_1") or 0
        pas_2 = pressao_arterial.get("pas_2") or 0
        pas_3 = pressao_arterial.get("pas_3") or 0
        pas_media = pressao_arterial.get("pas_media")
        classificacao = _classificar_pressao_media(pas_media)

        descricao_linhas = [
            "## Afericao de Pressao Arterial",
            f"- 1a afericao (PAS): {pas_1} mmHg",
            f"- 2a afericao (PAS): {pas_2} mmHg",
            f"- 3a afericao (PAS): {pas_3} mmHg",
            f"- PAS media: {pas_media or 0} mmHg",
            f"- Metodo: {pressao_arterial.get('metodo') or 'Doppler'}",
            f"- Manguito: {pressao_arterial.get('manguito') or '-'}",
            f"- Membro: {pressao_arterial.get('membro') or '-'}",
            f"- Decubito: {pressao_arterial.get('decubito') or '-'}",
        ]
        if pressao_arterial.get("obs_extra"):
            descricao_linhas.append(f"- Observacoes adicionais: {pressao_arterial.get('obs_extra')}")
        descricao = "\n".join(descricao_linhas)

        observacoes_extra = (conteudo.get("observacoes") or "").strip()
        obs_pressao = (pressao_arterial.get("obs_extra") or "").strip()
        observacoes = observacoes_extra
        if obs_pressao and obs_pressao not in observacoes:
            observacoes = f"{observacoes}\n{obs_pressao}".strip()

        clinic_id = _extrair_clinic_id(clinica)
        veterinario_parceiro_id, veterinario_parceiro = _load_veterinario_parceiro_or_422(
            db,
            laudo_data.get("veterinario_parceiro_id"),
        )
        data_exame = _parse_data_exame(paciente.get("data_exame") or paciente.get("data"))
        anexos_json = _serializar_anexos(laudo_data.get("anexos"), pressao_arterial)

        agendamento_id = laudo_data.get("agendamento_id")
        if agendamento_id in ("", 0):
            agendamento_id = None
        if agendamento_id is not None:
            try:
                agendamento_id = int(agendamento_id)
            except Exception:
                agendamento_id = None

        laudo = Laudo(
            paciente_id=paciente_id,
            agendamento_id=agendamento_id,
            veterinario_id=current_user.id,
            tipo="pressao_arterial",
            titulo=f"Laudo de Pressao Arterial - {paciente.get('nome', 'Paciente')}",
            descricao=descricao,
            diagnostico=classificacao,
            observacoes=observacoes,
            anexos=anexos_json,
            status=laudo_data.get("status", "Finalizado"),
            clinic_id=clinic_id,
            veterinario_parceiro_id=veterinario_parceiro_id,
            data_exame=data_exame,
            medico_solicitante=(
                (veterinario.get("nome") if isinstance(veterinario, dict) else None)
                or (veterinario_parceiro.nome_exibicao if veterinario_parceiro else None)
            ),
            criado_por_id=current_user.id,
            criado_por_nome=current_user.nome,
        )

        db.add(laudo)
        db.commit()
        db.refresh(laudo)

        return {
            "id": laudo.id,
            "agendamento_id": laudo.agendamento_id,
            "mensagem": "Laudo de pressao arterial salvo com sucesso",
            "paciente": paciente.get("nome") if isinstance(paciente, dict) else None,
            "tipo": "pressao_arterial",
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"ERRO AO CRIAR LAUDO PRESSAO: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Erro ao criar laudo: {str(e)}")


def criar_laudo_ultrassonografia_abdominal(laudo_data: dict, db: Session, current_user: User):
    """Cria laudo de ultrassonografia abdominal."""
    import traceback

    try:
        paciente = laudo_data.get("paciente", {}) or {}
        qualitativa = laudo_data.get("qualitativa", {}) or {}
        conteudo = laudo_data.get("conteudo", {}) or {}
        clinica = laudo_data.get("clinica", {})
        veterinario = laudo_data.get("veterinario", {})

        paciente_id = _resolver_ou_criar_paciente(paciente, db)

        ultrassom_raw = laudo_data.get("ultrassonografia_abdominal")
        if not isinstance(ultrassom_raw, dict):
            ultrassom_raw = {
                "qualitativa": qualitativa,
                "observacoes_gerais": conteudo.get("observacoes"),
                "sexo_paciente": paciente.get("sexo"),
            }
        else:
            ultrassom_raw = {
                **ultrassom_raw,
                "qualitativa": ultrassom_raw.get("qualitativa") or qualitativa,
                "observacoes_gerais": ultrassom_raw.get("observacoes_gerais")
                or ultrassom_raw.get("observacoes")
                or conteudo.get("observacoes"),
                "sexo_paciente": ultrassom_raw.get("sexo_paciente")
                or ultrassom_raw.get("sexo")
                or paciente.get("sexo"),
            }

        ultrassonografia_abdominal = _normalizar_ultrassonografia_abdominal(ultrassom_raw) or {
            "versao": 1,
            "sexo_paciente": _normalizar_sexo_paciente(paciente.get("sexo")),
            "qualitativa": {},
            "observacoes_gerais": str(conteudo.get("observacoes") or "").strip(),
        }

        descricao = _montar_descricao_ultrassonografia_abdominal(ultrassonografia_abdominal)
        diagnostico = str(conteudo.get("conclusao") or "").strip()
        observacoes = str(
            ultrassonografia_abdominal.get("observacoes_gerais")
            or conteudo.get("observacoes")
            or ""
        ).strip()
        clinic_id = _extrair_clinic_id(clinica)
        veterinario_parceiro_id, veterinario_parceiro = _load_veterinario_parceiro_or_422(
            db,
            laudo_data.get("veterinario_parceiro_id"),
        )
        data_exame = _parse_data_exame(
            paciente.get("data_exame") or paciente.get("data") or laudo_data.get("data_exame")
        )
        anexos_json = _serializar_anexos(
            laudo_data.get("anexos"),
            ultrassonografia_abdominal=ultrassonografia_abdominal,
        )

        agendamento_id = laudo_data.get("agendamento_id")
        if agendamento_id in ("", 0):
            agendamento_id = None
        if agendamento_id is not None:
            try:
                agendamento_id = int(agendamento_id)
            except Exception:
                agendamento_id = None

        laudo = Laudo(
            paciente_id=paciente_id,
            agendamento_id=agendamento_id,
            veterinario_id=current_user.id,
            tipo="ultrassonografia_abdominal",
            titulo=f"Laudo de Ultrassonografia Abdominal - {paciente.get('nome', 'Paciente')}",
            descricao=descricao,
            diagnostico=diagnostico,
            observacoes=observacoes,
            anexos=anexos_json,
            status=laudo_data.get("status", "Finalizado"),
            clinic_id=clinic_id,
            veterinario_parceiro_id=veterinario_parceiro_id,
            data_exame=data_exame,
            medico_solicitante=(
                (veterinario.get("nome") if isinstance(veterinario, dict) else None)
                or (veterinario_parceiro.nome_exibicao if veterinario_parceiro else None)
            ),
            criado_por_id=current_user.id,
            criado_por_nome=current_user.nome,
        )

        db.add(laudo)
        db.commit()
        db.refresh(laudo)

        return {
            "id": laudo.id,
            "agendamento_id": laudo.agendamento_id,
            "mensagem": "Laudo de ultrassonografia abdominal salvo com sucesso",
            "paciente": paciente.get("nome") if isinstance(paciente, dict) else None,
            "tipo": "ultrassonografia_abdominal",
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"ERRO AO CRIAR LAUDO ULTRASSOM: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Erro ao criar laudo: {str(e)}")


def atualizar_laudo_ultrassonografia_abdominal(
    laudo: Laudo,
    laudo_data: dict,
    db: Session,
    current_user: User,
):
    """Atualiza laudo estruturado de ultrassonografia abdominal."""
    paciente = laudo_data.get("paciente", {}) or {}
    qualitativa = laudo_data.get("qualitativa", {}) or {}
    conteudo = laudo_data.get("conteudo", {}) or {}
    clinica = laudo_data.get("clinica", {})
    veterinario = laudo_data.get("veterinario", {})

    if paciente:
        laudo.paciente_id = _resolver_ou_criar_paciente(paciente, db)

    ultrassom_raw = laudo_data.get("ultrassonografia_abdominal")
    if not isinstance(ultrassom_raw, dict):
        ultrassom_raw = {
            "qualitativa": qualitativa,
            "observacoes_gerais": conteudo.get("observacoes"),
            "sexo_paciente": paciente.get("sexo"),
        }
    else:
        ultrassom_raw = {
            **ultrassom_raw,
            "qualitativa": ultrassom_raw.get("qualitativa") or qualitativa,
            "observacoes_gerais": ultrassom_raw.get("observacoes_gerais")
            or ultrassom_raw.get("observacoes")
            or conteudo.get("observacoes"),
            "sexo_paciente": ultrassom_raw.get("sexo_paciente")
            or ultrassom_raw.get("sexo")
            or paciente.get("sexo"),
        }

    ultrassonografia_abdominal = _normalizar_ultrassonografia_abdominal(ultrassom_raw) or {
        "versao": 1,
        "sexo_paciente": _normalizar_sexo_paciente(paciente.get("sexo")),
        "qualitativa": {},
        "observacoes_gerais": str(conteudo.get("observacoes") or "").strip(),
    }

    agendamento_id = laudo_data.get("agendamento_id", laudo.agendamento_id)
    if agendamento_id in ("", 0):
        agendamento_id = None
    if agendamento_id is not None:
        try:
            agendamento_id = int(agendamento_id)
        except Exception:
            agendamento_id = None

    clinic_id = _extrair_clinic_id(clinica)
    if clinic_id is None and "clinic_id" in laudo_data:
        clinic_id = laudo_data.get("clinic_id")
        if clinic_id not in ("", None):
            try:
                clinic_id = int(clinic_id)
            except (TypeError, ValueError):
                raise HTTPException(status_code=422, detail="clinic_id invalido.")
        else:
            clinic_id = None
    veterinario_parceiro_id = laudo.veterinario_parceiro_id
    veterinario_parceiro = None
    if "veterinario_parceiro_id" in laudo_data:
        veterinario_parceiro_id, veterinario_parceiro = _load_veterinario_parceiro_or_422(
            db,
            laudo_data.get("veterinario_parceiro_id"),
        )

    data_exame = _parse_data_exame(
        paciente.get("data_exame") or paciente.get("data") or laudo_data.get("data_exame")
    )

    laudo.agendamento_id = agendamento_id
    laudo.tipo = "ultrassonografia_abdominal"
    laudo.titulo = laudo_data.get("titulo") or f"Laudo de Ultrassonografia Abdominal - {paciente.get('nome', 'Paciente')}"
    laudo.descricao = _montar_descricao_ultrassonografia_abdominal(ultrassonografia_abdominal)
    laudo.diagnostico = str(conteudo.get("conclusao") or laudo_data.get("diagnostico") or "").strip()
    laudo.observacoes = str(
        ultrassonografia_abdominal.get("observacoes_gerais")
        or conteudo.get("observacoes")
        or laudo_data.get("observacoes")
        or ""
    ).strip()
    laudo.status = laudo_data.get("status", laudo.status)
    if clinic_id is not None or "clinic_id" in laudo_data or isinstance(clinica, dict):
        laudo.clinic_id = clinic_id
    if "veterinario_parceiro_id" in laudo_data:
        laudo.veterinario_parceiro_id = veterinario_parceiro_id
    if data_exame is not None or "data_exame" in laudo_data or paciente.get("data_exame"):
        laudo.data_exame = data_exame
    if isinstance(veterinario, dict) and veterinario.get("nome"):
        laudo.medico_solicitante = veterinario.get("nome")
    elif veterinario_parceiro is not None:
        laudo.medico_solicitante = veterinario_parceiro.nome_exibicao
    elif "medico_solicitante" in laudo_data:
        laudo.medico_solicitante = laudo_data.get("medico_solicitante")

    laudo.anexos = _serializar_anexos(
        laudo.anexos,
        ultrassonografia_abdominal=ultrassonografia_abdominal,
    )
    laudo.updated_at = datetime.now()
    _, anexo_portal, old_portal_path, new_portal_path = _sincronizar_publicacao_laudo_no_portal(
        db,
        laudo=laudo,
        current_user=current_user,
    )

    try:
        db.commit()
        db.refresh(laudo)
        if anexo_portal is not None:
            db.refresh(anexo_portal)
    except Exception:
        db.rollback()
        remove_atendimento_attachment_file(new_portal_path)
        raise

    if old_portal_path and old_portal_path != new_portal_path:
        remove_atendimento_attachment_file(old_portal_path)

    return {
        "id": laudo.id,
        "agendamento_id": laudo.agendamento_id,
        "mensagem": "Laudo de ultrassonografia abdominal atualizado com sucesso",
        "paciente_id": laudo.paciente_id,
        "tipo": laudo.tipo,
    }


@router.get("/laudos/{laudo_id}")
def obter_laudo(
    laudo_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Obtém um laudo específico com dados completos do paciente e clínica"""
    from app.models.paciente import Paciente
    from app.models.tutor import Tutor
    from app.models.clinica import Clinica
    
    laudo = db.query(Laudo).filter(Laudo.id == laudo_id).first()
    if not laudo:
        raise HTTPException(status_code=404, detail="Laudo não encontrado")
    
    # Buscar dados do paciente
    paciente = db.query(Paciente).filter(Paciente.id == laudo.paciente_id).first()
    
    # Buscar dados do tutor se existir
    tutor_nome = None
    tutor_telefone = None
    if paciente and paciente.tutor_id:
        tutor = db.query(Tutor).filter(Tutor.id == paciente.tutor_id).first()
        if tutor:
            tutor_nome = tutor.nome
            tutor_telefone = tutor.telefone
    
    idade = extrair_idade_paciente(
        paciente.nascimento if paciente else None,
        paciente.observacoes if paciente else None,
    )
    
    # Buscar nome da clínica
    clinica_nome = None
    if laudo.clinic_id:
        clinica = db.query(Clinica).filter(Clinica.id == laudo.clinic_id).first()
        if clinica:
            clinica_nome = clinica.nome
    veterinario_parceiro = None
    if laudo.veterinario_parceiro_id:
        veterinario_parceiro = (
            db.query(PortalPartnerProfile)
            .filter(PortalPartnerProfile.id == laudo.veterinario_parceiro_id)
            .first()
        )
    
    # Buscar imagens do laudo
    from app.models.imagem_laudo import ImagemLaudo
    imagens = db.query(ImagemLaudo).filter(
        ImagemLaudo.laudo_id == laudo_id,
        ImagemLaudo.ativo == 1
    ).order_by(ImagemLaudo.ordem).all()
    
    imagens_list = []
    for img in imagens:
        imagens_list.append({
            "id": img.id,
            "nome": img.nome_arquivo,
            "ordem": img.ordem,
            "descricao": img.descricao,
            "url": f"/imagens/{img.id}",
            "tamanho": img.tamanho_bytes
        })

    pressao_arterial = _extrair_pressao_arterial_de_anexos(laudo.anexos)
    ultrassonografia_abdominal = _extrair_ultrassonografia_abdominal_de_anexos(laudo.anexos)
    ecocardiograma_cabecalho = _extrair_ecocardiograma_cabecalho_de_anexos(laudo.anexos)
    ecocardiograma_estruturado = _extrair_ecocardiograma_estruturado_de_anexos(laudo.anexos)
    medidas_ecocardiograma = extrair_medidas_ecocardiograma_da_descricao(
        laudo.descricao
    )
    if not ultrassonografia_abdominal and (laudo.tipo or "").lower() == "ultrassonografia_abdominal":
        ultrassonografia_abdominal = _extrair_ultrassonografia_abdominal_do_descricao(laudo.descricao)
    if ultrassonografia_abdominal and not ultrassonografia_abdominal.get("sexo_paciente") and paciente:
        ultrassonografia_abdominal["sexo_paciente"] = _normalizar_sexo_paciente(paciente.sexo)
    
    return {
        "id": laudo.id,
        "paciente_id": laudo.paciente_id,
        "paciente": {
            "id": paciente.id if paciente else None,
            "nome": paciente.nome if paciente else "Desconhecido",
            "tutor": tutor_nome or "",
            "telefone": tutor_telefone or "",
            "especie": paciente.especie if paciente else "",
            "raca": paciente.raca if paciente else "",
            "sexo": normalizar_sexo_paciente(paciente.sexo if paciente else ""),
            "peso_kg": paciente.peso_kg if paciente else None,
            "idade": idade,
        },
        "clinica": clinica_nome or "",
        "clinic_id": laudo.clinic_id,
        "veterinario_parceiro_id": laudo.veterinario_parceiro_id,
        "veterinario_parceiro_nome": getattr(veterinario_parceiro, "nome_exibicao", None),
        "veterinario_parceiro_crmv": getattr(veterinario_parceiro, "crmv", None),
        "medico_solicitante": laudo.medico_solicitante,
        "data_exame": laudo.data_exame.isoformat() if laudo.data_exame else None,
        "tipo": laudo.tipo,
        "titulo": laudo.titulo,
        "descricao": laudo.descricao,
        "medidas": medidas_ecocardiograma,
        "diagnostico": laudo.diagnostico,
        "observacoes": laudo.observacoes,
        "status": laudo.status,
        "created_at": laudo.created_at.isoformat() if laudo.created_at else None,
        "updated_at": laudo.updated_at.isoformat() if laudo.updated_at else None,
        "data_laudo": laudo.data_laudo.isoformat() if laudo.data_laudo else None,
        "pressao_arterial": pressao_arterial,
        "ultrassonografia_abdominal": ultrassonografia_abdominal,
        "ecocardiograma_cabecalho": ecocardiograma_cabecalho,
        "ecocardiograma_estruturado": ecocardiograma_estruturado,
        "pdf_externo": _extrair_pdf_externo_laudo(laudo.anexos),
        "imagens": imagens_list,
        **_serialize_portal_release_state(db, laudo=laudo),
    }


@router.get("/laudos/{laudo_id}/pdf-original")
def baixar_pdf_original_laudo(
    laudo_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ = current_user
    laudo = db.query(Laudo).filter(Laudo.id == laudo_id).first()
    if not laudo:
        raise HTTPException(status_code=404, detail="Laudo nao encontrado")

    anexo = _buscar_anexo_pdf_externo_laudo(db, laudo)
    if not anexo:
        raise HTTPException(status_code=404, detail="PDF original nao encontrado para este laudo.")

    return build_attachment_download_response(
        anexo,
        missing_detail="PDF original nao encontrado no armazenamento.",
    )


@router.put("/laudos/{laudo_id}")
def atualizar_laudo(
    laudo_id: int,
    laudo_data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Atualiza um laudo"""
    laudo = db.query(Laudo).filter(Laudo.id == laudo_id).first()
    if not laudo:
        raise HTTPException(status_code=404, detail="Laudo nao encontrado")

    tipo_estruturado = (laudo_data.get("tipo_laudo") or laudo_data.get("tipo") or laudo.tipo or "").strip().lower()
    if "paciente" in laudo_data and isinstance(laudo_data["paciente"], dict):
        if tipo_estruturado == "ultrassonografia_abdominal":
            return atualizar_laudo_ultrassonografia_abdominal(laudo, laudo_data, db, current_user)
        if tipo_estruturado == "ecocardiograma":
            paciente = laudo_data.get("paciente", {}) or {}
            medidas = laudo_data.get("medidas", {}) or {}
            qualitativa = laudo_data.get("qualitativa", {}) or {}
            conteudo = laudo_data.get("conteudo", {}) or {}
            veterinario = laudo_data.get("veterinario", {}) or {}
            ecocardiograma_estruturado = _normalizar_ecocardiograma_estruturado(
                laudo_data.get("ecocardiograma_estruturado")
            )
            if (
                ecocardiograma_estruturado
                and ecocardiograma_estruturado.get("usar_no_laudo")
            ):
                legado = _derivar_legado_de_ecocardiograma_estruturado(
                    ecocardiograma_estruturado
                )
                qualitativa = legado["qualitativa"]
                conteudo = dict(conteudo)
                if legado["conclusao"]:
                    conteudo["conclusao"] = legado["conclusao"]

            agendamento_id = laudo_data.get("agendamento_id")
            if agendamento_id in ("", 0):
                agendamento_id = None
            elif agendamento_id is not None:
                try:
                    agendamento_id = int(agendamento_id)
                except (TypeError, ValueError):
                    agendamento_id = None

            laudo_data = {
                "paciente_id": _resolver_ou_criar_paciente(paciente, db),
                "agendamento_id": agendamento_id,
                "tipo": "ecocardiograma",
                "titulo": f"Laudo de Ecocardiograma - {paciente.get('nome', 'Paciente')}",
                "descricao": _montar_descricao_ecocardiograma(medidas, qualitativa),
                "diagnostico": conteudo.get("conclusao", ""),
                "observacoes": conteudo.get("observacoes", ""),
                "status": laudo_data.get("status", laudo.status),
                "clinic_id": _extrair_clinic_id(laudo_data.get("clinica")),
                "data_exame": (
                    paciente.get("data_exame")
                    or paciente.get("data")
                    or laudo_data.get("data_exame")
                ),
                "medico_solicitante": (
                    veterinario.get("nome")
                    if isinstance(veterinario, dict)
                    else None
                ),
                "veterinario_parceiro_id": laudo_data.get("veterinario_parceiro_id"),
                "pressao_arterial": laudo_data.get("pressao_arterial"),
                "ecocardiograma_cabecalho": laudo_data.get(
                    "ecocardiograma_cabecalho"
                ),
                "ecocardiograma_estruturado": ecocardiograma_estruturado,
            }

    if "data_exame" in laudo_data:
        parsed = _parse_data_exame(laudo_data.get("data_exame"))
        if laudo_data.get("data_exame") not in (None, "", parsed):
            # Se o cliente enviou string invalida, bloqueia para evitar data corrompida.
            if isinstance(laudo_data.get("data_exame"), str) and parsed is None:
                raise HTTPException(
                    status_code=422,
                    detail="Formato invalido para data_exame. Use YYYY-MM-DD ou ISO datetime.",
                )
        laudo_data["data_exame"] = parsed

    if "clinic_id" in laudo_data:
        clinic_id = laudo_data.get("clinic_id")
        if clinic_id in ("", None):
            laudo_data["clinic_id"] = None
        else:
            try:
                laudo_data["clinic_id"] = int(clinic_id)
            except (TypeError, ValueError):
                raise HTTPException(status_code=422, detail="clinic_id invalido.")
    if "veterinario_parceiro_id" in laudo_data:
        veterinario_parceiro_id, veterinario_parceiro = _load_veterinario_parceiro_or_422(
            db,
            laudo_data.get("veterinario_parceiro_id"),
        )
        laudo_data["veterinario_parceiro_id"] = veterinario_parceiro_id
        if veterinario_parceiro is not None and not laudo_data.get("medico_solicitante"):
            laudo_data["medico_solicitante"] = veterinario_parceiro.nome_exibicao

    if "tipo_laudo" in laudo_data and "tipo" not in laudo_data:
        laudo_data["tipo"] = laudo_data.pop("tipo_laudo")

    if "pressao_arterial" in laudo_data:
        pressao_arterial = _normalizar_pressao_arterial(laudo_data.pop("pressao_arterial"))
        laudo.anexos = _serializar_anexos(laudo.anexos, pressao_arterial)

    if "ultrassonografia_abdominal" in laudo_data:
        ultrassonografia_abdominal = _normalizar_ultrassonografia_abdominal(
            laudo_data.pop("ultrassonografia_abdominal")
        )
        laudo.anexos = _serializar_anexos(
            laudo.anexos,
            ultrassonografia_abdominal=ultrassonografia_abdominal,
        )
        if ultrassonografia_abdominal:
            laudo_data.setdefault(
                "descricao",
                _montar_descricao_ultrassonografia_abdominal(ultrassonografia_abdominal),
            )
            laudo_data.setdefault(
                "observacoes",
                ultrassonografia_abdominal.get("observacoes_gerais") or "",
            )

    if "ecocardiograma_cabecalho" in laudo_data:
        ecocardiograma_cabecalho = _normalizar_ecocardiograma_cabecalho(
            laudo_data.pop("ecocardiograma_cabecalho")
        )
        laudo.anexos = _serializar_anexos(
            laudo.anexos,
            ecocardiograma_cabecalho=ecocardiograma_cabecalho,
        )

    if "ecocardiograma_estruturado" in laudo_data:
        ecocardiograma_estruturado = _normalizar_ecocardiograma_estruturado(
            laudo_data.pop("ecocardiograma_estruturado")
        )
        laudo.anexos = _serializar_anexos(
            laudo.anexos,
            ecocardiograma_estruturado=ecocardiograma_estruturado,
        )
        if (
            (laudo_data.get("tipo") or laudo.tipo or "").strip().lower() == "ecocardiograma"
            and ecocardiograma_estruturado
            and ecocardiograma_estruturado.get("usar_no_laudo")
        ):
            legado = _derivar_legado_de_ecocardiograma_estruturado(ecocardiograma_estruturado)
            laudo_data.setdefault(
                "descricao",
                _montar_descricao_ecocardiograma({}, legado["qualitativa"]),
            )
            if legado["conclusao"]:
                laudo_data.setdefault("diagnostico", legado["conclusao"])

    for field, value in laudo_data.items():
        if hasattr(laudo, field):
            setattr(laudo, field, value)

    laudo.updated_at = datetime.now()
    _, anexo_portal, old_portal_path, new_portal_path = _sincronizar_publicacao_laudo_no_portal(
        db,
        laudo=laudo,
        current_user=current_user,
    )

    try:
        db.commit()
        db.refresh(laudo)
        if anexo_portal is not None:
            db.refresh(anexo_portal)
    except Exception:
        db.rollback()
        remove_atendimento_attachment_file(new_portal_path)
        raise

    if old_portal_path and old_portal_path != new_portal_path:
        remove_atendimento_attachment_file(old_portal_path)
    return laudo


@router.delete("/laudos/{laudo_id}")
def deletar_laudo(
    laudo_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Remove um laudo e suas imagens associadas"""
    from app.models.imagem_laudo import ImagemLaudo

    laudo = db.query(Laudo).filter(Laudo.id == laudo_id).first()
    if not laudo:
        raise HTTPException(status_code=404, detail="Laudo não encontrado")

    # Exame.laudo_id nao tem FK/cascade: sem isso, um Exame liberado no portal
    # a partir deste laudo (_sincronizar_exame_liberado_para_portal) ficaria
    # com status='Liberado no portal' e laudo_id apontando para um registro
    # inexistente - a clinica parceira/tutor continuaria vendo o resultado.
    exames_vinculados = db.query(Exame).filter(Exame.laudo_id == laudo_id).all()
    for exame in exames_vinculados:
        if is_portal_released_status(exame.status):
            revogar_liberacao_exame_no_portal(
                exame_id=exame.id,
                db=db,
                current_user=current_user,
                request=request,
            )
        exame.laudo_id = None

    # Remover imagens associadas ao laudo
    imagens = db.query(ImagemLaudo).filter(ImagemLaudo.laudo_id == laudo_id).all()
    for img in imagens:
        db.delete(img)

    # Remover o laudo
    db.delete(laudo)
    db.commit()

    return {"message": "Laudo e imagens removidos com sucesso"}


def _liberar_laudo_para_portal(
    laudo_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Libera explicitamente um laudo no portal para os destinatarios externos vinculados."""
    laudo = db.query(Laudo).filter(Laudo.id == laudo_id).first()
    if not laudo:
        raise HTTPException(status_code=404, detail="Laudo nao encontrado")
    if not laudo.paciente_id:
        raise HTTPException(
            status_code=422,
            detail="Vincule um paciente ao laudo antes de liberar no portal.",
        )

    clinic_available = _to_optional_int(laudo.clinic_id) is not None
    veterinario_parceiro = None
    if _to_optional_int(laudo.veterinario_parceiro_id) is not None:
        veterinario_parceiro = (
            db.query(PortalPartnerProfile)
            .filter(
                PortalPartnerProfile.id == laudo.veterinario_parceiro_id,
                PortalPartnerProfile.tipo == PORTAL_PARTNER_TYPE_VETERINARIO,
                PortalPartnerProfile.ativo.is_(True),
            )
            .first()
        )

    if not clinic_available and veterinario_parceiro is None:
        raise HTTPException(
            status_code=422,
            detail="Vincule uma clinica ou um veterinario parceiro ao laudo antes de liberar no portal.",
        )

    released_at = datetime.utcnow()
    clinic_release_now = clinic_available and not is_portal_released_status(laudo.status, kind="laudo")
    laudo.status = PORTAL_RELEASED_STATUS
    laudo.updated_at = released_at
    exame = _sincronizar_exame_liberado_para_portal(db, laudo, current_user, released_at)
    anexo, old_portal_path, new_portal_path = _persistir_pdf_laudo_para_portal(
        db,
        laudo=laudo,
        exame=exame,
        current_user=current_user,
    )
    partner_target = None
    partner_release_now = False
    if veterinario_parceiro is not None:
        partner_target, partner_release_now = _upsert_portal_partner_release_target(
            db,
            partner_id=veterinario_parceiro.id,
            exame_id=exame.id,
            laudo_id=laudo.id,
            created_by_user_id=getattr(current_user, "id", None),
            released_at=released_at,
            contexto={
                "source": "laudo_portal_release",
                "partner_tipo": veterinario_parceiro.tipo,
                "partner_nome": veterinario_parceiro.nome_exibicao,
            },
        )

    try:
        db.commit()
        db.refresh(laudo)
        db.refresh(exame)
        db.refresh(anexo)
        if partner_target is not None:
            db.refresh(partner_target)
    except Exception:
        db.rollback()
        remove_atendimento_attachment_file(new_portal_path)
        raise

    if old_portal_path and old_portal_path != new_portal_path:
        remove_atendimento_attachment_file(old_portal_path)
    from app.models.clinica import Clinica
    from app.models.paciente import Paciente
    from app.models.tutor import Tutor

    clinica = db.query(Clinica).filter(Clinica.id == laudo.clinic_id).first() if clinic_available else None
    paciente = db.query(Paciente).filter(Paciente.id == laudo.paciente_id).first()
    tutor = db.query(Tutor).filter(Tutor.id == paciente.tutor_id).first() if paciente and paciente.tutor_id else None

    registrar_auditoria(
        current_user=current_user,
        modulo="laudos",
        entidade="laudo",
        acao="LAUDO_LIBERADO_PORTAL_EXTERNO",
        descricao="Laudo liberado no portal para destinatarios autorizados.",
        entidade_id=laudo.id,
        detalhes={
            "laudo_id": laudo.id,
            "exame_id": exame.id,
            "anexo_id": anexo.id,
            "paciente_id": laudo.paciente_id,
            "clinic_id": laudo.clinic_id,
            "veterinario_parceiro_id": laudo.veterinario_parceiro_id,
            "status": laudo.status,
            "pdf_nome": anexo.nome_original,
            "pdf_tamanho": anexo.tamanho,
            "destinos_liberados_agora": {
                "clinica": clinic_release_now,
                "veterinario_parceiro": partner_release_now,
            },
        },
        request=request,
    )

    clinic_notification_result = None
    if clinic_release_now and clinic_available:
        clinic_notification_result = notify_clinic_report_released(
            db=db,
            request=request,
            clinica_id=int(laudo.clinic_id),
            clinica_nome=getattr(clinica, "nome", None),
            tipo_exame=exame.tipo_exame or _label_tipo_exame_portal(laudo),
            paciente_nome=getattr(paciente, "nome", None),
            tutor_nome=getattr(tutor, "nome", None),
            released_at=released_at,
        )
        registrar_auditoria(
            current_user=current_user,
            modulo="laudos",
            entidade="laudo",
            acao=f"LAUDO_PORTAL_CLINICA_NOTIFICATION_{clinic_notification_result.status.upper()}",
            descricao="Resultado do envio de notificacao da clinica apos liberacao do laudo no portal.",
            entidade_id=laudo.id,
            detalhes={
                "laudo_id": laudo.id,
                "clinic_id": laudo.clinic_id,
                "notification_status": clinic_notification_result.status,
                "destination_masked": clinic_notification_result.destination_masked,
                "provider": clinic_notification_result.provider,
                "reason": clinic_notification_result.reason,
            },
            request=request,
        )

    partner_notification_result = None
    if partner_release_now and veterinario_parceiro is not None:
        partner_notification_result = notify_partner_report_released(
            db=db,
            request=request,
            partner_id=veterinario_parceiro.id,
            partner_nome=veterinario_parceiro.nome_exibicao,
            tipo_exame=exame.tipo_exame or _label_tipo_exame_portal(laudo),
            paciente_nome=getattr(paciente, "nome", None),
            tutor_nome=getattr(tutor, "nome", None),
            released_at=released_at,
        )
        registrar_auditoria(
            current_user=current_user,
            modulo="laudos",
            entidade="laudo",
            acao=f"LAUDO_PORTAL_PARTNER_NOTIFICATION_{partner_notification_result.status.upper()}",
            descricao="Resultado do envio de notificacao do veterinario parceiro apos liberacao do laudo no portal.",
            entidade_id=laudo.id,
            detalhes={
                "laudo_id": laudo.id,
                "partner_id": veterinario_parceiro.id,
                "partner_tipo": veterinario_parceiro.tipo,
                "notification_status": partner_notification_result.status,
                "destination_masked": partner_notification_result.destination_masked,
                "provider": partner_notification_result.provider,
                "reason": partner_notification_result.reason,
            },
            request=request,
        )

    portal_release_state = _serialize_portal_release_state(
        db,
        laudo=laudo,
        portal_veterinario_liberado=veterinario_parceiro is not None,
        exame_id_by_laudo_id={laudo.id: exame.id},
    )
    success_message = _build_portal_release_success_message(
        clinic_released_now=clinic_release_now,
        partner_released_now=partner_release_now,
        clinic_notification_destination=getattr(clinic_notification_result, "destination_masked", None),
        partner_notification_destination=getattr(partner_notification_result, "destination_masked", None),
    )

    return {
        "message": success_message,
        "laudo_id": laudo.id,
        "exame_id": exame.id,
        "anexo_id": anexo.id,
        "paciente_id": laudo.paciente_id,
        "clinic_id": laudo.clinic_id,
        "veterinario_parceiro_id": laudo.veterinario_parceiro_id,
        "status": laudo.status,
        "pdf_nome": anexo.nome_original,
        "pdf_tamanho": anexo.tamanho,
        "released_at": released_at.isoformat(),
        "destinos_liberados_agora": {
            "clinica": clinic_release_now,
            "veterinario_parceiro": partner_release_now,
        },
        "notificacao_clinica": (
            {
                "status": clinic_notification_result.status,
                "destination_masked": clinic_notification_result.destination_masked,
                "provider": clinic_notification_result.provider,
                "reason": clinic_notification_result.reason,
            }
            if clinic_notification_result is not None
            else None
        ),
        "notificacao_parceiro": (
            {
                "status": partner_notification_result.status,
                "destination_masked": partner_notification_result.destination_masked,
                "provider": partner_notification_result.provider,
                "reason": partner_notification_result.reason,
            }
            if partner_notification_result is not None
            else None
        ),
        **portal_release_state,
    }


@router.post("/laudos/{laudo_id}/portal/liberar")
def liberar_laudo_para_portal(
    laudo_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return _liberar_laudo_para_portal(
        laudo_id=laudo_id,
        request=request,
        db=db,
        current_user=current_user,
    )


@router.post("/laudos/{laudo_id}/portal/liberar-clinica")
def liberar_laudo_para_portal_clinica(
    laudo_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return _liberar_laudo_para_portal(
        laudo_id=laudo_id,
        request=request,
        db=db,
        current_user=current_user,
    )


@router.post("/laudos/{laudo_id}/pdf-jobs", response_model=dict)
def criar_job_pdf_laudo(
    laudo_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Enfileira a geracao de PDF do laudo e retorna o status do job."""
    try:
        return enqueue_laudo_pdf_job(db, laudo_id, current_user.id)
    except ValueError as exc:
        if "Laudo nao encontrado" in str(exc):
            raise HTTPException(status_code=404, detail="Laudo nao encontrado")
        raise HTTPException(status_code=400, detail=str(exc))


@router.get("/laudos/pdf-jobs/{job_id}", response_model=dict)
def obter_status_job_pdf_laudo(
    job_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Consulta o status de um job de PDF do laudo."""
    job = get_laudo_pdf_job_for_user(db, job_id, current_user.id)
    if not job:
        raise HTTPException(status_code=404, detail="Job de PDF nao encontrado")

    if job.status == JOB_STATUS_PENDING:
        submit_laudo_pdf_job(job.id)

    return serialize_laudo_pdf_job(job)


@router.get("/laudos/pdf-jobs/{job_id}/download")
def baixar_pdf_laudo_pronto(
    job_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Faz download do arquivo PDF gerado por um job concluido."""
    from fastapi.responses import FileResponse

    job = get_laudo_pdf_job_for_user(db, job_id, current_user.id)
    if not job:
        raise HTTPException(status_code=404, detail="Job de PDF nao encontrado")
    if job.status != JOB_STATUS_COMPLETED:
        raise HTTPException(status_code=409, detail="PDF ainda nao esta pronto")
    if not job.arquivo_caminho or not os.path.exists(job.arquivo_caminho):
        raise HTTPException(status_code=410, detail="Arquivo PDF nao encontrado no armazenamento")

    return FileResponse(
        path=job.arquivo_caminho,
        media_type="application/pdf",
        filename=job.arquivo_nome or f"laudo_{job.laudo_id}.pdf",
    )


# Endpoint para gerar PDF
@router.get("/laudos/{laudo_id}/pdf")
def gerar_pdf_laudo(
    laudo_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Mantem compatibilidade com download direto, reaproveitando cache quando existir."""
    from fastapi.responses import FileResponse, StreamingResponse

    try:
        cached_job = None
        try:
            cache_key = compute_laudo_pdf_cache_key(db, laudo_id, current_user.id)
            cached_job = get_cached_laudo_pdf_job(db, laudo_id, current_user.id, cache_key)
        except Exception as exc:
            db.rollback()
            print(f"[WARN] Cache de PDF assincrono indisponivel, seguindo em modo sincrono: {exc}")
        if (
            cached_job
            and cached_job.status == JOB_STATUS_COMPLETED
            and cached_job.arquivo_caminho
            and os.path.exists(cached_job.arquivo_caminho)
        ):
            return FileResponse(
                path=cached_job.arquivo_caminho,
                media_type="application/pdf",
                filename=cached_job.arquivo_nome or f"laudo_{laudo_id}.pdf",
            )

        pdf = render_laudo_pdf(db, laudo_id, current_user)
        return StreamingResponse(
            BytesIO(pdf.content),
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{pdf.filename}"'},
        )
    except ValueError as exc:
        if "Laudo nao encontrado" in str(exc):
            raise HTTPException(status_code=404, detail="Laudo nao encontrado")
        raise HTTPException(status_code=400, detail=str(exc))
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Erro ao gerar PDF: {str(exc)}")

    from fastapi.responses import StreamingResponse
    from app.utils.pdf_laudo import (
        gerar_pdf_laudo_eco,
        gerar_pdf_laudo_pressao,
        gerar_pdf_laudo_ultrassom_abdominal,
    )
    from app.models.paciente import Paciente
    from app.models.tutor import Tutor
    from app.models.clinica import Clinica
    from app.models.imagem_laudo import ImagemLaudo
    from app.models.configuracao import Configuracao, ConfiguracaoUsuario
    from app.models.referencia_eco import ReferenciaEco
    from app.utils.referencia_eco_defaults import aplicar_defaults_publicados_caninos
    from sqlalchemy import func
    import traceback

    try:
        laudo = db.query(Laudo).filter(Laudo.id == laudo_id).first()
        if not laudo:
            raise HTTPException(status_code=404, detail="Laudo nao encontrado")

        paciente = db.query(Paciente).filter(Paciente.id == laudo.paciente_id).first()

        tutor_nome = ""
        if paciente and paciente.tutor_id:
            tutor = db.query(Tutor).filter(Tutor.id == paciente.tutor_id).first()
            if tutor:
                tutor_nome = tutor.nome

        clinica_nome = ""
        if laudo.clinic_id:
            clinica = db.query(Clinica).filter(Clinica.id == laudo.clinic_id).first()
            if clinica:
                clinica_nome = clinica.nome
        elif laudo.medico_solicitante:
            clinica_nome = laudo.medico_solicitante

        imagens = db.query(ImagemLaudo).filter(
            ImagemLaudo.laudo_id == laudo_id,
            ImagemLaudo.ativo == 1
        ).order_by(ImagemLaudo.ordem).all()

        imagens_bytes = []
        for img in imagens:
            if img.conteudo:
                imagens_bytes.append(img.conteudo)
            elif img.caminho_arquivo and os.path.exists(img.caminho_arquivo):
                with open(img.caminho_arquivo, "rb") as f:
                    imagens_bytes.append(f.read())

        config_sistema = None
        config_usuario = None
        try:
            config_sistema = db.query(Configuracao).first()
        except Exception as e:
            db.rollback()
            print(f"[WARN] Configuracao indisponivel para PDF: {e}")

        try:
            config_usuario = db.query(ConfiguracaoUsuario).filter(
                ConfiguracaoUsuario.user_id == current_user.id
            ).first()
        except Exception as e:
            db.rollback()
            print(f"[WARN] ConfiguracaoUsuario indisponivel para PDF: {e}")

        data_exame = laudo.data_exame or laudo.data_laudo
        if data_exame and isinstance(data_exame, str):
            data_exame = _parse_data_exame(data_exame)
        data_exame_str = data_exame.strftime("%d/%m/%Y") if data_exame else datetime.now().strftime("%d/%m/%Y")

        idade = extrair_idade_paciente(
            paciente.nascimento if paciente else None,
            paciente.observacoes if paciente else None,
        )

        dados_paciente = {
            "nome": paciente.nome if paciente else "N/A",
            "especie": paciente.especie if paciente else "Canina",
            "raca": paciente.raca if paciente else "",
            "sexo": normalizar_sexo_paciente(paciente.sexo if paciente else ""),
            "idade": idade,
            "peso": f"{paciente.peso_kg:.1f}" if paciente and paciente.peso_kg else "",
            "tutor": tutor_nome,
            "solicitante": laudo.medico_solicitante or "",
            "data_exame": data_exame_str,
        }
        ecocardiograma_cabecalho = _extrair_ecocardiograma_cabecalho_de_anexos(laudo.anexos) or {}
        dados_paciente["ritmo"] = str(ecocardiograma_cabecalho.get("ritmo") or "").strip()
        dados_paciente["estado"] = str(ecocardiograma_cabecalho.get("estado") or "").strip()
        dados_paciente["fc"] = str(ecocardiograma_cabecalho.get("fc") or "").strip()

        logomarca = None
        assinatura = None
        texto_rodape = None
        if config_sistema:
            if config_sistema.mostrar_logomarca and config_sistema.logomarca_dados:
                logomarca = config_sistema.logomarca_dados
            texto_rodape = config_sistema.texto_rodape_laudo

        if config_usuario and config_usuario.assinatura_dados:
            assinatura = config_usuario.assinatura_dados
        elif config_sistema and config_sistema.mostrar_assinatura and config_sistema.assinatura_dados:
            assinatura = config_sistema.assinatura_dados

        def sanitizar(texto, padrao):
            if not texto or texto == "N/A":
                return padrao
            texto = re.sub(r"[^\w\s-]", "", texto)
            texto = texto.strip().replace(" ", "_")
            return texto[:30] if texto else padrao

        try:
            data_nome = data_exame.strftime("%Y-%m-%d") if data_exame else datetime.now().strftime("%Y-%m-%d")
        except Exception:
            data_nome = datetime.now().strftime("%Y-%m-%d")

        pet_nome = sanitizar(dados_paciente.get("nome"), "Pet")
        tutor_nome_arq = sanitizar(tutor_nome, "SemTutor")
        clinica_nome_arq = sanitizar(clinica_nome, "SemClinica")
        filename_base = f"{data_nome}__{pet_nome}__{tutor_nome_arq}__{clinica_nome_arq}"

        tipo_laudo = (laudo.tipo or "").lower()

        if tipo_laudo == "pressao_arterial":
            pressao_arterial = _extrair_pressao_arterial_de_anexos(laudo.anexos) or {}
            classificacao = laudo.diagnostico or _classificar_pressao_media(pressao_arterial.get("pas_media"))

            dados_pressao = {
                "paciente": dados_paciente,
                "clinica": clinica_nome,
                "pressao_arterial": pressao_arterial,
                "conclusao": classificacao,
                "observacoes": laudo.observacoes or "",
                "veterinario_nome": current_user.nome,
                "veterinario_crmv": config_usuario.crmv if config_usuario else "",
            }

            pdf_bytes = gerar_pdf_laudo_pressao(
                dados_pressao,
                logomarca_bytes=logomarca,
                assinatura_bytes=assinatura,
                nome_veterinario=current_user.nome,
                crmv=config_usuario.crmv if config_usuario else "",
                texto_rodape=texto_rodape,
            )
            filename = f"{filename_base}__PA.pdf"
        elif tipo_laudo == "ultrassonografia_abdominal":
            ultrassonografia_abdominal = _extrair_ultrassonografia_abdominal_de_anexos(laudo.anexos)
            if not ultrassonografia_abdominal:
                ultrassonografia_abdominal = _extrair_ultrassonografia_abdominal_do_descricao(laudo.descricao)
            if not ultrassonografia_abdominal:
                ultrassonografia_abdominal = {
                    "versao": 1,
                    "sexo_paciente": _normalizar_sexo_paciente(paciente.sexo if paciente else ""),
                    "qualitativa": {},
                    "observacoes_gerais": laudo.observacoes or "",
                }

            dados_ultrassom = {
                "paciente": dados_paciente,
                "clinica": clinica_nome,
                "ultrassonografia_abdominal": ultrassonografia_abdominal,
                "observacoes": laudo.observacoes or "",
                "imagens": imagens_bytes,
                "veterinario_nome": current_user.nome,
                "veterinario_crmv": config_usuario.crmv if config_usuario else "",
            }

            pdf_bytes = gerar_pdf_laudo_ultrassom_abdominal(
                dados_ultrassom,
                logomarca_bytes=logomarca,
                assinatura_bytes=assinatura,
                nome_veterinario=current_user.nome,
                crmv=config_usuario.crmv if config_usuario else "",
                texto_rodape=texto_rodape,
            )
            filename = f"{filename_base}__US_abdominal.pdf"
        else:
            medidas = extrair_medidas_ecocardiograma_da_descricao(laudo.descricao)
            qualitativa = {}
            pressao_arterial = _extrair_pressao_arterial_de_anexos(laudo.anexos)
            if laudo.descricao:
                descricao = laudo.descricao
                qualitativa_match = re.search(r"Avalia(?:ç|c)ão Qualitativa[\s\n]*(-.*?)(?=\n##|\Z)", descricao, re.DOTALL)
                if not qualitativa_match:
                    qualitativa_match = re.search(r"Avaliacao Qualitativa[\s\n]*(-.*?)(?=\n##|\Z)", descricao, re.DOTALL)
                if qualitativa_match:
                    qualitativa_texto = qualitativa_match.group(1)
                    for match in re.finditer(r"-\s*(\w+):?\s*(.+?)(?=\n-|\Z)", qualitativa_texto, re.DOTALL):
                        campo = match.group(1).lower().strip()
                        valor = match.group(2).strip()
                        if campo in ["valvas", "camaras", "funcao", "pericardio", "vasos", "ad_vd"]:
                            qualitativa[campo] = valor

            referencia_eco = None
            if paciente and paciente.especie and paciente.peso_kg is not None:
                try:
                    ref = db.query(ReferenciaEco).filter(
                        ReferenciaEco.especie.ilike(paciente.especie)
                    ).order_by(
                        func.abs(ReferenciaEco.peso_kg - float(paciente.peso_kg))
                    ).first()
                    if ref:
                        referencia_eco = aplicar_defaults_publicados_caninos({
                            col.name: getattr(ref, col.name)
                            for col in ref.__table__.columns
                        }, peso_kg=paciente.peso_kg)
                except Exception as e:
                    db.rollback()
                    print(f"[WARN] ReferenciaEco indisponivel para PDF: {e}")

            dados_eco = {
                "paciente": dados_paciente,
                "medidas": medidas,
                "qualitativa": qualitativa,
                "conclusao": laudo.diagnostico or "",
                "clinica": clinica_nome,
                "referencia_eco": referencia_eco,
                "pressao_arterial": pressao_arterial,
                "imagens": imagens_bytes,
                "veterinario_nome": current_user.nome,
                "veterinario_crmv": config_usuario.crmv if config_usuario else "",
            }

            pdf_bytes = gerar_pdf_laudo_eco(
                dados_eco,
                logomarca_bytes=logomarca,
                assinatura_bytes=assinatura,
                nome_veterinario=current_user.nome,
                crmv=config_usuario.crmv if config_usuario else "",
                texto_rodape=texto_rodape,
            )
            filename = f"{filename_base}.pdf"

        return StreamingResponse(
            BytesIO(pdf_bytes),
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )
    except HTTPException:
        raise
    except Exception as e:
        print(f"ERRO AO GERAR PDF: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Erro ao gerar PDF: {str(e)}")


# Exames
@router.get("/exames")
def listar_exames(
    paciente_id: Optional[int] = None,
    tipo_exame: Optional[str] = None,
    status: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Lista exames com filtros"""
    try:
        query = db.query(Exame)

        if paciente_id:
            query = query.filter(Exame.paciente_id == paciente_id)
        if tipo_exame:
            query = query.filter(Exame.tipo_exame == tipo_exame)
        if status:
            query = query.filter(Exame.status == status)

        total = query.count()
        items = query.offset(skip).limit(limit).all()
        return {"total": total, "items": items}
    except Exception as e:
        # Stage legado pode ter drift de schema em `exames`; não bloqueia a tela de laudos.
        print(f"[WARN] Falha ao listar exames: {e}")
        return {"total": 0, "items": []}


@router.post("/exames", status_code=status.HTTP_201_CREATED)
def criar_exame(
    exame_data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Cria novo exame"""
    paciente_id = exame_data["paciente_id"]
    laudo_id = exame_data.get("laudo_id")
    if laudo_id and not db.query(Laudo).filter(Laudo.id == laudo_id, Laudo.paciente_id == paciente_id).first():
        # Mesma protecao de _sync_exames (atendimento.py) contra vincular um
        # exame a um laudo de outro paciente - vazaria o exame no portal via
        # o status de liberacao do laudo alheio.
        laudo_id = None
    exame = Exame(
        laudo_id=laudo_id,
        paciente_id=paciente_id,
        tipo_exame=exame_data["tipo_exame"],
        resultado=exame_data.get("resultado"),
        valor_referencia=exame_data.get("valor_referencia"),
        unidade=exame_data.get("unidade"),
        status=exame_data.get("status", "Solicitado"),
        valor=exame_data.get("valor", 0),
        observacoes=exame_data.get("observacoes"),
        criado_por_id=current_user.id,
        criado_por_nome=current_user.nome
    )
    
    db.add(exame)
    db.commit()
    db.refresh(exame)
    
    return exame


@router.get("/exames/{exame_id}")
def obter_exame(
    exame_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Obtém um exame específico"""
    exame = db.query(Exame).filter(Exame.id == exame_id).first()
    if not exame:
        raise HTTPException(status_code=404, detail="Exame não encontrado")
    return exame


@router.put("/exames/{exame_id}")
def atualizar_exame(
    exame_id: int,
    exame_data: dict,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Atualiza um exame"""
    exame = db.query(Exame).filter(Exame.id == exame_id).first()
    if not exame:
        raise HTTPException(status_code=404, detail="Exame não encontrado")

    # atendimento_id nao e aceito aqui: essa rota generica nao tem o contexto
    # (guards de exclusao/liberacao no portal) que _sync_exames aplica ao
    # vincular um exame a um atendimento - so o modulo de Atendimento pode
    # fazer esse vinculo.
    campos_ignorados = {"atendimento_id", "id"}
    for field, value in exame_data.items():
        if field in campos_ignorados:
            continue
        if field == "laudo_id":
            # Mesma protecao de _sync_exames (atendimento.py): so aceita um
            # laudo_id que pertenca ao mesmo paciente deste exame.
            if value and not db.query(Laudo).filter(Laudo.id == value, Laudo.paciente_id == exame.paciente_id).first():
                continue
            exame.laudo_id = value
        elif field == "status" and is_portal_released_status(value) and not is_portal_released_status(exame.status):
            # A liberacao no portal so pode ser feita pelo endpoint dedicado
            # (valida PDF, preserva observacoes originais e audita a acao).
            continue
        elif hasattr(exame, field):
            setattr(exame, field, value)

    db.commit()
    db.refresh(exame)

    registrar_auditoria(
        current_user=current_user,
        modulo="laudos",
        entidade="exame",
        entidade_id=exame.id,
        acao="EXAME_ATUALIZADO",
        descricao=f"Exame #{exame.id} atualizado via tela de Laudos.",
        detalhes={"paciente_id": exame.paciente_id, "campos_alterados": [f for f in exame_data if f not in campos_ignorados]},
        request=request,
    )
    return exame


@router.delete("/exames/{exame_id}")
def deletar_exame(
    exame_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Remove um exame"""
    exame = db.query(Exame).filter(Exame.id == exame_id).first()
    if not exame:
        raise HTTPException(status_code=404, detail="Exame não encontrado")

    total_anexos = db.query(AnexoAtendimento).filter(AnexoAtendimento.exame_id == exame_id).count()
    motivo_bloqueio = _motivo_bloqueio_exclusao_exame(exame, total_anexos)
    if motivo_bloqueio:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=motivo_bloqueio)

    paciente_id = exame.paciente_id
    tipo_exame = exame.tipo_exame

    _excluir_anexos_por_exame(db, exame.id)
    db.delete(exame)
    db.commit()

    registrar_auditoria(
        current_user=current_user,
        modulo="laudos",
        entidade="exame",
        entidade_id=exame_id,
        acao="EXAME_EXCLUIDO",
        descricao=f"Exame #{exame_id} ({tipo_exame}) excluido via tela de Laudos.",
        detalhes={"paciente_id": paciente_id},
        request=request,
    )

    return {"message": "Exame removido com sucesso"}
