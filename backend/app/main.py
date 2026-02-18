from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.endpoints import auth, admin, agenda, pacientes, clinicas, servicos, laudos, financeiro, xml_import, frases, imagens, tabelas_preco, ordens_servico, configuracoes
from app.models import user, papel, agendamento
from app.core.websocket import manager

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
app.include_router(laudos.router, prefix="/api/v1", tags=["laudos"])
app.include_router(financeiro.router, prefix="/api/v1/financeiro", tags=["financeiro"])
app.include_router(xml_import.router, prefix="/api/v1/xml", tags=["xml_import"])
app.include_router(frases.router, prefix="/api/v1/frases", tags=["frases"])
app.include_router(imagens.router, prefix="/api/v1/imagens", tags=["imagens"])
app.include_router(tabelas_preco.router, prefix="/api/v1/tabelas-preco", tags=["tabelas_preco"])
app.include_router(ordens_servico.router, prefix="/api/v1/ordens-servico", tags=["ordens_servico"])
app.include_router(configuracoes.router, prefix="/api/v1", tags=["configuracoes"])

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
    return {"status": "healthy", "database": "connected"}
