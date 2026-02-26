from sqlalchemy import Column, DateTime, Integer, String, Text
from sqlalchemy.sql import func

from app.db.database import Base


class AtendimentoClinico(Base):
    __tablename__ = "atendimentos_clinicos"

    id = Column(Integer, primary_key=True, index=True)
    paciente_id = Column(Integer, nullable=False, index=True)
    tutor_id = Column(Integer, nullable=True, index=True)
    clinica_id = Column(Integer, nullable=True, index=True)
    agendamento_id = Column(Integer, nullable=True, index=True)
    veterinario_id = Column(Integer, nullable=False, index=True)

    data_atendimento = Column(DateTime(timezone=True), nullable=False, default=func.now(), index=True)
    status = Column(String, nullable=False, default="Em atendimento", index=True)

    queixa_principal = Column(Text)
    anamnese = Column(Text)
    exame_fisico = Column(Text)
    dados_clinicos = Column(Text)
    diagnostico = Column(Text)
    plano_terapeutico = Column(Text)
    retorno_recomendado = Column(String)
    observacoes = Column(Text)

    created_at = Column(DateTime(timezone=True), default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    criado_por_id = Column(Integer)
    criado_por_nome = Column(String)


class Medicamento(Base):
    __tablename__ = "medicamentos"

    id = Column(Integer, primary_key=True, index=True)
    nome = Column(String, nullable=False, index=True)
    principio_ativo = Column(String)
    concentracao = Column(String)
    forma_farmaceutica = Column(String)
    categoria = Column(String, index=True)
    observacoes = Column(Text)
    ativo = Column(Integer, nullable=False, default=1, index=True)

    created_at = Column(DateTime(timezone=True), default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class PrescricaoClinica(Base):
    __tablename__ = "prescricoes_clinicas"

    id = Column(Integer, primary_key=True, index=True)
    atendimento_id = Column(Integer, nullable=False, index=True)
    orientacoes_gerais = Column(Text)
    retorno_dias = Column(Integer)

    created_at = Column(DateTime(timezone=True), default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class PrescricaoItem(Base):
    __tablename__ = "prescricoes_itens"

    id = Column(Integer, primary_key=True, index=True)
    prescricao_id = Column(Integer, nullable=False, index=True)
    medicamento_id = Column(Integer, nullable=True, index=True)
    medicamento_nome = Column(String, nullable=False, index=True)
    dose = Column(String)
    frequencia = Column(String)
    duracao = Column(String)
    via = Column(String)
    instrucoes = Column(Text)
    ordem = Column(Integer, nullable=False, default=0)

    created_at = Column(DateTime(timezone=True), default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
