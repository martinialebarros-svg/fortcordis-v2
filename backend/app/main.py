from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.api.v1.endpoints import auth, admin, agenda, pacientes, clinicas, servicos
from app.models import user, papel, agendamento
from app.core.websocket import manager
from app.db.database import SessionLocal

app = FastAPI(
    redirect_slashes=False,
    title="FortCordis API",
    description="API do sistema FortCordis",
    version="2.0.0",

)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Rotas REST
app.include_router(auth.router, prefix="/api/v1/auth", tags=["auth"])
app.include_router(admin.router, prefix="/api/v1/admin", tags=["admin"])
app.include_router(agenda.router, prefix="/api/v1/agenda", tags=["agenda"])
app.include_router(pacientes.router, prefix="/api/v1/pacientes", tags=["pacientes"])
app.include_router(clinicas.router, prefix="/api/v1/clinicas", tags=["clinicas"])
app.include_router(servicos.router, prefix="/api/v1/servicos", tags=["servicos"])

# WebSocket endpoint
@app.websocket("/ws/{client_id}")
async def websocket_endpoint(websocket: WebSocket, client_id: str):
    await manager.connect(websocket, client_id)
    try:
        while True:
            data = await websocket.receive_text()
            # Aqui você pode processar mensagens do cliente se necessário
            await manager.send_personal_message(f"Recebido: {data}", websocket)
    except WebSocketDisconnect:
        manager.disconnect(websocket, client_id)

@app.get("/")
def root():
    return {"message": "FortCordis API v2.0", "status": "online"}

@app.get("/health")
def health_check():
    db = SessionLocal()
    try:
        db.execute(text("SELECT 1"))
        db_status = "connected"
    except Exception as e:
        db_status = f"error: {e}"
    finally:
        db.close()
    return {"status": "healthy", "database": db_status}
