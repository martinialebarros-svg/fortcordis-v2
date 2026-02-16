from pydantic import BaseModel, validator
from datetime import datetime
from typing import Optional, List

def parse_datetime(value):
    """Converte string ISO 8601 (com Z ou formato PostgreSQL) para datetime"""
    if isinstance(value, str):
        # Se termina com Z, converte para +00:00
        if value.endswith('Z'):
            value = value[:-1] + '+00:00'
        # Remove milisegundos (.000)
        if '.' in value:
            if '+' in value:
                dt_part, tz_part = value.rsplit('+', 1)
                if '.' in dt_part:
                    dt_part = dt_part.split('.')[0]
                value = f"{dt_part}+{tz_part}"
            else:
                value = value.split('.')[0]
        return datetime.fromisoformat(value)
    return value

class AgendamentoBase(BaseModel):
    paciente_id: int
    clinica_id: Optional[int] = None
    servico_id: Optional[int] = None
    inicio: datetime
    fim: Optional[datetime] = None
    status: str = "Agendado"
    observacoes: Optional[str] = None

    @validator('inicio', 'fim', pre=True)
    def parse_dates(cls, v):
        return parse_datetime(v) if v else None

class AgendamentoCreate(AgendamentoBase):
    pass

class AgendamentoUpdate(BaseModel):
    paciente_id: Optional[int] = None
    clinica_id: Optional[int] = None
    servico_id: Optional[int] = None
    inicio: Optional[datetime] = None
    fim: Optional[datetime] = None
    status: Optional[str] = None
    observacoes: Optional[str] = None

    @validator('inicio', 'fim', pre=True)
    def parse_dates(cls, v):
        return parse_datetime(v) if v else None

class AgendamentoResponse(BaseModel):
    id: int
    paciente_id: int
    clinica_id: Optional[int] = None
    servico_id: Optional[int] = None
    inicio: str  # Retorna como string para evitar problemas de formato
    fim: Optional[str] = None  # Retorna como string
    status: str
    observacoes: Optional[str] = None
    data: Optional[str]
    hora: Optional[str]
    paciente: Optional[str]
    tutor: Optional[str]
    telefone: Optional[str]
    servico: Optional[str]
    clinica: Optional[str]
    criado_por_nome: Optional[str]
    confirmado_por_nome: Optional[str]
    created_at: Optional[str]  # Retorna como string

    class Config:
        from_attributes = True

class AgendamentoLista(BaseModel):
    total: int
    items: List[AgendamentoResponse]
