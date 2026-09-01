from collections.abc import Mapping
from typing import Any

from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from app.core.config import settings


def build_database_engine_options(
    database_url: str,
    database_settings: Any = settings,
) -> Mapping[str, Any]:
    """Retorna opcoes de engine seguras para o dialeto configurado.

    SQLite e usado em testes e desenvolvimento local; os limites do QueuePool
    PostgreSQL nao se aplicam a ele. Para PostgreSQL, cada processo da API tem
    capacidade limitada, detecta sockets descartados antes do uso e deixa de
    esperar em tempo finito quando o pool ou a conexao externa degradarem.
    """

    if database_url.startswith("sqlite"):
        return {"connect_args": {"check_same_thread": False}}

    return {
        "connect_args": {
            "connect_timeout": database_settings.DATABASE_CONNECT_TIMEOUT_SECONDS,
        },
        "pool_pre_ping": database_settings.DATABASE_POOL_PRE_PING,
        "pool_size": database_settings.DATABASE_POOL_SIZE,
        "max_overflow": database_settings.DATABASE_MAX_OVERFLOW,
        "pool_timeout": database_settings.DATABASE_POOL_TIMEOUT_SECONDS,
        "pool_recycle": database_settings.DATABASE_POOL_RECYCLE_SECONDS,
    }


def create_database_engine(
    database_url: str,
    database_settings: Any = settings,
):
    return create_engine(
        database_url,
        **build_database_engine_options(database_url, database_settings),
    )


engine = create_database_engine(settings.DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
