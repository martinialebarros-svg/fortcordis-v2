"""Helpers for clinic travel matrix (phase 1)."""
from __future__ import annotations

import json
import math
from collections import defaultdict
from datetime import datetime, timedelta
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from types import SimpleNamespace
from typing import Iterable, Optional
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from sqlalchemy import case, func, or_
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.clinica import Clinica
from app.models.clinica_deslocamento import ClinicaDeslocamento
from app.models.google_maps_usage_metrica import GoogleMapsUsageMetrica

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
DEFAULT_METRICAS_WINDOW_DIAS = 30


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


def _normalize_datetime(value: Optional[datetime]) -> Optional[datetime]:
    if value is None:
        return None
    if getattr(value, "tzinfo", None) is not None:
        return value.astimezone().replace(tzinfo=None)
    return value


def _utc_now_naive() -> datetime:
    return datetime.utcnow()


def _cache_max_age_days() -> int:
    try:
        return max(0, int(getattr(settings, "GOOGLE_ROUTES_CACHE_MAX_AGE_DAYS", 7) or 0))
    except (TypeError, ValueError):
        return 7


def _metrics_retention_days() -> int:
    try:
        return max(1, int(getattr(settings, "GOOGLE_MAPS_USAGE_METRICS_RETENTION_DAYS", 90) or 90))
    except (TypeError, ValueError):
        return 90


def _force_refresh_heuristica_com_api_key() -> bool:
    return bool(getattr(settings, "LOGISTICA_FORCE_REFRESH_HEURISTICA_COM_API_KEY", False))


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


def _row_base_datetime(row: Optional[ClinicaDeslocamento]) -> Optional[datetime]:
    if row is None:
        return None
    updated = _normalize_datetime(getattr(row, "updated_at", None))
    created = _normalize_datetime(getattr(row, "created_at", None))
    return updated or created


def _clinic_geocode_datetime(clinica: Optional[Clinica]) -> Optional[datetime]:
    return _normalize_datetime(getattr(clinica, "geocode_at", None)) if clinica else None


def _build_google_metric_context(origem: Clinica, destino: Clinica, perfil: str) -> dict:
    return {
        "origem_clinica_id": int(getattr(origem, "id", 0) or 0) or None,
        "destino_clinica_id": int(getattr(destino, "id", 0) or 0) or None,
        "perfil": normalizar_perfil(perfil),
    }


def _append_google_metric_event(
    telemetry_events: Optional[list[dict]],
    *,
    service: str,
    operation: str,
    provider: str,
    status: str,
    context: Optional[dict] = None,
) -> None:
    if not isinstance(telemetry_events, list):
        return
    payload = {
        "service": str(service or "").strip() or "maps",
        "operation": str(operation or "").strip() or "unknown",
        "provider": str(provider or "").strip() or "unknown",
        "status": str(status or "").strip().lower() or "unknown",
    }
    if isinstance(context, dict):
        payload.update(
            {
                "origem_clinica_id": context.get("origem_clinica_id"),
                "destino_clinica_id": context.get("destino_clinica_id"),
                "perfil": context.get("perfil"),
            }
        )
    telemetry_events.append(payload)


def registrar_google_maps_metricas(
    db: Session,
    telemetry_events: Optional[list[dict]],
) -> int:
    if not isinstance(telemetry_events, list) or not telemetry_events:
        return 0

    rows = []
    for event in telemetry_events:
        if not isinstance(event, dict):
            continue
        rows.append(
            GoogleMapsUsageMetrica(
                service=str(event.get("service") or "maps").strip() or "maps",
                operation=str(event.get("operation") or "unknown").strip() or "unknown",
                provider=str(event.get("provider") or "unknown").strip() or "unknown",
                status=str(event.get("status") or "unknown").strip().lower() or "unknown",
                origem_clinica_id=event.get("origem_clinica_id"),
                destino_clinica_id=event.get("destino_clinica_id"),
                perfil=str(event.get("perfil") or "").strip() or None,
            )
        )

    if not rows:
        return 0

    db.add_all(rows)
    return len(rows)


def _deslocamento_esta_atual(
    row: Optional[ClinicaDeslocamento],
    *,
    origem: Clinica,
    destino: Clinica,
) -> bool:
    if row is None:
        return False
    if bool(getattr(row, "manual_override", False)):
        return True

    fonte = str(getattr(row, "fonte", "") or "").strip().lower()
    if fonte.startswith("heuristica"):
        origem_ref = _ref_google_maps(origem)
        destino_ref = _ref_google_maps(destino)
        if (
            _force_refresh_heuristica_com_api_key()
            and origem_ref
            and destino_ref
            and str(settings.GOOGLE_MAPS_API_KEY or "").strip()
        ):
            return False

    row_at = _row_base_datetime(row)
    if row_at is None:
        return False

    cache_max_age_days = _cache_max_age_days()
    if fonte.startswith("google_") and cache_max_age_days > 0:
        limite = _utc_now_naive() - timedelta(days=cache_max_age_days)
        if row_at < limite:
            return False

    for clinica_at in (_clinic_geocode_datetime(origem), _clinic_geocode_datetime(destino)):
        if clinica_at and row_at < clinica_at:
            return False

    return True


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
    *,
    telemetry_events: Optional[list[dict]] = None,
    metric_context: Optional[dict] = None,
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
        _append_google_metric_event(
            telemetry_events,
            service="routes",
            operation="compute_routes_pro",
            provider="routes_api",
            status="error",
            context=metric_context,
        )
        return None

    routes = data.get("routes") or []
    if not isinstance(routes, list) or not routes:
        _append_google_metric_event(
            telemetry_events,
            service="routes",
            operation="compute_routes_pro",
            provider="routes_api",
            status="empty",
            context=metric_context,
        )
        return None

    route = routes[0] or {}
    distance_meters = route.get("distanceMeters")
    if distance_meters is None:
        _append_google_metric_event(
            telemetry_events,
            service="routes",
            operation="compute_routes_pro",
            provider="routes_api",
            status="empty",
            context=metric_context,
        )
        return None

    try:
        distance_km = max(0.0, float(distance_meters) / 1000.0)
    except (TypeError, ValueError):
        _append_google_metric_event(
            telemetry_events,
            service="routes",
            operation="compute_routes_pro",
            provider="routes_api",
            status="error",
            context=metric_context,
        )
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
        _append_google_metric_event(
            telemetry_events,
            service="routes",
            operation="compute_routes_pro",
            provider="routes_api",
            status="empty",
            context=metric_context,
        )
        return None

    _append_google_metric_event(
        telemetry_events,
        service="routes",
        operation="compute_routes_pro",
        provider="routes_api",
        status="ok",
        context=metric_context,
    )

    return {
        "provider": "routes_api",
        "distance_km": distance_km,
        "duracao_base_min": duration_base_min,
        "duracao_traffic_min": duration_traffic_min,
    }


def _consultar_google_distance_matrix_raw(
    origem_ref: str,
    destino_ref: str,
    *,
    telemetry_events: Optional[list[dict]] = None,
    metric_context: Optional[dict] = None,
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
        _append_google_metric_event(
            telemetry_events,
            service="routes",
            operation="distance_matrix",
            provider="distance_matrix",
            status="error",
            context=metric_context,
        )
        return None

    status = str(data.get("status") or "").strip().upper()
    if status != "OK":
        _append_google_metric_event(
            telemetry_events,
            service="routes",
            operation="distance_matrix",
            provider="distance_matrix",
            status="empty",
            context=metric_context,
        )
        return None

    rows = data.get("rows") or []
    if not isinstance(rows, list) or not rows:
        _append_google_metric_event(
            telemetry_events,
            service="routes",
            operation="distance_matrix",
            provider="distance_matrix",
            status="empty",
            context=metric_context,
        )
        return None

    row0 = rows[0] or {}
    elements = row0.get("elements") or []
    if not isinstance(elements, list) or not elements:
        _append_google_metric_event(
            telemetry_events,
            service="routes",
            operation="distance_matrix",
            provider="distance_matrix",
            status="empty",
            context=metric_context,
        )
        return None

    element = elements[0] or {}
    elem_status = str(element.get("status") or "").strip().upper()
    if elem_status != "OK":
        _append_google_metric_event(
            telemetry_events,
            service="routes",
            operation="distance_matrix",
            provider="distance_matrix",
            status="empty",
            context=metric_context,
        )
        return None

    distance_value = ((element.get("distance") or {}).get("value"))
    duration_value = ((element.get("duration") or {}).get("value"))
    duration_traffic_value = ((element.get("duration_in_traffic") or {}).get("value"))

    try:
        distance_km = max(0.0, float(distance_value) / 1000.0)
    except (TypeError, ValueError):
        _append_google_metric_event(
            telemetry_events,
            service="routes",
            operation="distance_matrix",
            provider="distance_matrix",
            status="error",
            context=metric_context,
        )
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
        _append_google_metric_event(
            telemetry_events,
            service="routes",
            operation="distance_matrix",
            provider="distance_matrix",
            status="empty",
            context=metric_context,
        )
        return None

    _append_google_metric_event(
        telemetry_events,
        service="routes",
        operation="distance_matrix",
        provider="distance_matrix",
        status="ok",
        context=metric_context,
    )

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
    telemetry_events: Optional[list[dict]] = None,
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
    metric_context = _build_google_metric_context(origem, destino, perfil_norm)
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
                google_result = _consultar_google_routes_api_raw(
                    origem_waypoint,
                    destino_waypoint,
                    telemetry_events=telemetry_events,
                    metric_context=metric_context,
                )
            if google_result is None and origem_ref and destino_ref:
                google_result = _consultar_google_distance_matrix_raw(
                    origem_ref,
                    destino_ref,
                    telemetry_events=telemetry_events,
                    metric_context=metric_context,
                )
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


def materializar_deslocamento_par(
    db: Session,
    *,
    origem: Clinica,
    destino: Clinica,
    perfis: Optional[Iterable[str]] = None,
    force_override: bool = False,
) -> dict[str, ClinicaDeslocamento]:
    """Resolve a route once and persist the requested profiles.

    A shared in-memory Google cache lets multiple profiles reuse the same
    upstream route lookup for the same clinic pair.
    """
    perfis_norm = normalizar_perfis(perfis)
    rows: dict[str, ClinicaDeslocamento] = {}
    google_cache: dict = {}
    telemetry_events: list[dict] = []

    for perfil in perfis_norm:
        distancia_km, duracao_min, fonte = estimar_deslocamento(
            origem,
            destino,
            perfil=perfil,
            google_cache=google_cache,
            telemetry_events=telemetry_events,
        )
        row, _changed, _skipped = upsert_deslocamento(
            db,
            origem_clinica_id=int(origem.id),
            destino_clinica_id=int(destino.id),
            perfil=perfil,
            distancia_km=distancia_km,
            duracao_min=duracao_min,
            fonte=fonte,
            force_override=force_override,
        )
        rows[perfil] = row

    registrar_google_maps_metricas(db, telemetry_events)
    db.commit()
    return rows


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
    telemetry_events: list[dict] = []
    rows_existentes = (
        db.query(ClinicaDeslocamento)
        .filter(
            ClinicaDeslocamento.perfil.in_(perfis_norm),
            ClinicaDeslocamento.origem_clinica_id.in_(list(mapa.keys())),
            ClinicaDeslocamento.destino_clinica_id.in_(list(mapa.keys())),
        )
        .all()
    )
    rows_map = {
        (int(row.origem_clinica_id), int(row.destino_clinica_id), str(row.perfil or "")): row
        for row in rows_existentes
    }

    for destino in clinicas:
        pares = [(origem_principal, destino)]
        if destino.id != origem_principal.id:
            pares.append((destino, origem_principal))

        for origem, destino_real in pares:
            for perfil in perfis_norm:
                row_existente = rows_map.get((int(origem.id), int(destino_real.id), perfil))
                if (
                    not force_override
                    and _deslocamento_esta_atual(
                        row_existente,
                        origem=origem,
                        destino=destino_real,
                    )
                ):
                    continue
                distancia_km, duracao_min, fonte = estimar_deslocamento(
                    origem,
                    destino_real,
                    perfil=perfil,
                    google_cache=google_cache,
                    telemetry_events=telemetry_events,
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
                    rows_map[(int(origem.id), int(destino_real.id), perfil)] = _row
                if skipped:
                    skipped_manual += 1

    registrar_google_maps_metricas(db, telemetry_events)
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
    telemetry_events: list[dict] = []
    clinica_ids = [int(clinica.id) for clinica in clinicas if clinica.id is not None]
    rows_existentes = []
    if clinica_ids:
        rows_existentes = (
            db.query(ClinicaDeslocamento)
            .filter(
                ClinicaDeslocamento.perfil.in_(perfis_norm),
                ClinicaDeslocamento.origem_clinica_id.in_(clinica_ids),
                ClinicaDeslocamento.destino_clinica_id.in_(clinica_ids),
            )
            .all()
        )
    rows_map = {
        (int(row.origem_clinica_id), int(row.destino_clinica_id), str(row.perfil or "")): row
        for row in rows_existentes
    }

    for origem in clinicas:
        for destino in clinicas:
            for perfil in perfis_norm:
                row_existente = rows_map.get((int(origem.id), int(destino.id), perfil))
                if (
                    not force_override
                    and _deslocamento_esta_atual(
                        row_existente,
                        origem=origem,
                        destino=destino,
                    )
                ):
                    continue
                distancia_km, duracao_min, fonte = estimar_deslocamento(
                    origem,
                    destino,
                    perfil=perfil,
                    google_cache=google_cache,
                    telemetry_events=telemetry_events,
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
                    rows_map[(int(origem.id), int(destino.id), perfil)] = _row
                if skipped:
                    skipped_manual += 1

    registrar_google_maps_metricas(db, telemetry_events)
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
    origem = db.query(Clinica).filter(Clinica.id == origem_clinica_id).first()
    destino = db.query(Clinica).filter(Clinica.id == destino_clinica_id).first()
    if not origem or not destino:
        return None

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
        if not force_recalculate and _deslocamento_esta_atual(row, origem=origem, destino=destino):
            return row

    rows = materializar_deslocamento_par(
        db,
        origem=origem,
        destino=destino,
        perfis=[perfil_norm],
        force_override=force_recalculate,
    )
    return rows.get(perfil_norm)


def obter_duracao_deslocamento(
    db: Session,
    *,
    origem_clinica_id: Optional[int],
    destino_clinica_id: Optional[int],
    perfil: str = "comercial",
    permitir_estimativa_fallback: bool = True,
) -> tuple[int, str]:
    """Returns travel duration for a clinic pair and persists cache misses."""
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
    origem = db.query(Clinica).filter(Clinica.id == origem_id).first()
    destino = db.query(Clinica).filter(Clinica.id == destino_id).first()
    if not origem or not destino:
        return 0, "clinica_nao_encontrada"
    if row and row.duracao_min is not None and _deslocamento_esta_atual(row, origem=origem, destino=destino):
        return max(0, int(row.duracao_min)), str(row.fonte or "matriz")

    if not permitir_estimativa_fallback:
        return 0, "sem_matriz"

    # On the first miss, populate both operational profiles while the shared
    # Google cache is warm. This keeps accuracy from Google Maps without paying
    # for the same pair again on the next lookup.
    rows = materializar_deslocamento_par(
        db,
        origem=origem,
        destino=destino,
        perfis=["comercial", "plantao"],
    )
    row = rows.get(perfil_norm)
    if row and row.duracao_min is not None:
        return max(0, int(row.duracao_min)), str(row.fonte or "matriz")
    return 0, "sem_matriz"


def resumir_cobertura_matriz_deslocamentos(
    db: Session,
    *,
    incluir_inativas: bool = False,
) -> dict:
    """Read-only snapshot: persisted matrix rows (Google vs heuristics) vs clinic geolocation.

    Rows are counted only when both endpoints belong to the clinic scope (same rule as /matriz).
    """
    query_clinicas = db.query(Clinica)
    if not incluir_inativas:
        query_clinicas = query_clinicas.filter(Clinica.ativo == True)
    clinicas = query_clinicas.order_by(Clinica.id.asc()).all()
    clinica_ids = [int(c.id) for c in clinicas if c.id is not None]
    n = len(clinica_ids)
    perfis_operacionais = len(normalizar_perfis(None))
    celulas_teoricas = n * n * perfis_operacionais if n else 0

    tem_place_id = 0
    tem_latlng = 0
    sem_endereco_texto = 0
    for c in clinicas:
        if str(getattr(c, "place_id", "") or "").strip():
            tem_place_id += 1
        lat = _safe_float(getattr(c, "latitude", None))
        lng = _safe_float(getattr(c, "longitude", None))
        if lat is not None and lng is not None:
            tem_latlng += 1
        if not _endereco_texto_clinica(c):
            sem_endereco_texto += 1

    if not clinica_ids:
        return {
            "escopo": {
                "incluir_inativas": bool(incluir_inativas),
                "total_clinicas": 0,
                "clinica_ids": [],
            },
            "clinicas_localizacao": {
                "com_place_id": 0,
                "com_latitude_longitude": 0,
                "sem_endereco_texto_minimo": 0,
            },
            "matriz": {
                "perfis_operacionais": perfis_operacionais,
                "celulas_teoricas": 0,
                "linhas_no_escopo": 0,
                "celulas_sem_linha_estimadas": 0,
                "por_bucket": {},
                "por_fonte_top": [],
                "amostra_heuristica": [],
            },
            "contexto": {
                "google_maps_api_key_configurada": bool(str(settings.GOOGLE_MAPS_API_KEY or "").strip()),
                "cache_max_age_days": _cache_max_age_days(),
                "force_refresh_heuristica_com_api_key": _force_refresh_heuristica_com_api_key(),
            },
        }

    fonte_lower = func.lower(func.coalesce(ClinicaDeslocamento.fonte, ""))
    bucket_expr = case(
        (ClinicaDeslocamento.manual_override == True, "manual_ou_override"),
        (fonte_lower == "manual", "manual_ou_override"),
        (fonte_lower.like("google%"), "google_api"),
        (fonte_lower.like("heuristica%"), "heuristica_local"),
        else_="outros",
    )

    escopo_rows = (
        db.query(bucket_expr.label("bucket"), func.count(ClinicaDeslocamento.id))
        .filter(
            ClinicaDeslocamento.origem_clinica_id.in_(clinica_ids),
            ClinicaDeslocamento.destino_clinica_id.in_(clinica_ids),
        )
        .group_by(bucket_expr)
        .all()
    )
    por_bucket: dict[str, int] = {str(row[0]): int(row[1]) for row in escopo_rows}

    fonte_rows = (
        db.query(
            ClinicaDeslocamento.fonte,
            ClinicaDeslocamento.perfil,
            func.count(ClinicaDeslocamento.id),
        )
        .filter(
            ClinicaDeslocamento.origem_clinica_id.in_(clinica_ids),
            ClinicaDeslocamento.destino_clinica_id.in_(clinica_ids),
        )
        .group_by(ClinicaDeslocamento.fonte, ClinicaDeslocamento.perfil)
        .order_by(func.count(ClinicaDeslocamento.id).desc())
        .limit(40)
        .all()
    )
    por_fonte_top = [
        {"fonte": r[0], "perfil": str(r[1] or ""), "linhas": int(r[2])}
        for r in fonte_rows
    ]

    linhas_no_escopo = sum(por_bucket.values())
    celulas_sem_linha = max(0, celulas_teoricas - linhas_no_escopo)

    amostra = (
        db.query(
            ClinicaDeslocamento.origem_clinica_id,
            ClinicaDeslocamento.destino_clinica_id,
            ClinicaDeslocamento.perfil,
            ClinicaDeslocamento.fonte,
        )
        .filter(
            ClinicaDeslocamento.origem_clinica_id.in_(clinica_ids),
            ClinicaDeslocamento.destino_clinica_id.in_(clinica_ids),
            fonte_lower.like("heuristica%"),
            ClinicaDeslocamento.manual_override == False,
        )
        .order_by(
            ClinicaDeslocamento.origem_clinica_id,
            ClinicaDeslocamento.destino_clinica_id,
            ClinicaDeslocamento.perfil,
        )
        .limit(40)
        .all()
    )
    amostra_heuristica = [
        {
            "origem_clinica_id": int(r[0]),
            "destino_clinica_id": int(r[1]),
            "perfil": str(r[2] or ""),
            "fonte": str(r[3] or ""),
        }
        for r in amostra
    ]

    linhas_fora_escopo: Optional[int] = None
    if not incluir_inativas:
        linhas_fora_escopo = int(
            db.query(func.count(ClinicaDeslocamento.id))
            .filter(
                or_(
                    ClinicaDeslocamento.origem_clinica_id.notin_(clinica_ids),
                    ClinicaDeslocamento.destino_clinica_id.notin_(clinica_ids),
                )
            )
            .scalar()
            or 0
        )

    return {
        "escopo": {
            "incluir_inativas": bool(incluir_inativas),
            "total_clinicas": n,
            "clinica_ids": clinica_ids,
        },
        "clinicas_localizacao": {
            "com_place_id": tem_place_id,
            "com_latitude_longitude": tem_latlng,
            "sem_endereco_texto_minimo": sem_endereco_texto,
        },
        "matriz": {
            "perfis_operacionais": perfis_operacionais,
            "celulas_teoricas": celulas_teoricas,
            "linhas_no_escopo": linhas_no_escopo,
            "celulas_sem_linha_estimadas": celulas_sem_linha,
            "por_bucket": por_bucket,
            "por_fonte_top": por_fonte_top,
            "amostra_heuristica": amostra_heuristica,
        },
        "contexto": {
            "google_maps_api_key_configurada": bool(str(settings.GOOGLE_MAPS_API_KEY or "").strip()),
            "cache_max_age_days": _cache_max_age_days(),
            "force_refresh_heuristica_com_api_key": _force_refresh_heuristica_com_api_key(),
            "linhas_fora_escopo_clinicas_ativas": linhas_fora_escopo,
        },
    }


def resumir_google_maps_metricas(
    db: Session,
    *,
    dias: int = DEFAULT_METRICAS_WINDOW_DIAS,
    incluir_inativas: bool = False,
) -> dict:
    dias_norm = max(1, min(365, int(dias or DEFAULT_METRICAS_WINDOW_DIAS)))
    inicio_janela = _utc_now_naive() - timedelta(days=dias_norm)

    metricas = (
        db.query(GoogleMapsUsageMetrica)
        .filter(GoogleMapsUsageMetrica.created_at >= inicio_janela)
        .order_by(GoogleMapsUsageMetrica.created_at.asc())
        .all()
    )

    por_dia: dict[str, int] = defaultdict(int)
    por_operacao: dict[str, int] = defaultdict(int)
    por_status: dict[str, int] = defaultdict(int)
    top_pares: dict[tuple[int | None, int | None], dict] = {}

    total_ok = 0
    for item in metricas:
        created_at = _normalize_datetime(getattr(item, "created_at", None)) or _utc_now_naive()
        dia = created_at.date().isoformat()
        por_dia[dia] += 1
        operacao = str(getattr(item, "operation", "") or "unknown").strip() or "unknown"
        status = str(getattr(item, "status", "") or "unknown").strip().lower() or "unknown"
        por_operacao[operacao] += 1
        por_status[status] += 1
        if status == "ok":
            total_ok += 1

        pair_key = (
            getattr(item, "origem_clinica_id", None),
            getattr(item, "destino_clinica_id", None),
        )
        pair_bucket = top_pares.setdefault(
            pair_key,
            {
                "origem_clinica_id": pair_key[0],
                "destino_clinica_id": pair_key[1],
                "calls": 0,
                "last_called_at": None,
            },
        )
        pair_bucket["calls"] += 1
        pair_bucket["last_called_at"] = created_at.isoformat(sep=" ")

    query_clinicas = db.query(
        Clinica.id,
        Clinica.ativo,
        Clinica.endereco,
        Clinica.numero,
        Clinica.bairro,
        Clinica.cidade,
        Clinica.estado,
        Clinica.cep,
        Clinica.place_id,
        Clinica.latitude,
        Clinica.longitude,
        Clinica.geocode_at,
    )
    if not incluir_inativas:
        query_clinicas = query_clinicas.filter(Clinica.ativo == True)
    clinicas = query_clinicas.all()
    clinicas_map = {
        int(item.id): SimpleNamespace(
            id=item.id,
            endereco=item.endereco,
            numero=item.numero,
            bairro=item.bairro,
            cidade=item.cidade,
            estado=item.estado,
            cep=item.cep,
            place_id=item.place_id,
            latitude=item.latitude,
            longitude=item.longitude,
            geocode_at=item.geocode_at,
        )
        for item in clinicas
        if item and item.id is not None
    }
    clinica_ids = list(clinicas_map.keys())

    cache_stats = {
        "total_rows": 0,
        "fresh_rows": 0,
        "stale_rows": 0,
        "manual_rows": 0,
        "google_rows": 0,
    }
    if clinica_ids:
        rows = (
            db.query(ClinicaDeslocamento)
            .filter(
                ClinicaDeslocamento.origem_clinica_id.in_(clinica_ids),
                ClinicaDeslocamento.destino_clinica_id.in_(clinica_ids),
            )
            .all()
        )
        cache_stats["total_rows"] = len(rows)
        for row in rows:
            origem = clinicas_map.get(int(row.origem_clinica_id or 0))
            destino = clinicas_map.get(int(row.destino_clinica_id or 0))
            if not origem or not destino:
                continue
            if bool(getattr(row, "manual_override", False)):
                cache_stats["manual_rows"] += 1
            fonte = str(getattr(row, "fonte", "") or "").strip().lower()
            if fonte.startswith("google_"):
                cache_stats["google_rows"] += 1
            if _deslocamento_esta_atual(row, origem=origem, destino=destino):
                cache_stats["fresh_rows"] += 1
            else:
                cache_stats["stale_rows"] += 1

    success_rate = round((total_ok / len(metricas)) * 100.0, 2) if metricas else 0.0
    top_pairs_sorted = sorted(
        top_pares.values(),
        key=lambda item: (-int(item["calls"]), str(item["last_called_at"] or "")),
    )[:10]

    return {
        "window_days": dias_norm,
        "cache_max_age_days": _cache_max_age_days(),
        "metrics_retention_days": _metrics_retention_days(),
        "total_api_calls": len(metricas),
        "success_rate_percent": success_rate,
        "status_counts": dict(sorted(por_status.items())),
        "operation_counts": dict(sorted(por_operacao.items())),
        "calls_by_day": dict(sorted(por_dia.items())),
        "top_pairs": top_pairs_sorted,
        "cache": cache_stats,
    }


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
