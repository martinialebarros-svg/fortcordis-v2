from datetime import datetime

from sqlalchemy import Column, Float, Integer, Text
from app.db.database import Base


def _legacy_now_str() -> str:
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


class Paciente(Base):
    __tablename__ = "pacientes"

    id = Column(Integer, primary_key=True, index=True)
    tutor_id = Column(Integer)
    nome = Column(Text, nullable=False)
    nome_key = Column(Text)
    especie = Column(Text)
    raca = Column(Text)
    sexo = Column(Text)
    nascimento = Column(Text)
    peso_kg = Column(Float)
    microchip = Column(Text)
    observacoes = Column(Text)
    ativo = Column(Integer)
    created_at = Column(Text, default=_legacy_now_str)
    updated_at = Column(Text)
