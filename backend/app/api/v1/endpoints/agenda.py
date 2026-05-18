import asyncio
import json
import logging
import math
import re
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from queue import Empty
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy import exists, func, or_
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models.agendamento import Agendamento
from app.models.paciente import Paciente
from app.models.clinica import Clinica
from app.models.configuracao import Configuracao, ConfiguracaoUsuario
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
MIN_MARGEM_SEGURA_DESLOCAMENTO_MIN = 5


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
    agendamentos_dia = _listar_agendamentos_ativos_do_dia(
        db,
        data_iso,
        agendamento_id_excluir=agendamento_id_excluir,
    )
    cache_duracoes: dict[tuple[int, int, str, bool], tuple[int, str]] = {}
    perfil_norm = normalizar_perfil(perfil_deslocamento)
    for item in agendamentos_dia:
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
    return False


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

    dias_preferenciais = dias_padrao or [2]
    ancora_d2 = False
    override_aplicado = None
    override_ancora_obrigatoria = False
    if distante_base and baixa_frequencia:
        dias_preferenciais = dias_distantes or dias_preferenciais
        if permitir_d2_ancora:
            data_d2 = (
                datetime.strptime(data_contato_iso, "%Y-%m-%d").date() + timedelta(days=2)
            ).isoformat()
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
        "baixa_frequencia": bool(baixa_frequencia),
        "agendamentos_30d": int(qtd_30d),
        "tempo_base_estimado_min": tempo_base_min,
        "ancora_d2": bool(ancora_d2),
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
    query = (
        db.query(Agendamento)
        .filter(Agendamento.status != "Cancelado")
        .filter(func.date(Agendamento.inicio) >= data_inicio_iso)
        .filter(func.date(Agendamento.inicio) <= data_fim_iso)
    )
    if agendamento_id_excluir is not None:
        query = query.filter(Agendamento.id != agendamento_id_excluir)

    registros: list[dict] = []
    for item in query.order_by(Agendamento.inicio.asc(), Agendamento.id.asc()).all():
        inicio_dt = _to_local_naive(_coerce_datetime(item.inicio))
        if inicio_dt is None:
            continue

        fim_dt = _to_local_naive(_coerce_datetime(item.fim))
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
            if duracao_prev > 0 and folga_prev < duracao_prev:
                raise HTTPException(
                    status_code=409,
                    detail={
                        "codigo": "CONFLITO_DESLOCAMENTO",
                        "mensagem": (
                            f"O tempo de deslocamento entre {clinica_anterior_nome} e {clinica_atual} "
                            f"e de aproximadamente {duracao_prev} minutos. "
                            f"Disponivel: {max(0, folga_prev)} minutos. "
                            "Ajuste o horario ou escolha outra clinica."
                        ),
                        "origem_clinica": clinica_anterior_nome,
                        "destino_clinica": clinica_atual,
                        "duracao_min": int(duracao_prev),
                        "folga_min": max(0, int(folga_prev)),
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
            if duracao_next > 0 and folga_next < duracao_next:
                raise HTTPException(
                    status_code=409,
                    detail={
                        "codigo": "CONFLITO_DESLOCAMENTO",
                        "mensagem": (
                            f"O tempo de deslocamento entre {clinica_atual} e {clinica_proxima_nome} "
                            f"e de aproximadamente {duracao_next} minutos. "
                            f"Disponivel: {max(0, folga_next)} minutos. "
                            "Ajuste o horario ou escolha outra clinica."
                        ),
                        "origem_clinica": clinica_atual,
                        "destino_clinica": clinica_proxima_nome,
                        "duracao_min": int(duracao_next),
                        "folga_min": max(0, int(folga_next)),
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


def _apply_service_duration_if_needed(db: Session, agendamento: Agendamento) -> None:
    inicio_dt = _coerce_datetime(agendamento.inicio)
    if inicio_dt is None:
        return

    fim_dt = _coerce_datetime(agendamento.fim)
    if fim_dt is not None and fim_dt > inicio_dt:
        return

    duracao_minutos = 30
    if agendamento.servico_id:
        servico = db.query(Servico).filter(Servico.id == agendamento.servico_id).first()
        if servico and servico.duracao_minutos and servico.duracao_minutos > 0:
            duracao_minutos = int(servico.duracao_minutos)

    agendamento.fim = inicio_dt + timedelta(minutes=duracao_minutos)


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

    inicio_dt = _coerce_datetime(agendamento.inicio)
    if inicio_dt is None:
        raise HTTPException(status_code=422, detail="Horario de inicio invalido para validar disponibilidade.")

    fim_dt = _coerce_datetime(agendamento.fim)
    if fim_dt is None or fim_dt <= inicio_dt:
        fim_dt = inicio_dt + timedelta(minutes=30)

    inicio_local = _to_local_naive(inicio_dt)
    fim_local = _to_local_naive(fim_dt)
    if inicio_local is None or fim_local is None:
        raise HTTPException(status_code=422, detail="Nao foi possivel validar disponibilidade do horario informado.")

    if fim_local <= inicio_local:
        raise HTTPException(status_code=422, detail="Horario final invalido para validar disponibilidade.")

    data_referencia = inicio_local.date().isoformat()

    query = (
        db.query(Agendamento)
        .filter(Agendamento.status != "Cancelado")
        .filter(func.date(Agendamento.inicio) == data_referencia)
    )
    if agendamento_id_excluir is not None:
        query = query.filter(Agendamento.id != agendamento_id_excluir)

    for existente in query.all():
        inicio_existente_dt = _coerce_datetime(existente.inicio)
        if inicio_existente_dt is None:
            continue

        fim_existente_dt = _coerce_datetime(existente.fim)
        if fim_existente_dt is None or fim_existente_dt <= inicio_existente_dt:
            fim_existente_dt = inicio_existente_dt + timedelta(minutes=30)

        inicio_existente_local = _to_local_naive(inicio_existente_dt)
        fim_existente_local = _to_local_naive(fim_existente_dt)
        if inicio_existente_local is None or fim_existente_local is None:
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

    clinica_base = db.query(Clinica).filter(Clinica.id == payload.clinica_id).first()
    if not clinica_base:
        raise HTTPException(status_code=404, detail="Clinica nao encontrada.")
    regras_rota = _obter_regras_rota_agenda(db)
    thresholds = regras_rota.get("thresholds") if isinstance(regras_rota.get("thresholds"), dict) else {}
    route_policy = regras_rota.get("route_policy") if isinstance(regras_rota.get("route_policy"), dict) else {}
    base_cfg = regras_rota.get("base") if isinstance(regras_rota.get("base"), dict) else {}

    duracao_minutos = int(payload.duracao_minutos or 0)
    if duracao_minutos <= 0:
        if payload.servico_id:
            servico = db.query(Servico).filter(Servico.id == payload.servico_id).first()
            if not servico:
                raise HTTPException(status_code=404, detail="Servico nao encontrado.")
            duracao_minutos = int(servico.duracao_minutos or 30)
        else:
            duracao_minutos = 30
    duracao_minutos = max(5, duracao_minutos)

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

    agendamentos_dia = _listar_agendamentos_ativos_do_dia(
        db,
        data_iso,
        agendamento_id_excluir=payload.ignorar_agendamento_id,
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
    while inicio_candidato < janela_fim:
        fim_candidato = inicio_candidato + timedelta(minutes=duracao_minutos)
        if fim_candidato > janela_fim:
            break

        conflita = any(
            inicio_candidato < item["fim"] and fim_candidato > item["inicio"]
            for item in agendamentos_dia
        )
        if conflita:
            inicio_candidato += timedelta(minutes=intervalo_minutos)
            continue

        anterior, proximo = _obter_vizinhos_horario(agendamentos_dia, inicio_candidato, fim_candidato)

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
            if folga_prev < tempo_prev:
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
            if folga_next < tempo_next:
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

    sugestoes.sort(key=lambda item: (item["score"], item["risco"], item["inicio"]))
    limite = max(1, min(50, int(payload.limite)))
    top_items = sugestoes[:limite]

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
    regras_rota = _obter_regras_rota_agenda(db)
    thresholds = regras_rota.get("thresholds") if isinstance(regras_rota.get("thresholds"), dict) else {}
    limite_proximidade_default = int(thresholds.get("nearby_anchor_max_travel_min") or 20)

    data_iso = _extract_date_filter(payload.data) if payload.data else datetime.now().strftime("%Y-%m-%d")
    if not data_iso:
        raise HTTPException(status_code=422, detail="Data invalida. Use o formato YYYY-MM-DD.")

    data_contato_iso = (
        _extract_date_filter(payload.data_contato)
        if payload.data_contato
        else datetime.now(LOCAL_TZ).date().isoformat()
    )
    if not data_contato_iso:
        data_contato_iso = datetime.now(LOCAL_TZ).date().isoformat()

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

    data_inicio_busca = (data_ref - timedelta(days=janela_dias)).strftime("%Y-%m-%d")
    data_fim_busca = (data_ref + timedelta(days=janela_dias)).strftime("%Y-%m-%d")

    agendamentos_periodo = _listar_agendamentos_ativos_periodo(
        db,
        data_inicio_busca,
        data_fim_busca,
        agendamento_id_excluir=payload.ignorar_agendamento_id,
    )
    perfil_norm = normalizar_perfil(payload.perfil_deslocamento)
    cache_duracoes: dict[tuple[int, int, str, bool], tuple[int, str]] = {}
    melhor_item: Optional[dict] = None
    melhor_tempo: Optional[int] = None
    melhor_rank = None

    for item in agendamentos_periodo:
        inicio_item = item.get("inicio")
        if inicio_item is None:
            continue

        status_item = (str(item.get("status") or "").strip() or "Agendado")
        if status_item not in AGENDA_STATUS_PRE_AGENDADOS:
            continue

        # Mantem o filtro de passado para datas antigas, mas preserva itens
        # do proprio dia selecionado (importante para sugestao operacional no dia).
        if inicio_item < agora_local and inicio_item.date() != data_ref:
            continue

        clinica_item_id = int(item.get("clinica_id") or 0)
        if clinica_item_id <= 0:
            continue
        if clinica_item_id == payload.clinica_id:
            if not payload.incluir_mesma_clinica:
                continue
            duracao_min, fonte = 0, "mesma_clinica"
        else:
            duracao_min, fonte = _obter_duracao_deslocamento_cacheado(
                db,
                origem_clinica_id=payload.clinica_id,
                destino_clinica_id=clinica_item_id,
                perfil=perfil_norm,
                cache=cache_duracoes,
            )
        if duracao_min <= 0:
            if clinica_item_id != payload.clinica_id:
                continue

        rank = (
            0 if inicio_item.date().isoformat() in datas_preferenciais_set else 1,
            (
                min(abs((inicio_item.date() - data_pref).days) for data_pref in datas_preferenciais_dt)
                if datas_preferenciais_dt
                else 0
            ),
            abs((inicio_item.date() - data_ref).days),
            int(duracao_min),
            inicio_item,
            int(item.get("id") or 0),
        )
        if melhor_rank is None or rank < melhor_rank:
            melhor_rank = rank
            melhor_tempo = int(duracao_min)
            melhor_item = {
                "agendamento_id": item.get("id"),
                "clinica_id": clinica_item_id,
                "clinica": item.get("clinica_nome") or _nome_clinica_por_id(db, clinica_item_id),
                "data": inicio_item.strftime("%Y-%m-%d"),
                "inicio": inicio_item.strftime("%H:%M"),
                "fim": item.get("fim").strftime("%H:%M") if item.get("fim") else None,
                "duracao_deslocamento_min": duracao_min,
                "fonte_deslocamento": fonte,
                "status": status_item,
                "data_preferencial": inicio_item.date().isoformat() in datas_preferenciais_set,
            }

    if melhor_item is None or melhor_tempo is None:
        return {
            "ok": True,
            "data": data_iso,
            "clinica_id": payload.clinica_id,
            "sugerir": False,
            "limite_minutos": limite_minutos,
            "politica_oferta": {
                **politica_oferta,
                "data_contato": data_contato_iso,
                "datas_preferenciais": datas_preferenciais,
            },
            "mensagem": "Nao encontramos agenda proxima para sugestao automatica dentro da janela configurada.",
            "item": None,
        }

    if melhor_tempo > limite_minutos:
        data_item = str(melhor_item.get("data") or data_iso)
        mensagem_limite = (
            f"Opcao mais proxima encontrada em {data_item} as {melhor_item.get('inicio')} "
            f"na clinica {melhor_item.get('clinica')} (aprox. {melhor_tempo} min de deslocamento), "
            f"acima do limite configurado de {limite_minutos} min."
        )
        return {
            "ok": True,
            "data": data_iso,
            "clinica_id": payload.clinica_id,
            "sugerir": True,
            "limite_minutos": limite_minutos,
            "politica_oferta": {
                **politica_oferta,
                "data_contato": data_contato_iso,
                "datas_preferenciais": datas_preferenciais,
            },
            "mensagem": mensagem_limite,
            "item": melhor_item,
            "acima_do_limite": True,
        }

    data_item = str(melhor_item.get("data") or data_iso)
    if int(melhor_item.get("clinica_id") or 0) == payload.clinica_id:
        mensagem = (
            f"Ja temos um agendamento na mesma clinica na data {data_item} as {melhor_item['inicio']}. "
            "Sugira esse horario para o cliente e confirme a disponibilidade."
        )
    else:
        mensagem = (
            f"Ja temos um agendamento na clinica {melhor_item['clinica']} "
            f"na data {data_item} as {melhor_item['inicio']} "
            f"(aprox. {melhor_tempo} min de deslocamento). "
            "Sugira esse horario para o cliente e confirme a disponibilidade."
        )
    if politica_oferta.get("distante_base") and politica_oferta.get("baixa_frequencia"):
        dias_txt = ", ".join([f"D+{int(dia)}" for dia in politica_oferta.get("dias_preferenciais", [])])
        if dias_txt:
            mensagem = (
                f"{mensagem} Politica recomendada para esta clinica: priorizar {dias_txt} "
                "quando nao houver ancora proxima em D+2."
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
        "politica_oferta": {
            **politica_oferta,
            "data_contato": data_contato_iso,
            "datas_preferenciais": datas_preferenciais,
        },
        "mensagem": mensagem,
        "item": melhor_item,
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
    now = datetime.now()
    db_agendamento = Agendamento(
        **agendamento.model_dump(exclude={"confirmar_conflito_deslocamento"})
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

    _apply_service_duration_if_needed(db, db_agendamento)
    _validar_agendamento_no_funcionamento(db, db_agendamento)
    _validar_slot_disponivel(db, db_agendamento)
    _validar_deslocamento_agendamento(
        db,
        db_agendamento,
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
            "contexto_agendamento": contexto,
        },
        request=request,
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

    update_data = agendamento.model_dump(exclude_unset=True)
    update_data.pop("confirmar_conflito_deslocamento", None)
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
            )
    elif reativando_cancelado:
        _apply_service_duration_if_needed(db, db_agendamento)
        _validar_agendamento_no_funcionamento(db, db_agendamento)
        _validar_slot_disponivel(db, db_agendamento, agendamento_id_excluir=agendamento_id)
        _validar_deslocamento_agendamento(
            db,
            db_agendamento,
            agendamento_id_excluir=agendamento_id,
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
            "contexto_agendamento": contexto,
        },
        request=request,
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
