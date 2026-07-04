import json
import os
import logging
import time

from fastapi import Depends, FastAPI, Request, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import inspect, text
from sqlalchemy.orm import Session

from app.api.v1.endpoints import (
    admin,
    agenda,
    atendimento,
    auth,
    clinicas,
    configuracoes,
    financeiro,
    fiscal,
    frases_ecocardiograma_estruturado_teste,
    frases_ultrassom_abdominal,
    imagens,
    laudos,
    logistica,
    ordens_servico,
    pacientes,
    portal,
    portal_clinic_auth,
    relatorios,
    referencias_eco,
    servicos,
    tabelas_preco,
    tutores,
    xml_import,
)
from app.core.runtime_checks import build_runtime_report, validate_startup_or_raise
from app.core.config import settings
from app.core.csrf import (
    has_valid_csrf_token_pair,
    is_trusted_origin,
    should_protect_request,
)
from app.core.security_headers import build_security_headers
from app.core.security import get_current_websocket_user
from app.core.websocket import manager
from app.db.database import engine, get_db
from app.models import user, papel, agendamento
from app.services.laudo_pdf_jobs import (
    restart_incomplete_laudo_pdf_jobs,
    shutdown_laudo_pdf_jobs,
)
from app.services.upload_dedupe_cleanup_service import (
    shutdown_upload_dedupe_cleanup_worker,
    start_upload_dedupe_cleanup_worker,
)
from app.services.push_scheduler_service import (
    shutdown_push_scheduler_worker,
    start_push_scheduler_worker,
)
from app.services.runtime_observability import record_http_request
from app.services.xml_import_jobs import (
    restart_incomplete_xml_import_jobs,
    shutdown_xml_import_jobs,
)

app = FastAPI(
    redirect_slashes=False,
    title="FortCordis API",
    description="API do sistema FortCordis",
    version="2.0.0",
)
logger = logging.getLogger(__name__)


def _ensure_financeiro_schema_compat() -> None:
    """Garante colunas novas de financeiro em bancos locais sem migracao aplicada."""
    required_columns = {
        "transacoes": {"clinica_id": "INTEGER"},
        "contas_pagar": {"clinica_id": "INTEGER"},
        "contas_receber": {"clinica_id": "INTEGER"},
        "custos_frota": {"veiculo_id": "INTEGER"},
        "configuracoes_usuario": {
            "notificacoes_push_tipos": "TEXT",
            "notificacoes_push_prioridade_alta_tipos": "TEXT",
            "notificacoes_push_agrupar": "BOOLEAN",
            "notificacoes_push_lembrete_pendencias": "BOOLEAN",
            "notificacoes_push_lembrete_horas": "INTEGER",
            "notificacoes_push_perfil": "VARCHAR(30)",
        },
        "configuracoes": {
            "inscricao_municipal": "TEXT",
            "inscricao_estadual": "TEXT",
            "cnae": "TEXT",
            "regime_tributario": "INTEGER",
            "codigo_municipio_servico": "TEXT",
        },
        "clinicas": {
            "razao_social": "TEXT",
            "atividade_cnae": "TEXT",
        },
    }

    try:
        with engine.begin() as conn:
            for table_name, columns in required_columns.items():
                inspector = inspect(conn)
                if table_name not in inspector.get_table_names():
                    continue

                existing = {column["name"] for column in inspector.get_columns(table_name)}
                for column_name, column_type in columns.items():
                    if column_name in existing:
                        continue
                    conn.execute(
                        text(
                            f'ALTER TABLE "{table_name}" '
                            f'ADD COLUMN "{column_name}" {column_type}'
                        )
                    )
                    print(
                        f"[schema-compat] Coluna adicionada: "
                        f"{table_name}.{column_name} ({column_type})"
                    )

            # Compat para entidade de custos de frota (V1 de rentabilidade real)
            from app.models.financeiro import (
                ConfigRateioFrota,
                CustoFrota,
                TelemetriaFrotaMensal,
                VeiculoFrota,
            )
            from app.models.push_scheduled_notification import PushScheduledNotification
            from app.models.push_subscription import PushSubscription

            CustoFrota.__table__.create(bind=conn, checkfirst=True)
            VeiculoFrota.__table__.create(bind=conn, checkfirst=True)
            TelemetriaFrotaMensal.__table__.create(bind=conn, checkfirst=True)
            ConfigRateioFrota.__table__.create(bind=conn, checkfirst=True)
            PushSubscription.__table__.create(bind=conn, checkfirst=True)
            PushScheduledNotification.__table__.create(bind=conn, checkfirst=True)

            # Compat para módulo fiscal
            from app.models.fiscal import FiscalNumeroSequencia, NotaFiscal
            NotaFiscal.__table__.create(bind=conn, checkfirst=True)
            FiscalNumeroSequencia.__table__.create(bind=conn, checkfirst=True)

            inspector = inspect(conn)
            if "configuracoes_usuario" in inspector.get_table_names():
                conn.execute(
                    text(
                        """
                        UPDATE configuracoes_usuario
                        SET notificacoes_push_tipos = 'created,updated,status_changed,cancelled,deleted,os_generated,payment_received,os_deleted,payment_pending'
                        WHERE notificacoes_push_tipos IS NULL
                        """
                    )
                )
                conn.execute(
                    text(
                        """
                        UPDATE configuracoes_usuario
                        SET notificacoes_push_tipos = TRIM(notificacoes_push_tipos) || ',cancelled'
                        WHERE notificacoes_push_tipos IS NOT NULL
                          AND TRIM(notificacoes_push_tipos) <> ''
                          AND LOWER(notificacoes_push_tipos) NOT LIKE '%cancelled%'
                        """
                    )
                )
                conn.execute(
                    text(
                        """
                        UPDATE configuracoes_usuario
                        SET notificacoes_push_tipos = TRIM(notificacoes_push_tipos) || ',payment_pending'
                        WHERE notificacoes_push_tipos IS NOT NULL
                          AND TRIM(notificacoes_push_tipos) <> ''
                          AND LOWER(notificacoes_push_tipos) NOT LIKE '%payment_pending%'
                        """
                    )
                )
                conn.execute(
                    text(
                        """
                        UPDATE configuracoes_usuario
                        SET notificacoes_push_prioridade_alta_tipos = 'os_deleted,payment_pending'
                        WHERE notificacoes_push_prioridade_alta_tipos IS NULL
                           OR TRIM(notificacoes_push_prioridade_alta_tipos) = ''
                        """
                    )
                )
                conn.execute(
                    text(
                        """
                        UPDATE configuracoes_usuario
                        SET notificacoes_push_agrupar = TRUE
                        WHERE notificacoes_push_agrupar IS NULL
                        """
                    )
                )
                conn.execute(
                    text(
                        """
                        UPDATE configuracoes_usuario
                        SET notificacoes_push_lembrete_pendencias = TRUE
                        WHERE notificacoes_push_lembrete_pendencias IS NULL
                        """
                    )
                )
                conn.execute(
                    text(
                        """
                        UPDATE configuracoes_usuario
                        SET notificacoes_push_lembrete_horas = 6
                        WHERE notificacoes_push_lembrete_horas IS NULL
                        """
                    )
                )
                conn.execute(
                    text(
                        """
                        UPDATE configuracoes_usuario
                        SET notificacoes_push_perfil = 'custom'
                        WHERE notificacoes_push_perfil IS NULL OR TRIM(notificacoes_push_perfil) = ''
                        """
                    )
                )
    except Exception as exc:
        print(f"[schema-compat] Falha ao validar schema financeiro: {exc}")


def _resolve_cors_allow_origins() -> list[str]:
    """
    Resolve origens permitidas para CORS.

    Suporta:
    - JSON array em CORS_ALLOW_ORIGINS (ex.: ["https://app.exemplo.com"])
    - Lista separada por virgula (ex.: https://a.com,https://b.com)
    """
    raw_value = (os.getenv("CORS_ALLOW_ORIGINS") or "").strip()
    if not raw_value:
        # Default seguro para desenvolvimento local.
        return ["http://localhost:3000", "http://127.0.0.1:3000"]

    origins: list[str] = []
    if raw_value.startswith("["):
        try:
            parsed = json.loads(raw_value)
            if isinstance(parsed, list):
                origins = [str(item).strip() for item in parsed if str(item).strip()]
            else:
                logger.warning(
                    "CORS_ALLOW_ORIGINS em JSON invalido (nao e lista). "
                    "Aplicando parser por virgula."
                )
        except json.JSONDecodeError:
            logger.warning(
                "CORS_ALLOW_ORIGINS com JSON invalido. Aplicando parser por virgula."
            )

    if not origins:
        origins = [item.strip() for item in raw_value.split(",") if item.strip()]

    # Remove duplicados preservando ordem.
    deduped: list[str] = []
    for origin in origins:
        if origin not in deduped:
            deduped.append(origin)
    return deduped


cors_allow_origins = _resolve_cors_allow_origins()
cors_has_wildcard = any(origin == "*" for origin in cors_allow_origins)
if cors_has_wildcard:
    logger.warning(
        "CORS_ALLOW_ORIGINS contem '*'. Cookies/credenciais via CORS foram desabilitados."
    )

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_allow_origins,
    allow_credentials=not cors_has_wildcard,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition"],
)


def _append_security_headers(path: str, response):
    for header_name, header_value in build_security_headers(path).items():
        response.headers[header_name] = header_value
    return response


@app.middleware("http")
async def enforce_csrf_for_cookie_session(request: Request, call_next):
    if not settings.CSRF_PROTECTION_ENABLED:
        response = await call_next(request)
        return _append_security_headers(request.url.path, response)

    path = request.url.path
    has_session_cookie = bool(request.cookies.get(settings.AUTH_COOKIE_NAME))
    if not should_protect_request(path, request.method, has_session_cookie):
        response = await call_next(request)
        return _append_security_headers(path, response)

    csrf_cookie = request.cookies.get(settings.CSRF_COOKIE_NAME)
    csrf_header = request.headers.get(settings.CSRF_HEADER_NAME)
    if has_valid_csrf_token_pair(csrf_header, csrf_cookie):
        response = await call_next(request)
        return _append_security_headers(path, response)

    sec_fetch_site = (request.headers.get("sec-fetch-site") or "").strip().lower()
    if sec_fetch_site == "cross-site":
        return _append_security_headers(
            path,
            JSONResponse(
                status_code=403,
                content={"detail": "CSRF: origem nao confiavel."},
            ),
        )

    request_origin = f"{request.url.scheme}://{request.url.netloc}"
    origin = request.headers.get("origin")
    referer = request.headers.get("referer")
    trusted_origin = is_trusted_origin(
        origin=origin,
        referer=referer,
        allowed_origins=set(cors_allow_origins),
        request_origin=request_origin,
    )
    if trusted_origin:
        response = await call_next(request)
        return _append_security_headers(path, response)

    # Compatibilidade: em alguns proxies internos os headers de origem podem ser omitidos.
    # Ainda assim bloqueamos o sinal explicito de cross-site acima.
    if settings.CSRF_TRUST_SAME_SITE_FETCH_METADATA and sec_fetch_site in {
        "same-origin",
        "same-site",
        "none",
    }:
        response = await call_next(request)
        return _append_security_headers(path, response)

    return _append_security_headers(
        path,
        JSONResponse(
            status_code=403,
            content={"detail": "CSRF: token ausente/invalido."},
        ),
    )


@app.middleware("http")
async def monitor_runtime_http_status(request: Request, call_next):
    path = request.url.path
    start_monotonic = time.monotonic()
    try:
        response = await call_next(request)
    except Exception:
        elapsed_ms = (time.monotonic() - start_monotonic) * 1000.0
        try:
            record_http_request(path=path, status_code=500, duration_ms=elapsed_ms)
        except Exception:
            logger.exception("Falha ao registrar erro 5xx/latencia no monitor de runtime.")
        raise

    elapsed_ms = (time.monotonic() - start_monotonic) * 1000.0
    try:
        record_http_request(
            path=path,
            status_code=response.status_code,
            duration_ms=elapsed_ms,
        )
    except Exception:
        logger.exception("Falha ao registrar status/latencia HTTP no monitor de runtime.")
    return _append_security_headers(path, response)

# Rotas REST
app.include_router(auth.router, prefix="/api/v1/auth", tags=["auth"])
app.include_router(admin.router, prefix="/api/v1/admin", tags=["admin"])
app.include_router(agenda.router, prefix="/api/v1/agenda", tags=["agenda"])
app.include_router(pacientes.router, prefix="/api/v1/pacientes", tags=["pacientes"])
app.include_router(clinicas.router, prefix="/api/v1/clinicas", tags=["clinicas"])
app.include_router(servicos.router, prefix="/api/v1/servicos", tags=["servicos"])
app.include_router(laudos.router, prefix="/api/v1", tags=["laudos"])
app.include_router(financeiro.router, prefix="/api/v1/financeiro", tags=["financeiro"])
app.include_router(xml_import.router, prefix="/api/v1/xml", tags=["xml_import"])
app.include_router(
    frases_ecocardiograma_estruturado_teste.router,
    prefix="/api/v1/frases-ecocardiograma-estruturado-teste",
    tags=["frases_ecocardiograma_estruturado_teste"],
)
app.include_router(
    frases_ultrassom_abdominal.router,
    prefix="/api/v1/frases-ultrassom-abdominal",
    tags=["frases_ultrassom_abdominal"],
)
app.include_router(imagens.router, prefix="/api/v1/imagens", tags=["imagens"])
app.include_router(tabelas_preco.router, prefix="/api/v1/tabelas-preco", tags=["tabelas_preco"])
app.include_router(ordens_servico.router, prefix="/api/v1/ordens-servico", tags=["ordens_servico"])
app.include_router(configuracoes.router, prefix="/api/v1", tags=["configuracoes"])
app.include_router(tutores.router, prefix="/api/v1/tutores", tags=["tutores"])
app.include_router(portal.router, prefix="/api/v1/portal", tags=["portal"])
app.include_router(portal_clinic_auth.router, prefix="/api/v1/portal", tags=["portal"])
app.include_router(referencias_eco.router, prefix="/api/v1/referencias-eco", tags=["referencias_eco"])
app.include_router(atendimento.router, prefix="/api/v1/atendimentos", tags=["atendimento"])
app.include_router(logistica.router, prefix="/api/v1/logistica", tags=["logistica"])
app.include_router(relatorios.router, prefix="/api/v1/relatorios", tags=["relatorios"])
app.include_router(fiscal.router, prefix="/api/v1/fiscal", tags=["fiscal"])


@app.on_event("startup")
def startup_schema_compatibility() -> None:
    _ensure_financeiro_schema_compat()
    validate_startup_or_raise()
    restart_incomplete_laudo_pdf_jobs()
    restart_incomplete_xml_import_jobs()
    start_upload_dedupe_cleanup_worker()
    start_push_scheduler_worker()


@app.on_event("shutdown")
def shutdown_background_workers() -> None:
    shutdown_laudo_pdf_jobs()
    shutdown_xml_import_jobs()
    shutdown_upload_dedupe_cleanup_worker()
    shutdown_push_scheduler_worker()


# WebSocket endpoint
@app.websocket("/ws/{client_id}")
async def websocket_endpoint(
    websocket: WebSocket,
    client_id: str,
    db: Session = Depends(get_db),
):
    get_current_websocket_user(websocket, db)
    await manager.connect(websocket, client_id)
    try:
        while True:
            data = await websocket.receive_text()
            await manager.send_personal_message(f"Recebido: {data}", websocket)
    except WebSocketDisconnect:
        manager.disconnect(websocket, client_id)


@app.get("/")
def root():
    return {"message": "FortCordis API v2.0", "status": "online"}


def _health_payload(report: dict) -> dict:
    return {
        "status": report["status"],
        "database": report["database"]["status"],
        "readiness": "ready" if report["ready"] else "degraded",
        "checks": {
            "migrations": {
                "tracking_table_exists": report["migrations"].get("tracking_table_exists"),
                "current_version": report["migrations"].get("current_version"),
                "latest_version": report["migrations"].get("latest_version"),
                "pending_count": report["migrations"].get("pending_count"),
            },
            "security": {
                "secret_key_configured": report["security"]["secret_key"].get("configured"),
                "secret_key_strong": report["security"]["secret_key"].get("strong"),
            },
            "integrations": {
                "google_maps_configured": report["integrations"].get("google_maps_configured"),
                "web_push_configured": report["integrations"].get("web_push_configured"),
            },
            "observability": {
                "http_5xx_monitor": report["observability"].get("http_5xx_monitor"),
                "http_latency_monitor": report["observability"].get("http_latency_monitor"),
                "upload_dedupe_cleanup_worker": report["observability"].get("upload_dedupe_cleanup_worker"),
                "push_scheduler_worker": report["observability"].get("push_scheduler_worker"),
            },
        },
        "compatibility_modes": report["compatibility_modes"],
        "warnings": report["warnings"],
    }


@app.get("/health")
def health_check():
    report = build_runtime_report()
    return _health_payload(report)


@app.get("/ready")
def readiness_check():
    report = build_runtime_report()
    payload = {
        **_health_payload(report),
        "readiness_issues": report["readiness_issues"],
    }
    if report["ready"]:
        return payload
    return JSONResponse(status_code=503, content=payload)
