import json
import os
import logging

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import inspect, text

from app.api.v1.endpoints import (
    admin,
    agenda,
    atendimento,
    auth,
    clinicas,
    configuracoes,
    financeiro,
    frases,
    frases_ultrassom_abdominal,
    imagens,
    laudos,
    logistica,
    ordens_servico,
    pacientes,
    referencias_eco,
    servicos,
    tabelas_preco,
    tutores,
    xml_import,
)
from app.core.runtime_checks import build_runtime_report, validate_startup_or_raise
from app.core.websocket import manager
from app.db.database import engine
from app.models import user, papel, agendamento
from app.services.laudo_pdf_jobs import (
    restart_incomplete_laudo_pdf_jobs,
    shutdown_laudo_pdf_jobs,
)

app = FastAPI(
    redirect_slashes=False,
    title="FortCordis API",
    description="API do sistema FortCordis",
    version="2.0.0",
)


def _ensure_financeiro_schema_compat() -> None:
    """Garante colunas novas de financeiro em bancos locais sem migracao aplicada."""
    required_columns = {
        "transacoes": {"clinica_id": "INTEGER"},
        "contas_pagar": {"clinica_id": "INTEGER"},
        "contas_receber": {"clinica_id": "INTEGER"},
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
    except Exception as exc:
        print(f"[schema-compat] Falha ao validar schema financeiro: {exc}")


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition"],
)

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
app.include_router(frases.router, prefix="/api/v1/frases", tags=["frases"])
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
app.include_router(referencias_eco.router, prefix="/api/v1/referencias-eco", tags=["referencias_eco"])
app.include_router(atendimento.router, prefix="/api/v1/atendimentos", tags=["atendimento"])
app.include_router(logistica.router, prefix="/api/v1/logistica", tags=["logistica"])


@app.on_event("startup")
def startup_schema_compatibility() -> None:
    _ensure_financeiro_schema_compat()
    validate_startup_or_raise()
    restart_incomplete_laudo_pdf_jobs()


@app.on_event("shutdown")
def shutdown_background_workers() -> None:
    shutdown_laudo_pdf_jobs()


# WebSocket endpoint
@app.websocket("/ws/{client_id}")
async def websocket_endpoint(websocket: WebSocket, client_id: str):
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
