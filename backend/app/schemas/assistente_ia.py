from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, Field


class AssistenteIAChatRequest(BaseModel):
    mensagem: str = Field(..., min_length=1, max_length=6000)
    conversa_id: Optional[str] = Field(default=None, min_length=36, max_length=36)


class AssistenteIAAcaoDecisaoRequest(BaseModel):
    decisao: Literal["approve", "reject"]
    observacao: Optional[str] = Field(default=None, max_length=500)
