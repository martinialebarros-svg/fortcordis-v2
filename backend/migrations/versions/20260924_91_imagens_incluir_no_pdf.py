"""Permite escolher quais imagens do laudo entram no PDF."""
from __future__ import annotations

from sqlalchemy import inspect, text
from sqlalchemy.engine import Connection

VERSION = "20260924_91"
DESCRIPTION = "Adiciona incluir_no_pdf as imagens permanentes e temporarias"


def upgrade(connection: Connection, dialect: str) -> None:
    del dialect
    for table in ("imagens_laudo", "imagens_temporarias"):
        inspector = inspect(connection)
        if table not in inspector.get_table_names():
            continue
        columns = {column["name"] for column in inspector.get_columns(table)}
        if "incluir_no_pdf" not in columns:
            connection.execute(
                text(
                    f"ALTER TABLE {table} "
                    "ADD COLUMN incluir_no_pdf BOOLEAN NOT NULL DEFAULT 1"
                )
            )
