from sqlalchemy import Column, DateTime, Integer, Text
from sqlalchemy.sql import func
from app.db.database import Base


class Tutor(Base):
    __tablename__ = "tutores"

    id = Column(Integer, primary_key=True, index=True)
    nome = Column(Text)
    nome_key = Column(Text)
    telefone = Column(Text)
    whatsapp = Column(Text)
    email = Column(Text)
    cpf = Column(Text)
    cep = Column(Text)
    endereco = Column(Text)
    numero = Column(Text)
    complemento = Column(Text)
    bairro = Column(Text)
    cidade = Column(Text)
    estado = Column(Text)
    ativo = Column(Integer)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
