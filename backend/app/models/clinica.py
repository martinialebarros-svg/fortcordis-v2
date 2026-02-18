from sqlalchemy import Column, Integer, String, DateTime, Text, Boolean
from sqlalchemy.sql import func
from app.db.database import Base

class Clinica(Base):
    __tablename__ = "clinicas"

    id = Column(Integer, primary_key=True, index=True)
    nome = Column(String, nullable=False)
    cnpj = Column(String)
    telefone = Column(String)
    email = Column(String)
    endereco = Column(String)
    cidade = Column(String)  # Para identificar a região
    estado = Column(String)
    
    # Tabela de preço associada (1 = Fortaleza, 2 = Região Metropolitana, 3 = Domiciliar)
    tabela_preco_id = Column(Integer, default=1)
    
    ativo = Column(Boolean, default=True)
    
    # Campos de auditoria
    created_at = Column(DateTime(timezone=True), default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
