import asyncio
import json
import logging
import math
import os
import re
import secrets
import unicodedata
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from queue import Empty
from typing import Any, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy import and_, exists, func, or_, text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models.agendamento import Agendamento
from app.models.paciente import Paciente
from app.models.clinica import Clinica
from app.models.configuracao import Configuracao, ConfiguracaoUsuario
from app.models.auditoria_evento import AuditoriaEvento
from app.models.servico import Servico
from app.models.ordem_servico import OrdemServico
from app.models.laudo import Laudo
from app.models.user import User
from app.models.tutor import Tutor
from app.schemas.agendamento import (
    AgendamentoCreate,
    AgendamentoLista,
    AgendamentoResponse,
    AgendamentoUpdate,
)
from app.core.agenda_config import (
    DEFAULT_AGENDA_SEMANAL,
    carregar_agenda_excecoes,
    carregar_agenda_feriados,
    carregar_agenda_semanal,
    obter_excecao_data,
    obter_feriado,
    validar_horario_agenda,
)
from app.core.agenda_route_rules import carregar_agenda_rota_regras
from app.core.agenda_realtime import agenda_realtime_manager
from app.core.config import settings
from app.core.security import get_current_user
from app.services.logistica_service import normalizar_perfil, obter_duracao_deslocamento
from app.services.precos_service import calcular_preco_servico, to_decimal
from app.services.auditoria_service import registrar_auditoria
from app.services.push_notifications import (
    send_agenda_push_notification,
    send_financeiro_push_notification,
)
from app.services.push_scheduler_service import schedule_pending_os_payment_reminder

router = APIRouter()
logger = logging.getLogger(__name__)
# Horario de Brasilia (UTC-3). Evita dependencia de tzdata no Windows local.
LOCAL_TZ = timezone(timedelta(hours=-3))
AGENDA_STATUS_PERMITIDOS = ["Agendado", "Reservado", "Confirmado", "Em atendimento", "Realizado", "Cancelado", "Faltou"]
AGENDA_STATUS_PRE_AGENDADOS = {"Agendado", "Reservado", "Confirmado"}
AGENDA_STATUS_NAO_ANCORA = {"Cancelado", "Faltou"}
MIN_MARGEM_SEGURA_DESLOCAMENTO_MIN = 5
AGENDA_WRITE_LOCK_KEY = 24052301
ASSISTENTE_BUSCA_PROGRESSIVA_MAX_DIAS = 30
ASSISTENTE_AGENDA_TOKEN_ENV = "ASSISTENTE_AGENDA_TOKEN"
ASSISTENTE_AGENDA_MAX_WINDOW_ENV = "ASSISTENTE_AGENDA_MAX_WINDOW_DAYS"
ASSISTENTE_AGENDA_DEFAULT_WINDOW_DAYS = 7
ASSISTENTE_AGENDA_DEFAULT_MAX_WINDOW_DAYS = 14
ASSISTENTE_AGENDA_HARD_MAX_WINDOW_DAYS = 31
DIAS_SEMANA_PT = [
    "segunda-feira",
    "terca-feira",
    "quarta-feira",
    "quinta-feira",
    "sexta-feira",
    "sabado",
    "domingo",
]


def _usuario_tem_papel(usuario: Any, papel: str) -> bool:
    metodo = getattr(usuario, "tem_papel", None)
    if callable(metodo):
        try:
            return bool(metodo(papel))
        except Exception:
            return False
    return False


class SugestaoHorarioPayload(BaseModel):
    data: str = Field(..., description="Data no formato YYYY-MM-DD")
    clinica_id: int = Field(..., ge=1)
    servico_id: Optional[int] = Field(default=None, ge=1)
    duracao_minutos: Optional[int] = Field(default=None, ge=5, le=720)
    intervalo_minutos: int = Field(default=15, ge=5, le=120)
    limite: int = Field(default=8, ge=1, le=50)
    perfil_deslocamento: str = Field(default="comercial")
    ignorar_agendamento_id: Optional[int] = Field(default=None, ge=1)


class SugestaoProximidadePayload(BaseModel):
    clinica_id: int = Field(..., ge=1)
    data: Optional[str] = Field(default=None, description="Data no formato YYYY-MM-DD")
    data_contato: Optional[str] = Field(default=None, description="Data do contato no formato YYYY-MM-DD")
    servico_id: Optional[int] = Field(default=None, ge=1)
    duracao_minutos: Optional[int] = Field(default=None, ge=5, le=720)
    intervalo_minutos: int = Field(default=30, ge=5, le=120)
    limite_sugestoes_operacionais: int = Field(default=8, ge=1, le=50)
    perfil_deslocamento: str = Field(default="comercial")
    limite_minutos: int = Field(default=25, ge=1, le=180)
    ignorar_agendamento_id: Optional[int] = Field(default=None, ge=1)
    incluir_mesma_clinica: bool = Field(default=True)
    janela_dias_proximidade: int = Field(default=7, ge=0, le=30)


class AssistenteEncerramentoPayload(BaseModel):
    tipo: Literal["solicitacao_excecao", "encerramento_sem_agendamento"] = Field(...)
    motivo: str = Field(..., min_length=5, max_length=1200)
    clinica_id: Optional[int] = Field(default=None, ge=1)
    servico_id: Optional[int] = Field(default=None, ge=1)
    data_referencia: Optional[str] = Field(default=None, description="Data no formato YYYY-MM-DD")
    data_contato: Optional[str] = Field(default=None, description="Data do primeiro contato no formato YYYY-MM-DD")
    contexto: Optional[dict[str, Any]] = Field(default=None)


class AssistenteOfertaPayload(BaseModel):
    clinica_id: int = Field(..., ge=1)
    data: Optional[str] = Field(default=None, description="Data no formato YYYY-MM-DD")
    data_contato: Optional[str] = Field(default=None, description="Data do contato no formato YYYY-MM-DD")
    servico_id: Optional[int] = Field(default=None, ge=1)
    duracao_minutos: Optional[int] = Field(default=None, ge=5, le=720)
    intervalo_minutos: int = Field(default=30, ge=5, le=120)
    limite: int = Field(default=8, ge=1, le=50)
    perfil_deslocamento: str = Field(default="comercial")
    limite_minutos: int = Field(default=25, ge=1, le=180)
    ignorar_agendamento_id: Optional[int] = Field(default=None, ge=1)
    incluir_mesma_clinica: bool = Field(default=True)
    janela_dias_proximidade: int = Field(default=7, ge=0, le=30)


def _parse_hora_hhmm(value: Optional[str], fallback: str) -> str:
    raw = str(value or "").strip()
    if len(raw) != 5 or raw[2] != ":":
        return fallback

    hh = raw[:2]
    mm = raw[3:]
    if not (hh.isdigit() and mm.isdigit()):
        return fallback

    hora = int(hh)
    minuto = int(mm)
    if hora < 0 or hora > 23 or minuto < 0 or minuto > 59:
        return fallback
    return f"{hora:02d}:{minuto:02d}"


def _hora_para_minutos(value: str) -> int:
    hh, mm = value.split(":")
    return int(hh) * 60 + int(mm)


def _combine_date_hhmm(data_ref: date, hora_hhmm: str) -> datetime:
    hh, mm = hora_hhmm.split(":")
    return datetime(
        data_ref.year,
        data_ref.month,
        data_ref.day,
        int(hh),
        int(mm),
        0,
        0,
    )


def _minutos_entre(inicio: datetime, fim: datetime) -> int:
    return int((fim - inicio).total_seconds() // 60)


def _arredondar_para_proximo_slot(data_hora: datetime, intervalo_minutos: int) -> datetime:
    intervalo = max(1, int(intervalo_minutos))
    base = data_hora.replace(second=0, microsecond=0)
    total_min = (base.hour * 60) + base.minute
    resto = total_min % intervalo
    if resto == 0:
        return base
    total_ajustado = total_min + (intervalo - resto)
    inicio_dia = base.replace(hour=0, minute=0, second=0, microsecond=0)
    return inicio_dia + timedelta(minutes=total_ajustado)


def _obter_duracao_deslocamento_cacheado(
    db: Session,
    *,
    origem_clinica_id: Optional[int],
    destino_clinica_id: Optional[int],
    perfil: str,
    permitir_estimativa_fallback: bool = True,
    cache: Optional[dict[tuple[int, int, str, bool], tuple[int, str]]] = None,
) -> tuple[int, str]:
    perfil_norm = normalizar_perfil(perfil)
    chave = (
        int(origem_clinica_id or 0),
        int(destino_clinica_id or 0),
        perfil_norm,
        bool(permitir_estimativa_fallback),
    )
    if isinstance(cache, dict) and chave in cache:
        return cache[chave]

    resultado = obter_duracao_deslocamento(
        db,
        origem_clinica_id=origem_clinica_id,
        destino_clinica_id=destino_clinica_id,
        perfil=perfil_norm,
        permitir_estimativa_fallback=permitir_estimativa_fallback,
    )
    if isinstance(cache, dict):
        cache[chave] = resultado
    return resultado


def _nome_clinica_legivel(nome: Optional[str], fallback: str = "clinica nao informada") -> str:
    valor = str(nome or "").strip()
    return valor or fallback


def _formatar_data_com_semana_pt(data_iso: Optional[str]) -> str:
    raw = str(data_iso or "").strip()
    if not raw:
        return "data nao informada"
    try:
        data_ref = datetime.strptime(raw, "%Y-%m-%d").date()
    except ValueError:
        return raw
    return f"{raw} ({DIAS_SEMANA_PT[data_ref.weekday()]})"


def _frase_deslocamento_entre_clinicas(origem: str, destino: str, duracao_min: int) -> str:
    origem_nome = _nome_clinica_legivel(origem)
    destino_nome = _nome_clinica_legivel(destino)
    if origem_nome.casefold() == destino_nome.casefold():
        return f"Deslocamento dentro da clinica {origem_nome}: {duracao_min} min."
    return f"Deslocamento entre {origem_nome} e {destino_nome} de {duracao_min} min."


def _detalhar_deslocamento_por_clinicas(
    *,
    clinica_destino: Optional[str],
    clinica_anterior: Optional[str],
    clinica_posterior: Optional[str],
    duracao_anterior_min: Optional[int],
    duracao_posterior_min: Optional[int],
    total_min: Optional[int],
    ha_agendamento_anterior: bool,
    ha_agendamento_posterior: bool,
) -> str:
    destino_nome = _nome_clinica_legivel(clinica_destino)
    anterior_nome = _nome_clinica_legivel(clinica_anterior)
    posterior_nome = _nome_clinica_legivel(clinica_posterior)
    anterior_min = max(0, int(duracao_anterior_min or 0))
    posterior_min = max(0, int(duracao_posterior_min or 0))
    total = max(0, int(total_min or 0))

    partes = []
    if ha_agendamento_anterior:
        partes.append(_frase_deslocamento_entre_clinicas(anterior_nome, destino_nome, anterior_min))
    else:
        partes.append("Nao ha agendamentos anteriores ainda.")

    if ha_agendamento_posterior:
        partes.append(_frase_deslocamento_entre_clinicas(destino_nome, posterior_nome, posterior_min))
    else:
        partes.append("Nao ha agendamentos posteriores ainda.")

    partes.append(f"Total estimado de deslocamento: {total} min.")
    return " ".join(partes)


def _nome_clinica_por_id(db: Session, clinica_id: Optional[int]) -> str:
    if not clinica_id:
        return "Clinica nao informada"
    clinica = db.query(Clinica).filter(Clinica.id == int(clinica_id)).first()
    if clinica and clinica.nome:
        return str(clinica.nome).strip()
    return f"Clinica #{int(clinica_id)}"


def _clinica_tem_localizacao_confiavel(clinica: Optional[Clinica]) -> bool:
    if not clinica:
        return False
    if clinica.latitude is None or clinica.longitude is None:
        return False
    try:
        lat = float(clinica.latitude)
        lng = float(clinica.longitude)
    except (TypeError, ValueError):
        return False
    if not math.isfinite(lat) or not math.isfinite(lng):
        return False
    if lat < -90.0 or lat > 90.0 or lng < -180.0 or lng > 180.0:
        return False
    if abs(lat) < 0.000001 and abs(lng) < 0.000001:
        return False
    return True


def _hora_hhmm_para_minutos(value: Optional[str], fallback: int = 16 * 60) -> int:
    raw = str(value or "").strip()
    if len(raw) != 5 or raw[2] != ":":
        return fallback
    hh = raw[:2]
    mm = raw[3:]
    if not (hh.isdigit() and mm.isdigit()):
        return fallback
    hora = int(hh)
    minuto = int(mm)
    if hora < 0 or hora > 23 or minuto < 0 or minuto > 59:
        return fallback
    return (hora * 60) + minuto


def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    raio_terra_km = 6371.0
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)
    a = (
        math.sin(delta_phi / 2.0) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2
    )
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return raio_terra_km * c


def _normalizar_localidade(value: Optional[str]) -> str:
    raw = str(value or "").strip().casefold()
    if not raw:
        return ""
    sem_acentos = unicodedata.normalize("NFKD", raw)
    sem_acentos = sem_acentos.encode("ascii", "ignore").decode("ascii")
    sem_pontuacao = re.sub(r"[^a-z0-9]+", " ", sem_acentos)
    return re.sub(r"\s+", " ", sem_pontuacao).strip()


def _status_conta_como_ancora(status_value: Optional[str]) -> bool:
    status = str(status_value or "").strip() or "Agendado"
    return status not in AGENDA_STATUS_NAO_ANCORA


def _clinicas_mesma_regiao_operacional(
    clinica_a: Optional[Clinica],
    clinica_b: Optional[Clinica],
    *,
    max_cluster_km: float = 18.0,
) -> bool:
    if clinica_a is None or clinica_b is None:
        return False

    cidade_a = _normalizar_localidade(getattr(clinica_a, "cidade", None))
    cidade_b = _normalizar_localidade(getattr(clinica_b, "cidade", None))
    uf_a = _normalizar_localidade(getattr(clinica_a, "estado", None))
    uf_b = _normalizar_localidade(getattr(clinica_b, "estado", None))

    if cidade_a and cidade_b and cidade_a == cidade_b:
        if uf_a and uf_b and uf_a != uf_b:
            return False
        return True

    if _clinica_tem_localizacao_confiavel(clinica_a) and _clinica_tem_localizacao_confiavel(clinica_b):
        try:
            lat_a = float(clinica_a.latitude)
            lng_a = float(clinica_a.longitude)
            lat_b = float(clinica_b.latitude)
            lng_b = float(clinica_b.longitude)
        except (TypeError, ValueError):
            return False
        return _haversine_km(lat_a, lng_a, lat_b, lng_b) <= float(max_cluster_km)

    return False


def _tempo_estimado_clinica_ate_base_min(
    clinica: Optional[Clinica],
    *,
    base_lat: Optional[float],
    base_lng: Optional[float],
    perfil_deslocamento: str = "comercial",
) -> Optional[int]:
    if clinica is None:
        return None
    if base_lat is None or base_lng is None:
        return None
    if clinica.latitude is None or clinica.longitude is None:
        return None

    try:
        lat_clinica = float(clinica.latitude)
        lng_clinica = float(clinica.longitude)
        lat_base = float(base_lat)
        lng_base = float(base_lng)
    except (TypeError, ValueError):
        return None

    if not (
        math.isfinite(lat_clinica)
        and math.isfinite(lng_clinica)
        and math.isfinite(lat_base)
        and math.isfinite(lng_base)
    ):
        return None

    distancia_km = _haversine_km(lat_clinica, lng_clinica, lat_base, lng_base)
    perfil_norm = normalizar_perfil(perfil_deslocamento)
    velocidade_media_kmh = 26.0 if perfil_norm == "comercial" else 32.0
    buffer_min = 8 if perfil_norm == "comercial" else 5
    minutos = int(round((distancia_km / max(1.0, velocidade_media_kmh)) * 60.0))
    return max(1, minutos + buffer_min)


def _obter_regras_rota_agenda(db: Session) -> dict:
    config = db.query(Configuracao).first()
    if not config:
        return carregar_agenda_rota_regras(None)
    return carregar_agenda_rota_regras(getattr(config, "agenda_rota_regras", None))


def _obter_max_window_assistente_agenda() -> int:
    raw = str(
        os.getenv(ASSISTENTE_AGENDA_MAX_WINDOW_ENV)
        or getattr(settings, ASSISTENTE_AGENDA_MAX_WINDOW_ENV, "")
        or ""
    ).strip()
    try:
        value = int(raw) if raw else ASSISTENTE_AGENDA_DEFAULT_MAX_WINDOW_DAYS
    except ValueError:
        value = ASSISTENTE_AGENDA_DEFAULT_MAX_WINDOW_DAYS
    return max(1, min(ASSISTENTE_AGENDA_HARD_MAX_WINDOW_DAYS, value))


def _validar_acesso_assistente_agenda(request: Request) -> None:
    expected = str(
        os.getenv(ASSISTENTE_AGENDA_TOKEN_ENV)
        or getattr(settings, ASSISTENTE_AGENDA_TOKEN_ENV, "")
        or ""
    ).strip()
    if len(expected) < 20:
        raise HTTPException(
            status_code=403,
            detail="Integracao read-only do assistente de agenda desabilitada.",
        )

    headers = getattr(request, "headers", {}) or {}
    provided = str(headers.get("x-assistente-agenda-token") or "").strip()
    auth_header = str(headers.get("authorization") or "").strip()
    if not provided and auth_header.lower().startswith("bearer "):
        provided = auth_header[7:].strip()

    if not provided or not secrets.compare_digest(provided, expected):
        raise HTTPException(status_code=403, detail="Token do assistente de agenda invalido.")


def _parse_data_assistente_agenda(value: Optional[str], *, field_label: str, default: date) -> date:
    raw = str(value or "").strip()
    if not raw:
        return default
    data_iso = _extract_date_filter(raw)
    if not data_iso:
        raise HTTPException(status_code=422, detail=f"{field_label} invalida. Use YYYY-MM-DD.")
    try:
        return datetime.strptime(data_iso, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=422, detail=f"{field_label} invalida. Use YYYY-MM-DD.")


def _resolver_periodo_assistente_agenda(
    data_inicio: Optional[str],
    data_fim: Optional[str],
) -> tuple[str, str, int]:
    hoje = datetime.now(LOCAL_TZ).date()
    inicio_ref = _parse_data_assistente_agenda(
        data_inicio,
        field_label="Data inicial",
        default=hoje,
    )
    fim_padrao = inicio_ref + timedelta(days=ASSISTENTE_AGENDA_DEFAULT_WINDOW_DAYS)
    fim_ref = _parse_data_assistente_agenda(
        data_fim,
        field_label="Data final",
        default=fim_padrao,
    )
    if fim_ref < inicio_ref:
        raise HTTPException(status_code=422, detail="Data final nao pode ser anterior a data inicial.")

    total_dias = (fim_ref - inicio_ref).days + 1
    max_dias = _obter_max_window_assistente_agenda()
    if total_dias > max_dias:
        raise HTTPException(
            status_code=422,
            detail=f"Janela maxima para assistente de agenda e de {max_dias} dias.",
        )

    return inicio_ref.isoformat(), fim_ref.isoformat(), total_dias


def _contar_agendamentos_clinica_30d(
    db: Session,
    *,
    clinica_id: int,
    data_ref_iso: str,
) -> int:
    try:
        data_ref = datetime.strptime(data_ref_iso, "%Y-%m-%d").date()
    except ValueError:
        data_ref = datetime.now(LOCAL_TZ).date()
    inicio = (data_ref - timedelta(days=30)).isoformat()
    fim = data_ref.isoformat()
    count = (
        db.query(Agendamento.id)
        .filter(Agendamento.clinica_id == clinica_id)
        .filter(Agendamento.status != "Cancelado")
        .filter(func.date(Agendamento.inicio) >= inicio)
        .filter(func.date(Agendamento.inicio) <= fim)
        .count()
    )
    return int(count or 0)


def _existe_ancora_proxima_no_dia(
    db: Session,
    *,
    clinica_id: int,
    data_iso: str,
    limite_minutos: int,
    perfil_deslocamento: str,
    agendamento_id_excluir: Optional[int] = None,
) -> bool:
    if limite_minutos <= 0:
        return False
    janela_inicio, janela_fim, _motivo = _obter_janela_funcionamento_data(db, data_iso)
    if janela_inicio is None or janela_fim is None:
        return False

    agendamentos_dia = _listar_agendamentos_ativos_do_dia(
        db,
        data_iso,
        agendamento_id_excluir=agendamento_id_excluir,
    )
    agendamentos_dia = _filtrar_agendamentos_por_janela_funcionamento(
        db,
        agendamentos_dia,
        cache_janelas={data_iso: (janela_inicio, janela_fim, None)},
    )
    clinica_ref = db.query(Clinica).filter(Clinica.id == clinica_id).first()
    clinicas_cache: dict[int, Optional[Clinica]] = {}
    ancoras_mesma_cidade = 0

    def _get_clinica_cached(cid: int) -> Optional[Clinica]:
        if cid not in clinicas_cache:
            clinicas_cache[cid] = db.query(Clinica).filter(Clinica.id == cid).first()
        return clinicas_cache[cid]

    cache_duracoes: dict[tuple[int, int, str, bool], tuple[int, str]] = {}
    perfil_norm = normalizar_perfil(perfil_deslocamento)
    for item in agendamentos_dia:
        status_item = (str(item.get("status") or "").strip() or "Agendado")
        if not _status_conta_como_ancora(status_item):
            continue
        clinica_item_id = int(item.get("clinica_id") or 0)
        if clinica_item_id <= 0:
            continue
        if clinica_item_id == clinica_id:
            return True
        duracao_min, _fonte = _obter_duracao_deslocamento_cacheado(
            db,
            origem_clinica_id=clinica_id,
            destino_clinica_id=clinica_item_id,
                perfil=perfil_norm,
                permitir_estimativa_fallback=True,
                cache=cache_duracoes,
            )
        if duracao_min > 0 and duracao_min <= limite_minutos:
            return True
        if duracao_min <= 0:
            clinica_item = _get_clinica_cached(clinica_item_id)
            if not _clinicas_mesma_regiao_operacional(clinica_ref, clinica_item):
                continue
            ancoras_mesma_cidade += 1
            if ancoras_mesma_cidade >= 1:
                # Fallback operacional: se a matriz ainda nao tem duracoes, mas existe
                # ancora valida na mesma cidade/UF para D+2, libera a ancoragem.
                return True
    return False


def _clinicas_mesma_cidade_uf(
    db: Session,
    *,
    clinica_a_id: int,
    clinica_b_id: int,
    cache: Optional[dict[int, Optional[Clinica]]] = None,
) -> bool:
    clinicas_cache = cache if isinstance(cache, dict) else {}

    def _get_clinica(cid: int) -> Optional[Clinica]:
        if cid not in clinicas_cache:
            clinicas_cache[cid] = db.query(Clinica).filter(Clinica.id == cid).first()
        return clinicas_cache[cid]

    clinica_a = _get_clinica(int(clinica_a_id or 0))
    clinica_b = _get_clinica(int(clinica_b_id or 0))
    return _clinicas_mesma_regiao_operacional(clinica_a, clinica_b)


def _classificar_politica_oferta(
    db: Session,
    *,
    clinica_id: int,
    data_contato_iso: str,
    perfil_deslocamento: str,
    regras_rota: dict,
    agendamento_id_excluir: Optional[int] = None,
) -> dict[str, Any]:
    thresholds = regras_rota.get("thresholds") if isinstance(regras_rota.get("thresholds"), dict) else {}
    offer_policy = regras_rota.get("offer_policy") if isinstance(regras_rota.get("offer_policy"), dict) else {}
    base_cfg = regras_rota.get("base") if isinstance(regras_rota.get("base"), dict) else {}

    limite_ancora = int(thresholds.get("nearby_anchor_max_travel_min") or 20)
    limite_distante = int(thresholds.get("distant_clinic_min_travel_from_base_min") or 35)
    limite_baixa_frequencia = int(thresholds.get("low_frequency_max_bookings_30d") or 3)
    try:
        data_contato_ref = datetime.strptime(data_contato_iso, "%Y-%m-%d").date()
    except ValueError:
        data_contato_ref = datetime.now(LOCAL_TZ).date()
    data_d0 = data_contato_ref.isoformat()
    data_d2 = (data_contato_ref + timedelta(days=2)).isoformat()
    data_d3 = (data_contato_ref + timedelta(days=3)).isoformat()

    dias_padrao = [int(item) for item in list(offer_policy.get("default_first_offer_days_ahead") or [2])]
    dias_distantes = [
        int(item) for item in list(offer_policy.get("distant_low_frequency_first_offer_days_ahead") or [3, 4])
    ]
    permitir_d2_ancora = bool(offer_policy.get("allow_d2_if_anchor_exists", True))

    clinica = db.query(Clinica).filter(Clinica.id == clinica_id).first()
    clinic_name = str(getattr(clinica, "nome", "") or "").strip()
    clinic_name_norm = clinic_name.casefold()
    tempo_base_min = _tempo_estimado_clinica_ate_base_min(
        clinica,
        base_lat=base_cfg.get("lat"),
        base_lng=base_cfg.get("lng"),
        perfil_deslocamento=perfil_deslocamento,
    )
    distante_base = tempo_base_min is not None and tempo_base_min >= limite_distante
    qtd_30d = _contar_agendamentos_clinica_30d(
        db,
        clinica_id=clinica_id,
        data_ref_iso=data_contato_iso,
    )
    baixa_frequencia = qtd_30d <= limite_baixa_frequencia
    if tempo_base_min is None and baixa_frequencia and permitir_d2_ancora:
        # Sem base geocodificada, adota regra conservadora para clinicas de baixa frequencia:
        # D+2 so e priorizado quando houver ancora realmente proxima.
        distante_base = True
    base_proxima = tempo_base_min is not None and tempo_base_min < limite_distante

    dias_preferenciais = dias_padrao or [2]
    ancora_d0 = False
    ancora_d2 = False
    ancora_d3 = False
    sem_agendamentos_d0 = False
    prioridade_d0_aplicada = False
    override_aplicado = None
    override_ancora_obrigatoria = False
    if distante_base and baixa_frequencia:
        dias_preferenciais = dias_distantes or dias_preferenciais
        if permitir_d2_ancora:
            ancora_d2 = _existe_ancora_proxima_no_dia(
                db,
                clinica_id=clinica_id,
                data_iso=data_d2,
                limite_minutos=limite_ancora,
                perfil_deslocamento=perfil_deslocamento,
                agendamento_id_excluir=agendamento_id_excluir,
            )
            if ancora_d2:
                dias_preferenciais = [2]

    if base_proxima:
        agendamentos_d0 = _listar_agendamentos_ativos_do_dia(
            db,
            data_d0,
            agendamento_id_excluir=agendamento_id_excluir,
        )
        agendamentos_d0 = _filtrar_agendamentos_por_janela_funcionamento(db, agendamentos_d0)
        sem_agendamentos_d0 = len(agendamentos_d0) == 0
        if not sem_agendamentos_d0:
            ancora_d0 = _existe_ancora_proxima_no_dia(
                db,
                clinica_id=clinica_id,
                data_iso=data_d0,
                limite_minutos=limite_ancora,
                perfil_deslocamento=perfil_deslocamento,
                agendamento_id_excluir=agendamento_id_excluir,
            )
        if not ancora_d2:
            ancora_d2 = _existe_ancora_proxima_no_dia(
                db,
                clinica_id=clinica_id,
                data_iso=data_d2,
                limite_minutos=limite_ancora,
                perfil_deslocamento=perfil_deslocamento,
                agendamento_id_excluir=agendamento_id_excluir,
            )
        ancora_d3 = _existe_ancora_proxima_no_dia(
            db,
            clinica_id=clinica_id,
            data_iso=data_d3,
            limite_minutos=limite_ancora,
            perfil_deslocamento=perfil_deslocamento,
            agendamento_id_excluir=agendamento_id_excluir,
        )
        if (ancora_d0 or sem_agendamentos_d0) and (not ancora_d2 and not ancora_d3):
            dias_preferenciais = [0]
            prioridade_d0_aplicada = True

    overrides_cfg = regras_rota.get("clinic_overrides") if isinstance(regras_rota.get("clinic_overrides"), list) else []
    for override in overrides_cfg:
        if not isinstance(override, dict):
            continue
        override_name = str(override.get("clinic_name") or "").strip().casefold()
        if not override_name:
            continue
        if override_name != clinic_name_norm:
            continue
        override_dias = [
            int(item)
            for item in list(override.get("force_days_ahead") or [])
            if str(item).strip().isdigit()
        ]
        override_dias = [dia for dia in override_dias if 0 <= dia <= 30]
        if override_dias:
            dias_preferenciais = sorted(set(override_dias))
        override_ancora_obrigatoria = bool(override.get("prefer_only_when_anchor_exists", False))
        override_aplicado = {
            "clinic_name": clinic_name,
            "force_days_ahead": dias_preferenciais,
            "prefer_only_when_anchor_exists": override_ancora_obrigatoria,
            "notes": str(override.get("notes") or "").strip(),
        }
        break

    if override_ancora_obrigatoria and 2 in dias_preferenciais:
        data_d2 = (datetime.strptime(data_contato_iso, "%Y-%m-%d").date() + timedelta(days=2)).isoformat()
        if not ancora_d2:
            ancora_d2 = _existe_ancora_proxima_no_dia(
                db,
                clinica_id=clinica_id,
                data_iso=data_d2,
                limite_minutos=limite_ancora,
                perfil_deslocamento=perfil_deslocamento,
                agendamento_id_excluir=agendamento_id_excluir,
            )
        if not ancora_d2:
            dias_preferenciais = [dia for dia in dias_preferenciais if dia != 2]
            if not dias_preferenciais:
                dias_preferenciais = dias_distantes or dias_padrao or [2]

    dias_preferenciais = sorted(set(int(dia) for dia in dias_preferenciais if 0 <= int(dia) <= 30))

    return {
        "dias_preferenciais": dias_preferenciais,
        "distante_base": bool(distante_base),
        "base_proxima": bool(base_proxima),
        "baixa_frequencia": bool(baixa_frequencia),
        "agendamentos_30d": int(qtd_30d),
        "tempo_base_estimado_min": tempo_base_min,
        "ancora_d0": bool(ancora_d0),
        "ancora_d2": bool(ancora_d2),
        "ancora_d3": bool(ancora_d3),
        "sem_agendamentos_d0": bool(sem_agendamentos_d0),
        "prioridade_d0_aplicada": bool(prioridade_d0_aplicada),
        "override_aplicado": override_aplicado,
    }


def _obter_janela_funcionamento_data(
    db: Session,
    data_iso: str,
) -> tuple[Optional[datetime], Optional[datetime], Optional[str]]:
    try:
        data_ref = datetime.strptime(data_iso, "%Y-%m-%d").date()
    except ValueError:
        return None, None, "Data invalida. Use o formato YYYY-MM-DD."

    agenda_semanal, agenda_feriados, agenda_excecoes = _obter_regras_agenda(db)

    excecao = obter_excecao_data(data_ref, agenda_excecoes)
    if excecao is not None:
        if not bool(excecao.get("ativo", False)):
            motivo = str(excecao.get("motivo") or "").strip()
            detalhe = f" ({motivo})" if motivo else ""
            return None, None, f"Agenda fechada por excecao de data{detalhe}."
        hora_inicio = _parse_hora_hhmm(str(excecao.get("inicio") or ""), "08:00")
        hora_fim = _parse_hora_hhmm(str(excecao.get("fim") or ""), "18:00")
    else:
        feriado = obter_feriado(data_ref, agenda_feriados)
        if feriado:
            descricao = str(feriado.get("descricao") or "").strip()
            detalhe = f" ({descricao})" if descricao else ""
            return None, None, f"Agenda fechada em feriado{detalhe}."

        dia_key = str(data_ref.isoweekday())
        dia_cfg = agenda_semanal.get(dia_key) or DEFAULT_AGENDA_SEMANAL[dia_key]
        if not bool(dia_cfg.get("ativo", False)):
            return None, None, "Agenda fechada para este dia."
        fallback_dia = DEFAULT_AGENDA_SEMANAL.get(dia_key, {"inicio": "08:00", "fim": "14:00"})
        hora_inicio = _parse_hora_hhmm(str(dia_cfg.get("inicio") or ""), str(fallback_dia["inicio"]))
        hora_fim = _parse_hora_hhmm(str(dia_cfg.get("fim") or ""), str(fallback_dia["fim"]))

    if _hora_para_minutos(hora_inicio) >= _hora_para_minutos(hora_fim):
        return None, None, "Configuracao de agenda invalida para esta data."

    inicio = _combine_date_hhmm(data_ref, hora_inicio)
    fim = _combine_date_hhmm(data_ref, hora_fim)
    return inicio, fim, None


def _listar_agendamentos_ativos_periodo(
    db: Session,
    data_inicio_iso: str,
    data_fim_iso: str,
    *,
    agendamento_id_excluir: Optional[int] = None,
) -> list[dict]:
    data_sem_vazio = func.nullif(func.trim(Agendamento.data), "")
    query = (
        db.query(Agendamento)
        .filter(Agendamento.status != "Cancelado")
        .filter(
            or_(
                and_(
                    data_sem_vazio.isnot(None),
                    data_sem_vazio >= data_inicio_iso,
                    data_sem_vazio <= data_fim_iso,
                ),
                and_(
                    func.date(Agendamento.inicio) >= data_inicio_iso,
                    func.date(Agendamento.inicio) <= data_fim_iso,
                ),
            )
        )
    )
    if agendamento_id_excluir is not None:
        query = query.filter(Agendamento.id != agendamento_id_excluir)

    registros: list[dict] = []
    for item in query.order_by(Agendamento.inicio.asc(), Agendamento.id.asc()).all():
        inicio_dt, fim_dt = _intervalo_local_agendamento(item)
        if inicio_dt is None:
            continue

        if fim_dt is None or fim_dt <= inicio_dt:
            fim_dt = inicio_dt + timedelta(minutes=30)

        registros.append(
            {
                "id": item.id,
                "inicio": inicio_dt,
                "fim": fim_dt,
                "clinica_id": item.clinica_id,
                "clinica_nome": (str(item.clinica or "").strip() or None),
                "status": item.status,
            }
        )

    return registros


def _listar_agendamentos_ativos_do_dia(
    db: Session,
    data_iso: str,
    *,
    agendamento_id_excluir: Optional[int] = None,
) -> list[dict]:
    return _listar_agendamentos_ativos_periodo(
        db,
        data_iso,
        data_iso,
        agendamento_id_excluir=agendamento_id_excluir,
    )


def _obter_janela_funcionamento_cacheada(
    db: Session,
    data_iso: str,
    *,
    cache_janelas: Optional[dict[str, tuple[Optional[datetime], Optional[datetime], Optional[str]]]] = None,
) -> tuple[Optional[datetime], Optional[datetime], Optional[str]]:
    if cache_janelas is not None and data_iso in cache_janelas:
        return cache_janelas[data_iso]
    janela = _obter_janela_funcionamento_data(db, data_iso)
    if cache_janelas is not None:
        cache_janelas[data_iso] = janela
    return janela


def _filtrar_agendamentos_por_janela_funcionamento(
    db: Session,
    agendamentos: list[dict],
    *,
    cache_janelas: Optional[dict[str, tuple[Optional[datetime], Optional[datetime], Optional[str]]]] = None,
) -> list[dict]:
    filtrados: list[dict] = []
    for item in agendamentos:
        inicio_item = item.get("inicio")
        fim_item = item.get("fim")
        if not isinstance(inicio_item, datetime):
            continue
        if not isinstance(fim_item, datetime) or fim_item <= inicio_item:
            fim_item = inicio_item + timedelta(minutes=30)
        data_item_iso = inicio_item.date().isoformat()
        janela_inicio, janela_fim, _motivo = _obter_janela_funcionamento_cacheada(
            db,
            data_item_iso,
            cache_janelas=cache_janelas,
        )
        if janela_inicio is None or janela_fim is None:
            continue
        # Ignora legados fora da janela operacional ativa para evitar ancoras invalidas.
        if inicio_item < janela_inicio or fim_item > janela_fim:
            continue
        filtrados.append(item)
    return filtrados


def _obter_vizinhos_horario(
    agendamentos_dia: list[dict],
    inicio: datetime,
    fim: datetime,
) -> tuple[Optional[dict], Optional[dict]]:
    anterior = None
    proximo = None

    for item in agendamentos_dia:
        if item["fim"] <= inicio:
            anterior = item
            continue
        if item["inicio"] >= fim:
            proximo = item
            break
    return anterior, proximo


def _validar_deslocamento_agendamento(
    db: Session,
    agendamento: Agendamento,
    *,
    agendamento_id_excluir: Optional[int] = None,
    perfil_deslocamento: str = "comercial",
    confirmar_conflito_deslocamento: bool = False,
) -> None:
    status_atual = (str(agendamento.status or "").strip() or "Agendado")
    if status_atual == "Cancelado":
        return

    if not agendamento.clinica_id:
        return

    inicio_dt = _to_local_naive(_coerce_datetime(agendamento.inicio))
    if inicio_dt is None:
        raise HTTPException(status_code=422, detail="Horario de inicio invalido para validar deslocamento.")

    fim_dt = _to_local_naive(_coerce_datetime(agendamento.fim))
    if fim_dt is None or fim_dt <= inicio_dt:
        fim_dt = inicio_dt + timedelta(minutes=30)

    data_iso = inicio_dt.date().isoformat()
    agendamentos_dia = _listar_agendamentos_ativos_do_dia(
        db,
        data_iso,
        agendamento_id_excluir=agendamento_id_excluir,
    )
    anterior, proximo = _obter_vizinhos_horario(agendamentos_dia, inicio_dt, fim_dt)
    perfil_norm = normalizar_perfil(perfil_deslocamento)
    clinica_atual = _nome_clinica_por_id(db, agendamento.clinica_id)
    regras_rota = _obter_regras_rota_agenda(db)
    thresholds = regras_rota.get("thresholds") if isinstance(regras_rota.get("thresholds"), dict) else {}
    route_policy = regras_rota.get("route_policy") if isinstance(regras_rota.get("route_policy"), dict) else {}
    limite_desvio_insercao = int(thresholds.get("max_insertion_detour_min") or 25)
    margem_segura_min = int(thresholds.get("safe_margin_min") or MIN_MARGEM_SEGURA_DESLOCAMENTO_MIN)
    bloquear_ineficiencia = bool(route_policy.get("reject_clear_inefficiency", True))
    cache_clinicas: dict[int, Optional[Clinica]] = {}
    cache_duracoes: dict[tuple[int, int, str, bool], tuple[int, str]] = {}
    duracao_prev = 0
    folga_prev = None
    fonte_prev = "indefinido"
    clinica_anterior_nome = None
    duracao_next = 0
    folga_next = None
    fonte_next = "indefinido"
    clinica_proxima_nome = None

    def _get_clinica(clinica_id: Optional[int]) -> Optional[Clinica]:
        cid = int(clinica_id or 0)
        if cid <= 0:
            return None
        if cid not in cache_clinicas:
            cache_clinicas[cid] = db.query(Clinica).filter(Clinica.id == cid).first()
        return cache_clinicas[cid]

    clinica_atual_obj = _get_clinica(agendamento.clinica_id)
    if not _clinica_tem_localizacao_confiavel(clinica_atual_obj):
        # Fase de implantacao: sem geolocalizacao validada, nao bloquear agendamento por deslocamento.
        return

    if anterior and anterior.get("clinica_id"):
        clinica_anterior_obj = _get_clinica(anterior.get("clinica_id"))
        if _clinica_tem_localizacao_confiavel(clinica_anterior_obj):
            duracao_prev, fonte_prev = _obter_duracao_deslocamento_cacheado(
                db,
                origem_clinica_id=anterior.get("clinica_id"),
                destino_clinica_id=agendamento.clinica_id,
                perfil=perfil_norm,
                permitir_estimativa_fallback=True,
                cache=cache_duracoes,
            )
            folga_prev = _minutos_entre(anterior["fim"], inicio_dt)
            clinica_anterior_nome = anterior.get("clinica_nome") or _nome_clinica_por_id(db, anterior.get("clinica_id"))
            folga_necessaria_prev = int(duracao_prev + margem_segura_min)
            if duracao_prev > 0 and folga_prev < folga_necessaria_prev:
                if confirmar_conflito_deslocamento:
                    return
                raise HTTPException(
                    status_code=409,
                    detail={
                        "codigo": "CONFLITO_DESLOCAMENTO",
                        "mensagem": (
                            f"O tempo de deslocamento entre {clinica_anterior_nome} e {clinica_atual} "
                            f"e de aproximadamente {duracao_prev} minutos. "
                            f"Disponivel: {max(0, folga_prev)} minutos. "
                            f"Necessario com margem segura: {folga_necessaria_prev} minutos "
                            f"({duracao_prev} min de deslocamento + {margem_segura_min} min de margem). "
                            "Ajuste o horario ou escolha outra clinica."
                        ),
                        "origem_clinica": clinica_anterior_nome,
                        "destino_clinica": clinica_atual,
                        "duracao_min": int(duracao_prev),
                        "folga_min": max(0, int(folga_prev)),
                        "margem_segura_min": int(margem_segura_min),
                        "folga_necessaria_min": int(folga_necessaria_prev),
                        "fonte": fonte_prev,
                        "confirmavel": False,
                    },
                )

    if proximo and proximo.get("clinica_id"):
        clinica_proxima_obj = _get_clinica(proximo.get("clinica_id"))
        if _clinica_tem_localizacao_confiavel(clinica_proxima_obj):
            duracao_next, fonte_next = _obter_duracao_deslocamento_cacheado(
                db,
                origem_clinica_id=agendamento.clinica_id,
                destino_clinica_id=proximo.get("clinica_id"),
                perfil=perfil_norm,
                permitir_estimativa_fallback=True,
                cache=cache_duracoes,
            )
            folga_next = _minutos_entre(fim_dt, proximo["inicio"])
            clinica_proxima_nome = proximo.get("clinica_nome") or _nome_clinica_por_id(db, proximo.get("clinica_id"))
            folga_necessaria_next = int(duracao_next + margem_segura_min)
            if duracao_next > 0 and folga_next < folga_necessaria_next:
                if confirmar_conflito_deslocamento:
                    return
                raise HTTPException(
                    status_code=409,
                    detail={
                        "codigo": "CONFLITO_DESLOCAMENTO",
                        "mensagem": (
                            f"O tempo de deslocamento entre {clinica_atual} e {clinica_proxima_nome} "
                            f"e de aproximadamente {duracao_next} minutos. "
                            f"Disponivel: {max(0, folga_next)} minutos. "
                            f"Necessario com margem segura: {folga_necessaria_next} minutos "
                            f"({duracao_next} min de deslocamento + {margem_segura_min} min de margem). "
                            "Ajuste o horario ou escolha outra clinica."
                        ),
                        "origem_clinica": clinica_atual,
                        "destino_clinica": clinica_proxima_nome,
                        "duracao_min": int(duracao_next),
                        "folga_min": max(0, int(folga_next)),
                        "margem_segura_min": int(margem_segura_min),
                        "folga_necessaria_min": int(folga_necessaria_next),
                        "fonte": fonte_next,
                        "confirmavel": False,
                    },
                )

    if (
        bloquear_ineficiencia
        and limite_desvio_insercao > 0
        and anterior
        and anterior.get("clinica_id")
        and proximo
        and proximo.get("clinica_id")
        and duracao_prev > 0
        and duracao_next > 0
    ):
        duracao_direta, fonte_direta = _obter_duracao_deslocamento_cacheado(
            db,
            origem_clinica_id=anterior.get("clinica_id"),
            destino_clinica_id=proximo.get("clinica_id"),
            perfil=perfil_norm,
            permitir_estimativa_fallback=True,
            cache=cache_duracoes,
        )
        if duracao_direta > 0:
            duracao_via_novo = int(duracao_prev + duracao_next)
            desvio_insercao = max(0, int(duracao_via_novo - duracao_direta))
            if desvio_insercao > limite_desvio_insercao:
                if confirmar_conflito_deslocamento:
                    return
                origem = clinica_anterior_nome or _nome_clinica_por_id(db, anterior.get("clinica_id"))
                destino = clinica_proxima_nome or _nome_clinica_por_id(db, proximo.get("clinica_id"))
                raise HTTPException(
                    status_code=409,
                    detail={
                        "codigo": "CONFLITO_DESLOCAMENTO",
                        "mensagem": (
                            f"A insercao de {clinica_atual} entre {origem} e {destino} "
                            f"gera desvio estimado de {desvio_insercao} minutos "
                            f"(limite: {limite_desvio_insercao} minutos). "
                            "Ajuste o horario ou escolha outra clinica."
                        ),
                        "origem_clinica": origem,
                        "destino_clinica": destino,
                        "clinica_inserida": clinica_atual,
                        "desvio_insercao_min": desvio_insercao,
                        "limite_desvio_min": limite_desvio_insercao,
                        "duracao_direta_min": int(duracao_direta),
                        "duracao_via_insercao_min": duracao_via_novo,
                        "fonte": fonte_direta,
                        "confirmavel": False,
                    },
                )


def _notificar_agenda_update(
    db: Session,
    action: str,
    agendamento_id: int,
    data: Optional[dict] = None,
    actor_user_id: Optional[int] = None,
) -> None:
    try:
        agenda_realtime_manager.publish(action=action, agendamento_id=agendamento_id, data=data)
    except Exception as exc:
        print(f"[agenda-realtime] Falha ao publicar evento: {exc}")

    try:
        send_agenda_push_notification(
            db,
            action=action,
            agendamento_id=agendamento_id,
            data=data,
            actor_user_id=actor_user_id,
        )
    except Exception as exc:
        print(f"[agenda-push] Falha ao enviar notificacao push: {exc}")


def _texto_realtime(value: Optional[object]) -> str:
    return str(value or "").strip()


def _montar_payload_realtime(
    *,
    agendamento: Optional[Agendamento] = None,
    related: Optional[dict] = None,
    usuario: Optional[User] = None,
    base: Optional[dict] = None,
) -> dict:
    payload = dict(base or {})

    if agendamento is not None:
        payload.setdefault("status", agendamento.status)
        payload.setdefault("data", agendamento.data)
        payload.setdefault("hora", agendamento.hora)
        payload.setdefault("paciente_id", agendamento.paciente_id)
        payload.setdefault("clinica_id", agendamento.clinica_id)
        payload.setdefault("servico_id", agendamento.servico_id)

    rel = related or {}
    paciente_nome = _texto_realtime(rel.get("paciente_nome")) or _texto_realtime(getattr(agendamento, "paciente", None))
    clinica_nome = _texto_realtime(rel.get("clinica_nome")) or _texto_realtime(getattr(agendamento, "clinica", None))
    servico_nome = _texto_realtime(rel.get("servico_nome")) or _texto_realtime(getattr(agendamento, "servico", None))

    if paciente_nome:
        payload["paciente_nome"] = paciente_nome
        payload.setdefault("paciente", paciente_nome)
    if clinica_nome:
        payload["clinica_nome"] = clinica_nome
        payload.setdefault("clinica", clinica_nome)
    if servico_nome:
        payload["servico_nome"] = servico_nome
        payload.setdefault("servico", servico_nome)

    if usuario is not None:
        nome_usuario = _texto_realtime(usuario.nome)
        if nome_usuario:
            payload["usuario_nome"] = nome_usuario
            payload.setdefault("usuario", nome_usuario)
        if getattr(usuario, "id", None) is not None:
            payload["usuario_id"] = usuario.id

    return payload


def _parse_iso_datetime(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None

    raw = value.strip()
    if raw.endswith("Z"):
        raw = raw[:-1] + "+00:00"

    # Compatibilidade com bancos legados que armazenam offset como +00/-03 (sem minutos).
    if len(raw) > 10:
        sufixo = raw[10:]
        if not re.search(r"[+-]\d{2}:\d{2}$", sufixo):
            match_hhmm = re.search(r"([+-]\d{2})(\d{2})$", sufixo)
            if match_hhmm:
                sufixo = sufixo[: match_hhmm.start()] + f"{match_hhmm.group(1)}:{match_hhmm.group(2)}"
            else:
                match_hh = re.search(r"([+-]\d{2})$", sufixo)
                if match_hh:
                    sufixo = sufixo[: match_hh.start()] + f"{match_hh.group(1)}:00"
            raw = raw[:10] + sufixo

    try:
        return datetime.fromisoformat(raw)
    except ValueError:
        return None


def _to_local_naive(value: Optional[datetime]) -> Optional[datetime]:
    if value is None:
        return None
    if value.tzinfo is None:
        return value
    return value.astimezone(LOCAL_TZ).replace(tzinfo=None)


def _to_local_aware(value: Optional[datetime]) -> Optional[datetime]:
    if value is None:
        return None
    if value.tzinfo is None:
        # Interpreta datetimes sem timezone como horario local de Brasilia.
        return value.replace(tzinfo=LOCAL_TZ)
    return value.astimezone(LOCAL_TZ)


def _extract_date_filter(value: Optional[str]) -> Optional[str]:
    if not value:
        return None

    parsed = _parse_iso_datetime(value)
    if parsed is not None:
        return parsed.date().isoformat()

    # Fallback para valores no formato YYYY-MM-DD...
    candidate = value.strip().split("T", 1)[0].split(" ", 1)[0]
    if len(candidate) == 10:
        return candidate
    return None


def _coerce_datetime(value) -> Optional[datetime]:
    if isinstance(value, datetime):
        return _to_local_aware(value)
    if isinstance(value, str):
        parsed = _parse_iso_datetime(value.replace(" ", "T", 1))
        return _to_local_aware(parsed)
    return None


def _coerce_hora_hhmm(value: Optional[str]) -> Optional[str]:
    raw = str(value or "").strip()
    if not raw:
        return None
    match = re.match(r"^(\d{2}):(\d{2})", raw)
    if not match:
        return None
    hh = int(match.group(1))
    mm = int(match.group(2))
    if hh < 0 or hh > 23 or mm < 0 or mm > 59:
        return None
    return f"{hh:02d}:{mm:02d}"


def _coerce_data_iso(value: Optional[str]) -> Optional[str]:
    raw = str(value or "").strip()
    if not raw:
        return None
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", raw):
        return None
    return raw


def _intervalo_local_agendamento(
    item: Agendamento,
    *,
    fallback_duracao_min: int = 30,
) -> tuple[Optional[datetime], Optional[datetime]]:
    inicio_ref = _to_local_naive(_coerce_datetime(item.inicio))
    fim_ref = _to_local_naive(_coerce_datetime(item.fim))

    duracao_min = max(1, int(fallback_duracao_min or 30))
    if inicio_ref is not None and fim_ref is not None and fim_ref > inicio_ref:
        duracao_min = max(1, int((fim_ref - inicio_ref).total_seconds() // 60))

    data_iso = _coerce_data_iso(getattr(item, "data", None))
    hora_hhmm = _coerce_hora_hhmm(getattr(item, "hora", None))
    if data_iso and hora_hhmm:
        try:
            inicio_normalizado = datetime.strptime(f"{data_iso} {hora_hhmm}", "%Y-%m-%d %H:%M")
            fim_normalizado = inicio_normalizado + timedelta(minutes=duracao_min)
            return inicio_normalizado, fim_normalizado
        except ValueError:
            pass

    if inicio_ref is None:
        return None, None
    if fim_ref is None or fim_ref <= inicio_ref:
        fim_ref = inicio_ref + timedelta(minutes=duracao_min)
    return inicio_ref, fim_ref


def _normalize_text_filter(value: Optional[str]) -> Optional[str]:
    raw = " ".join(str(value or "").split())
    return raw.strip() or None


def _build_contains_pattern(value: str) -> str:
    escaped = (
        value.replace("\\", "\\\\")
        .replace("%", "\\%")
        .replace("_", "\\_")
    )
    return f"%{escaped}%"


def _fill_data_hora_from_inicio(agendamento: Agendamento) -> None:
    inicio_dt = _coerce_datetime(agendamento.inicio)
    if inicio_dt is None:
        return
    agendamento.data = inicio_dt.strftime("%Y-%m-%d")
    agendamento.hora = inicio_dt.strftime("%H:%M")


def _apply_service_duration_if_needed(
    db: Session,
    agendamento: Agendamento,
    *,
    force_from_service: bool = False,
) -> None:
    inicio_dt = _coerce_datetime(agendamento.inicio)
    if inicio_dt is None:
        return

    fim_dt = _coerce_datetime(agendamento.fim)

    if agendamento.servico_id:
        servico = db.query(Servico).filter(Servico.id == agendamento.servico_id).first()
        if servico and servico.duracao_minutos and servico.duracao_minutos > 0:
            agendamento.fim = inicio_dt + timedelta(minutes=int(servico.duracao_minutos))
            return
        if force_from_service:
            agendamento.fim = inicio_dt + timedelta(minutes=30)
            return

    if fim_dt is not None and fim_dt > inicio_dt:
        return

    agendamento.fim = inicio_dt + timedelta(minutes=30)


def _resolver_duracao_servico(
    db: Session,
    *,
    servico_id: Optional[int],
    fallback_minutos: int = 30,
) -> int:
    fallback = max(5, int(fallback_minutos or 30))
    if not servico_id:
        return fallback

    servico = db.query(Servico).filter(Servico.id == servico_id).first()
    if not servico:
        raise HTTPException(status_code=404, detail="Servico nao encontrado.")

    duracao = int(servico.duracao_minutos or 0)
    if duracao <= 0:
        return fallback
    return max(5, duracao)


def _obter_regras_agenda(db: Session) -> tuple[dict, list, list]:
    config = db.query(Configuracao).first()
    if not config:
        return carregar_agenda_semanal(None), carregar_agenda_feriados(None), carregar_agenda_excecoes(None)

    return (
        carregar_agenda_semanal(getattr(config, "agenda_semanal", None)),
        carregar_agenda_feriados(getattr(config, "agenda_feriados", None)),
        carregar_agenda_excecoes(getattr(config, "agenda_excecoes", None)),
    )


def _validar_agendamento_no_funcionamento(db: Session, agendamento: Agendamento) -> None:
    inicio_dt = _coerce_datetime(agendamento.inicio)
    if inicio_dt is None:
        raise HTTPException(status_code=422, detail="Horario de inicio invalido.")

    fim_dt = _coerce_datetime(agendamento.fim)
    if fim_dt is None:
        fim_dt = inicio_dt + timedelta(minutes=30)

    inicio_local = _to_local_naive(inicio_dt)
    fim_local = _to_local_naive(fim_dt)
    if inicio_local is None or fim_local is None:
        raise HTTPException(status_code=422, detail="Nao foi possivel validar o horario informado.")

    agenda_semanal, agenda_feriados, agenda_excecoes = _obter_regras_agenda(db)
    valido, mensagem = validar_horario_agenda(
        inicio_local=inicio_local,
        fim_local=fim_local,
        agenda_semanal=agenda_semanal,
        agenda_feriados=agenda_feriados,
        agenda_excecoes=agenda_excecoes,
    )
    if not valido:
        raise HTTPException(status_code=422, detail=mensagem)


def _validar_slot_disponivel(
    db: Session,
    agendamento: Agendamento,
    *,
    agendamento_id_excluir: Optional[int] = None,
) -> None:
    status_atual = (str(agendamento.status or "").strip() or "Agendado")
    if status_atual == "Cancelado":
        return

    inicio_local, fim_local = _intervalo_local_agendamento(agendamento)
    if inicio_local is None:
        raise HTTPException(status_code=422, detail="Horario de inicio invalido para validar disponibilidade.")
    if fim_local is None:
        raise HTTPException(status_code=422, detail="Nao foi possivel validar disponibilidade do horario informado.")

    if fim_local <= inicio_local:
        raise HTTPException(status_code=422, detail="Horario final invalido para validar disponibilidade.")

    data_referencia = inicio_local.date().isoformat()
    data_sem_vazio = func.nullif(func.trim(Agendamento.data), "")

    query = (
        db.query(Agendamento)
        .filter(Agendamento.status != "Cancelado")
        .filter(
            or_(
                data_sem_vazio == data_referencia,
                and_(
                    data_sem_vazio.is_(None),
                    func.date(Agendamento.inicio) == data_referencia,
                ),
            )
        )
    )
    if agendamento_id_excluir is not None:
        query = query.filter(Agendamento.id != agendamento_id_excluir)

    for existente in query.all():
        inicio_existente_local, fim_existente_local = _intervalo_local_agendamento(existente)
        if inicio_existente_local is None:
            continue
        if fim_existente_local is None:
            continue

        sobrepoe = inicio_local < fim_existente_local and fim_local > inicio_existente_local
        if not sobrepoe:
            continue

        horario_inicio = inicio_existente_local.strftime("%H:%M")
        horario_fim = fim_existente_local.strftime("%H:%M")
        paciente_existente = (str(existente.paciente or "").strip() or "paciente nao informado")
        raise HTTPException(
            status_code=409,
            detail=(
                "Horario indisponivel: ja existe atendimento neste slot "
                f"({horario_inicio} as {horario_fim}, {paciente_existente})."
            ),
        )


def _adquirir_lock_escrita_agenda(db: Session) -> None:
    if db.info.get("_agenda_write_lock"):
        return

    bind = db.get_bind()
    dialect_name = str(getattr(getattr(bind, "dialect", None), "name", "")).lower()

    if dialect_name == "sqlite":
        # Em SQLite, BEGIN IMMEDIATE antecipa o lock de escrita e evita corrida
        # entre duas transacoes que validam slot ao mesmo tempo.
        if not db.in_transaction():
            db.execute(text("BEGIN IMMEDIATE"))
    elif dialect_name in {"postgres", "postgresql"}:
        db.execute(text("SELECT pg_advisory_xact_lock(:lock_key)"), {"lock_key": AGENDA_WRITE_LOCK_KEY})
    else:
        (
            db.query(Configuracao)
            .order_by(Configuracao.id.asc())
            .with_for_update()
            .first()
        )

    db.info["_agenda_write_lock"] = True


def _fetch_related_names(db: Session, agendamento: Agendamento) -> dict:
    paciente_nome = None
    tutor_nome = None
    tutor_telefone = None
    clinica_nome = None
    servico_nome = None

    if agendamento.paciente_id:
        paciente = db.query(Paciente).filter(Paciente.id == agendamento.paciente_id).first()
        if paciente:
            paciente_nome = paciente.nome
            if paciente.tutor_id:
                tutor = db.query(Tutor).filter(Tutor.id == paciente.tutor_id).first()
                if tutor:
                    tutor_nome = tutor.nome
                    tutor_telefone = tutor.telefone

    if agendamento.clinica_id:
        clinica = db.query(Clinica).filter(Clinica.id == agendamento.clinica_id).first()
        if clinica:
            clinica_nome = clinica.nome

    if agendamento.servico_id:
        servico = db.query(Servico).filter(Servico.id == agendamento.servico_id).first()
        if servico:
            servico_nome = servico.nome

    return {
        "paciente_nome": paciente_nome,
        "tutor_nome": tutor_nome,
        "tutor_telefone": tutor_telefone,
        "clinica_nome": clinica_nome,
        "servico_nome": servico_nome,
    }


def _sync_denormalized_fields(agendamento: Agendamento, related: dict) -> None:
    paciente_nome = related.get("paciente_nome")
    tutor_nome = related.get("tutor_nome")
    tutor_telefone = related.get("tutor_telefone")
    clinica_nome = related.get("clinica_nome")
    servico_nome = related.get("servico_nome")

    if paciente_nome:
        agendamento.paciente = paciente_nome
    if tutor_nome:
        agendamento.tutor = tutor_nome
    if tutor_telefone:
        agendamento.telefone = tutor_telefone
    if clinica_nome:
        agendamento.clinica = clinica_nome
    if servico_nome:
        agendamento.servico = servico_nome


def _contexto_agendamento_auditoria(agendamento: Agendamento, related: Optional[dict] = None) -> dict[str, str]:
    rel = related or {}

    data = str(agendamento.data or "").strip()
    hora = str(agendamento.hora or "").strip()
    if not data or not hora:
        inicio = _to_local_naive(_coerce_datetime(agendamento.inicio))
        if inicio is not None:
            if not data:
                data = inicio.strftime("%Y-%m-%d")
            if not hora:
                hora = inicio.strftime("%H:%M")

    paciente = (str(rel.get("paciente_nome") or agendamento.paciente or "").strip() or "Nao informado")
    tutor = (str(rel.get("tutor_nome") or agendamento.tutor or "").strip() or "Nao informado")
    clinica = (str(rel.get("clinica_nome") or agendamento.clinica or "").strip() or "Nao informada")

    return {
        "data": data or "-",
        "hora": hora or "-",
        "clinica": clinica,
        "animal": paciente,
        "tutor": tutor,
    }


def _descricao_contexto_agendamento(contexto: dict[str, str]) -> str:
    return (
        f"{contexto.get('data', '-')} {contexto.get('hora', '-')}"
        f" | Clinica: {contexto.get('clinica', 'Nao informada')}"
        f" | Animal: {contexto.get('animal', 'Nao informado')}"
        f" | Tutor: {contexto.get('tutor', 'Nao informado')}"
    )


def _registrar_auditoria_excecao_operacional_concedida(
    *,
    db: Session,
    current_user: User,
    request: Request,
    agendamento: Agendamento,
    related: Optional[dict],
    motivo: str,
) -> None:
    contexto = _contexto_agendamento_auditoria(agendamento, related)
    registrar_auditoria(
        current_user=current_user,
        modulo="agenda",
        entidade="assistente_agendamento",
        entidade_id=agendamento.id,
        acao="ASSISTENTE_AGENDA_EXCECAO_CONCEDIDA",
        descricao=(
            "Excecao operacional concedida por admin para concluir agendamento manual - "
            f"{_descricao_contexto_agendamento(contexto)}"
        ),
        detalhes={
            "motivo": motivo,
            "perfil_usuario": "admin",
            "agendamento_id": agendamento.id,
            "clinica_id": agendamento.clinica_id,
            "servico_id": agendamento.servico_id,
            "contexto_agendamento": contexto,
        },
        request=request,
    )


def _registrar_evento_funil_assistente(
    *,
    current_user: User,
    request: Optional[Request],
    evento: str,
    detalhes: Optional[dict[str, Any]] = None,
) -> None:
    registrar_auditoria(
        current_user=current_user,
        modulo="agenda",
        entidade="assistente_agendamento",
        acao=evento,
        descricao=f"Evento de funil do assistente: {evento}.",
        detalhes=detalhes or {},
        request=request,
    )


def _parse_detalhes_auditoria(raw: Optional[str]) -> dict[str, Any]:
    if not raw:
        return {}
    try:
        value = json.loads(raw)
    except Exception:
        return {}
    return value if isinstance(value, dict) else {}


def _extrair_data_evento_local(value: Any) -> Optional[str]:
    if isinstance(value, datetime):
        dt = value if value.tzinfo else value.replace(tzinfo=timezone.utc)
        return dt.astimezone(LOCAL_TZ).date().isoformat()
    if value is None:
        return None
    raw = str(value).strip()
    if not raw:
        return None
    try:
        dt = datetime.fromisoformat(raw.replace("Z", "+00:00"))
    except ValueError:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(LOCAL_TZ).date().isoformat()


def _validar_paciente_tutor_para_status(
    db: Session,
    agendamento: Agendamento,
    *,
    status_destino: Optional[str] = None,
    related: Optional[dict] = None,
) -> None:
    status_alvo = (status_destino or agendamento.status or "").strip() or "Agendado"
    if status_alvo == "Reservado":
        return

    rel = related or _fetch_related_names(db, agendamento)
    paciente_id_valido = bool(agendamento.paciente_id)
    paciente_nome = str(rel.get("paciente_nome") or agendamento.paciente or "").strip()
    tutor_nome = str(rel.get("tutor_nome") or agendamento.tutor or "").strip()

    if not paciente_id_valido or not paciente_nome:
        raise HTTPException(
            status_code=422,
            detail="Para este status, o campo paciente deve estar preenchido.",
        )

    if not tutor_nome:
        raise HTTPException(
            status_code=422,
            detail="Para este status, o campo tutor deve estar preenchido.",
        )


def _normalizar_status_agendamento(status_value: Optional[str], fallback: str = "Agendado") -> str:
    status_norm = (status_value or fallback or "Agendado").strip() or "Agendado"
    if status_norm not in AGENDA_STATUS_PERMITIDOS:
        raise HTTPException(
            status_code=400,
            detail=f"Status invalido. Use: {', '.join(AGENDA_STATUS_PERMITIDOS)}",
        )
    return status_norm


def _serialize_agendamento(
    agendamento: Agendamento,
    *,
    paciente_nome: Optional[str] = None,
    tutor_nome: Optional[str] = None,
    tutor_telefone: Optional[str] = None,
    clinica_nome: Optional[str] = None,
    servico_nome: Optional[str] = None,
) -> dict:
    inicio_dt = _coerce_datetime(agendamento.inicio)
    fim_dt = _coerce_datetime(agendamento.fim)

    data = agendamento.data
    hora = agendamento.hora
    if inicio_dt is not None:
        if not data:
            data = inicio_dt.strftime("%Y-%m-%d")
        if not hora:
            hora = inicio_dt.strftime("%H:%M")

    return {
        "id": agendamento.id,
        "paciente_id": agendamento.paciente_id,
        "clinica_id": agendamento.clinica_id,
        "servico_id": agendamento.servico_id,
        "inicio": inicio_dt.strftime("%Y-%m-%d %H:%M:%S") if inicio_dt else None,
        "fim": fim_dt.strftime("%Y-%m-%d %H:%M:%S") if fim_dt else None,
        "status": agendamento.status,
        "observacoes": agendamento.observacoes,
        "data": data,
        "hora": hora,
        "paciente": paciente_nome or agendamento.paciente or "Paciente nao informado",
        "tutor": tutor_nome or agendamento.tutor or "Tutor nao informado",
        "telefone": tutor_telefone or agendamento.telefone or "",
        "servico": servico_nome or agendamento.servico or "",
        "clinica": clinica_nome or agendamento.clinica or "Clinica nao informada",
        "criado_por_nome": agendamento.criado_por_nome,
        "confirmado_por_nome": agendamento.confirmado_por_nome,
        "created_at": str(agendamento.created_at) if agendamento.created_at else None,
    }


def _query_agendamentos_com_relacionados(db: Session):
    return (
        db.query(
            Agendamento,
            Paciente.nome.label("paciente_nome"),
            Clinica.nome.label("clinica_nome"),
            Servico.nome.label("servico_nome"),
            Tutor.nome.label("tutor_nome"),
            Tutor.telefone.label("tutor_telefone"),
        )
        .outerjoin(Paciente, Agendamento.paciente_id == Paciente.id)
        .outerjoin(Clinica, Agendamento.clinica_id == Clinica.id)
        .outerjoin(Servico, Agendamento.servico_id == Servico.id)
        .outerjoin(Tutor, Paciente.tutor_id == Tutor.id)
    )


def _primeiro_nome_paciente_assistente(
    agendamento: Agendamento,
    *,
    paciente_nome: Optional[str] = None,
) -> Optional[str]:
    raw = " ".join(str(paciente_nome or agendamento.paciente or "").split())
    if not raw:
        return None
    return raw.split(" ", 1)[0]


def _serialize_agendamento_assistente_readonly(
    agendamento: Agendamento,
    *,
    paciente_nome: Optional[str] = None,
    clinica_nome: Optional[str] = None,
    servico_nome: Optional[str] = None,
    incluir_paciente: bool = False,
) -> dict[str, Any]:
    inicio_dt, fim_dt = _intervalo_local_agendamento(agendamento)
    data = str(agendamento.data or "").strip()
    hora = str(agendamento.hora or "").strip()
    if inicio_dt is not None:
        if not data:
            data = inicio_dt.date().isoformat()
        if not hora:
            hora = inicio_dt.strftime("%H:%M")

    duracao_minutos = None
    if inicio_dt is not None and fim_dt is not None and fim_dt > inicio_dt:
        duracao_minutos = int((fim_dt - inicio_dt).total_seconds() // 60)

    item: dict[str, Any] = {
        "agendamento_id": agendamento.id,
        "data": data or None,
        "inicio": hora or (inicio_dt.strftime("%H:%M") if inicio_dt else None),
        "fim": fim_dt.strftime("%H:%M") if fim_dt else None,
        "duracao_minutos": duracao_minutos,
        "status": agendamento.status,
        "conta_como_ancora": _status_conta_como_ancora(agendamento.status),
        "clinica": {
            "id": agendamento.clinica_id,
            "nome": clinica_nome or agendamento.clinica or "Clinica nao informada",
        },
        "servico": {
            "id": agendamento.servico_id,
            "nome": servico_nome or agendamento.servico or "",
        },
    }
    if incluir_paciente:
        item["paciente_primeiro_nome"] = _primeiro_nome_paciente_assistente(
            agendamento,
            paciente_nome=paciente_nome,
        )
    return item


def _incrementar_resumo_assistente(bucket: dict[str, int], key: Optional[Any]) -> None:
    key_txt = str(key or "nao_informado").strip() or "nao_informado"
    bucket[key_txt] = int(bucket.get(key_txt, 0)) + 1


def _clinicas_ativas_assistente(db: Session) -> list[dict[str, Any]]:
    clinicas = (
        db.query(Clinica)
        .filter(Clinica.ativo == True)  # noqa: E712
        .order_by(Clinica.nome.asc(), Clinica.id.asc())
        .all()
    )
    return [
        {
            "id": clinica.id,
            "nome": clinica.nome,
            "cidade": clinica.cidade,
            "estado": clinica.estado,
            "regiao_operacional": clinica.regiao_operacional,
        }
        for clinica in clinicas
    ]


def _servicos_ativos_assistente(db: Session) -> list[dict[str, Any]]:
    servicos = (
        db.query(Servico)
        .filter(Servico.ativo == True)  # noqa: E712
        .order_by(Servico.nome.asc(), Servico.id.asc())
        .all()
    )
    return [
        {
            "id": servico.id,
            "nome": servico.nome,
            "duracao_minutos": servico.duracao_minutos,
        }
        for servico in servicos
    ]


def _aplicar_filtros_lista_agenda(
    query,
    *,
    data_inicio: Optional[str],
    data_fim: Optional[str],
    status: Optional[str],
    clinica_id: Optional[int],
    servico_id: Optional[int],
    paciente_id: Optional[int],
    paciente_nome: Optional[str],
    tutor_nome: Optional[str],
    clinica_nome: Optional[str],
    servico_nome: Optional[str],
):
    # Filtra por coluna data (YYYY-MM-DD) para evitar drift de timezone entre navegador e servidor.
    data_inicio_filtro = _extract_date_filter(data_inicio)
    data_fim_filtro = _extract_date_filter(data_fim)
    if data_inicio_filtro:
        query = query.filter(Agendamento.data >= data_inicio_filtro)
    if data_fim_filtro:
        query = query.filter(Agendamento.data <= data_fim_filtro)
    if status:
        query = query.filter(Agendamento.status == status)
    if clinica_id:
        query = query.filter(Agendamento.clinica_id == clinica_id)
    if servico_id:
        query = query.filter(Agendamento.servico_id == servico_id)
    if paciente_id:
        query = query.filter(Agendamento.paciente_id == paciente_id)

    paciente_nome_filtro = _normalize_text_filter(paciente_nome)
    if paciente_nome_filtro:
        pattern = _build_contains_pattern(paciente_nome_filtro)
        query = query.filter(
            or_(
                Agendamento.paciente.ilike(pattern, escape="\\"),
                exists().where(Paciente.id == Agendamento.paciente_id).where(
                    Paciente.nome.ilike(pattern, escape="\\")
                ),
            )
        )

    tutor_nome_filtro = _normalize_text_filter(tutor_nome)
    if tutor_nome_filtro:
        pattern = _build_contains_pattern(tutor_nome_filtro)
        query = query.filter(
            or_(
                Agendamento.tutor.ilike(pattern, escape="\\"),
                exists()
                .where(Paciente.id == Agendamento.paciente_id)
                .where(Paciente.tutor_id == Tutor.id)
                .where(Tutor.nome.ilike(pattern, escape="\\")),
            )
        )

    clinica_nome_filtro = _normalize_text_filter(clinica_nome)
    if clinica_nome_filtro:
        pattern = _build_contains_pattern(clinica_nome_filtro)
        query = query.filter(
            or_(
                Agendamento.clinica.ilike(pattern, escape="\\"),
                exists().where(Clinica.id == Agendamento.clinica_id).where(
                    Clinica.nome.ilike(pattern, escape="\\")
                ),
            )
        )

    servico_nome_filtro = _normalize_text_filter(servico_nome)
    if servico_nome_filtro:
        pattern = _build_contains_pattern(servico_nome_filtro)
        query = query.filter(
            or_(
                Agendamento.servico.ilike(pattern, escape="\\"),
                exists().where(Servico.id == Agendamento.servico_id).where(
                    Servico.nome.ilike(pattern, escape="\\")
                ),
            )
        )

    return query


@router.get("", response_model=AgendamentoLista)
def listar_agendamentos(
    data_inicio: Optional[str] = None,
    data_fim: Optional[str] = None,
    status: Optional[str] = None,
    clinica_id: Optional[int] = None,
    servico_id: Optional[int] = None,
    paciente_id: Optional[int] = None,
    paciente_nome: Optional[str] = None,
    tutor_nome: Optional[str] = None,
    clinica_nome: Optional[str] = None,
    servico_nome: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Lista agendamentos com filtros e nomes dos relacionados"""
    query_ids = _aplicar_filtros_lista_agenda(
        db.query(Agendamento.id),
        data_inicio=data_inicio,
        data_fim=data_fim,
        status=status,
        clinica_id=clinica_id,
        servico_id=servico_id,
        paciente_id=paciente_id,
        paciente_nome=paciente_nome,
        tutor_nome=tutor_nome,
        clinica_nome=clinica_nome,
        servico_nome=servico_nome,
    )

    total = query_ids.order_by(None).count()
    ids_paginados = [
        row[0]
        for row in query_ids.order_by(Agendamento.inicio.asc(), Agendamento.id.asc()).offset(skip).limit(limit).all()
    ]

    results = []
    if ids_paginados:
        results = (
            _query_agendamentos_com_relacionados(db)
            .filter(Agendamento.id.in_(ids_paginados))
            .order_by(Agendamento.inicio.asc(), Agendamento.id.asc())
            .all()
        )

    items = [
        _serialize_agendamento(
            ag,
            paciente_nome=paciente_nome,
            clinica_nome=clinica_nome,
            servico_nome=servico_nome,
            tutor_nome=tutor_nome,
            tutor_telefone=tutor_telefone,
        )
        for ag, paciente_nome, clinica_nome, servico_nome, tutor_nome, tutor_telefone in results
    ]

    agenda_semanal, agenda_feriados, agenda_excecoes = _obter_regras_agenda(db)

    return {
        "total": total,
        "items": items,
        "agenda_semanal": agenda_semanal,
        "agenda_feriados": agenda_feriados,
        "agenda_excecoes": agenda_excecoes,
    }


def _calcular_previsao_agendamento(db: Session, agendamento: Agendamento) -> Decimal:
    if not agendamento.clinica_id or not agendamento.servico_id:
        return Decimal("0.00")

    try:
        return to_decimal(calcular_preco_servico(
            db=db,
            clinica_id=agendamento.clinica_id,
            servico_id=agendamento.servico_id,
            tipo_horario="comercial",
            usar_preco_clinica=True,
        ))
    except HTTPException as exc:
        logger.warning(
            "Resumo financeiro da agenda sem preco para agendamento %s (clinica=%s, servico=%s): %s",
            agendamento.id,
            agendamento.clinica_id,
            agendamento.servico_id,
            exc.detail,
        )
        return Decimal("0.00")
    except Exception:
        logger.exception(
            "Resumo financeiro da agenda falhou ao calcular previsao do agendamento %s",
            agendamento.id,
        )
        return Decimal("0.00")


@router.get("/resumo-financeiro")
def resumo_financeiro_agenda(
    data: Optional[str] = None,
    data_inicio: Optional[str] = None,
    data_fim: Optional[str] = None,
    clinica_id: Optional[int] = None,
    servico_id: Optional[int] = None,
    paciente_id: Optional[int] = None,
    paciente_nome: Optional[str] = None,
    tutor_nome: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Resumo financeiro da agenda para admin (realizado x agendado)."""
    if not current_user.tem_papel("admin"):
        raise HTTPException(status_code=403, detail="Apenas administradores podem acessar este resumo.")

    if data:
        inicio = _extract_date_filter(data)
        fim = inicio
    else:
        inicio = _extract_date_filter(data_inicio)
        fim = _extract_date_filter(data_fim)

    if not inicio:
        hoje = datetime.now(LOCAL_TZ).date().isoformat()
        inicio = hoje
    if not fim:
        fim = inicio

    query_agendamentos = _aplicar_filtros_lista_agenda(
        db.query(Agendamento),
        data_inicio=inicio,
        data_fim=fim,
        status=None,
        clinica_id=clinica_id,
        servico_id=servico_id,
        paciente_id=paciente_id,
        paciente_nome=paciente_nome,
        tutor_nome=tutor_nome,
        clinica_nome=None,
        servico_nome=None,
    )
    agendamentos = query_agendamentos.all()

    ids_agendamento = [ag.id for ag in agendamentos]
    mapa_os: dict[int, OrdemServico] = {}
    if ids_agendamento:
        ordens = (
            db.query(OrdemServico)
            .filter(
                OrdemServico.agendamento_id.in_(ids_agendamento),
                OrdemServico.status != "Cancelado",
            )
            .order_by(OrdemServico.id.desc())
            .all()
        )
        for os_data in ordens:
            if os_data.agendamento_id not in mapa_os:
                mapa_os[os_data.agendamento_id] = os_data

    valor_realizado = Decimal("0.00")
    valor_agendado = Decimal("0.00")
    qtd_realizados = 0
    qtd_agendados = 0

    for ag in agendamentos:
        os_vinculada = mapa_os.get(ag.id)
        valor_base = (
            to_decimal(os_vinculada.valor_final)
            if os_vinculada and os_vinculada.valor_final is not None
            else _calcular_previsao_agendamento(db, ag)
        )

        if ag.status == "Realizado":
            qtd_realizados += 1
            valor_realizado += valor_base
        elif ag.status in ("Agendado", "Reservado", "Confirmado", "Em atendimento"):
            qtd_agendados += 1
            valor_agendado += valor_base

    return {
        "data_inicio": inicio,
        "data_fim": fim,
        "qtd_realizados": qtd_realizados,
        "qtd_agendados": qtd_agendados,
        "valor_realizado": float(valor_realizado),
        "valor_agendado": float(valor_agendado),
    }


@router.get("/configuracao")
def obter_configuracao_agenda(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Retorna regras de funcionamento da agenda para qualquer usuario com acesso ao modulo Agenda.
    Evita depender de permissao do modulo Configuracoes apenas para ler horario de funcionamento.
    """
    config = db.query(Configuracao).first()
    agenda_semanal, agenda_feriados, agenda_excecoes = _obter_regras_agenda(db)
    agenda_rota_regras = _obter_regras_rota_agenda(db)

    return {
        "horario_comercial_inicio": getattr(config, "horario_comercial_inicio", "08:00") if config else "08:00",
        "horario_comercial_fim": getattr(config, "horario_comercial_fim", "18:00") if config else "18:00",
        "dias_trabalho": getattr(config, "dias_trabalho", "1,2,3,4,5") if config else "1,2,3,4,5",
        "agenda_semanal": agenda_semanal,
        "agenda_feriados": agenda_feriados,
        "agenda_excecoes": agenda_excecoes,
        "agenda_rota_regras": agenda_rota_regras,
    }


@router.get("/assistente/contexto")
def obter_contexto_assistente_agenda_readonly(
    request: Request,
    data_inicio: Optional[str] = None,
    data_fim: Optional[str] = None,
    status: Optional[str] = None,
    clinica_id: Optional[int] = None,
    servico_id: Optional[int] = None,
    incluir_paciente: bool = False,
    limit: int = 200,
    db: Session = Depends(get_db),
):
    """
    Contexto minimo e read-only da agenda para assistentes externos autorizados.

    A rota usa token dedicado e nao retorna telefone, tutor, observacoes, laudos,
    financeiro nem dados completos de paciente. Serve para o assistente entender
    disponibilidade, ancoras e regras operacionais sem ganhar capacidade de escrita.
    """
    _validar_acesso_assistente_agenda(request)
    if status and status not in AGENDA_STATUS_PERMITIDOS:
        raise HTTPException(
            status_code=422,
            detail=f"Status invalido. Use: {', '.join(AGENDA_STATUS_PERMITIDOS)}",
        )

    inicio, fim, total_dias = _resolver_periodo_assistente_agenda(data_inicio, data_fim)
    limit_eff = max(1, min(500, int(limit or 200)))

    query_ids = _aplicar_filtros_lista_agenda(
        db.query(Agendamento.id),
        data_inicio=inicio,
        data_fim=fim,
        status=status,
        clinica_id=clinica_id,
        servico_id=servico_id,
        paciente_id=None,
        paciente_nome=None,
        tutor_nome=None,
        clinica_nome=None,
        servico_nome=None,
    )
    total = query_ids.order_by(None).count()
    ids_paginados = [
        row[0]
        for row in query_ids.order_by(Agendamento.inicio.asc(), Agendamento.id.asc())
        .limit(limit_eff)
        .all()
    ]

    rows = []
    if ids_paginados:
        rows = (
            _query_agendamentos_com_relacionados(db)
            .filter(Agendamento.id.in_(ids_paginados))
            .order_by(Agendamento.inicio.asc(), Agendamento.id.asc())
            .all()
        )

    items: list[dict[str, Any]] = []
    por_data: dict[str, int] = {}
    por_status: dict[str, int] = {}
    por_clinica: dict[str, int] = {}
    for agendamento, paciente_nome, clinica_nome, servico_nome, _tutor_nome, _tutor_telefone in rows:
        item = _serialize_agendamento_assistente_readonly(
            agendamento,
            paciente_nome=paciente_nome,
            clinica_nome=clinica_nome,
            servico_nome=servico_nome,
            incluir_paciente=incluir_paciente,
        )
        items.append(item)
        _incrementar_resumo_assistente(por_data, item.get("data"))
        _incrementar_resumo_assistente(por_status, item.get("status"))
        clinica_item = item.get("clinica") if isinstance(item.get("clinica"), dict) else {}
        _incrementar_resumo_assistente(por_clinica, clinica_item.get("nome"))

    agenda_semanal, agenda_feriados, agenda_excecoes = _obter_regras_agenda(db)
    agenda_rota_regras = _obter_regras_rota_agenda(db)

    return {
        "ok": True,
        "contrato": {
            "modo": "read_only",
            "escopo": "agenda_operacional",
            "janela_maxima_dias": _obter_max_window_assistente_agenda(),
            "dados_excluidos": [
                "telefone",
                "tutor",
                "observacoes",
                "laudos",
                "financeiro",
                "dados_completos_paciente",
            ],
            "acoes_permitidas": [
                "consultar_ocupacao",
                "explicar_regras",
                "preparar_sugestoes",
                "pedir_confirmacao_humana",
            ],
            "acoes_bloqueadas": [
                "criar_agendamento",
                "editar_agendamento",
                "cancelar_agendamento",
                "consultar_contato_do_tutor",
            ],
        },
        "periodo": {
            "data_inicio": inicio,
            "data_fim": fim,
            "total_dias": total_dias,
        },
        "agenda": {
            "total": total,
            "limit": limit_eff,
            "truncado": total > len(items),
            "items": items,
            "resumo": {
                "por_data": por_data,
                "por_status": por_status,
                "por_clinica": por_clinica,
            },
        },
        "catalogos": {
            "clinicas_ativas": _clinicas_ativas_assistente(db),
            "servicos_ativos": _servicos_ativos_assistente(db),
        },
        "regras": {
            "fonte": "configuracoes",
            "status_permitidos": AGENDA_STATUS_PERMITIDOS,
            "status_que_contam_como_ancora": [
                status_item
                for status_item in AGENDA_STATUS_PERMITIDOS
                if _status_conta_como_ancora(status_item)
            ],
            "agenda_semanal": agenda_semanal,
            "agenda_feriados": agenda_feriados,
            "agenda_excecoes": agenda_excecoes,
            "agenda_rota_regras": agenda_rota_regras,
        },
        "assistente_guiado": {
            "regra_geral": (
                "Use as mesmas regras de janela operacional, feriados, excecoes, "
                "ancoras por clinica e politica de oferta por rota/frequencia antes "
                "de sugerir horarios."
            ),
            "referencias_backend": {
                "orquestrador_ofertas": "POST /api/v1/agenda/assistente/ofertas",
                "sugestao_proximidade": "POST /api/v1/agenda/sugestao-proximidade",
                "panorama_horarios": "POST /api/v1/agenda/sugestoes-horario",
                "encerramento_sem_agendamento": "POST /api/v1/agenda/assistente/encerramento",
            },
            "orientacao_operacional": [
                "Nunca confirme agendamento sozinho; apresente sugestoes e peca validacao humana.",
                "Priorize slots aderentes a rota e frequencia configuradas.",
                "Quando nao houver oferta aderente, registre a necessidade de excecao ou encaminhe para humano.",
                "Nao use dados pessoais fora do minimo necessario para localizar ocupacao da agenda.",
            ],
        },
    }


@router.get("/hoje", response_model=AgendamentoLista)
def agendamentos_hoje(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Lista agendamentos de hoje"""
    hoje_str = datetime.now().strftime("%Y-%m-%d")
    results = (
        _query_agendamentos_com_relacionados(db)
        .filter(Agendamento.data == hoje_str)
        .order_by(Agendamento.inicio.asc(), Agendamento.id.asc())
        .all()
    )
    items = [
        _serialize_agendamento(
            agendamento,
            paciente_nome=paciente_nome,
            clinica_nome=clinica_nome,
            servico_nome=servico_nome,
            tutor_nome=tutor_nome,
            tutor_telefone=tutor_telefone,
        )
        for agendamento, paciente_nome, clinica_nome, servico_nome, tutor_nome, tutor_telefone in results
    ]
    return {"total": len(items), "items": items}


@router.get("/stream")
async def stream_agenda(
    request: Request,
    current_user: User = Depends(get_current_user),
):
    """Canal SSE para atualizacao em tempo real da agenda."""
    subscriber = agenda_realtime_manager.subscribe()

    async def event_generator():
        connected_payload = {
            "type": "connected",
            "module": "agenda",
            "user_id": current_user.id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        yield f"event: connected\ndata: {json.dumps(connected_payload, ensure_ascii=False)}\n\n"

        try:
            while True:
                if await request.is_disconnected():
                    break

                try:
                    payload = await asyncio.to_thread(subscriber.get, True, 15)
                    yield f"event: agenda_update\ndata: {payload}\n\n"
                except Empty:
                    # keep-alive
                    yield "event: ping\ndata: {}\n\n"
        finally:
            agenda_realtime_manager.unsubscribe(subscriber)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/sugestoes-horario")
def sugerir_horarios_agenda(
    payload: SugestaoHorarioPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Sugere horarios operacionais considerando conflito de agenda e deslocamento entre clinicas."""
    data_iso = _extract_date_filter(payload.data)
    if not data_iso:
        raise HTTPException(status_code=422, detail="Data invalida. Use o formato YYYY-MM-DD.")
    hoje_local_iso = datetime.now(LOCAL_TZ).date().isoformat()
    if data_iso < hoje_local_iso:
        return {
            "ok": True,
            "data": data_iso,
            "clinica_id": payload.clinica_id,
            "duracao_minutos": max(5, int(payload.duracao_minutos or 30)),
            "perfil_deslocamento": normalizar_perfil(payload.perfil_deslocamento),
            "motivo": "Nao sugerimos horarios para datas passadas. Selecione hoje ou uma data futura.",
            "total_encontrados": 0,
            "items": [],
        }

    clinica_base = db.query(Clinica).filter(Clinica.id == payload.clinica_id).first()
    if not clinica_base:
        raise HTTPException(status_code=404, detail="Clinica nao encontrada.")
    regras_rota = _obter_regras_rota_agenda(db)
    thresholds = regras_rota.get("thresholds") if isinstance(regras_rota.get("thresholds"), dict) else {}
    route_policy = regras_rota.get("route_policy") if isinstance(regras_rota.get("route_policy"), dict) else {}
    base_cfg = regras_rota.get("base") if isinstance(regras_rota.get("base"), dict) else {}

    duracao_minutos = int(payload.duracao_minutos or 0)
    duracao_fallback = max(5, duracao_minutos if duracao_minutos > 0 else 30)
    # Fonte de verdade: quando houver servico selecionado, usa sempre a duracao cadastrada.
    duracao_minutos = _resolver_duracao_servico(
        db,
        servico_id=payload.servico_id,
        fallback_minutos=duracao_fallback,
    )

    janela_inicio, janela_fim, motivo_fechado = _obter_janela_funcionamento_data(db, data_iso)
    if janela_inicio is None or janela_fim is None:
        return {
            "ok": True,
            "data": data_iso,
            "clinica_id": payload.clinica_id,
            "duracao_minutos": duracao_minutos,
            "perfil_deslocamento": normalizar_perfil(payload.perfil_deslocamento),
            "motivo": motivo_fechado or "Sem janela valida para sugerir horarios.",
            "total_encontrados": 0,
            "items": [],
        }

    agendamentos_dia_todos = _listar_agendamentos_ativos_do_dia(
        db,
        data_iso,
        agendamento_id_excluir=payload.ignorar_agendamento_id,
    )
    agendamentos_dia = _filtrar_agendamentos_por_janela_funcionamento(
        db,
        agendamentos_dia_todos,
        cache_janelas={data_iso: (janela_inicio, janela_fim, None)},
    )
    ancoras_mesma_clinica_inicio = sorted(
        [
            item["inicio"]
            for item in agendamentos_dia
            if int(item.get("clinica_id") or 0) == int(payload.clinica_id or 0)
            and _status_conta_como_ancora(item.get("status"))
        ]
    )
    perfil_norm = normalizar_perfil(payload.perfil_deslocamento)
    intervalo_minutos = max(5, int(payload.intervalo_minutos))
    margem_segura_min = int(thresholds.get("safe_margin_min") or MIN_MARGEM_SEGURA_DESLOCAMENTO_MIN)
    limite_desvio_insercao = int(thresholds.get("max_insertion_detour_min") or 25)
    limite_proximo_base_min = int(thresholds.get("nearby_anchor_max_travel_min") or 20)
    janela_fim_rota_min = _hora_hhmm_para_minutos(
        route_policy.get("end_of_route_window_start"),
        fallback=16 * 60,
    )
    preferir_base_fim_rota = bool(route_policy.get("prefer_near_base_at_end_of_route", True))
    bonus_base_score = abs(int(route_policy.get("bonus_near_base_score") or 15))
    penalty_far_score = int(route_policy.get("penalty_far_base_score") or 10)
    bloquear_ineficiencia = bool(route_policy.get("reject_clear_inefficiency", True))
    tempo_ate_base_min = _tempo_estimado_clinica_ate_base_min(
        clinica_base,
        base_lat=base_cfg.get("lat"),
        base_lng=base_cfg.get("lng"),
        perfil_deslocamento=perfil_norm,
    )
    cache_duracoes: dict[tuple[int, int, str, bool], tuple[int, str]] = {}

    sugestoes: list[dict] = []
    inicio_candidato = janela_inicio
    agora_local = datetime.now(LOCAL_TZ).replace(tzinfo=None)
    if janela_inicio.date() == agora_local.date():
        # Nunca sugerir slots retroativos no dia atual.
        lead_time_min = max(1, margem_segura_min)
        inicio_minimo_hoje = _arredondar_para_proximo_slot(
            agora_local + timedelta(minutes=lead_time_min),
            intervalo_minutos,
        )
        if inicio_minimo_hoje > inicio_candidato:
            inicio_candidato = inicio_minimo_hoje
    while inicio_candidato < janela_fim:
        fim_candidato = inicio_candidato + timedelta(minutes=duracao_minutos)
        if fim_candidato > janela_fim:
            break

        conflita = any(
            inicio_candidato < item["fim"] and fim_candidato > item["inicio"]
            for item in agendamentos_dia_todos
        )
        if conflita:
            inicio_candidato += timedelta(minutes=intervalo_minutos)
            continue

        # Para validar deslocamento operacional, os vizinhos devem considerar toda a agenda ativa do dia.
        # Isso evita ofertar slots que "cabem" na janela configurada, mas conflitam com atendimentos
        # reais registrados fora da janela (legado/excecoes operacionais).
        anterior, proximo = _obter_vizinhos_horario(agendamentos_dia_todos, inicio_candidato, fim_candidato)

        tempo_prev = 0
        tempo_next = 0
        folga_prev = None
        folga_next = None
        fonte_prev = "indefinido"
        fonte_next = "indefinido"

        if anterior and anterior.get("clinica_id"):
            tempo_prev, fonte_prev = _obter_duracao_deslocamento_cacheado(
                db,
                origem_clinica_id=anterior.get("clinica_id"),
                destino_clinica_id=payload.clinica_id,
                perfil=perfil_norm,
                cache=cache_duracoes,
            )
            folga_prev = _minutos_entre(anterior["fim"], inicio_candidato)
            if tempo_prev > 0 and folga_prev < (tempo_prev + margem_segura_min):
                inicio_candidato += timedelta(minutes=intervalo_minutos)
                continue

        if proximo and proximo.get("clinica_id"):
            tempo_next, fonte_next = _obter_duracao_deslocamento_cacheado(
                db,
                origem_clinica_id=payload.clinica_id,
                destino_clinica_id=proximo.get("clinica_id"),
                perfil=perfil_norm,
                cache=cache_duracoes,
            )
            folga_next = _minutos_entre(fim_candidato, proximo["inicio"])
            if tempo_next > 0 and folga_next < (tempo_next + margem_segura_min):
                inicio_candidato += timedelta(minutes=intervalo_minutos)
                continue

        if (
            bloquear_ineficiencia
            and limite_desvio_insercao > 0
            and anterior
            and anterior.get("clinica_id")
            and proximo
            and proximo.get("clinica_id")
            and tempo_prev > 0
            and tempo_next > 0
        ):
            duracao_direta, _fonte_direta = _obter_duracao_deslocamento_cacheado(
                db,
                origem_clinica_id=anterior.get("clinica_id"),
                destino_clinica_id=proximo.get("clinica_id"),
                perfil=perfil_norm,
                cache=cache_duracoes,
            )
            if duracao_direta > 0:
                desvio_insercao = max(0, int((tempo_prev + tempo_next) - duracao_direta))
                if desvio_insercao > limite_desvio_insercao:
                    inicio_candidato += timedelta(minutes=intervalo_minutos)
                    continue

        margem_prev = (folga_prev - tempo_prev) if folga_prev is not None else None
        margem_next = (folga_next - tempo_next) if folga_next is not None else None
        ociosidade_min = max(0, margem_prev or 0) + max(0, margem_next or 0)

        preferencia_ancora_ordem = 1
        espera_ancora_min = 999999
        if ancoras_mesma_clinica_inicio:
            esperas_validas = []
            for inicio_ancora in ancoras_mesma_clinica_inicio:
                alvo_ancora = inicio_ancora + timedelta(minutes=60)
                if inicio_candidato >= alvo_ancora:
                    esperas_validas.append(_minutos_entre(alvo_ancora, inicio_candidato))
            if esperas_validas:
                preferencia_ancora_ordem = 0
                espera_ancora_min = min(esperas_validas)
            else:
                # Quando existe ancora na mesma clinica, manter candidatos anteriores
                # como fallback, mas abaixo das opcoes apos ancora+60.
                preferencia_ancora_ordem = 2

        risco = 0
        if margem_prev is not None and margem_prev < margem_segura_min:
            risco += 1
        if margem_next is not None and margem_next < margem_segura_min:
            risco += 1

        tempo_deslocamento_total = tempo_prev + tempo_next
        score = round((tempo_deslocamento_total * 1.0) + (ociosidade_min * 0.2) + (risco * 20.0), 2)
        horario_min = (inicio_candidato.hour * 60) + inicio_candidato.minute
        fim_rota = horario_min >= janela_fim_rota_min
        ajuste_base_score = 0
        if preferir_base_fim_rota and fim_rota and tempo_ate_base_min is not None:
            if tempo_ate_base_min <= limite_proximo_base_min:
                ajuste_base_score -= bonus_base_score
            else:
                ajuste_base_score += penalty_far_score
        score = round(score + ajuste_base_score, 2)

        sugestoes.append(
            {
                "inicio": inicio_candidato.strftime("%Y-%m-%d %H:%M"),
                "fim": fim_candidato.strftime("%Y-%m-%d %H:%M"),
                "score": score,
                "risco": risco,
                "preferencia_ancora_ordem": preferencia_ancora_ordem,
                "espera_ancora_min": espera_ancora_min if preferencia_ancora_ordem == 0 else None,
                "fim_rota": bool(fim_rota),
                "tempo_ate_base_min": tempo_ate_base_min,
                "ajuste_base_score": ajuste_base_score,
                "tempo_deslocamento_total_min": tempo_deslocamento_total,
                "ociosidade_min": ociosidade_min,
                "anterior": (
                    {
                        "agendamento_id": anterior.get("id"),
                        "clinica_id": anterior.get("clinica_id"),
                        "clinica": anterior.get("clinica_nome") or _nome_clinica_por_id(db, anterior.get("clinica_id")),
                        "fim": anterior["fim"].strftime("%Y-%m-%d %H:%M"),
                        "duracao_deslocamento_min": tempo_prev,
                        "folga_min": folga_prev,
                        "margem_min": margem_prev,
                        "fonte": fonte_prev,
                    }
                    if anterior
                    else None
                ),
                "proximo": (
                    {
                        "agendamento_id": proximo.get("id"),
                        "clinica_id": proximo.get("clinica_id"),
                        "clinica": proximo.get("clinica_nome") or _nome_clinica_por_id(db, proximo.get("clinica_id")),
                        "inicio": proximo["inicio"].strftime("%Y-%m-%d %H:%M"),
                        "duracao_deslocamento_min": tempo_next,
                        "folga_min": folga_next,
                        "margem_min": margem_next,
                        "fonte": fonte_next,
                    }
                    if proximo
                    else None
                ),
            }
        )

        inicio_candidato += timedelta(minutes=intervalo_minutos)

    sugestoes.sort(
        key=lambda item: (
            int(item.get("preferencia_ancora_ordem", 1)),
            (
                int(item.get("espera_ancora_min"))
                if item.get("espera_ancora_min") is not None
                else 999999
            ),
            item["score"],
            item["risco"],
            item["inicio"],
        )
    )
    limite = max(1, min(50, int(payload.limite)))
    top_items = sugestoes[:limite]
    motivo_sem_item = None
    if not top_items and data_iso == agora_local.date().isoformat():
        motivo_sem_item = "Nao ha horarios futuros disponiveis para hoje dentro da janela da agenda."

    return {
        "ok": True,
        "data": data_iso,
        "clinica_id": payload.clinica_id,
        "duracao_minutos": duracao_minutos,
        "perfil_deslocamento": perfil_norm,
        "intervalo_minutos": intervalo_minutos,
        "regras_aplicadas": {
            "safe_margin_min": margem_segura_min,
            "max_insertion_detour_min": limite_desvio_insercao,
            "nearby_anchor_max_travel_min": limite_proximo_base_min,
            "end_of_route_window_start": route_policy.get("end_of_route_window_start", "16:00"),
            "prefer_near_base_at_end_of_route": preferir_base_fim_rota,
            "tempo_ate_base_min": tempo_ate_base_min,
        },
        "janela": {
            "inicio": janela_inicio.strftime("%Y-%m-%d %H:%M"),
            "fim": janela_fim.strftime("%Y-%m-%d %H:%M"),
        },
        "motivo": motivo_sem_item,
        "total_encontrados": len(sugestoes),
        "items": top_items,
    }


@router.post("/sugestao-proximidade")
def sugerir_agendamento_proximo(
    payload: SugestaoProximidadePayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Sugere aproveitamento de agenda existente em clinica proxima."""
    clinica_base = db.query(Clinica).filter(Clinica.id == payload.clinica_id).first()
    if not clinica_base:
        raise HTTPException(status_code=404, detail="Clinica nao encontrada.")
    clinica_destino_nome = _nome_clinica_legivel(clinica_base.nome)
    regras_rota = _obter_regras_rota_agenda(db)
    thresholds = regras_rota.get("thresholds") if isinstance(regras_rota.get("thresholds"), dict) else {}
    limite_proximidade_default = int(thresholds.get("nearby_anchor_max_travel_min") or 20)

    data_iso = _extract_date_filter(payload.data) if payload.data else datetime.now().strftime("%Y-%m-%d")
    if not data_iso:
        raise HTTPException(status_code=422, detail="Data invalida. Use o formato YYYY-MM-DD.")
    hoje_local_iso = datetime.now(LOCAL_TZ).date().isoformat()
    if data_iso < hoje_local_iso:
        return {
            "ok": True,
            "data": data_iso,
            "clinica_id": payload.clinica_id,
            "sugerir": False,
            "limite_minutos": limite_proximidade_default,
            "itens_ignorados_janela": 0,
            "politica_oferta": {
                "data_contato": None,
                "datas_preferenciais": [],
            },
            "mensagem": "Nao sugerimos horarios para datas passadas. Selecione hoje ou uma data futura.",
            "item": None,
        }

    data_contato_iso = (
        _extract_date_filter(payload.data_contato)
        if payload.data_contato
        else datetime.now(LOCAL_TZ).date().isoformat()
    )
    if not data_contato_iso:
        data_contato_iso = datetime.now(LOCAL_TZ).date().isoformat()
    try:
        data_contato_ref = datetime.strptime(data_contato_iso, "%Y-%m-%d").date()
    except ValueError:
        data_contato_ref = datetime.now(LOCAL_TZ).date()

    data_ref = datetime.strptime(data_iso, "%Y-%m-%d").date()
    agora_local = datetime.now(LOCAL_TZ).replace(tzinfo=None)
    janela_dias = int(payload.janela_dias_proximidade or 7)
    limite_minutos_payload = int(payload.limite_minutos or 0)
    limite_minutos = limite_minutos_payload
    if limite_minutos_payload == 25:
        limite_minutos = limite_proximidade_default
    if limite_minutos <= 0:
        limite_minutos = limite_proximidade_default

    politica_oferta = _classificar_politica_oferta(
        db,
        clinica_id=payload.clinica_id,
        data_contato_iso=data_contato_iso,
        perfil_deslocamento=payload.perfil_deslocamento,
        regras_rota=regras_rota,
        agendamento_id_excluir=payload.ignorar_agendamento_id,
    )
    datas_preferenciais = [
        (
            datetime.strptime(data_contato_iso, "%Y-%m-%d").date() + timedelta(days=int(dia))
        ).isoformat()
        for dia in politica_oferta.get("dias_preferenciais", [])
    ]
    datas_preferenciais_dt = [
        datetime.strptime(data_item, "%Y-%m-%d").date() for data_item in datas_preferenciais
    ]
    datas_preferenciais_set = set(datas_preferenciais)
    politica_distante_baixa = bool(politica_oferta.get("distante_base")) and bool(
        politica_oferta.get("baixa_frequencia")
    )
    exigir_data_preferencial = politica_distante_baixa and not bool(politica_oferta.get("ancora_d2"))

    data_inicio_busca = (data_ref - timedelta(days=janela_dias)).strftime("%Y-%m-%d")
    data_fim_busca = (data_ref + timedelta(days=janela_dias)).strftime("%Y-%m-%d")

    agendamentos_periodo = _listar_agendamentos_ativos_periodo(
        db,
        data_inicio_busca,
        data_fim_busca,
        agendamento_id_excluir=payload.ignorar_agendamento_id,
    )
    total_agendamentos_periodo = len(agendamentos_periodo)
    agendamentos_periodo = _filtrar_agendamentos_por_janela_funcionamento(
        db,
        agendamentos_periodo,
    )
    itens_ignorados_janela = max(0, total_agendamentos_periodo - len(agendamentos_periodo))
    cache_clinicas: dict[int, Optional[Clinica]] = {}
    cache_slots_operacionais_por_data: dict[str, list[dict[str, Any]]] = {}
    melhor_item: Optional[dict] = None
    melhor_tempo: Optional[int] = None
    melhor_rank = None

    def _obter_slots_operacionais_data(data_busca_iso: str) -> list[dict[str, Any]]:
        if data_busca_iso in cache_slots_operacionais_por_data:
            return cache_slots_operacionais_por_data[data_busca_iso]

        payload_sugestoes = SugestaoHorarioPayload(
            data=data_busca_iso,
            clinica_id=payload.clinica_id,
            servico_id=payload.servico_id,
            duracao_minutos=payload.duracao_minutos,
            intervalo_minutos=payload.intervalo_minutos,
            limite=payload.limite_sugestoes_operacionais,
            perfil_deslocamento=payload.perfil_deslocamento,
            ignorar_agendamento_id=payload.ignorar_agendamento_id,
        )
        resposta_sugestoes = sugerir_horarios_agenda(
            payload=payload_sugestoes,
            db=db,
            current_user=current_user,
        )
        slots = resposta_sugestoes.get("items") if isinstance(resposta_sugestoes, dict) else None
        slots_lista = slots if isinstance(slots, list) else []
        cache_slots_operacionais_por_data[data_busca_iso] = slots_lista
        return slots_lista

    def _slot_referencia_ancora(slot: dict[str, Any], agendamento_id_ancora: int) -> bool:
        if agendamento_id_ancora <= 0:
            return False
        anterior = slot.get("anterior") if isinstance(slot, dict) else None
        proximo = slot.get("proximo") if isinstance(slot, dict) else None
        anterior_id = int((anterior or {}).get("agendamento_id") or 0)
        proximo_id = int((proximo or {}).get("agendamento_id") or 0)
        return anterior_id == agendamento_id_ancora or proximo_id == agendamento_id_ancora

    for item in agendamentos_periodo:
        inicio_item = item.get("inicio")
        if inicio_item is None:
            continue

        status_item = (str(item.get("status") or "").strip() or "Agendado")
        if not _status_conta_como_ancora(status_item):
            continue

        # Nao sugerir ancora em horario passado, inclusive quando a data-base for hoje.
        # Isso evita mensagens contraditorias (proximidade sugerindo slot ja vencido).
        if inicio_item < agora_local:
            continue

        data_item_iso = inicio_item.date().isoformat()
        if exigir_data_preferencial and data_item_iso not in datas_preferenciais_set:
            continue

        slots_operacionais_data = _obter_slots_operacionais_data(data_item_iso)
        if not slots_operacionais_data:
            continue

        agendamento_ancora_id = int(item.get("id") or 0)
        if agendamento_ancora_id > 0:
            possui_slot_aderente = any(
                _slot_referencia_ancora(slot, agendamento_ancora_id) for slot in slots_operacionais_data
            )
            if not possui_slot_aderente:
                continue

        clinica_item_id = int(item.get("clinica_id") or 0)
        if clinica_item_id <= 0:
            continue
        if clinica_item_id == payload.clinica_id and not payload.incluir_mesma_clinica:
            continue

        slots_aderentes = (
            [slot for slot in slots_operacionais_data if _slot_referencia_ancora(slot, agendamento_ancora_id)]
            if agendamento_ancora_id > 0
            else list(slots_operacionais_data)
        )
        if not slots_aderentes:
            continue

        for slot in slots_aderentes:
            if not isinstance(slot, dict):
                continue

            inicio_slot_raw = str(slot.get("inicio") or "").strip()
            fim_slot_raw = str(slot.get("fim") or "").strip()
            if not inicio_slot_raw:
                continue

            try:
                inicio_slot = datetime.strptime(inicio_slot_raw, "%Y-%m-%d %H:%M")
            except ValueError:
                continue

            data_slot_iso = inicio_slot.strftime("%Y-%m-%d")
            if exigir_data_preferencial and data_slot_iso not in datas_preferenciais_set:
                continue
            if inicio_slot < agora_local:
                continue

            anterior_slot = slot.get("anterior") if isinstance(slot.get("anterior"), dict) else {}
            proximo_slot = slot.get("proximo") if isinstance(slot.get("proximo"), dict) else {}
            clinica_anterior_nome = str((anterior_slot or {}).get("clinica") or "").strip()
            clinica_posterior_nome = str((proximo_slot or {}).get("clinica") or "").strip()
            ha_agendamento_anterior = bool((anterior_slot or {}).get("agendamento_id") or clinica_anterior_nome)
            ha_agendamento_posterior = bool((proximo_slot or {}).get("agendamento_id") or clinica_posterior_nome)
            duracao_anterior = max(0, int((anterior_slot or {}).get("duracao_deslocamento_min") or 0))
            duracao_proximo = max(0, int((proximo_slot or {}).get("duracao_deslocamento_min") or 0))
            duracao_total = duracao_anterior + duracao_proximo

            if duracao_total <= 0:
                # Fallback para manter compatibilidade com payloads antigos sem vizinhos detalhados.
                duracao_total = max(0, int(slot.get("tempo_deslocamento_total_min") or 0))

            fonte_anterior = str((anterior_slot or {}).get("fonte") or "").strip()
            fonte_proximo = str((proximo_slot or {}).get("fonte") or "").strip()
            if duracao_anterior > 0 and duracao_proximo > 0:
                fonte = f"anterior:{fonte_anterior or 'indefinido'}|proximo:{fonte_proximo or 'indefinido'}"
            elif duracao_anterior > 0:
                fonte = f"anterior:{fonte_anterior or 'indefinido'}"
            elif duracao_proximo > 0:
                fonte = f"proximo:{fonte_proximo or 'indefinido'}"
            else:
                if clinica_item_id == payload.clinica_id:
                    fonte = "mesma_clinica"
                elif _clinicas_mesma_cidade_uf(
                    db,
                    clinica_a_id=payload.clinica_id,
                    clinica_b_id=clinica_item_id,
                    cache=cache_clinicas,
                ):
                    fonte = "fallback_mesma_cidade"
                else:
                    fonte = "sem_vizinhos"

            rank = (
                int(duracao_total),
                abs((inicio_slot.date() - data_ref).days),
                0 if data_slot_iso in datas_preferenciais_set else 1,
                (
                    min(abs((inicio_slot.date() - data_pref).days) for data_pref in datas_preferenciais_dt)
                    if datas_preferenciais_dt
                    else 0
                ),
                inicio_slot,
                int(item.get("id") or 0),
            )
            if melhor_rank is None or rank < melhor_rank:
                melhor_rank = rank
                melhor_tempo = int(duracao_total)
                melhor_item = {
                    "agendamento_id": item.get("id"),
                    "clinica_id": clinica_item_id,
                    "clinica": item.get("clinica_nome") or _nome_clinica_por_id(db, clinica_item_id),
                    "data": data_slot_iso,
                    "inicio": inicio_slot.strftime("%H:%M"),
                    "fim": fim_slot_raw.split(" ")[1] if " " in fim_slot_raw else (fim_slot_raw or None),
                    "duracao_deslocamento_min": duracao_total,
                    "tempo_deslocamento_total_min": duracao_total,
                    "duracao_deslocamento_anterior_min": duracao_anterior,
                    "duracao_deslocamento_proximo_min": duracao_proximo,
                    "clinica_destino": clinica_destino_nome,
                    "clinica_anterior": clinica_anterior_nome or None,
                    "clinica_posterior": clinica_posterior_nome or None,
                    "ha_agendamento_anterior": ha_agendamento_anterior,
                    "ha_agendamento_posterior": ha_agendamento_posterior,
                    "fonte_deslocamento": fonte,
                    "status": status_item,
                    "data_preferencial": data_slot_iso in datas_preferenciais_set,
                }

    if melhor_item is None or melhor_tempo is None:
        mensagem_base = "Nao encontramos agenda proxima para sugestao automatica dentro da janela configurada."
        if politica_distante_baixa and datas_preferenciais:
            dias_relativos = ", ".join(
                [
                    f"D+{(datetime.strptime(item, '%Y-%m-%d').date() - data_contato_ref).days}"
                    for item in datas_preferenciais
                ]
            )
            if dias_relativos:
                mensagem_base = (
                    f"{mensagem_base} Politica da clinica: priorizar {dias_relativos} e usar D+2 apenas com atendimento proximo."
                )
        if itens_ignorados_janela > 0:
            mensagem_base = (
                f"{mensagem_base} {itens_ignorados_janela} agendamento(s) foram ignorados por estarem "
                "fora da janela operacional ou em data fechada."
            )
        return {
            "ok": True,
            "data": data_iso,
            "clinica_id": payload.clinica_id,
            "sugerir": False,
            "limite_minutos": limite_minutos,
            "itens_ignorados_janela": itens_ignorados_janela,
            "politica_oferta": {
                **politica_oferta,
                "data_contato": data_contato_iso,
                "datas_preferenciais": datas_preferenciais,
            },
            "mensagem": mensagem_base,
            "item": None,
        }

    if melhor_tempo > limite_minutos:
        data_item = str(melhor_item.get("data") or data_iso)
        data_item_legivel = _formatar_data_com_semana_pt(data_item)
        detalhe_deslocamento = _detalhar_deslocamento_por_clinicas(
            clinica_destino=melhor_item.get("clinica_destino") or clinica_destino_nome,
            clinica_anterior=melhor_item.get("clinica_anterior"),
            clinica_posterior=melhor_item.get("clinica_posterior"),
            duracao_anterior_min=melhor_item.get("duracao_deslocamento_anterior_min"),
            duracao_posterior_min=melhor_item.get("duracao_deslocamento_proximo_min"),
            total_min=melhor_tempo,
            ha_agendamento_anterior=bool(melhor_item.get("ha_agendamento_anterior")),
            ha_agendamento_posterior=bool(melhor_item.get("ha_agendamento_posterior")),
        )
        mensagem_limite = (
            f"Opcao mais proxima encontrada na data {data_item_legivel} as {melhor_item.get('inicio')} "
            f"proximo ao atendimento na clinica {_nome_clinica_legivel(melhor_item.get('clinica'))}. "
            f"{detalhe_deslocamento} O deslocamento total estimado ({melhor_tempo} min) "
            f"esta acima do limite configurado de {limite_minutos} min."
        )
        return {
            "ok": True,
            "data": data_iso,
            "clinica_id": payload.clinica_id,
            "sugerir": False,
            "limite_minutos": limite_minutos,
            "itens_ignorados_janela": itens_ignorados_janela,
            "politica_oferta": {
                **politica_oferta,
                "data_contato": data_contato_iso,
                "datas_preferenciais": datas_preferenciais,
            },
            "mensagem": mensagem_limite,
            "item": None,
            "item_rejeitado": melhor_item,
            "acima_do_limite": True,
        }

    data_item = str(melhor_item.get("data") or data_iso)
    data_item_legivel = _formatar_data_com_semana_pt(data_item)
    detalhe_deslocamento = _detalhar_deslocamento_por_clinicas(
        clinica_destino=melhor_item.get("clinica_destino") or clinica_destino_nome,
        clinica_anterior=melhor_item.get("clinica_anterior"),
        clinica_posterior=melhor_item.get("clinica_posterior"),
        duracao_anterior_min=melhor_item.get("duracao_deslocamento_anterior_min"),
        duracao_posterior_min=melhor_item.get("duracao_deslocamento_proximo_min"),
        total_min=melhor_tempo,
        ha_agendamento_anterior=bool(melhor_item.get("ha_agendamento_anterior")),
        ha_agendamento_posterior=bool(melhor_item.get("ha_agendamento_posterior")),
    )
    if int(melhor_item.get("clinica_id") or 0) == payload.clinica_id:
        mensagem = (
            f"Encontramos horario livre na data {data_item_legivel} as {melhor_item['inicio']} "
            f"na clinica {_nome_clinica_legivel(melhor_item.get('clinica_destino') or clinica_destino_nome)}. "
            f"{detalhe_deslocamento} "
            "Sugira esse horario para o cliente e confirme a disponibilidade."
        )
    else:
        mensagem = (
            f"Encontramos horario livre na data {data_item_legivel} as {melhor_item['inicio']} "
            f"proximo ao atendimento na clinica {_nome_clinica_legivel(melhor_item.get('clinica'))}. "
            f"{detalhe_deslocamento} "
            "Sugira esse horario para o cliente e confirme a disponibilidade."
        )
    if politica_oferta.get("distante_base") and politica_oferta.get("baixa_frequencia"):
        dias_txt = ", ".join([f"D+{int(dia)}" for dia in politica_oferta.get("dias_preferenciais", [])])
        if dias_txt:
            mensagem = (
                f"{mensagem} Politica recomendada para esta clinica: priorizar {dias_txt} "
                "quando nao houver atendimento proximo em D+2."
            )
    if datas_preferenciais and not bool(melhor_item.get("data_preferencial")):
        mensagem = (
            f"{mensagem} Observacao: o horario sugerido ficou fora das datas preferenciais "
            f"({', '.join(datas_preferenciais)})."
        )
    return {
        "ok": True,
        "data": data_iso,
        "clinica_id": payload.clinica_id,
        "sugerir": True,
        "limite_minutos": limite_minutos,
        "itens_ignorados_janela": itens_ignorados_janela,
        "politica_oferta": {
            **politica_oferta,
            "data_contato": data_contato_iso,
            "datas_preferenciais": datas_preferenciais,
        },
        "mensagem": mensagem,
        "item": melhor_item,
    }


@router.post("/assistente/ofertas")
def orquestrar_ofertas_assistente(
    payload: AssistenteOfertaPayload,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Orquestra politica de oferta + sugestao de proximidade + panorama de horarios em resposta unica."""
    data_referencia = _extract_date_filter(payload.data) if payload.data else datetime.now(LOCAL_TZ).date().isoformat()
    if not data_referencia:
        raise HTTPException(status_code=422, detail="Data invalida. Use o formato YYYY-MM-DD.")
    try:
        data_referencia_ref = datetime.strptime(data_referencia, "%Y-%m-%d").date()
    except ValueError:
        data_referencia_ref = datetime.now(LOCAL_TZ).date()
    data_contato = (
        _extract_date_filter(payload.data_contato)
        if payload.data_contato
        else datetime.now(LOCAL_TZ).date().isoformat()
    )
    if not data_contato:
        data_contato = datetime.now(LOCAL_TZ).date().isoformat()

    resposta_proximidade = sugerir_agendamento_proximo(
        payload=SugestaoProximidadePayload(
            clinica_id=payload.clinica_id,
            data=data_referencia,
            data_contato=data_contato,
            servico_id=payload.servico_id,
            duracao_minutos=payload.duracao_minutos,
            intervalo_minutos=payload.intervalo_minutos,
            limite_sugestoes_operacionais=payload.limite,
            perfil_deslocamento=payload.perfil_deslocamento,
            limite_minutos=payload.limite_minutos,
            ignorar_agendamento_id=payload.ignorar_agendamento_id,
            incluir_mesma_clinica=payload.incluir_mesma_clinica,
            janela_dias_proximidade=payload.janela_dias_proximidade,
        ),
        db=db,
        current_user=current_user,
    )

    politica_oferta = (
        resposta_proximidade.get("politica_oferta")
        if isinstance(resposta_proximidade, dict) and isinstance(resposta_proximidade.get("politica_oferta"), dict)
        else {}
    )
    data_proximidade = (
        str(((resposta_proximidade or {}).get("item") or {}).get("data") or "").strip()
        if isinstance(resposta_proximidade, dict)
        else ""
    )
    datas_preferenciais = [
        str(item).strip()
        for item in (politica_oferta.get("datas_preferenciais") or [])
        if isinstance(item, str) and re.fullmatch(r"\d{4}-\d{2}-\d{2}", item.strip())
    ]
    politica_distante_baixa = bool(politica_oferta.get("distante_base")) and bool(politica_oferta.get("baixa_frequencia"))
    sugestao_proximidade_aderente = bool((resposta_proximidade or {}).get("sugerir")) and bool(data_proximidade)

    data_base = data_referencia
    origem_data_automatica = "manual"
    candidatos_data_base: list[tuple[str, str]] = []
    datas_tentadas_panorama: list[str] = []

    def _adicionar_candidato_data(data_candidata: Optional[str], origem: str) -> None:
        data_txt = str(data_candidata or "").strip()
        if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", data_txt):
            return
        if any(data_txt == data_existente for data_existente, _ in candidatos_data_base):
            return
        candidatos_data_base.append((data_txt, origem))

    if politica_distante_baixa and datas_preferenciais:
        if sugestao_proximidade_aderente:
            _adicionar_candidato_data(data_proximidade, "proximidade")
        for data_preferencial in datas_preferenciais:
            _adicionar_candidato_data(data_preferencial, "politica")
        _adicionar_candidato_data(data_referencia, "manual")
    elif sugestao_proximidade_aderente:
        _adicionar_candidato_data(data_proximidade, "proximidade")
        _adicionar_candidato_data(data_referencia, "manual")
    else:
        _adicionar_candidato_data(data_referencia, "manual")

    if not candidatos_data_base:
        _adicionar_candidato_data(data_referencia, "manual")

    resposta_panorama = {"ok": True, "items": [], "motivo": "", "itens_ignorados_janela": 0}
    for data_candidata, origem_candidata in candidatos_data_base:
        resposta_tentativa = sugerir_horarios_agenda(
            payload=SugestaoHorarioPayload(
                data=data_candidata,
                clinica_id=payload.clinica_id,
                servico_id=payload.servico_id,
                duracao_minutos=payload.duracao_minutos,
                intervalo_minutos=payload.intervalo_minutos,
                limite=payload.limite,
                perfil_deslocamento=payload.perfil_deslocamento,
                ignorar_agendamento_id=payload.ignorar_agendamento_id,
            ),
            db=db,
            current_user=current_user,
        )
        datas_tentadas_panorama.append(data_candidata)
        resposta_panorama = resposta_tentativa if isinstance(resposta_tentativa, dict) else resposta_panorama
        data_base = data_candidata
        origem_data_automatica = origem_candidata
        items_tentativa = resposta_panorama.get("items") if isinstance(resposta_panorama, dict) else []
        if isinstance(items_tentativa, list) and items_tentativa:
            break

    items_panorama = resposta_panorama.get("items") if isinstance(resposta_panorama, dict) else []
    items_panorama = items_panorama if isinstance(items_panorama, list) else []
    hoje_local_ref = datetime.now(LOCAL_TZ).date()
    if not items_panorama and data_referencia_ref >= hoje_local_ref:
        datas_tentadas_set = set(datas_tentadas_panorama)
        datas_candidatas_ref: list[date] = []
        for data_candidata, _origem in candidatos_data_base:
            try:
                datas_candidatas_ref.append(datetime.strptime(data_candidata, "%Y-%m-%d").date())
            except ValueError:
                continue

        data_cursor = max(datas_candidatas_ref) if datas_candidatas_ref else data_referencia_ref
        dias_busca_progressiva = 0
        while dias_busca_progressiva < ASSISTENTE_BUSCA_PROGRESSIVA_MAX_DIAS:
            dias_busca_progressiva += 1
            data_cursor = data_cursor + timedelta(days=1)
            data_cursor_iso = data_cursor.isoformat()
            if data_cursor_iso in datas_tentadas_set:
                continue

            resposta_tentativa = sugerir_horarios_agenda(
                payload=SugestaoHorarioPayload(
                    data=data_cursor_iso,
                    clinica_id=payload.clinica_id,
                    servico_id=payload.servico_id,
                    duracao_minutos=payload.duracao_minutos,
                    intervalo_minutos=payload.intervalo_minutos,
                    limite=payload.limite,
                    perfil_deslocamento=payload.perfil_deslocamento,
                    ignorar_agendamento_id=payload.ignorar_agendamento_id,
                ),
                db=db,
                current_user=current_user,
            )
            datas_tentadas_panorama.append(data_cursor_iso)
            datas_tentadas_set.add(data_cursor_iso)
            resposta_panorama = resposta_tentativa if isinstance(resposta_tentativa, dict) else resposta_panorama
            data_base = data_cursor_iso
            origem_data_automatica = "progressao_dias"
            items_tentativa = resposta_panorama.get("items") if isinstance(resposta_panorama, dict) else []
            items_panorama = items_tentativa if isinstance(items_tentativa, list) else []
            if items_panorama:
                break

    mudou_data_base = data_base != data_referencia
    if origem_data_automatica == "proximidade" and mudou_data_base:
        prefixo_mensagem = f"Sugestoes calculadas automaticamente para {data_base} com base no agendamento proximo."
    elif origem_data_automatica == "politica":
        prefixo_mensagem = f"Sugestoes calculadas automaticamente para {data_base} conforme politica de oferta (rota/frequencia)."
    elif origem_data_automatica == "progressao_dias":
        prefixo_mensagem = (
            f"Sugestoes calculadas automaticamente para {data_base} apos busca progressiva nos dias seguintes."
        )
    else:
        prefixo_mensagem = ""

    motivo_panorama = str((resposta_panorama or {}).get("motivo") or "").strip() if isinstance(resposta_panorama, dict) else ""
    if not items_panorama:
        mensagem_panorama = f"{prefixo_mensagem} {motivo_panorama or 'Nenhum horario operacional encontrado para essa data.'}".strip()
    elif all(not item.get("anterior") and not item.get("proximo") for item in items_panorama if isinstance(item, dict)):
        mensagem_panorama = f"{prefixo_mensagem} Nao ha agendamentos vizinhos nesta data; por isso o deslocamento pode aparecer como 0 min.".strip()
    else:
        mensagem_panorama = prefixo_mensagem.strip()

    _registrar_evento_funil_assistente(
        current_user=current_user,
        request=request,
        evento="ASSISTENTE_AGENDA_OFERTA_GERADA",
        detalhes={
            "clinica_id": payload.clinica_id,
            "servico_id": payload.servico_id,
            "perfil_usuario": "admin" if _usuario_tem_papel(current_user, "admin") else "nao_admin",
            "data_referencia": data_referencia,
            "data_base": data_base,
            "origem_data_automatica": origem_data_automatica,
            "datas_tentadas_panorama": datas_tentadas_panorama,
            "total_sugestoes": len(items_panorama),
            "houve_sugestao_proximidade": bool((resposta_proximidade or {}).get("item")),
        },
    )

    return {
        "ok": True,
        "clinica_id": payload.clinica_id,
        "data_referencia": data_referencia,
        "data_contato": data_contato,
        "data_base": data_base,
        "origem_data_automatica": origem_data_automatica,
        "politica_oferta": politica_oferta,
        "sugestao_proximidade": resposta_proximidade,
        "panorama_ofertas": resposta_panorama,
        "mensagem_panorama": mensagem_panorama,
    }


@router.get("/assistente/metricas")
def obter_metricas_funil_assistente(
    data_inicio: Optional[str] = None,
    data_fim: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Consolida metricas do funil do assistente por etapa, perfil e clinica."""
    if not _usuario_tem_papel(current_user, "admin"):
        raise HTTPException(status_code=403, detail="Apenas administradores podem consultar metricas do assistente.")

    data_inicio_iso = _extract_date_filter(data_inicio) if data_inicio else None
    data_fim_iso = _extract_date_filter(data_fim) if data_fim else None
    if data_inicio and not data_inicio_iso:
        raise HTTPException(status_code=422, detail="Data inicial invalida. Use YYYY-MM-DD.")
    if data_fim and not data_fim_iso:
        raise HTTPException(status_code=422, detail="Data final invalida. Use YYYY-MM-DD.")

    acoes_funil = {
        "ASSISTENTE_AGENDA_OFERTA_GERADA": "oferta_gerada",
        "ASSISTENTE_AGENDA_ACEITE": "aceite",
        "ASSISTENTE_AGENDA_SEM_OPCAO": "sem_opcao",
        "ASSISTENTE_AGENDA_SOLICITACAO_EXCECAO": "solicitacao_excecao",
        "ASSISTENTE_AGENDA_EXCECAO_CONCEDIDA": "excecao_concedida",
        "ASSISTENTE_AGENDA_ENCERRADO_SEM_AGENDAMENTO": "encerramento",
    }

    query = db.query(AuditoriaEvento).filter(
        AuditoriaEvento.modulo == "agenda",
        AuditoriaEvento.entidade == "assistente_agendamento",
        AuditoriaEvento.acao.in_(list(acoes_funil.keys())),
    )
    if data_inicio_iso:
        query = query.filter(func.date(AuditoriaEvento.created_at) >= data_inicio_iso)
    if data_fim_iso:
        query = query.filter(func.date(AuditoriaEvento.created_at) <= data_fim_iso)

    eventos = query.order_by(AuditoriaEvento.created_at.asc(), AuditoriaEvento.id.asc()).all()

    totais_por_etapa: dict[str, int] = {etapa: 0 for etapa in acoes_funil.values()}
    por_perfil: dict[str, dict[str, int]] = {}
    por_clinica: dict[str, dict[str, Any]] = {}
    serie_diaria: dict[str, dict[str, int]] = {}

    for row in eventos:
        etapa = acoes_funil.get(str(row.acao or "").strip())
        if not etapa:
            continue
        detalhes = _parse_detalhes_auditoria(getattr(row, "detalhes_json", None))
        perfil = str(detalhes.get("perfil_usuario") or detalhes.get("perfil") or "nao_informado").strip() or "nao_informado"
        clinica_id_raw = detalhes.get("clinica_id")
        clinica_id = str(clinica_id_raw) if clinica_id_raw not in (None, "", 0, "0") else "nao_informada"
        clinica_nome = str(detalhes.get("clinica_nome") or "Nao informada")
        data_evento = _extrair_data_evento_local(getattr(row, "created_at", None)) or "sem_data"

        totais_por_etapa[etapa] = int(totais_por_etapa.get(etapa, 0)) + 1

        bucket_perfil = por_perfil.setdefault(perfil, {nome: 0 for nome in acoes_funil.values()})
        bucket_perfil[etapa] = int(bucket_perfil.get(etapa, 0)) + 1

        bucket_clinica = por_clinica.setdefault(
            clinica_id,
            {
                "clinica_id": None if clinica_id == "nao_informada" else clinica_id_raw,
                "clinica_nome": clinica_nome,
                "eventos": {nome: 0 for nome in acoes_funil.values()},
            },
        )
        bucket_clinica["eventos"][etapa] = int(bucket_clinica["eventos"].get(etapa, 0)) + 1

        bucket_dia = serie_diaria.setdefault(data_evento, {nome: 0 for nome in acoes_funil.values()})
        bucket_dia[etapa] = int(bucket_dia.get(etapa, 0)) + 1

    return {
        "ok": True,
        "periodo": {
            "data_inicio": data_inicio_iso,
            "data_fim": data_fim_iso,
        },
        "totais_por_etapa": totais_por_etapa,
        "por_perfil": por_perfil,
        "por_clinica": sorted(por_clinica.values(), key=lambda item: str(item.get("clinica_nome") or "")),
        "serie_diaria": [
            {"data": data_ref, "eventos": serie_diaria[data_ref]}
            for data_ref in sorted(serie_diaria.keys())
        ],
    }


@router.post("/assistente/encerramento")
def registrar_encerramento_assistente(
    payload: AssistenteEncerramentoPayload,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Registra desfechos estruturados do assistente guiado sem criar agendamento."""
    motivo = str(payload.motivo or "").strip()
    if len(motivo) < 5:
        raise HTTPException(status_code=422, detail="Motivo deve ter ao menos 5 caracteres.")

    def _parse_data_yyyy_mm_dd(raw_value: Optional[str], field_label: str) -> Optional[str]:
        raw = str(raw_value or "").strip()
        if not raw:
            return None
        if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", raw):
            raise HTTPException(
                status_code=422,
                detail=f"{field_label} invalida. Use o formato YYYY-MM-DD.",
            )
        try:
            return datetime.strptime(raw, "%Y-%m-%d").date().isoformat()
        except ValueError:
            raise HTTPException(
                status_code=422,
                detail=f"{field_label} invalida. Use o formato YYYY-MM-DD.",
            )

    data_referencia = _parse_data_yyyy_mm_dd(payload.data_referencia, "Data de referencia")
    data_contato = _parse_data_yyyy_mm_dd(payload.data_contato, "Data de contato")
    contexto = payload.contexto if isinstance(payload.contexto, dict) else {}
    try:
        total_sugestoes = int(contexto.get("total_sugestoes", 0) or 0)
    except (TypeError, ValueError):
        total_sugestoes = 0
    if total_sugestoes < 1:
        raise HTTPException(
            status_code=422,
            detail="Para registrar recusa sem agendamento, e obrigatorio ter ao menos 1 oferta exibida.",
        )

    clinica_nome = _nome_clinica_por_id(db, payload.clinica_id) if payload.clinica_id else "Nao informada"
    servico_nome = "Nao informado"
    if payload.servico_id:
        servico = db.query(Servico).filter(Servico.id == payload.servico_id).first()
        if servico and servico.nome:
            servico_nome = str(servico.nome).strip()

    eh_admin = bool(current_user.tem_papel("admin"))
    tipo = payload.tipo
    if tipo == "solicitacao_excecao":
        acao = "ASSISTENTE_AGENDA_SOLICITACAO_EXCECAO"
        descricao = (
            "Assistente de agenda sem oferta aderente: solicitacao de excecao registrada "
            f"({clinica_nome} | servico: {servico_nome})."
        )
        mensagem = "Solicitacao de excecao registrada com sucesso."
    else:
        acao = "ASSISTENTE_AGENDA_ENCERRADO_SEM_AGENDAMENTO"
        descricao = (
            "Assistente de agenda encerrado sem agendamento "
            f"({clinica_nome} | servico: {servico_nome})."
        )
        mensagem = "Encerramento sem agendamento registrado com sucesso."

    registrar_auditoria(
        current_user=current_user,
        modulo="agenda",
        entidade="assistente_agendamento",
        acao=acao,
        descricao=descricao,
        detalhes={
            "tipo": tipo,
            "motivo": motivo,
            "clinica_id": payload.clinica_id,
            "clinica_nome": clinica_nome,
            "servico_id": payload.servico_id,
            "servico_nome": servico_nome,
            "data_referencia": data_referencia,
            "data_contato": data_contato,
            "perfil_usuario": "admin" if eh_admin else "nao_admin",
            "contexto": contexto,
        },
        request=request,
    )
    _registrar_evento_funil_assistente(
        current_user=current_user,
        request=request,
        evento="ASSISTENTE_AGENDA_SEM_OPCAO",
        detalhes={
            "clinica_id": payload.clinica_id,
            "servico_id": payload.servico_id,
            "perfil_usuario": "admin" if eh_admin else "nao_admin",
            "tipo_desfecho": tipo,
            "motivo": motivo,
            "data_referencia": data_referencia,
            "data_contato": data_contato,
        },
    )

    return {
        "ok": True,
        "tipo": tipo,
        "mensagem": mensagem,
    }


@router.get("/{agendamento_id}", response_model=AgendamentoResponse)
def obter_agendamento(
    agendamento_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Obtem um agendamento especifico"""
    agendamento = db.query(Agendamento).filter(Agendamento.id == agendamento_id).first()
    if not agendamento:
        raise HTTPException(status_code=404, detail="Agendamento nao encontrado")
    related = _fetch_related_names(db, agendamento)
    return _serialize_agendamento(agendamento, **related)

@router.post("", response_model=AgendamentoResponse, status_code=status.HTTP_201_CREATED)
def criar_agendamento(
    agendamento: AgendamentoCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Cria novo agendamento"""
    _adquirir_lock_escrita_agenda(db)

    override_conflito_deslocamento = bool(agendamento.confirmar_conflito_deslocamento)
    excecao_operacional_concedida = bool(getattr(agendamento, "excecao_operacional_concedida", False))
    motivo_excecao_operacional = str(getattr(agendamento, "motivo_excecao_operacional", "") or "").strip()
    if override_conflito_deslocamento and not _usuario_tem_papel(current_user, "admin"):
        raise HTTPException(
            status_code=403,
            detail="Somente administradores podem confirmar excecao de conflito operacional.",
        )
    if excecao_operacional_concedida and not _usuario_tem_papel(current_user, "admin"):
        raise HTTPException(
            status_code=403,
            detail="Somente administradores podem conceder excecao operacional da agenda.",
        )
    if excecao_operacional_concedida and not motivo_excecao_operacional:
        raise HTTPException(
            status_code=422,
            detail="Informe o motivo da excecao operacional concedida.",
        )

    now = datetime.now()
    db_agendamento = Agendamento(
        **agendamento.model_dump(
            exclude={
                "confirmar_conflito_deslocamento",
                "excecao_operacional_concedida",
                "motivo_excecao_operacional",
            }
        )
    )
    db_agendamento.status = _normalizar_status_agendamento(db_agendamento.status)
    if db_agendamento.status == "Reservado" and not db_agendamento.paciente_id:
        # Compatibilidade com bancos legados onde paciente_id ainda esta NOT NULL.
        db_agendamento.paciente_id = 0
    db_agendamento.inicio = _coerce_datetime(db_agendamento.inicio)
    db_agendamento.fim = _coerce_datetime(db_agendamento.fim)
    db_agendamento.criado_por_id = current_user.id
    db_agendamento.criado_por_nome = current_user.nome
    db_agendamento.criado_em = now
    db_agendamento.created_at = now
    db_agendamento.updated_at = now

    _apply_service_duration_if_needed(db, db_agendamento, force_from_service=True)
    _validar_agendamento_no_funcionamento(db, db_agendamento)
    _validar_slot_disponivel(db, db_agendamento)
    _validar_deslocamento_agendamento(
        db,
        db_agendamento,
        confirmar_conflito_deslocamento=override_conflito_deslocamento,
    )
    _fill_data_hora_from_inicio(db_agendamento)
    related = _fetch_related_names(db, db_agendamento)
    _sync_denormalized_fields(db_agendamento, related)
    _validar_paciente_tutor_para_status(
        db,
        db_agendamento,
        status_destino=db_agendamento.status,
        related=related,
    )

    db.add(db_agendamento)
    db.commit()
    db.refresh(db_agendamento)
    contexto = _contexto_agendamento_auditoria(db_agendamento, related)

    registrar_auditoria(
        current_user=current_user,
        modulo="agenda",
        entidade="agendamento",
        entidade_id=db_agendamento.id,
        acao="AGENDAMENTO_CRIADO",
        descricao=f"Agendamento criado - {_descricao_contexto_agendamento(contexto)}",
        detalhes={
            "paciente_id": db_agendamento.paciente_id,
            "clinica_id": db_agendamento.clinica_id,
            "servico_id": db_agendamento.servico_id,
            "status": db_agendamento.status,
            "override_conflito_deslocamento": override_conflito_deslocamento,
            "contexto_agendamento": contexto,
        },
        request=request,
    )
    observacoes_agendamento = str(db_agendamento.observacoes or "")
    if "[Assistente agenda] sugestao aceita" in observacoes_agendamento:
        _registrar_evento_funil_assistente(
            current_user=current_user,
            request=request,
            evento="ASSISTENTE_AGENDA_ACEITE",
            detalhes={
                "agendamento_id": db_agendamento.id,
                "clinica_id": db_agendamento.clinica_id,
                "servico_id": db_agendamento.servico_id,
                "perfil_usuario": "admin" if _usuario_tem_papel(current_user, "admin") else "nao_admin",
            },
        )
    if excecao_operacional_concedida:
        _registrar_auditoria_excecao_operacional_concedida(
            db=db,
            current_user=current_user,
            request=request,
            agendamento=db_agendamento,
            related=related,
            motivo=motivo_excecao_operacional,
        )

    _notificar_agenda_update(
        db=db,
        action="created",
        agendamento_id=db_agendamento.id,
        data=_montar_payload_realtime(
            agendamento=db_agendamento,
            related=related,
            usuario=current_user,
        ),
    )

    return _serialize_agendamento(db_agendamento, **related)

@router.put("/{agendamento_id}", response_model=AgendamentoResponse)
def atualizar_agendamento(
    agendamento_id: int,
    agendamento: AgendamentoUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Atualiza agendamento"""
    _adquirir_lock_escrita_agenda(db)

    db_agendamento = db.query(Agendamento).filter(Agendamento.id == agendamento_id).first()
    if not db_agendamento:
        raise HTTPException(status_code=404, detail="Agendamento nao encontrado")

    dados_anteriores = {
        "inicio": str(db_agendamento.inicio) if db_agendamento.inicio else None,
        "fim": str(db_agendamento.fim) if db_agendamento.fim else None,
        "status": db_agendamento.status,
        "paciente_id": db_agendamento.paciente_id,
        "clinica_id": db_agendamento.clinica_id,
        "servico_id": db_agendamento.servico_id,
    }

    inicio_original = _coerce_datetime(db_agendamento.inicio)
    fim_original = _coerce_datetime(db_agendamento.fim)
    servico_original = db_agendamento.servico_id
    clinica_original = db_agendamento.clinica_id
    status_anterior = str(db_agendamento.status or "").strip() or "Agendado"

    override_conflito_deslocamento = bool(agendamento.confirmar_conflito_deslocamento)
    excecao_operacional_concedida = bool(getattr(agendamento, "excecao_operacional_concedida", False))
    motivo_excecao_operacional = str(getattr(agendamento, "motivo_excecao_operacional", "") or "").strip()
    if override_conflito_deslocamento and not _usuario_tem_papel(current_user, "admin"):
        raise HTTPException(
            status_code=403,
            detail="Somente administradores podem confirmar excecao de conflito operacional.",
        )
    if excecao_operacional_concedida and not _usuario_tem_papel(current_user, "admin"):
        raise HTTPException(
            status_code=403,
            detail="Somente administradores podem conceder excecao operacional da agenda.",
        )
    if excecao_operacional_concedida and not motivo_excecao_operacional:
        raise HTTPException(
            status_code=422,
            detail="Informe o motivo da excecao operacional concedida.",
        )

    update_data = agendamento.model_dump(exclude_unset=True)
    update_data.pop("confirmar_conflito_deslocamento", None)
    update_data.pop("excecao_operacional_concedida", None)
    update_data.pop("motivo_excecao_operacional", None)
    for field, value in update_data.items():
        setattr(db_agendamento, field, value)

    if "inicio" in update_data:
        db_agendamento.inicio = _coerce_datetime(db_agendamento.inicio)
    if "fim" in update_data:
        db_agendamento.fim = _coerce_datetime(db_agendamento.fim)
    if "status" in update_data:
        db_agendamento.status = _normalizar_status_agendamento(db_agendamento.status, fallback=status_anterior)
    else:
        db_agendamento.status = status_anterior
    if db_agendamento.status == "Reservado" and not db_agendamento.paciente_id:
        # Compatibilidade com bancos legados onde paciente_id ainda esta NOT NULL.
        db_agendamento.paciente_id = 0

    campos_horario = "inicio" in update_data or "fim" in update_data or "servico_id" in update_data or "clinica_id" in update_data
    reativando_cancelado = status_anterior == "Cancelado" and db_agendamento.status != "Cancelado"
    if campos_horario:
        _apply_service_duration_if_needed(db, db_agendamento)

        inicio_atual = _coerce_datetime(db_agendamento.inicio)
        fim_atual = _coerce_datetime(db_agendamento.fim)
        servico_atual = db_agendamento.servico_id
        clinica_atual = db_agendamento.clinica_id

        alterou_horario = False
        if "inicio" in update_data:
            alterou_horario = alterou_horario or (_to_local_naive(inicio_original) != _to_local_naive(inicio_atual))
        if "fim" in update_data:
            alterou_horario = alterou_horario or (_to_local_naive(fim_original) != _to_local_naive(fim_atual))
        if "servico_id" in update_data:
            alterou_horario = alterou_horario or (servico_original != servico_atual)
        if "clinica_id" in update_data:
            alterou_horario = alterou_horario or (clinica_original != clinica_atual)

        if alterou_horario or reativando_cancelado:
            _validar_agendamento_no_funcionamento(db, db_agendamento)
            _validar_slot_disponivel(db, db_agendamento, agendamento_id_excluir=agendamento_id)
            _validar_deslocamento_agendamento(
                db,
                db_agendamento,
                agendamento_id_excluir=agendamento_id,
                confirmar_conflito_deslocamento=override_conflito_deslocamento,
            )
    elif reativando_cancelado:
        _apply_service_duration_if_needed(db, db_agendamento)
        _validar_agendamento_no_funcionamento(db, db_agendamento)
        _validar_slot_disponivel(db, db_agendamento, agendamento_id_excluir=agendamento_id)
        _validar_deslocamento_agendamento(
            db,
            db_agendamento,
            agendamento_id_excluir=agendamento_id,
            confirmar_conflito_deslocamento=override_conflito_deslocamento,
        )
    if "inicio" in update_data:
        _fill_data_hora_from_inicio(db_agendamento)

    related = _fetch_related_names(db, db_agendamento)
    _sync_denormalized_fields(db_agendamento, related)
    if status_anterior == "Reservado" or "status" in update_data or "paciente_id" in update_data:
        _validar_paciente_tutor_para_status(
            db,
            db_agendamento,
            status_destino=db_agendamento.status,
            related=related,
        )

    db_agendamento.atualizado_em = datetime.now()
    db_agendamento.updated_at = datetime.now()

    db.commit()
    db.refresh(db_agendamento)
    contexto = _contexto_agendamento_auditoria(db_agendamento, related)

    registrar_auditoria(
        current_user=current_user,
        modulo="agenda",
        entidade="agendamento",
        entidade_id=db_agendamento.id,
        acao="AGENDAMENTO_ATUALIZADO",
        descricao=f"Agendamento atualizado - {_descricao_contexto_agendamento(contexto)}",
        detalhes={
            "antes": dados_anteriores,
            "campos_alterados": list(update_data.keys()),
            "depois": {
                "inicio": str(db_agendamento.inicio) if db_agendamento.inicio else None,
                "fim": str(db_agendamento.fim) if db_agendamento.fim else None,
                "status": db_agendamento.status,
                "paciente_id": db_agendamento.paciente_id,
                "clinica_id": db_agendamento.clinica_id,
                "servico_id": db_agendamento.servico_id,
            },
            "override_conflito_deslocamento": override_conflito_deslocamento,
            "contexto_agendamento": contexto,
        },
        request=request,
    )
    observacoes_atualizadas = str(db_agendamento.observacoes or "")
    if "[Assistente agenda] sugestao aceita" in observacoes_atualizadas:
        _registrar_evento_funil_assistente(
            current_user=current_user,
            request=request,
            evento="ASSISTENTE_AGENDA_ACEITE",
            detalhes={
                "agendamento_id": db_agendamento.id,
                "clinica_id": db_agendamento.clinica_id,
                "servico_id": db_agendamento.servico_id,
                "perfil_usuario": "admin" if _usuario_tem_papel(current_user, "admin") else "nao_admin",
            },
        )
    if excecao_operacional_concedida:
        _registrar_auditoria_excecao_operacional_concedida(
            db=db,
            current_user=current_user,
            request=request,
            agendamento=db_agendamento,
            related=related,
            motivo=motivo_excecao_operacional,
        )

    acao_push_update = "updated"
    base_push_update: Optional[dict] = None
    if status_anterior != db_agendamento.status:
        base_push_update = {
            "status_anterior": status_anterior,
            "status_novo": db_agendamento.status,
        }
        acao_push_update = "cancelled" if db_agendamento.status == "Cancelado" else "status_changed"

    _notificar_agenda_update(
        db=db,
        action=acao_push_update,
        agendamento_id=db_agendamento.id,
        data=_montar_payload_realtime(
            agendamento=db_agendamento,
            related=related,
            usuario=current_user,
            base=base_push_update,
        ),
    )

    return _serialize_agendamento(db_agendamento, **related)

@router.patch("/{agendamento_id}/status")
def atualizar_status(
    agendamento_id: int,
    request: Request,
    status: str,
    tipo_horario: Optional[str] = "comercial",  # 'comercial' ou 'plantao'
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Atualiza apenas o status do agendamento."""
    from decimal import Decimal
    from app.models.ordem_servico import OrdemServico
    _adquirir_lock_escrita_agenda(db)

    def _gerar_numero_os() -> str:
        mes_ano = datetime.now().strftime("%Y%m")
        ultima_os = (
            db.query(OrdemServico)
            .filter(OrdemServico.numero_os.like(f"OS{mes_ano}%"))
            .order_by(OrdemServico.id.desc())
            .first()
        )

        seq = 1
        if ultima_os and ultima_os.numero_os:
            sufixo = "".join(ch for ch in str(ultima_os.numero_os)[-4:] if ch.isdigit())
            if len(sufixo) == 4:
                seq = int(sufixo) + 1

        while (
            db.query(OrdemServico)
            .filter(OrdemServico.numero_os == f"OS{mes_ano}{seq:04d}")
            .first()
        ):
            seq += 1

        return f"OS{mes_ano}{seq:04d}"

    db_agendamento = db.query(Agendamento).filter(Agendamento.id == agendamento_id).first()
    if not db_agendamento:
        raise HTTPException(status_code=404, detail="Agendamento nao encontrado")

    status_normalizado = _normalizar_status_agendamento(status)
    related_validacao = _fetch_related_names(db, db_agendamento)
    _validar_paciente_tutor_para_status(
        db,
        db_agendamento,
        status_destino=status_normalizado,
        related=related_validacao,
    )

    status_anterior = db_agendamento.status

    db_agendamento.status = status_normalizado
    if status_anterior == "Cancelado" and status_normalizado != "Cancelado":
        _apply_service_duration_if_needed(db, db_agendamento)
        _validar_agendamento_no_funcionamento(db, db_agendamento)
        _validar_slot_disponivel(db, db_agendamento, agendamento_id_excluir=agendamento_id)
        _validar_deslocamento_agendamento(db, db_agendamento, agendamento_id_excluir=agendamento_id)
    db_agendamento.atualizado_em = datetime.now()
    db_agendamento.updated_at = datetime.now()

    if status_normalizado == "Confirmado":
        db_agendamento.confirmado_por_id = current_user.id
        db_agendamento.confirmado_por_nome = current_user.nome
        db_agendamento.confirmado_em = datetime.now()

    os_gerada = None
    os_reutilizada = False
    mensagens_adicionais: list[str] = []

    try:
        db.commit()
        db.refresh(db_agendamento)
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(status_code=500, detail="Erro ao atualizar status no banco de dados.")

    if status_anterior == "Realizado" and status_normalizado == "Em atendimento":
        from app.models.financeiro import Transacao

        try:
            ordens_vinculadas = (
                db.query(OrdemServico)
                .filter(
                    OrdemServico.agendamento_id == agendamento_id,
                    OrdemServico.status != "Cancelado",
                )
                .order_by(OrdemServico.id.desc())
                .all()
            )

            os_removidas: list[str] = []
            transacoes_canceladas = 0
            momento_desfazer = datetime.now()

            for os_data in ordens_vinculadas:
                marker = f"OS_ID={os_data.id};TIPO=RECEBIMENTO_OS"
                transacoes = (
                    db.query(Transacao)
                    .filter(
                        Transacao.tipo == "entrada",
                        Transacao.status.in_(["Recebido", "Pago"]),
                        Transacao.observacoes.like(f"%{marker}%"),
                    )
                    .all()
                )

                if not transacoes and os_data.numero_os:
                    transacoes = (
                        db.query(Transacao)
                        .filter(
                            Transacao.tipo == "entrada",
                            Transacao.status.in_(["Recebido", "Pago"]),
                            Transacao.descricao.like(f"%{os_data.numero_os}%"),
                        )
                        .all()
                    )

                for transacao in transacoes:
                    transacao.status = "Cancelado"
                    transacao.data_pagamento = None
                    transacao.updated_at = momento_desfazer
                    observacao_base = (transacao.observacoes or "").strip()
                    observacao_auto = (
                        f"Cancelada automaticamente ao desfazer realizado do agendamento {agendamento_id}"
                    )
                    transacao.observacoes = (
                        f"{observacao_base} | {observacao_auto}" if observacao_base else observacao_auto
                    )
                    transacoes_canceladas += 1

                os_removidas.append(os_data.numero_os or f"ID {os_data.id}")
                db.delete(os_data)

            db.commit()
            mensagens_adicionais.append("Marcacao de realizado desfeita.")
            if os_removidas:
                mensagens_adicionais.append(
                    f"OS removida(s) automaticamente: {', '.join(os_removidas)}."
                )
            if transacoes_canceladas:
                mensagens_adicionais.append(
                    f"Transacao(oes) de recebimento cancelada(s): {transacoes_canceladas}."
                )
        except SQLAlchemyError:
            db.rollback()
            try:
                agendamento_restaurado = (
                    db.query(Agendamento)
                    .filter(Agendamento.id == agendamento_id)
                    .first()
                )
                if agendamento_restaurado:
                    agendamento_restaurado.status = "Realizado"
                    agendamento_restaurado.atualizado_em = datetime.now()
                    agendamento_restaurado.updated_at = datetime.now()
                    db.commit()
            except SQLAlchemyError:
                db.rollback()
            raise HTTPException(
                status_code=500,
                detail=(
                    "Nao foi possivel desfazer a ordem de servico automaticamente. "
                    "O status foi restaurado para Realizado."
                ),
            )

    # Se status for "Realizado", tenta gerar Ordem de Servico automaticamente.
    if status_normalizado == "Realizado":
        try:
            os_existente = (
                db.query(OrdemServico)
                .filter(
                    OrdemServico.agendamento_id == agendamento_id,
                    OrdemServico.status != "Cancelado",
                )
                .order_by(OrdemServico.id.desc())
                .first()
            )

            if os_existente:
                os_gerada = {
                    "id": os_existente.id,
                    "numero_os": os_existente.numero_os,
                    "valor_final": float(os_existente.valor_final or 0),
                }
                os_reutilizada = True
            elif not (db_agendamento.paciente_id and db_agendamento.clinica_id and db_agendamento.servico_id):
                mensagens_adicionais.append(
                    "Status atualizado, mas OS nao foi gerada por falta de paciente, clinica ou servico."
                )
            else:
                valor_servico = Decimal("0.00")
                pode_gerar_os = True
                try:
                    valor_servico = calcular_preco_servico(
                        db=db,
                        clinica_id=db_agendamento.clinica_id,
                        servico_id=db_agendamento.servico_id,
                        tipo_horario=tipo_horario or "comercial",
                        usar_preco_clinica=True,
                    )
                except HTTPException as exc:
                    if exc.status_code in (404, 422):
                        mensagens_adicionais.append(
                            f"Status atualizado, mas OS nao foi gerada ({exc.detail})."
                        )
                        pode_gerar_os = False
                    else:
                        raise

                if pode_gerar_os:
                    nova_os = OrdemServico(
                        numero_os=_gerar_numero_os(),
                        agendamento_id=agendamento_id,
                        paciente_id=db_agendamento.paciente_id,
                        clinica_id=db_agendamento.clinica_id,
                        servico_id=db_agendamento.servico_id,
                        data_atendimento=db_agendamento.inicio,
                        tipo_horario=tipo_horario or "comercial",
                        valor_servico=valor_servico,
                        desconto=Decimal("0.00"),
                        valor_final=valor_servico,
                        status="Pendente",
                        observacoes=f"OS gerada automaticamente do agendamento {agendamento_id}",
                        criado_por_id=current_user.id,
                        criado_por_nome=current_user.nome,
                    )
                    db.add(nova_os)
                    db.commit()
                    db.refresh(nova_os)

                    os_gerada = {
                        "id": nova_os.id,
                        "numero_os": nova_os.numero_os,
                        "valor_final": float(nova_os.valor_final),
                    }
        except SQLAlchemyError:
            db.rollback()
            mensagens_adicionais.append("Status atualizado, mas houve erro ao processar a OS.")

    related_status = _fetch_related_names(db, db_agendamento)
    contexto_status = _contexto_agendamento_auditoria(db_agendamento, related_status)

    resposta = {
        "id": db_agendamento.id,
        "status": db_agendamento.status,
        "paciente": related_status.get("paciente_nome") or "",
        "clinica": related_status.get("clinica_nome") or "",
        "servico": related_status.get("servico_nome") or "",
        "mensagem": f"Status atualizado para {status_normalizado}",
    }

    if os_gerada:
        resposta["os_gerada"] = os_gerada
        if os_reutilizada:
            resposta["mensagem"] += f". OS {os_gerada['numero_os']} ja vinculada"
        else:
            resposta["mensagem"] += f". OS {os_gerada['numero_os']} gerada com valor R$ {os_gerada['valor_final']:.2f}"
    if mensagens_adicionais:
        resposta["mensagem"] += ". " + " ".join(mensagens_adicionais)

    if os_gerada and not os_reutilizada:
        try:
            send_financeiro_push_notification(
                db,
                action="os_generated",
                os_id=int(os_gerada["id"]),
                data={
                    "numero_os": os_gerada.get("numero_os"),
                    "valor_final": f"{float(os_gerada.get('valor_final') or 0):.2f}",
                    "paciente_nome": related_status.get("paciente_nome"),
                    "clinica_nome": related_status.get("clinica_nome"),
                    "servico_nome": related_status.get("servico_nome"),
                },
            )
        except Exception as exc:
            print(f"[financeiro-push] Falha ao enviar push de OS gerada: {exc}")

        try:
            lembrete_horas = 6
            preferencias_push = (
                db.query(
                    ConfiguracaoUsuario.notificacoes_push_lembrete_pendencias,
                    ConfiguracaoUsuario.notificacoes_push_lembrete_horas,
                )
                .filter(ConfiguracaoUsuario.user_id == current_user.id)
                .first()
            )
            lembrete_habilitado = True
            if preferencias_push:
                lembrete_habilitado = bool(
                    True
                    if preferencias_push.notificacoes_push_lembrete_pendencias is None
                    else preferencias_push.notificacoes_push_lembrete_pendencias
                )
                lembrete_horas = int(preferencias_push.notificacoes_push_lembrete_horas or 6)
            if lembrete_habilitado:
                if lembrete_horas < 1:
                    lembrete_horas = 1
                if lembrete_horas > 168:
                    lembrete_horas = 168
                schedule_pending_os_payment_reminder(
                    db,
                    os_id=int(os_gerada["id"]),
                    reminder_hours=lembrete_horas,
                    data={
                        "numero_os": os_gerada.get("numero_os"),
                        "valor_final": f"{float(os_gerada.get('valor_final') or 0):.2f}",
                        "paciente_nome": related_status.get("paciente_nome"),
                        "clinica_nome": related_status.get("clinica_nome"),
                        "servico_nome": related_status.get("servico_nome"),
                        "lembrete_horas": str(lembrete_horas),
                    },
                    commit=True,
                )
        except Exception as exc:
            print(f"[financeiro-push] Falha ao agendar lembrete de pendencia da OS: {exc}")

    if status_normalizado == "Cancelado":
        acao_log = "AGENDAMENTO_CANCELADO"
    elif status_anterior == "Realizado" and status_normalizado == "Em atendimento":
        acao_log = "AGENDAMENTO_REALIZADO_DESFEITO"
    else:
        acao_log = "AGENDAMENTO_STATUS_ALTERADO"

    registrar_auditoria(
        current_user=current_user,
        modulo="agenda",
        entidade="agendamento",
        entidade_id=db_agendamento.id,
        acao=acao_log,
        descricao=(
            f"Status do agendamento alterado de {status_anterior} para {status_normalizado}"
            f" - {_descricao_contexto_agendamento(contexto_status)}"
        ),
        detalhes={
            "status_anterior": status_anterior,
            "status_novo": status_normalizado,
            "tipo_horario": tipo_horario,
            "os_gerada": os_gerada,
            "mensagens_adicionais": mensagens_adicionais,
            "contexto_agendamento": contexto_status,
        },
        request=request,
    )

    acao_push_status = "cancelled" if status_normalizado == "Cancelado" else "status_changed"

    _notificar_agenda_update(
        db=db,
        action=acao_push_status,
        agendamento_id=db_agendamento.id,
        data=_montar_payload_realtime(
            agendamento=db_agendamento,
            related=related_status,
            usuario=current_user,
            base={
                "status_anterior": status_anterior,
                "status_novo": db_agendamento.status,
            },
        ),
    )

    return resposta
@router.delete("/{agendamento_id}")
def deletar_agendamento(
    agendamento_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Deleta agendamento (sÃƒÆ’Ã‚Â³ admin)"""
    from sqlalchemy import text
    papel = db.execute(
        text("SELECT p.nome FROM papeis p JOIN usuario_papel up ON p.id = up.papel_id WHERE up.usuario_id = :uid"),
        {"uid": current_user.id}
    ).fetchone()
    if not papel or papel[0] != "admin":
        raise HTTPException(status_code=403, detail="Apenas administradores podem excluir agendamentos")

    db_agendamento = db.query(Agendamento).filter(Agendamento.id == agendamento_id).first()
    if not db_agendamento:
        raise HTTPException(status_code=404, detail="Agendamento nao encontrado")

    related_delete = _fetch_related_names(db, db_agendamento)
    contexto_delete = _contexto_agendamento_auditoria(db_agendamento, related_delete)

    snapshot = {
        "paciente_id": db_agendamento.paciente_id,
        "clinica_id": db_agendamento.clinica_id,
        "servico_id": db_agendamento.servico_id,
        "status": db_agendamento.status,
        "data": db_agendamento.data,
        "hora": db_agendamento.hora,
        "contexto_agendamento": contexto_delete,
    }
    realtime_delete_payload = _montar_payload_realtime(
        agendamento=db_agendamento,
        related=related_delete,
        usuario=current_user,
        base={
            "status": snapshot.get("status"),
            "data": snapshot.get("data"),
            "hora": snapshot.get("hora"),
        },
    )

    laudos_vinculados = (
        db.query(Laudo)
        .filter(Laudo.agendamento_id == agendamento_id)
        .all()
    )
    laudos_desvinculados: list[int] = []
    for laudo in laudos_vinculados:
        laudo.agendamento_id = None
        laudo.updated_at = datetime.now()
        laudos_desvinculados.append(laudo.id)
    snapshot["laudos_desvinculados"] = laudos_desvinculados

    db.delete(db_agendamento)
    db.commit()

    registrar_auditoria(
        current_user=current_user,
        modulo="agenda",
        entidade="agendamento",
        entidade_id=agendamento_id,
        acao="AGENDAMENTO_EXCLUIDO",
        descricao=f"Agendamento excluido - {_descricao_contexto_agendamento(contexto_delete)}",
        detalhes=snapshot,
        request=request,
    )

    _notificar_agenda_update(
        db=db,
        action="deleted",
        agendamento_id=agendamento_id,
        data=realtime_delete_payload,
    )

    return {"message": "Agendamento deletado com sucesso"}
