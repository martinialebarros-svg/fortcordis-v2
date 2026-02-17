from sqlalchemy import Column, Integer, String, DateTime, Text, Float, Enum
from sqlalchemy.sql import func
from app.db.database import Base
import enum

class TipoTransacao(str, enum.Enum):
    ENTRADA = "entrada"
    SAIDA = "saida"

class FormaPagamento(str, enum.Enum):
    DINHEIRO = "dinheiro"
    CARTAO_CREDITO = "cartao_credito"
    CARTAO_DEBITO = "cartao_debito"
    PIX = "pix"
    BOLETO = "boleto"
    TRANSFERENCIA = "transferencia"

class CategoriaTransacao(str, enum.Enum):
    CONSULTA = "consulta"
    EXAME = "exame"
    CIRURGIA = "cirurgia"
    MEDICAMENTO = "medicamento"
    BANHO_TOSA = "banho_tosa"
    PRODUTO = "produto"
    OUTROS = "outros"
    # Despesas
    SALARIO = "salario"
    ALUGUEL = "aluguel"
    FORNECEDOR = "fornecedor"
    IMPOSTO = "imposto"
    MANUTENCAO = "manutencao"
    MARKETING = "marketing"

class Transacao(Base):
    __tablename__ = "transacoes"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # Tipo: entrada ou saída
    tipo = Column(String, nullable=False)  # entrada, saida
    
    # Categoria
    categoria = Column(String, nullable=False)
    
    # Valores
    valor = Column(Float, nullable=False)
    desconto = Column(Float, default=0)
    valor_final = Column(Float, nullable=False)
    
    # Forma de pagamento
    forma_pagamento = Column(String)
    
    # Status
    status = Column(String, default='Pendente')  # Pendente, Pago, Cancelado
    
    # Relacionamentos (opcionais)
    paciente_id = Column(Integer)
    paciente_nome = Column(String)
    agendamento_id = Column(Integer)
    
    # Descrição
    descricao = Column(Text)
    
    # Datas
    data_transacao = Column(DateTime(timezone=True), default=func.now())
    data_vencimento = Column(DateTime(timezone=True))
    data_pagamento = Column(DateTime(timezone=True))
    
    # Parcelas (para cartão)
    parcelas = Column(Integer, default=1)
    parcela_atual = Column(Integer, default=1)
    
    # Observações
    observacoes = Column(Text)
    
    # Auditoria
    created_at = Column(DateTime(timezone=True), default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    criado_por_id = Column(Integer)
    criado_por_nome = Column(String)

class ContaPagar(Base):
    __tablename__ = "contas_pagar"
    
    id = Column(Integer, primary_key=True, index=True)
    
    descricao = Column(String, nullable=False)
    fornecedor = Column(String)
    categoria = Column(String)
    
    valor = Column(Float, nullable=False)
    
    # Datas
    data_vencimento = Column(DateTime(timezone=True), nullable=False)
    data_pagamento = Column(DateTime(timezone=True))
    
    # Status
    status = Column(String, default='Pendente')  # Pendente, Pago, Atrasado
    
    # Observações
    observacoes = Column(Text)
    
    # Auditoria
    created_at = Column(DateTime(timezone=True), default=func.now())
    criado_por_id = Column(Integer)

class ContaReceber(Base):
    __tablename__ = "contas_receber"
    
    id = Column(Integer, primary_key=True, index=True)
    
    descricao = Column(String, nullable=False)
    cliente = Column(String)
    categoria = Column(String)
    
    valor = Column(Float, nullable=False)
    
    # Datas
    data_vencimento = Column(DateTime(timezone=True), nullable=False)
    data_recebimento = Column(DateTime(timezone=True))
    
    # Status
    status = Column(String, default='Pendente')  # Pendente, Recebido, Atrasado
    
    # Relacionamentos
    paciente_id = Column(Integer)
    agendamento_id = Column(Integer)
    
    # Observações
    observacoes = Column(Text)
    
    # Auditoria
    created_at = Column(DateTime(timezone=True), default=func.now())
    criado_por_id = Column(Integer)
