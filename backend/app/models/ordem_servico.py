"""Modelo para Ordens de Serviço"""
from sqlalchemy import Column, DateTime, Index, Integer, Numeric, String, Text
from sqlalchemy.sql import func
from app.db.database import Base


class OrdemServico(Base):
    """Ordem de Serviço gerada a partir de um agendamento realizado"""
    __tablename__ = "ordens_servico"
    __table_args__ = (
        Index("ix_ordens_servico_status_data_atendimento_id", "status", "data_atendimento", "id"),
        Index("ix_ordens_servico_clinica_status_data_id", "clinica_id", "status", "data_atendimento", "id"),
        Index("ix_ordens_servico_servico_status_data_id", "servico_id", "status", "data_atendimento", "id"),
        Index("ix_ordens_servico_criado_por_status_data_id", "criado_por_id", "status", "data_atendimento", "id"),
        Index("ix_ordens_servico_agendamento_status_id", "agendamento_id", "status", "id"),
    )

    id = Column(Integer, primary_key=True, index=True)
    numero_os = Column(String(50), unique=True, nullable=False)
    
    # Relacionamentos
    agendamento_id = Column(Integer, nullable=False)
    paciente_id = Column(Integer, nullable=False)
    clinica_id = Column(Integer, nullable=False)
    servico_id = Column(Integer, nullable=False)
    
    # Dados do serviço
    data_atendimento = Column(DateTime(timezone=True))
    tipo_horario = Column(String(20))  # 'comercial' ou 'plantao'
    
    # Valores
    valor_servico = Column(Numeric(10, 2), default=0)
    desconto = Column(Numeric(10, 2), default=0)
    valor_final = Column(Numeric(10, 2), default=0)
    
    # Status da OS
    status = Column(String(50), default='Pendente')  # Pendente, Pago, Cancelado
    
    # Observações
    observacoes = Column(Text)
    
    # Auditoria
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    criado_por_id = Column(Integer)
    criado_por_nome = Column(String(100))
