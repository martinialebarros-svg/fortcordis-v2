"""Vinculo opcional e exclusivo da equipe com Supabase Auth."""
from sqlalchemy import inspect, text

VERSION = "20261012_97"
DESCRIPTION = "Vinculo explicito de usuarios internos com Supabase Auth"


def upgrade(connection, dialect):
    inspector = inspect(connection)
    if "usuarios" not in inspector.get_table_names():
        return
    if "supabase_auth_id" not in {column["name"] for column in inspector.get_columns("usuarios")}:
        connection.execute(text("ALTER TABLE usuarios ADD COLUMN supabase_auth_id VARCHAR(36)"))
    connection.execute(text(
        "CREATE UNIQUE INDEX IF NOT EXISTS ux_usuarios_supabase_auth_id ON usuarios (supabase_auth_id)"
    ))
