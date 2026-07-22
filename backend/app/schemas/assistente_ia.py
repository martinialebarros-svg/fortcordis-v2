from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, Field


class AssistenteIAChatRequest(BaseModel):
    mensagem: str = Field(..., min_length=1, max_length=6000)
    conversa_id: Optional[str] = Field(default=None, min_length=36, max_length=36)


class AssistenteIAAcaoDecisaoRequest(BaseModel):
    decisao: Literal["approve", "reject"]
    observacao: Optional[str] = Field(default=None, max_length=500)


class AssistenteIAMemoriaCreateRequest(BaseModel):
    titulo: str = Field(..., min_length=3, max_length=180)
    conteudo: str = Field(..., min_length=3, max_length=8000)
    categoria: str = Field(default="operacao", min_length=2, max_length=60)


class AssistenteIAMemoriaDecisaoRequest(BaseModel):
    decisao: Literal["approve", "reject"]


class AssistenteIAConhecimentoCreateRequest(BaseModel):
    titulo: str = Field(..., min_length=3, max_length=220)
    conteudo: str = Field(..., min_length=20, max_length=250_000)
    categoria: str = Field(default="manual", min_length=2, max_length=60)
    fonte: Optional[str] = Field(default=None, max_length=500)


class AssistenteIAFeedbackCreateRequest(BaseModel):
    mensagem_id: int = Field(..., ge=1)
    avaliacao: Literal["positive", "negative"]
    categoria: Optional[str] = Field(default=None, max_length=60)
    comentario: Optional[str] = Field(default=None, max_length=2000)
    correcao_esperada: Optional[str] = Field(default=None, max_length=6000)
