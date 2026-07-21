from __future__ import annotations

from sqlalchemy import Boolean, Column, DateTime, Index, Integer, String, Text
from sqlalchemy.sql import func

from app.db.database import Base


class AssistenteIAConversa(Base):
    __tablename__ = "assistente_ia_conversas"
    __table_args__ = (
        Index(
            "ix_assistente_ia_conversas_usuario_updated",
            "usuario_id",
            "updated_at",
        ),
    )

    id = Column(String(36), primary_key=True)
    usuario_id = Column(Integer, nullable=False, index=True)
    titulo = Column(String(160), nullable=False, default="Nova conversa")
    previous_response_id = Column(String(255), nullable=True)
    ativa = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


class AssistenteIAMensagem(Base):
    __tablename__ = "assistente_ia_mensagens"
    __table_args__ = (
        Index(
            "ix_assistente_ia_mensagens_conversa_created",
            "conversa_id",
            "created_at",
            "id",
        ),
    )

    id = Column(Integer, primary_key=True, index=True)
    conversa_id = Column(String(36), nullable=False, index=True)
    usuario_id = Column(Integer, nullable=False, index=True)
    papel = Column(String(20), nullable=False)
    conteudo = Column(Text, nullable=False)
    ferramentas_json = Column(Text, nullable=True)
    acao_pendente_id = Column(String(36), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class AssistenteIAAcaoPendente(Base):
    __tablename__ = "assistente_ia_acoes_pendentes"
    __table_args__ = (
        Index(
            "ix_assistente_ia_acoes_usuario_status",
            "usuario_id",
            "status",
            "created_at",
        ),
    )

    id = Column(String(36), primary_key=True)
    conversa_id = Column(String(36), nullable=False, index=True)
    usuario_id = Column(Integer, nullable=False, index=True)
    tipo_acao = Column(String(80), nullable=False)
    argumentos_json = Column(Text, nullable=False)
    alvo_snapshot_json = Column(Text, nullable=False)
    status = Column(String(24), nullable=False, default="pending", index=True)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    decided_at = Column(DateTime(timezone=True), nullable=True)
    executed_at = Column(DateTime(timezone=True), nullable=True)
    resultado_json = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
