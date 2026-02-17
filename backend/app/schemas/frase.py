"""Schemas para frases qualitativas"""
from typing import Optional, Dict, Any
from pydantic import BaseModel
from datetime import datetime


class FraseQualitativaBase(BaseModel):
    chave: str
    patologia: str
    grau: str = "Normal"
    valvas: str = ""
    camaras: str = ""
    funcao: str = ""
    pericardio: str = ""
    vasos: str = ""
    ad_vd: str = ""
    conclusao: str = ""
    detalhado: Optional[Dict[str, Any]] = None
    layout: str = "detalhado"


class FraseQualitativaCreate(FraseQualitativaBase):
    pass


class FraseQualitativaUpdate(BaseModel):
    patologia: Optional[str] = None
    grau: Optional[str] = None
    valvas: Optional[str] = None
    camaras: Optional[str] = None
    funcao: Optional[str] = None
    pericardio: Optional[str] = None
    vasos: Optional[str] = None
    ad_vd: Optional[str] = None
    conclusao: Optional[str] = None
    detalhado: Optional[Dict[str, Any]] = None
    layout: Optional[str] = None


class FraseQualitativaResponse(FraseQualitativaBase):
    id: int
    ativo: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    created_by: Optional[int] = None

    class Config:
        from_attributes = True


class FraseQualitativaLista(BaseModel):
    items: list[FraseQualitativaResponse]
    total: int


class FraseAplicarRequest(BaseModel):
    patologia: str
    grau_refluxo: Optional[str] = None
    grau_geral: Optional[str] = None
    layout: str = "detalhado"
