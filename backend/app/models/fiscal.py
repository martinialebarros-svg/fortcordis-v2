"""Modelo para o módulo fiscal (Notas Fiscais de Serviço)"""
from datetime import datetime

from sqlalchemy import Column, Integer, String, Text, Numeric, Float
from app.db.database import Base


def _now_str() -> str:
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


class NotaFiscal(Base):
    __tablename__ = "notas_fiscais"

    id = Column(Integer, primary_key=True, index=True)
    numero = Column(String(50), unique=True)
    serie = Column(String(10), default="1")
    os_id = Column(Integer)

    # Tipo de cliente: PF (Pessoa Física) ou PJ (Pessoa Jurídica)
    tipo_cliente = Column(String(2))  # 'PF' ou 'PJ'

    # Dados do cliente/tomador
    cliente_nome = Column(Text)
    cliente_documento = Column(Text)  # CPF ou CNPJ
    cliente_endereco = Column(Text)
    cliente_bairro = Column(Text)
    cliente_cidade = Column(Text)
    cliente_estado = Column(Text)
    cliente_cep = Column(Text)
    cliente_telefone = Column(Text)
    cliente_email = Column(Text)

    # Valores
    valor_servico = Column(Numeric(12, 2), default=0)
    valor_desconto = Column(Numeric(12, 2), default=0)
    valor_final = Column(Numeric(12, 2), default=0)
    aliquota_iss = Column(Float, default=5.0)  # Percentual ISS (padrão 5%)
    valor_iss = Column(Numeric(12, 2), default=0)

    # Dados do serviço
    atividade_cnae = Column(Text)
    descricao_servico = Column(Text)
    observacoes = Column(Text)

    # Dados fiscais complementares
    natureza_operacao = Column(Text, default="Tributação no município")
    codigo_municipio = Column(Text)
    regime_tributario = Column(Integer)  # 1=MEI, 2=Simples, 3=Lucro Presumido, 4=Lucro Real

    # Status e exportação
    formato_exportado = Column(String(10))  # 'pdf', 'csv', 'xlsx'
    status = Column(String(20), default="rascunho")  # 'rascunho', 'exportado', 'cancelado'

    # Auditoria
    created_at = Column(Text, default=_now_str)
    updated_at = Column(Text)


class FiscalNumeroSequencia(Base):
    __tablename__ = "fiscal_numero_sequencias"

    ano = Column(Integer, primary_key=True)
    ultimo_numero = Column(Integer, nullable=False, default=0)
    updated_at = Column(Text, default=_now_str)
