"""Schemas Pydantic para o módulo de atendimento clínico."""
from typing import Any, Dict, List, Optional, Union

from pydantic import BaseModel, Field


class ExameSolicitacaoPayload(BaseModel):
    id: Optional[int] = None
    catalogo_exame_id: Optional[int] = None
    painel_exame_id: Optional[int] = None
    painel_exame_nome: Optional[str] = ""
    tipo_exame: str = Field(..., min_length=2, max_length=120)
    categoria_exame: Optional[str] = ""
    preparo: Optional[str] = ""
    prioridade: str = Field(default="Rotina", max_length=50)
    status: str = Field(default="Solicitado", max_length=50)
    resultado: Optional[str] = ""
    valor_referencia: Optional[str] = ""
    unidade: Optional[str] = ""
    data_resultado: Optional[str] = None
    observacoes: Optional[str] = ""
    valor: Optional[float] = 0.0
    laudo_id: Optional[int] = None


class PrescricaoItemPayload(BaseModel):
    id: Optional[int] = None
    medicamento_id: Optional[int] = None
    medicamento_nome: Optional[str] = ""
    apresentacao_selecionada: Optional[str] = ""
    dose: Optional[str] = ""
    frequencia: Optional[str] = ""
    duracao: Optional[str] = ""
    via: Optional[str] = ""
    instrucoes: Optional[str] = ""
    ordem: Optional[int] = 0


class PrescricaoPayload(BaseModel):
    orientacoes_gerais: Optional[str] = ""
    retorno_dias: Optional[int] = None
    itens: List[PrescricaoItemPayload] = Field(default_factory=list)


class TriagemPayload(BaseModel):
    peso: Optional[float] = None
    temperatura: Optional[float] = None
    frequencia_cardiaca: Optional[int] = None
    frequencia_respiratoria: Optional[int] = None
    pressao_arterial: Optional[str] = ""
    saturacao_oxigenio: Optional[int] = None
    escore_condicion_corpo: Optional[int] = None
    mucosas: Optional[str] = ""
    hidratacao: Optional[str] = ""
    triagem_observacoes: Optional[str] = ""


class DiagnosticoPayload(BaseModel):
    diagnostico_principal: Optional[str] = ""
    diagnostico_secundario: Optional[str] = ""
    diagnostico_diferencial: Optional[str] = ""
    prognostico: Optional[str] = ""


class EvolucaoPayload(BaseModel):
    descricao: str
    sinais_vitais: Optional[str] = ""


class AnexoPayload(BaseModel):
    tipo: str = Field(..., max_length=50)
    descricao: Optional[str] = ""
    url: str
    nome_original: Optional[str] = ""
    tamanho: Optional[int] = None
    mime_type: Optional[str] = ""
    exame_id: Optional[int] = None


class DocumentoTemplatePayload(BaseModel):
    nome: str = Field(..., min_length=2, max_length=255)
    tipo: str = Field(default="documento", max_length=80)
    titulo_padrao: str = Field(..., min_length=2, max_length=255)
    corpo_template: str = Field(..., min_length=2)
    ativo: Optional[int] = 1
    ordem: Optional[int] = 0


class DocumentoAtendimentoCreatePayload(BaseModel):
    template_id: Optional[int] = None
    titulo: Optional[str] = Field(default="", max_length=255)
    corpo: Optional[str] = ""


class DocumentoAtendimentoUpdatePayload(BaseModel):
    titulo: Optional[str] = Field(default=None, max_length=255)
    corpo: Optional[str] = None
    status: Optional[str] = Field(default=None, max_length=40)


class AlertaPayload(BaseModel):
    tipo: str = Field(..., max_length=50)
    titulo: str
    descricao: Optional[str] = ""
    gravidade: Optional[str] = "media"


class AtendimentoCreatePayload(BaseModel):
    paciente_id: int
    clinica_id: Optional[int] = None
    agendamento_id: Optional[int] = None
    data_atendimento: Optional[str] = None
    status: str = Field(default="Triagem", max_length=50)
    triagem: Optional[TriagemPayload] = None
    queixa_principal: Optional[str] = ""
    anamnese: Optional[str] = ""
    exame_fisico: Optional[str] = ""
    dados_clinicos: Optional[str] = ""
    diagnostico: Optional[Union[DiagnosticoPayload, str]] = None
    plano_terapeutico: Optional[str] = ""
    retorno_recomendado: Optional[str] = ""
    motivo_retorno: Optional[str] = ""
    observacoes: Optional[str] = ""
    exames: List[ExameSolicitacaoPayload] = Field(default_factory=list)
    prescricao: Optional[PrescricaoPayload] = None


class AtendimentoUpdatePayload(BaseModel):
    paciente_id: Optional[int] = None
    clinica_id: Optional[int] = None
    agendamento_id: Optional[int] = None
    data_atendimento: Optional[str] = None
    status: Optional[str] = None
    triagem: Optional[TriagemPayload] = None
    triagem_concluida: Optional[int] = None
    consulta_concluida: Optional[int] = None
    queixa_principal: Optional[str] = None
    anamnese: Optional[str] = None
    exame_fisico: Optional[str] = None
    dados_clinicos: Optional[str] = None
    diagnostico: Optional[Union[DiagnosticoPayload, str]] = None
    plano_terapeutico: Optional[str] = None
    retorno_recomendado: Optional[str] = None
    motivo_retorno: Optional[str] = None
    observacoes: Optional[str] = None
    exames: Optional[List[ExameSolicitacaoPayload]] = None
    prescricao: Optional[PrescricaoPayload] = None


class MedicamentoPayload(BaseModel):
    nome: str = Field(..., min_length=2, max_length=255)
    principio_ativo: Optional[str] = ""
    concentracao: Optional[str] = ""
    forma_farmaceutica: Optional[str] = ""
    categoria: Optional[str] = ""
    classe_terapeutica: Optional[str] = ""
    especie_alvo: Optional[str] = ""
    dose_min_mg_kg: Optional[float] = None
    dose_max_mg_kg: Optional[float] = None
    dose_intervalo_horas: Optional[int] = None
    dose_unidade: Optional[str] = "mg/kg"
    via_padrao: Optional[str] = ""
    duracao_padrao: Optional[str] = ""
    concentracao_mg_ml: Optional[float] = None
    concentracao_mg_comprimido: Optional[float] = None
    indicacoes: Optional[str] = ""
    contraindicacoes: Optional[str] = ""
    interacoes: List[str] = Field(default_factory=list)
    observacao_seguranca: Optional[str] = ""
    parametrizacao_origem: Optional[str] = "manual"
    observacoes: Optional[str] = ""
    ativo: Optional[int] = 1


class ClinicalPhrasePayload(BaseModel):
    secao: str = Field(..., min_length=2, max_length=120)
    titulo: str = Field(..., min_length=2, max_length=255)
    texto: str = Field(..., min_length=2)
    ordem: Optional[int] = 0
    ativo: Optional[int] = 1


class PainelExameItemPayload(BaseModel):
    catalogo_exame_id: int = Field(..., ge=1)
    ordem: Optional[int] = 0


class PainelExamePayload(BaseModel):
    nome: str = Field(..., min_length=2, max_length=255)
    categoria: Optional[str] = ""
    especie_alvo: Optional[str] = ""
    observacoes: Optional[str] = ""
    ativo: Optional[int] = 1
    itens: List[PainelExameItemPayload] = Field(default_factory=list)


class PrescricaoPreviewPayload(BaseModel):
    """Payload para preview em tempo real da prescricao (sem salvar no banco)."""
    paciente_nome: str = ""
    paciente_especie: str = ""
    paciente_raca: str = ""
    paciente_peso: Optional[float] = None
    paciente_sexo: str = ""
    paciente_idade: str = ""
    tutor_nome: str = ""
    veterinario_nome: str = ""
    data_atendimento: str = ""
    orientacoes_gerais: str = ""
    retorno_dias: Optional[int] = None
    itens: List[PrescricaoItemPayload] = Field(default_factory=list)
