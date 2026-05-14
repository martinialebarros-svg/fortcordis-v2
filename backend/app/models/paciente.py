from sqlalchemy import Column, DateTime, Float, Integer, Text
from sqlalchemy.sql import func
from app.db.database import Base


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
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
