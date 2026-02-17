from sqlalchemy import Column, Integer, String, DateTime, Text, ForeignKey, Float
from sqlalchemy.sql import func
from app.db.database import Base

class Laudo(Base):
    __tablename__ = "laudos"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # Relacionamentos
    paciente_id = Column(Integer, nullable=False)
    agendamento_id = Column(Integer, nullable=True)
    veterinario_id = Column(Integer, nullable=False)  # Usuário que fez o laudo
    
    # Dados do laudo
    tipo = Column(String, nullable=False)  # exame, consulta, cirurgia, etc
    titulo = Column(String, nullable=False)
    descricao = Column(Text)
    diagnostico = Column(Text)
    observacoes = Column(Text)
    
    # Anexos (URLs separadas por vírgula ou JSON)
    anexos = Column(Text)  # URLs dos arquivos
    
    # Status
    status = Column(String, default='Rascunho')  # Rascunho, Finalizado, Arquivado
    
    # Datas
    data_laudo = Column(DateTime(timezone=True), default=func.now())
    created_at = Column(DateTime(timezone=True), default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Auditoria
    criado_por_id = Column(Integer)
    criado_por_nome = Column(String)

class Exame(Base):
    __tablename__ = "exames"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # Relacionamentos
    laudo_id = Column(Integer, nullable=True)
    paciente_id = Column(Integer, nullable=False)
    
    # Tipo de exame
    tipo_exame = Column(String, nullable=False)  # Sangue, Urina, Raio-X, Ultrassom, etc
    
    # Resultados
    resultado = Column(Text)
    valor_referencia = Column(Text)
    unidade = Column(String)
    
    # Status
    status = Column(String, default='Solicitado')  # Solicitado, Em andamento, Concluido
    
    # Datas
    data_solicitacao = Column(DateTime(timezone=True), default=func.now())
    data_resultado = Column(DateTime(timezone=True))
    
    # Valor
    valor = Column(Float, default=0)
    
    # Observações
    observacoes = Column(Text)
    
    # Auditoria
    created_at = Column(DateTime(timezone=True), default=func.now())
    criado_por_id = Column(Integer)
    criado_por_nome = Column(String)
