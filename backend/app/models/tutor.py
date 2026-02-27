from datetime import datetime

from sqlalchemy import Column, Integer, Text
from app.db.database import Base


def _legacy_now_str() -> str:
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


class Tutor(Base):
    __tablename__ = "tutores"

    id = Column(Integer, primary_key=True, index=True)
    nome = Column(Text)
    nome_key = Column(Text)
    telefone = Column(Text)
    whatsapp = Column(Text)
    email = Column(Text)
    ativo = Column(Integer)
    created_at = Column(Text, default=_legacy_now_str)
    updated_at = Column(Text)
