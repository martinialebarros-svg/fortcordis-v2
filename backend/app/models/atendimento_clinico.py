from sqlalchemy import Column, DateTime, Float, Integer, String, Text
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
    status = Column(String, nullable=False, default="Triagem", index=True)

    # === TRIAGEM ===
    peso = Column(Float)  # kg
    temperatura = Column(Float)  # Celsius
    frequencia_cardiaca = Column(Integer)  # bpm
    frequencia_respiratoria = Column(Integer)  # mpm
    pressao_arterial = Column(String)  # mmHg
    saturacao_oxigenio = Column(Integer)  # %
    escore_condicion_corpo = Column(Integer)  # 1-9
    mucosas = Column(String)  # rosadas, palidas, ictericas, cianoticas
    hidratacao = Column(String)  # normal, desidratado, desidratado++
    triagem_observacoes = Column(Text)

    # === CONSULTA ===
    queixa_principal = Column(Text)
    anamnese = Column(Text)
    exame_fisico = Column(Text)
    dados_clinicos = Column(Text)

    # === DIAGNOSTICO E TRATAMENTO ===
    diagnostico_principal = Column(Text)
    diagnostico_secundario = Column(Text)
    diagnostico_diferencial = Column(Text)
    plano_terapeutico = Column(Text)
    prognostico = Column(String)  # Favoravel, Reservado, Ruim

    # === RETORNO E OBSERVACOES ===
    retorno_recomendado = Column(String)
    motivo_retorno = Column(Text)
    observacoes = Column(Text)

    # === FLUXO DE TRABALHO ===
    triagem_concluida = Column(Integer, default=0)
    consulta_concluida = Column(Integer, default=0)

    created_at = Column(DateTime(timezone=True), default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    criado_por_id = Column(Integer)
    criado_por_nome = Column(String)


class AnexoAtendimento(Base):
    __tablename__ = "anexos_atendimentos"

    id = Column(Integer, primary_key=True, index=True)
    atendimento_id = Column(Integer, nullable=False, index=True)
    tipo = Column(String, nullable=False)  # imagem, documento, radiografia, ultrassom, outro
    descricao = Column(String)
    url = Column(String, nullable=False)
    nome_original = Column(String)
    tamanho = Column(Integer)  # bytes
    mime_type = Column(String)

    created_at = Column(DateTime(timezone=True), default=func.now())


class EvolucaoClinica(Base):
    __tablename__ = "evolucoes_clinicas"

    id = Column(Integer, primary_key=True, index=True)
    atendimento_id = Column(Integer, nullable=False, index=True)
    data_evolucao = Column(DateTime(timezone=True), nullable=False, default=func.now())
    descricao = Column(Text, nullable=False)
    sinais_vitais = Column(Text)  # JSON com FC, FR, Temp, etc
    responsavel_id = Column(Integer)
    responsavel_nome = Column(String)

    created_at = Column(DateTime(timezone=True), default=func.now())


class AlertaClinico(Base):
    __tablename__ = "alertas_clinicos"

    id = Column(Integer, primary_key=True, index=True)
    paciente_id = Column(Integer, nullable=False, index=True)
    tipo = Column(String, nullable=False)  # alergia, contraindicacao, doenca_cronica, risco, outro
    titulo = Column(String, nullable=False)
    descricao = Column(Text)
    gravidade = Column(String)  # baixa, media, alta, critica
    ativo = Column(Integer, default=1, index=True)
    data_inicio = Column(DateTime(timezone=True), default=func.now())
    data_fim = Column(DateTime(timezone=True))

    created_at = Column(DateTime(timezone=True), default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


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
