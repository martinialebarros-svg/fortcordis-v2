from sqlalchemy import Column, DateTime, Integer, String, Text
from sqlalchemy.sql import func

from app.db.database import Base


class WhatsAppBotJob(Base):
    """Job de resposta automatica gerado a partir de uma mensagem inbound.

    Enfileirado pelo endpoint de mensagem recebida (Fase 2); consumido pelo
    worker do bot. `wa_message_id` e unico para dedupe de reentrega do
    webhook.
    """

    __tablename__ = "whatsapp_bot_jobs"

    id = Column(Integer, primary_key=True, index=True)
    wa_identity = Column(String(30), nullable=False, index=True)
    conversation_id = Column(String(64), nullable=False, index=True)
    wa_message_id = Column(String(160), nullable=False, unique=True, index=True)
    status = Column(String(20), nullable=False, default="pending", index=True)
    scheduled_for = Column(DateTime(timezone=True), nullable=False, index=True)
    attempts = Column(Integer, nullable=False, default=0)
    last_error = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )


class WhatsAppBotResposta(Base):
    """Registro de auditoria de cada job processado pelo bot.

    Grava a decisao tomada (`sent`/`draft`/`suppressed`/`handoff`/`blocked`) e
    o contexto usado para chegar nela, independente do que foi de fato
    enviado ao cliente.
    """

    __tablename__ = "whatsapp_bot_respostas"

    id = Column(Integer, primary_key=True, index=True)
    job_id = Column(Integer, nullable=False, index=True)
    wa_identity = Column(String(30), nullable=False, index=True)
    conversation_id = Column(String(64), nullable=False)
    decisao = Column(String(20), nullable=False)
    motivo = Column(Text, nullable=True)
    texto_gerado = Column(Text, nullable=True)
    texto_enviado = Column(Text, nullable=True)
    modelo = Column(String(100), nullable=True)
    prompt_version = Column(String(50), nullable=True)
    tools_usadas = Column(Text, nullable=True)
    input_tokens = Column(Integer, nullable=True)
    output_tokens = Column(Integer, nullable=True)
    latencia_ms = Column(Integer, nullable=True)
    resolution = Column(String(20), nullable=True)
    match_type = Column(String(20), nullable=True)
    feedback = Column(String(20), nullable=True)
    enviado_por_id = Column(Integer, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())


class WhatsAppBotConversaEstado(Base):
    """Estado do bot por conversa, chaveado pela identidade canonica do telefone.

    Sem linha para uma `wa_identity`, a conversa herda
    `configuracoes.whatsapp_bot_modo` (ver `Configuracao`).
    """

    __tablename__ = "whatsapp_bot_conversa_estado"

    wa_identity = Column(String(30), primary_key=True)
    modo = Column(String(20), nullable=False, default="suggest")
    pausado_ate = Column(DateTime(timezone=True), nullable=True)
    handoff_motivo = Column(String(50), nullable=True)
    atualizado_por_id = Column(Integer, nullable=True)
    updated_at = Column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )
