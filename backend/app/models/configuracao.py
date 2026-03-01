"""Modelo para configurações do sistema"""
from sqlalchemy import Column, Integer, String, Text, LargeBinary, DateTime, Boolean
from sqlalchemy.sql import func
from app.db.database import Base


class Configuracao(Base):
    __tablename__ = "configuracoes"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # Dados da empresa/clínica
    nome_empresa = Column(String(255), default="Fort Cordis Cardiologia Veterinária")
    endereco = Column(Text)
    telefone = Column(String(50))
    email = Column(String(255))
    cidade = Column(String(100), default="Fortaleza")
    estado = Column(String(2), default="CE")
    website = Column(String(255))
    
    # Logomarca
    logomarca_nome = Column(String(255))
    logomarca_tipo = Column(String(100), default="image/png")
    logomarca_dados = Column(LargeBinary)
    
    # Assinatura do veterinário
    assinatura_nome = Column(String(255))
    assinatura_tipo = Column(String(100), default="image/png")
    assinatura_dados = Column(LargeBinary)
    
    # Configurações de laudo
    texto_cabecalho_laudo = Column(Text)
    texto_rodape_laudo = Column(Text, default="Fort Cordis Cardiologia Veterinária | Fortaleza-CE")
    mostrar_logomarca = Column(Boolean, default=True)
    mostrar_assinatura = Column(Boolean, default=True)
    
    # Configurações de agendamento
    horario_comercial_inicio = Column(String(5), default="08:00")
    horario_comercial_fim = Column(String(5), default="18:00")
    dias_trabalho = Column(String(50), default="1,2,3,4,5")  # 1=Seg, 7=Dom
    agenda_semanal = Column(Text)
    agenda_feriados = Column(Text)
    agenda_excecoes = Column(Text)
    
    # Auditoria
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    updated_by_id = Column(Integer)


class ConfiguracaoUsuario(Base):
    """Configurações específicas por usuário"""
    __tablename__ = "configuracoes_usuario"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, nullable=False, unique=True)
    
    # Preferências
    tema = Column(String(20), default="light")  # light, dark
    idioma = Column(String(10), default="pt-BR")
    notificacoes_email = Column(Boolean, default=True)
    notificacoes_push = Column(Boolean, default=True)
    
    # Assinatura digital do usuário (se for veterinário)
    assinatura_nome = Column(String(255))
    assinatura_tipo = Column(String(100))
    assinatura_dados = Column(LargeBinary)
    
    # Configurações pessoais do laudo
    crmv = Column(String(50))
    especialidade = Column(String(100))
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
