from sqlalchemy import Column, Integer, String, Text
from app.db.database import Base

class Tutor(Base):
    __tablename__ = "tutores"

    id = Column(Integer, primary_key=True, index=True)
    nome = Column(Text)
    nome_key = Column(Text)
    telefone = Column(Text)
    whatsapp = Column(Text)
    email = Column(Text)
    ativo = Column(Integer)
