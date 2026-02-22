"""Simple versioned migration runner.

This project does not yet have an Alembic environment committed. To avoid
schema drift in stage/production, migrations are tracked in
`schema_migrations` and executed in filename order from `migrations/versions`.
"""
from __future__ import annotations

from dataclasses import dataclass
from importlib import util
from pathlib import Path
from typing import Callable, List, Set

from sqlalchemy import text
from sqlalchemy.engine import Connection

from app.db.database import engine

VERSIONS_DIR = Path(__file__).parent / "versions"


@dataclass(frozen=True)
class Migration:
    version: str
    description: str
    upgrade: Callable[[Connection, str], None]
    source: Path


def _load_migration(module_path: Path) -> Migration:
    module_name = f"migrations.versions.{module_path.stem}"
    spec = util.spec_from_file_location(module_name, module_path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Nao foi possivel carregar migracao: {module_path}")

    module = util.module_from_spec(spec)
    spec.loader.exec_module(module)
    migration_module = module

    version = getattr(migration_module, "VERSION", None)
    description = getattr(migration_module, "DESCRIPTION", "")
    upgrade = getattr(migration_module, "upgrade", None)

    if not isinstance(version, str) or not version.strip():
        raise RuntimeError(f"Migracao sem VERSION valido: {module_path.name}")
    if not callable(upgrade):
        raise RuntimeError(f"Migracao sem upgrade(connection, dialect): {module_path.name}")

    return Migration(
        version=version.strip(),
        description=str(description).strip(),
        upgrade=upgrade,
        source=module_path,
    )


def _discover_migrations() -> List[Migration]:
    if not VERSIONS_DIR.exists():
        return []

    migrations: List[Migration] = []
    seen_versions: Set[str] = set()
    for file_path in sorted(VERSIONS_DIR.glob("*.py")):
        if file_path.name == "__init__.py":
            continue
        migration = _load_migration(file_path)
        if migration.version in seen_versions:
            raise RuntimeError(f"Versao de migracao duplicada: {migration.version}")
        seen_versions.add(migration.version)
        migrations.append(migration)
    return migrations


def _ensure_schema_migrations_table(connection: Connection) -> None:
    connection.execute(
        text(
            """
            CREATE TABLE IF NOT EXISTS schema_migrations (
                version VARCHAR(255) PRIMARY KEY,
                description TEXT,
                applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
    )


def _get_applied_versions() -> Set[str]:
    with engine.connect() as connection:
        _ensure_schema_migrations_table(connection)
        rows = connection.execute(text("SELECT version FROM schema_migrations")).fetchall()
        return {str(row[0]) for row in rows}


def run_migrations() -> int:
    """Run pending migrations in order. Returns number of applied migrations."""
    migrations = _discover_migrations()
    if not migrations:
        print("[Migrations] Nenhuma migracao encontrada.")
        return 0

    with engine.begin() as connection:
        _ensure_schema_migrations_table(connection)

    applied_versions = _get_applied_versions()
    applied_count = 0

    for migration in migrations:
        if migration.version in applied_versions:
            continue

        with engine.begin() as connection:
            dialect_name = connection.dialect.name
            print(f"[Migrations] Aplicando {migration.version} ({migration.source.name})...")
            migration.upgrade(connection, dialect_name)
            connection.execute(
                text(
                    """
                    INSERT INTO schema_migrations (version, description)
                    VALUES (:version, :description)
                    """
                ),
                {"version": migration.version, "description": migration.description},
            )

        applied_count += 1
        applied_versions.add(migration.version)
        print(f"[Migrations] OK {migration.version}")

    if applied_count == 0:
        print("[Migrations] Nenhuma migracao pendente.")
    else:
        print(f"[Migrations] {applied_count} migracao(oes) aplicada(s).")

    return applied_count
