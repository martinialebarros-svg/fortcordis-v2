"""Add clinica_id to financeiro tables when missing."""
from __future__ import annotations

from sqlalchemy import inspect, text
from sqlalchemy.engine import Connection

VERSION = "20260304_07"
DESCRIPTION = "Adiciona clinica_id em transacoes/contas_pagar/contas_receber"


def _adicionar_coluna_clinica_id(connection: Connection, table_name: str, dialect: str) -> None:
    inspector = inspect(connection)
    if table_name not in inspector.get_table_names():
        return

    colunas = {column["name"] for column in inspector.get_columns(table_name)}
    if "clinica_id" in colunas:
        return

    # A instrucao funciona para PostgreSQL e SQLite neste caso.
    connection.execute(text(f"ALTER TABLE {table_name} ADD COLUMN clinica_id INTEGER"))


def upgrade(connection: Connection, dialect: str) -> None:
    _adicionar_coluna_clinica_id(connection, "transacoes", dialect)
    _adicionar_coluna_clinica_id(connection, "contas_pagar", dialect)
    _adicionar_coluna_clinica_id(connection, "contas_receber", dialect)
