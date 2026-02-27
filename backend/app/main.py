import json
import os
import logging

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.api.v1.endpoints import auth, admin, agenda, pacientes, clinicas, servicos, laudos, financeiro, xml_import, frases, imagens, tabelas_preco, ordens_servico, configuracoes, tutores, referencias_eco, atendimento
from app.models import user, papel, agendamento
from app.core.websocket import manager
from app.db.database import engine, Base, SessionLocal

logger = logging.getLogger(__name__)


def inicializar_banco():
    """Cria tabelas e seed de frases automaticamente na inicialização."""
    from app.models.frase import FraseQualitativa, FraseQualitativaHistorico
    from app.utils.frases_seed import seed_frases

    try:
        # Criar todas as tabelas que ainda não existem
        Base.metadata.create_all(bind=engine)
        logger.info("Tabelas verificadas/criadas com sucesso.")
    except Exception as e:
        logger.error(f"Erro ao criar tabelas: {e}")
        return

    # Seed de frases se a tabela estiver vazia
    db = SessionLocal()
    try:
        count = db.query(FraseQualitativa).count()
        if count == 0:
            logger.info("Tabela frases_qualitativas vazia. Executando seed...")
            seed_frases(db)

        # Sempre importar/atualizar frases personalizadas do JSON (upsert)
        json_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "frases_personalizadas.json")
        if os.path.exists(json_path):
            try:
                import re
                with open(json_path, "r", encoding="utf-8") as f:
                    dados = json.load(f)

                created = 0
                updated = 0
                for chave, frase_data in dados.items():
                    match = re.match(r"(.+)\s*\(([^)]+)\)", chave)
                    if match:
                        patologia = match.group(1).strip()
                        grau = match.group(2).strip()
                    else:
                        patologia = chave.strip()
                        grau = "Normal"

                    existing = db.query(FraseQualitativa).filter(
                        FraseQualitativa.chave == chave
                    ).first()

                    if existing:
                        # Atualizar frase existente com dados do JSON
                        existing.patologia = patologia
                        existing.grau = grau
                        existing.valvas = frase_data.get("valvas", "")
                        existing.camaras = frase_data.get("camaras", "")
                        existing.funcao = frase_data.get("funcao", "")
                        existing.pericardio = frase_data.get("pericardio", "")
                        existing.vasos = frase_data.get("vasos", "")
                        existing.ad_vd = frase_data.get("ad_vd", "")
                        existing.conclusao = frase_data.get("conclusao", "")
                        existing.detalhado = frase_data.get("det", {})
                        existing.layout = frase_data.get("layout", "enxuto")
                        existing.ativo = 1
                        updated += 1
                    else:
                        frase = FraseQualitativa(
                            chave=chave,
                            patologia=patologia,
                            grau=grau,
                            valvas=frase_data.get("valvas", ""),
                            camaras=frase_data.get("camaras", ""),
                            funcao=frase_data.get("funcao", ""),
                            pericardio=frase_data.get("pericardio", ""),
                            vasos=frase_data.get("vasos", ""),
                            ad_vd=frase_data.get("ad_vd", ""),
                            conclusao=frase_data.get("conclusao", ""),
                            detalhado=frase_data.get("det", {}),
                            layout=frase_data.get("layout", "enxuto"),
                            ativo=1,
                        )
                        db.add(frase)
                        created += 1

                db.commit()
                total = db.query(FraseQualitativa).count()
                logger.info(f"Frases personalizadas sincronizadas: {created} criadas, {updated} atualizadas. Total: {total}")
            except Exception as e:
                logger.warning(f"Erro ao importar frases personalizadas: {e}")
                db.rollback()
        else:
            logger.info(f"Arquivo frases_personalizadas.json não encontrado. Total de frases: {db.query(FraseQualitativa).count()}")
    except Exception as e:
        logger.error(f"Erro ao verificar/seed frases: {e}")
        db.rollback()
    finally:
        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Inicialização e encerramento da aplicação."""
    inicializar_banco()
    yield


app = FastAPI(
    redirect_slashes=False,
    title="FortCordis API",
    description="API do sistema FortCordis",
    version="2.0.0",
    lifespan=lifespan,
)

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
app.include_router(imagens.router, prefix="/api/v1/imagens", tags=["imagens"])
app.include_router(tabelas_preco.router, prefix="/api/v1/tabelas-preco", tags=["tabelas_preco"])
app.include_router(ordens_servico.router, prefix="/api/v1/ordens-servico", tags=["ordens_servico"])
app.include_router(configuracoes.router, prefix="/api/v1", tags=["configuracoes"])
app.include_router(tutores.router, prefix="/api/v1/tutores", tags=["tutores"])
app.include_router(referencias_eco.router, prefix="/api/v1/referencias-eco", tags=["referencias_eco"])
app.include_router(atendimento.router, prefix="/api/v1/atendimentos", tags=["atendimento"])

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
