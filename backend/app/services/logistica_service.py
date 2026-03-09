"""Helpers for clinic travel matrix (phase 1)."""
from __future__ import annotations

import json
import math
from datetime import datetime
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from typing import Iterable, Optional
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.clinica import Clinica
from app.models.clinica_deslocamento import ClinicaDeslocamento

PERFIS_VALIDOS = {"comercial", "plantao"}
VELOCIDADE_MEDIA_KMH = {
    "comercial": 26.0,
    "plantao": 32.0,
}
BUFFER_MINUTOS = {
    "comercial": 8,
    "plantao": 5,
}
DEFAULT_KM_MESMA_CIDADE = 12.0
DEFAULT_KM_OUTRA_CIDADE = 42.0
MIN_DURACAO_MINUTOS = 5
GOOGLE_DISTANCE_MATRIX_URL = "https://maps.googleapis.com/maps/api/distancematrix/json"
GOOGLE_ROUTES_API_URL = "https://routes.googleapis.com/directions/v2:computeRoutes"
GOOGLE_ROUTES_FIELD_MASK = "routes.distanceMeters,routes.duration,routes.staticDuration"
GOOGLE_TIMEOUT_SECONDS = 8.0


def normalizar_perfil(perfil: Optional[str]) -> str:
    perfil_norm = str(perfil or "comercial").strip().lower() or "comercial"
    return perfil_norm if perfil_norm in PERFIS_VALIDOS else "comercial"


def normalizar_perfis(perfis: Optional[Iterable[str]]) -> list[str]:
    if not perfis:
        return ["comercial", "plantao"]
    perfis_norm = []
    for item in perfis:
        perfil_norm = normalizar_perfil(item)
        if perfil_norm not in perfis_norm:
            perfis_norm.append(perfil_norm)
    return perfis_norm or ["comercial", "plantao"]


def _safe_float(value) -> Optional[float]:
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _to_decimal_2(value: float) -> Decimal:
    try:
        return Decimal(str(value)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    except (InvalidOperation, TypeError, ValueError):
        return Decimal("0.00")


def _http_get_json(url: str, timeout: float = GOOGLE_TIMEOUT_SECONDS) -> dict:
    req = Request(
        url,
        headers={
            "Accept": "application/json",
            "User-Agent": "FortCordis/1.0",
        },
    )
    with urlopen(req, timeout=timeout) as resp:
        payload = resp.read().decode("utf-8", errors="replace")
    return json.loads(payload or "{}")


def _http_post_json(url: str, body: dict, headers: dict, timeout: float = GOOGLE_TIMEOUT_SECONDS) -> dict:
    req = Request(
        url,
        data=json.dumps(body).encode("utf-8"),
        headers=headers,
        method="POST",
    )
    with urlopen(req, timeout=timeout) as resp:
        payload = resp.read().decode("utf-8", errors="replace")
    return json.loads(payload or "{}")


def _cidade_estado(value: Optional[str]) -> str:
    return str(value or "").strip().lower()


def _mesma_cidade(origem: Clinica, destino: Clinica) -> bool:
    cidade_origem = _cidade_estado(origem.cidade)
    cidade_destino = _cidade_estado(destino.cidade)
    estado_origem = _cidade_estado(origem.estado)
    estado_destino = _cidade_estado(destino.estado)
    if not cidade_origem or not cidade_destino:
        return False
    if cidade_origem != cidade_destino:
        return False
    if estado_origem and estado_destino and estado_origem != estado_destino:
        return False
    return True


def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    raio_terra_km = 6371.0
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = (
        math.sin(delta_phi / 2) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return raio_terra_km * c


def _endereco_texto_clinica(clinica: Clinica) -> str:
    endereco_parts = [
        str(getattr(clinica, "endereco", "") or "").strip(),
        str(getattr(clinica, "numero", "") or "").strip(),
        str(getattr(clinica, "bairro", "") or "").strip(),
        str(getattr(clinica, "cidade", "") or "").strip(),
        str(getattr(clinica, "estado", "") or "").strip(),
        str(getattr(clinica, "cep", "") or "").strip(),
        "Brasil",
    ]
    return ", ".join([p for p in endereco_parts if p]).strip()


def _waypoint_google_routes(clinica: Clinica) -> Optional[dict]:
    place_id = str(getattr(clinica, "place_id", "") or "").strip()
    if place_id:
        return {"placeId": place_id}

    lat = _safe_float(getattr(clinica, "latitude", None))
    lng = _safe_float(getattr(clinica, "longitude", None))
    if None not in (lat, lng):
        return {
            "location": {
                "latLng": {
                    "latitude": float(lat),
                    "longitude": float(lng),
                }
            }
        }

    endereco = _endereco_texto_clinica(clinica)
    if endereco:
        return {"address": endereco}
    return None


def _ref_google_maps(clinica: Clinica) -> Optional[str]:
    place_id = str(getattr(clinica, "place_id", "") or "").strip()
    if place_id:
        return f"place_id:{place_id}"

    lat = _safe_float(getattr(clinica, "latitude", None))
    lng = _safe_float(getattr(clinica, "longitude", None))
    if None not in (lat, lng):
        return f"{lat:.8f},{lng:.8f}"

    endereco = _endereco_texto_clinica(clinica)
    return endereco or None


def _parse_duration_seconds(duration_value) -> Optional[int]:
    if duration_value is None:
        return None
    text = str(duration_value).strip()
    if not text:
        return None
    if text.endswith("s"):
        text = text[:-1]
    try:
        seconds = float(text)
    except (TypeError, ValueError):
        return None
    if seconds < 0:
        return None
    return int(math.ceil(seconds))


def _consultar_google_routes_api_raw(
    origem_waypoint: dict,
    destino_waypoint: dict,
) -> Optional[dict]:
    api_key = str(settings.GOOGLE_MAPS_API_KEY or "").strip()
    if not api_key:
        return None

    body = {
        "origin": origem_waypoint,
        "destination": destino_waypoint,
        "travelMode": "DRIVE",
        "routingPreference": "TRAFFIC_AWARE",
        "languageCode": "pt-BR",
        "units": "METRIC",
    }
    headers = {
        "Content-Type": "application/json",
        "User-Agent": "FortCordis/1.0",
        "X-Goog-Api-Key": api_key,
        "X-Goog-FieldMask": GOOGLE_ROUTES_FIELD_MASK,
    }

    try:
        data = _http_post_json(GOOGLE_ROUTES_API_URL, body, headers=headers)
    except Exception:
        return None

    routes = data.get("routes") or []
    if not isinstance(routes, list) or not routes:
        return None

    route = routes[0] or {}
    distance_meters = route.get("distanceMeters")
    if distance_meters is None:
        return None

    try:
        distance_km = max(0.0, float(distance_meters) / 1000.0)
    except (TypeError, ValueError):
        return None

    duration_secs = _parse_duration_seconds(route.get("duration"))
    static_duration_secs = _parse_duration_seconds(route.get("staticDuration"))

    duration_traffic_min = (
        max(0, int(math.ceil(duration_secs / 60.0))) if duration_secs is not None else None
    )
    duration_base_min = (
        max(0, int(math.ceil(static_duration_secs / 60.0)))
        if static_duration_secs is not None
        else duration_traffic_min
    )

    if duration_base_min is None and duration_traffic_min is None:
        return None

    return {
        "provider": "routes_api",
        "distance_km": distance_km,
        "duracao_base_min": duration_base_min,
        "duracao_traffic_min": duration_traffic_min,
    }


def _consultar_google_distance_matrix_raw(
    origem_ref: str,
    destino_ref: str,
) -> Optional[dict]:
    api_key = str(settings.GOOGLE_MAPS_API_KEY or "").strip()
    if not api_key or not origem_ref or not destino_ref:
        return None

    params = urlencode(
        {
            "origins": origem_ref,
            "destinations": destino_ref,
            "mode": "driving",
            "language": "pt-BR",
            "region": "br",
            "departure_time": "now",
            "traffic_model": "best_guess",
            "key": api_key,
        }
    )
    url = f"{GOOGLE_DISTANCE_MATRIX_URL}?{params}"

    try:
        data = _http_get_json(url)
    except Exception:
        return None

    status = str(data.get("status") or "").strip().upper()
    if status != "OK":
        return None

    rows = data.get("rows") or []
    if not isinstance(rows, list) or not rows:
        return None

    row0 = rows[0] or {}
    elements = row0.get("elements") or []
    if not isinstance(elements, list) or not elements:
        return None

    element = elements[0] or {}
    elem_status = str(element.get("status") or "").strip().upper()
    if elem_status != "OK":
        return None

    distance_value = ((element.get("distance") or {}).get("value"))
    duration_value = ((element.get("duration") or {}).get("value"))
    duration_traffic_value = ((element.get("duration_in_traffic") or {}).get("value"))

    try:
        distance_km = max(0.0, float(distance_value) / 1000.0)
    except (TypeError, ValueError):
        return None

    duration_base_min: Optional[int] = None
    duration_traffic_min: Optional[int] = None
    try:
        if duration_value is not None:
            duration_base_min = max(0, int(math.ceil(float(duration_value) / 60.0)))
    except (TypeError, ValueError):
        duration_base_min = None
    try:
        if duration_traffic_value is not None:
            duration_traffic_min = max(0, int(math.ceil(float(duration_traffic_value) / 60.0)))
    except (TypeError, ValueError):
        duration_traffic_min = None

    if duration_base_min is None and duration_traffic_min is None:
        return None

    return {
        "provider": "distance_matrix",
        "distance_km": distance_km,
        "duracao_base_min": duration_base_min,
        "duracao_traffic_min": duration_traffic_min,
    }


def estimar_deslocamento(
    origem: Clinica,
    destino: Clinica,
    *,
    perfil: str = "comercial",
    google_cache: Optional[dict] = None,
) -> tuple[float, int, str]:
    """Estimate travel distance/duration with Google Distance Matrix + fallback heuristics."""
    if not origem or not destino:
        return 0.0, 0, "indefinido"

    if origem.id == destino.id:
        return 0.0, 0, "mesma_clinica"

    perfil_norm = normalizar_perfil(perfil)

    origem_waypoint = _waypoint_google_routes(origem)
    destino_waypoint = _waypoint_google_routes(destino)
    origem_ref = _ref_google_maps(origem)
    destino_ref = _ref_google_maps(destino)
    google_result = None
    if str(settings.GOOGLE_MAPS_API_KEY or "").strip():
        cache = google_cache if isinstance(google_cache, dict) else None
        origem_cache_ref = (
            json.dumps(origem_waypoint, ensure_ascii=True, sort_keys=True)
            if origem_waypoint is not None
            else str(origem_ref or "")
        )
        destino_cache_ref = (
            json.dumps(destino_waypoint, ensure_ascii=True, sort_keys=True)
            if destino_waypoint is not None
            else str(destino_ref or "")
        )
        cache_key = (origem_cache_ref, destino_cache_ref)
        if cache is not None and cache_key in cache:
            google_result = cache.get(cache_key)
        else:
            if origem_waypoint and destino_waypoint:
                google_result = _consultar_google_routes_api_raw(origem_waypoint, destino_waypoint)
            if google_result is None and origem_ref and destino_ref:
                google_result = _consultar_google_distance_matrix_raw(origem_ref, destino_ref)
            if cache is not None:
                cache[cache_key] = google_result

    if google_result:
        distancia_km = round(max(0.0, float(google_result.get("distance_km") or 0.0)), 2)
        duracao_base = google_result.get("duracao_base_min")
        duracao_traffic = google_result.get("duracao_traffic_min")
        provider = str(google_result.get("provider") or "google").strip().lower()
        provider_prefix = "google_routes_api" if provider == "routes_api" else "google_distance_matrix"
        if perfil_norm == "comercial":
            duracao_escolhida = duracao_traffic if duracao_traffic is not None else duracao_base
            fonte = f"{provider_prefix}_traffic" if duracao_traffic is not None else provider_prefix
        else:
            duracao_escolhida = duracao_base if duracao_base is not None else duracao_traffic
            fonte = provider_prefix

        duracao_min = max(MIN_DURACAO_MINUTOS, int(duracao_escolhida or 0))
        return distancia_km, duracao_min, fonte

    lat1 = _safe_float(origem.latitude)
    lon1 = _safe_float(origem.longitude)
    lat2 = _safe_float(destino.latitude)
    lon2 = _safe_float(destino.longitude)

    if None not in (lat1, lon1, lat2, lon2):
        distancia_km = _haversine_km(lat1, lon1, lat2, lon2)
        fonte = "heuristica_haversine"
    elif _mesma_cidade(origem, destino):
        distancia_km = DEFAULT_KM_MESMA_CIDADE
        fonte = "heuristica_mesma_cidade"
    else:
        distancia_km = DEFAULT_KM_OUTRA_CIDADE
        fonte = "heuristica_regional"

    velocidade = VELOCIDADE_MEDIA_KMH.get(perfil_norm, VELOCIDADE_MEDIA_KMH["comercial"])
    buffer_min = BUFFER_MINUTOS.get(perfil_norm, BUFFER_MINUTOS["comercial"])
    duracao_base = (distancia_km / max(1.0, velocidade)) * 60.0
    duracao_min = max(MIN_DURACAO_MINUTOS, int(math.ceil(duracao_base + buffer_min)))

    return round(max(0.0, distancia_km), 2), duracao_min, fonte


def upsert_deslocamento(
    db: Session,
    *,
    origem_clinica_id: int,
    destino_clinica_id: int,
    perfil: str,
    distancia_km: float,
    duracao_min: int,
    fonte: str,
    force_override: bool = False,
) -> tuple[ClinicaDeslocamento, bool, bool]:
    """Upsert matrix record.

    Returns: (row, changed, skipped_manual_override).
    """
    perfil_norm = normalizar_perfil(perfil)
    row = (
        db.query(ClinicaDeslocamento)
        .filter(
            ClinicaDeslocamento.origem_clinica_id == origem_clinica_id,
            ClinicaDeslocamento.destino_clinica_id == destino_clinica_id,
            ClinicaDeslocamento.perfil == perfil_norm,
        )
        .first()
    )

    if row and row.manual_override and not force_override:
        return row, False, True

    mudou = False
    distancia_decimal = _to_decimal_2(distancia_km)
    duracao_int = max(0, int(duracao_min or 0))
    fonte_texto = str(fonte or "heuristica").strip() or "heuristica"

    if row is None:
        row = ClinicaDeslocamento(
            origem_clinica_id=origem_clinica_id,
            destino_clinica_id=destino_clinica_id,
            perfil=perfil_norm,
            distancia_km=distancia_decimal,
            duracao_min=duracao_int,
            fonte=fonte_texto,
            manual_override=False,
            updated_at=datetime.utcnow(),
        )
        db.add(row)
        return row, True, False

    if row.distancia_km != distancia_decimal:
        row.distancia_km = distancia_decimal
        mudou = True
    if row.duracao_min != duracao_int:
        row.duracao_min = duracao_int
        mudou = True
    if row.fonte != fonte_texto:
        row.fonte = fonte_texto
        mudou = True

    if mudou:
        row.updated_at = datetime.utcnow()

    return row, mudou, False


def recalcular_matriz_para_clinica(
    db: Session,
    clinica_id: int,
    *,
    perfis: Optional[Iterable[str]] = None,
    force_override: bool = False,
    incluir_inativas: bool = False,
) -> dict:
    perfis_norm = normalizar_perfis(perfis)

    query_clinicas = db.query(Clinica)
    if not incluir_inativas:
        query_clinicas = query_clinicas.filter(Clinica.ativo == True)
    clinicas = query_clinicas.order_by(Clinica.id.asc()).all()
    mapa = {int(c.id): c for c in clinicas if c and c.id is not None}

    origem_principal = mapa.get(int(clinica_id))
    if origem_principal is None:
        return {"ok": False, "updated": 0, "skipped_manual": 0, "profiles": perfis_norm}

    updated = 0
    skipped_manual = 0
    google_cache: dict = {}

    for destino in clinicas:
        pares = [(origem_principal, destino)]
        if destino.id != origem_principal.id:
            pares.append((destino, origem_principal))

        for origem, destino_real in pares:
            for perfil in perfis_norm:
                distancia_km, duracao_min, fonte = estimar_deslocamento(
                    origem,
                    destino_real,
                    perfil=perfil,
                    google_cache=google_cache,
                )
                _row, changed, skipped = upsert_deslocamento(
                    db,
                    origem_clinica_id=int(origem.id),
                    destino_clinica_id=int(destino_real.id),
                    perfil=perfil,
                    distancia_km=distancia_km,
                    duracao_min=duracao_min,
                    fonte=fonte,
                    force_override=force_override,
                )
                if changed:
                    updated += 1
                if skipped:
                    skipped_manual += 1

    db.commit()
    return {
        "ok": True,
        "updated": updated,
        "skipped_manual": skipped_manual,
        "profiles": perfis_norm,
    }


def recalcular_matriz_completa(
    db: Session,
    *,
    perfis: Optional[Iterable[str]] = None,
    force_override: bool = False,
    incluir_inativas: bool = False,
) -> dict:
    perfis_norm = normalizar_perfis(perfis)
    query_clinicas = db.query(Clinica)
    if not incluir_inativas:
        query_clinicas = query_clinicas.filter(Clinica.ativo == True)
    clinicas = query_clinicas.order_by(Clinica.id.asc()).all()

    updated = 0
    skipped_manual = 0
    google_cache: dict = {}

    for origem in clinicas:
        for destino in clinicas:
            for perfil in perfis_norm:
                distancia_km, duracao_min, fonte = estimar_deslocamento(
                    origem,
                    destino,
                    perfil=perfil,
                    google_cache=google_cache,
                )
                _row, changed, skipped = upsert_deslocamento(
                    db,
                    origem_clinica_id=int(origem.id),
                    destino_clinica_id=int(destino.id),
                    perfil=perfil,
                    distancia_km=distancia_km,
                    duracao_min=duracao_min,
                    fonte=fonte,
                    force_override=force_override,
                )
                if changed:
                    updated += 1
                if skipped:
                    skipped_manual += 1

    db.commit()
    total_celulas = len(clinicas) * len(clinicas) * len(perfis_norm)
    return {
        "ok": True,
        "updated": updated,
        "skipped_manual": skipped_manual,
        "profiles": perfis_norm,
        "total_celulas": total_celulas,
    }


def obter_ou_criar_deslocamento(
    db: Session,
    *,
    origem_clinica_id: int,
    destino_clinica_id: int,
    perfil: str = "comercial",
    force_recalculate: bool = False,
) -> Optional[ClinicaDeslocamento]:
    perfil_norm = normalizar_perfil(perfil)
    row = (
        db.query(ClinicaDeslocamento)
        .filter(
            ClinicaDeslocamento.origem_clinica_id == origem_clinica_id,
            ClinicaDeslocamento.destino_clinica_id == destino_clinica_id,
            ClinicaDeslocamento.perfil == perfil_norm,
        )
        .first()
    )

    # Regra operacional: ajuste manual sempre prevalece.
    # Mesmo com force_recalculate=True (ex.: "recalcular par"), nao sobrescreve manual_override.
    if row:
        if bool(row.manual_override):
            return row
        if not force_recalculate:
            return row

    origem = db.query(Clinica).filter(Clinica.id == origem_clinica_id).first()
    destino = db.query(Clinica).filter(Clinica.id == destino_clinica_id).first()
    if not origem or not destino:
        return None

    distancia_km, duracao_min, fonte = estimar_deslocamento(origem, destino, perfil=perfil_norm)
    row, _changed, skipped = upsert_deslocamento(
        db,
        origem_clinica_id=origem_clinica_id,
        destino_clinica_id=destino_clinica_id,
        perfil=perfil_norm,
        distancia_km=distancia_km,
        duracao_min=duracao_min,
        fonte=fonte,
        force_override=force_recalculate,
    )
    if not skipped:
        db.commit()
    return row


def obter_duracao_deslocamento(
    db: Session,
    *,
    origem_clinica_id: Optional[int],
    destino_clinica_id: Optional[int],
    perfil: str = "comercial",
    permitir_estimativa_fallback: bool = True,
) -> tuple[int, str]:
    """Returns travel duration in minutes for a clinic pair without mutating DB."""
    origem_id = int(origem_clinica_id or 0)
    destino_id = int(destino_clinica_id or 0)
    if origem_id <= 0 or destino_id <= 0:
        return 0, "clinica_indefinida"
    if origem_id == destino_id:
        return 0, "mesma_clinica"

    perfil_norm = normalizar_perfil(perfil)
    row = (
        db.query(ClinicaDeslocamento)
        .filter(
            ClinicaDeslocamento.origem_clinica_id == origem_id,
            ClinicaDeslocamento.destino_clinica_id == destino_id,
            ClinicaDeslocamento.perfil == perfil_norm,
        )
        .first()
    )
    if row and row.duracao_min is not None:
        return max(0, int(row.duracao_min)), str(row.fonte or "matriz")

    if not permitir_estimativa_fallback:
        return 0, "sem_matriz"

    origem = db.query(Clinica).filter(Clinica.id == origem_id).first()
    destino = db.query(Clinica).filter(Clinica.id == destino_id).first()
    if not origem or not destino:
        return 0, "clinica_nao_encontrada"

    _distancia_km, duracao_min, fonte = estimar_deslocamento(origem, destino, perfil=perfil_norm)
    return max(0, int(duracao_min or 0)), fonte


def serialize_deslocamento(row: ClinicaDeslocamento) -> dict:
    return {
        "id": row.id,
        "origem_clinica_id": row.origem_clinica_id,
        "destino_clinica_id": row.destino_clinica_id,
        "perfil": row.perfil,
        "distancia_km": float(row.distancia_km or 0),
        "duracao_min": int(row.duracao_min or 0),
        "fonte": row.fonte,
        "manual_override": bool(row.manual_override),
        "observacoes": row.observacoes,
        "updated_at": str(row.updated_at) if row.updated_at else None,
    }
