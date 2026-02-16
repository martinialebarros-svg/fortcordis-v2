from sqlalchemy import Column, Integer, String, DateTime, Text
from sqlalchemy.sql import func
from app.db.database import Base

class Agendamento(Base):
    __tablename__ = "agendamentos"
    
    id = Column(Integer, primary_key=True, index=True)
    paciente_id = Column(Integer, nullable=False)
    clinica_id = Column(Integer, nullable=True)
    servico_id = Column(Integer, nullable=True)
    
    # Data/hora
    inicio = Column(DateTime(timezone=True), nullable=False)
    fim = Column(DateTime(timezone=True), nullable=True)
    data = Column(String)
    hora = Column(String)
    
    # Status: Agendado, Confirmado, Em atendimento, Concluido, Cancelado, Faltou
    status = Column(String, default='Agendado')
    observacoes = Column(Text)
    
    # Campos denormalizados (legado)
    paciente = Column(String)
    tutor = Column(String)
    telefone = Column(String)
    servico = Column(String)
    clinica = Column(String)
    
    # Relacionamentos (sem FK para evitar dependências)
    pacote_id = Column(Integer, nullable=True)
    
    # Auditoria - CORRIGIDO: default no Python também
    created_at = Column(DateTime(timezone=True), default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    criado_em = Column(DateTime(timezone=True))
    atualizado_em = Column(DateTime(timezone=True))
    
    criado_por_id = Column(Integer)
    criado_por_nome = Column(String)
    confirmado_por_id = Column(Integer)
    confirmado_por_nome = Column(String)
    confirmado_em = Column(DateTime(timezone=True))
