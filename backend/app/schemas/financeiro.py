from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List
from decimal import Decimal


# ==================== TRANSAÇÕES ====================

class TransacaoBase(BaseModel):
    tipo: str = Field(..., pattern="^(entrada|saida)$", description="Tipo: entrada ou saida")
    categoria: str = Field(..., description="Categoria da transação")
    valor: float = Field(..., gt=0, description="Valor da transação")
    desconto: float = Field(default=0, ge=0, description="Desconto aplicado")
    forma_pagamento: Optional[str] = Field(default=None, description="Forma de pagamento")
    status: str = Field(default="Pendente", description="Status: Pendente, Pago, Recebido, Cancelado")
    descricao: str = Field(..., min_length=3, max_length=255, description="Descrição da transação")
    data_transacao: datetime = Field(default_factory=datetime.now, description="Data da transação")
    data_vencimento: Optional[datetime] = Field(default=None, description="Data de vencimento")
    observacoes: Optional[str] = Field(default=None, description="Observações adicionais")
    
    # Relacionamentos opcionais
    paciente_id: Optional[int] = Field(default=None, description="ID do paciente")
    paciente_nome: Optional[str] = Field(default=None, description="Nome do paciente")
    agendamento_id: Optional[int] = Field(default=None, description="ID do agendamento")
    
    # Parcelas
    parcelas: int = Field(default=1, ge=1, description="Número de parcelas")
    parcela_atual: int = Field(default=1, ge=1, description="Parcela atual")


class TransacaoCreate(TransacaoBase):
    pass


class TransacaoUpdate(BaseModel):
    tipo: Optional[str] = Field(default=None, pattern="^(entrada|saida)$")
    categoria: Optional[str] = None
    valor: Optional[float] = Field(default=None, gt=0)
    desconto: Optional[float] = Field(default=None, ge=0)
    forma_pagamento: Optional[str] = None
    status: Optional[str] = None
    descricao: Optional[str] = Field(default=None, min_length=3, max_length=255)
    data_transacao: Optional[datetime] = None
    data_vencimento: Optional[datetime] = None
    data_pagamento: Optional[datetime] = None
    observacoes: Optional[str] = None
    paciente_id: Optional[int] = None
    paciente_nome: Optional[str] = None
    agendamento_id: Optional[int] = None
    parcelas: Optional[int] = Field(default=None, ge=1)
    parcela_atual: Optional[int] = Field(default=None, ge=1)


class TransacaoResponse(BaseModel):
    id: int
    tipo: str
    categoria: str
    valor: float
    desconto: float
    valor_final: float
    forma_pagamento: Optional[str]
    status: str
    descricao: str
    data_transacao: datetime
    data_vencimento: Optional[datetime]
    data_pagamento: Optional[datetime]
    observacoes: Optional[str]
    paciente_id: Optional[int]
    paciente_nome: Optional[str]
    agendamento_id: Optional[int]
    parcelas: int
    parcela_atual: int
    criado_por_id: Optional[int]
    criado_por_nome: Optional[str]
    created_at: Optional[datetime]
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


class TransacaoLista(BaseModel):
    total: int
    items: List[TransacaoResponse]


# ==================== CONTAS A PAGAR ====================

class ContaPagarBase(BaseModel):
    descricao: str = Field(..., min_length=3, max_length=255)
    fornecedor: Optional[str] = Field(default=None, max_length=255)
    categoria: Optional[str] = None
    valor: float = Field(..., gt=0)
    data_vencimento: datetime = Field(..., description="Data de vencimento")
    observacoes: Optional[str] = None


class ContaPagarCreate(ContaPagarBase):
    pass


class ContaPagarUpdate(BaseModel):
    descricao: Optional[str] = Field(default=None, min_length=3, max_length=255)
    fornecedor: Optional[str] = None
    categoria: Optional[str] = None
    valor: Optional[float] = Field(default=None, gt=0)
    data_vencimento: Optional[datetime] = None
    data_pagamento: Optional[datetime] = None
    status: Optional[str] = None
    observacoes: Optional[str] = None


class ContaPagarResponse(BaseModel):
    id: int
    descricao: str
    fornecedor: Optional[str]
    categoria: Optional[str]
    valor: float
    data_vencimento: datetime
    data_pagamento: Optional[datetime]
    status: str
    observacoes: Optional[str]
    criado_por_id: Optional[int]
    created_at: Optional[datetime]

    class Config:
        from_attributes = True


class ContaPagarLista(BaseModel):
    total: int
    items: List[ContaPagarResponse]


# ==================== CONTAS A RECEBER ====================

class ContaReceberBase(BaseModel):
    descricao: str = Field(..., min_length=3, max_length=255)
    cliente: Optional[str] = Field(default=None, max_length=255)
    categoria: Optional[str] = None
    valor: float = Field(..., gt=0)
    data_vencimento: datetime = Field(..., description="Data de vencimento")
    observacoes: Optional[str] = None
    paciente_id: Optional[int] = None
    agendamento_id: Optional[int] = None


class ContaReceberCreate(ContaReceberBase):
    pass


class ContaReceberUpdate(BaseModel):
    descricao: Optional[str] = Field(default=None, min_length=3, max_length=255)
    cliente: Optional[str] = None
    categoria: Optional[str] = None
    valor: Optional[float] = Field(default=None, gt=0)
    data_vencimento: Optional[datetime] = None
    data_recebimento: Optional[datetime] = None
    status: Optional[str] = None
    observacoes: Optional[str] = None
    paciente_id: Optional[int] = None
    agendamento_id: Optional[int] = None


class ContaReceberResponse(BaseModel):
    id: int
    descricao: str
    cliente: Optional[str]
    categoria: Optional[str]
    valor: float
    data_vencimento: datetime
    data_recebimento: Optional[datetime]
    status: str
    observacoes: Optional[str]
    paciente_id: Optional[int]
    agendamento_id: Optional[int]
    criado_por_id: Optional[int]
    created_at: Optional[datetime]

    class Config:
        from_attributes = True


class ContaReceberLista(BaseModel):
    total: int
    items: List[ContaReceberResponse]


# ==================== RELATÓRIOS ====================

class ResumoFinanceiro(BaseModel):
    periodo: str
    data_inicio: str
    data_fim: str
    entradas: float
    saidas: float
    saldo: float
    pendente_entrada: float
    pendente_saida: float
    a_receber: float
    a_pagar: float


class DadosGrafico(BaseModel):
    labels: List[str]
    entradas: List[float]
    saidas: List[float]


class CategoriaResumo(BaseModel):
    categoria: str
    total: float
    quantidade: int
    percentual: float


class RelatorioCategoria(BaseModel):
    tipo: str  # entrada ou saida
    periodo: str
    total: float
    categorias: List[CategoriaResumo]


class FluxoCaixaItem(BaseModel):
    data: str
    entradas: float
    saidas: float
    saldo_dia: float
    saldo_acumulado: float


class RelatorioFluxoCaixa(BaseModel):
    data_inicio: str
    data_fim: str
    saldo_inicial: float
    total_entradas: float
    total_saidas: float
    saldo_final: float
    items: List[FluxoCaixaItem]


class ComparativoMes(BaseModel):
    mes: str
    ano: int
    entradas: float
    saidas: float
    saldo: float
    variacao_entrada: Optional[float] = None
    variacao_saida: Optional[float] = None


class RelatorioComparativo(BaseModel):
    items: List[ComparativoMes]


class DREItem(BaseModel):
    categoria: str
    valor: float
    percentual_receita: float


class RelatorioDRE(BaseModel):
    """Demonstração do Resultado do Exercício"""
    periodo: str
    data_inicio: str
    data_fim: str
    
    # Receitas
    receita_bruta: float
    impostos: float
    receita_liquida: float
    
    # Custos e Despesas
    custos: List[DREItem]
    despesas_operacionais: List[DREItem]
    despesas_administrativas: List[DREItem]
    despesas_marketing: List[DREItem]
    
    total_custos: float
    total_despesas: float
    
    # Resultados
    lucro_bruto: float
    lucro_operacional: float
    margem_bruta: float
    margem_operacional: float
