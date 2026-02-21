from sqlalchemy import Column, Integer, String, DateTime, Text, Boolean, Numeric
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
    cep = Column(String)
    observacoes = Column(Text)  # Observações gerais da clínica
    
    # Tabela de preço associada (1 = Fortaleza, 2 = Região Metropolitana, 3 = Domiciliar, 4 = Personalizado)
    tabela_preco_id = Column(Integer, default=1)
    
    # Preço personalizado para cidades distantes (ex: Aracati)
    # Usado quando tabela_preco_id = 4 (Personalizado)
    preco_personalizado_km = Column(Numeric(10, 2), default=0)  # Valor por km adicional
    preco_personalizado_base = Column(Numeric(10, 2), default=0)  # Valor base do atendimento
    
    # Observações sobre o preço negociado
    observacoes_preco = Column(Text)
    
    ativo = Column(Boolean, default=True)
    
    # Campos de auditoria
    created_at = Column(DateTime(timezone=True), default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
