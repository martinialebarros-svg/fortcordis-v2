from __future__ import annotations

from typing import Any

from sqlalchemy import text

from app.core.config import settings
from app.db.database import engine
from app.services.frases_service import get_frases_store_report
from app.services.laudo_pdf_jobs import get_laudo_pdf_storage_dir
from migrations.runner import get_migration_status

_PLACEHOLDER_SECRET_KEYS = {"", "change-me", "changeme", "secret", "default"}
_MIN_SECRET_KEY_LENGTH = 32


def _check_database() -> dict[str, Any]:
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
        return {"connected": True, "status": "connected", "error": None}
    except Exception as exc:
        return {"connected": False, "status": "disconnected", "error": str(exc)}


def _check_secret_key() -> dict[str, Any]:
    secret = str(settings.SECRET_KEY or "").strip()
    strong = len(secret) >= _MIN_SECRET_KEY_LENGTH and secret.lower() not in _PLACEHOLDER_SECRET_KEYS

    warning = None
    if not secret:
        warning = "SECRET_KEY ausente."
    elif secret.lower() in _PLACEHOLDER_SECRET_KEYS:
        warning = "SECRET_KEY usa valor padrao ou inseguro."
    elif len(secret) < _MIN_SECRET_KEY_LENGTH:
        warning = f"SECRET_KEY curta (< {_MIN_SECRET_KEY_LENGTH} caracteres)."

    return {
        "configured": bool(secret),
        "strong": strong,
        "warning": warning,
    }


def _check_migrations() -> dict[str, Any]:
    fallback = {
        "tracking_table_exists": False,
        "discovered_count": 0,
        "applied_count": 0,
        "current_version": None,
        "latest_version": None,
        "pending_versions": [],
        "pending_count": 0,
        "unknown_applied_versions": [],
        "descriptions": {},
        "warnings": [],
        "error": None,
    }

    try:
        status = get_migration_status()
    except Exception as exc:
        fallback["warnings"] = [f"Falha ao inspecionar migracoes: {exc}"]
        fallback["error"] = str(exc)
        return fallback

    warnings: list[str] = []
    if not status.get("tracking_table_exists"):
        warnings.append("Tabela schema_migrations ausente; nao e possivel confirmar o schema aplicado.")
    if int(status.get("pending_count") or 0) > 0:
        warnings.append(f"{status['pending_count']} migracao(oes) pendente(s).")
    if status.get("unknown_applied_versions"):
        warnings.append("Existem versoes aplicadas que nao estao no codigo atual.")

    status["warnings"] = warnings
    status["error"] = None
    return status


def build_runtime_report() -> dict[str, Any]:
    database = _check_database()
    migrations = _check_migrations()
    secret_key = _check_secret_key()

    warnings: list[str] = []
    if not database["connected"]:
        warnings.append("Banco indisponivel para consultas de saude.")
    warnings.extend(migrations.get("warnings") or [])
    if secret_key["warning"]:
        warnings.append(secret_key["warning"])

    startup_enforced_issues: list[str] = []
    if settings.REQUIRE_STRONG_SECRET_KEY and not secret_key["strong"]:
        startup_enforced_issues.append(
            "REQUIRE_STRONG_SECRET_KEY ativo, mas a SECRET_KEY nao atende ao minimo esperado."
        )
    if settings.REQUIRE_UP_TO_DATE_MIGRATIONS:
        if not migrations.get("tracking_table_exists"):
            startup_enforced_issues.append(
                "REQUIRE_UP_TO_DATE_MIGRATIONS ativo, mas schema_migrations nao existe."
            )
        elif int(migrations.get("pending_count") or 0) > 0:
            startup_enforced_issues.append(
                "REQUIRE_UP_TO_DATE_MIGRATIONS ativo, com migracoes pendentes."
            )

    readiness_issues = list(startup_enforced_issues)
    if not database["connected"]:
        readiness_issues.insert(0, "Banco indisponivel.")

    laudo_pdf_jobs_dir = None
    try:
        laudo_pdf_jobs_dir = get_laudo_pdf_storage_dir()
    except Exception as exc:
        warnings.append(f"Diretorio de PDFs assincronos indisponivel: {exc}")

    frases_store = get_frases_store_report()
    warnings.extend(frases_store.get("warnings") or [])

    return {
        "status": "healthy" if database["connected"] else "unhealthy",
        "ready": len(readiness_issues) == 0,
        "database": database,
        "migrations": migrations,
        "security": {
            "secret_key": secret_key,
        },
        "compatibility_modes": {
            "allow_permission_matrix_fallback": bool(settings.ALLOW_PERMISSION_MATRIX_FALLBACK),
            "allow_legacy_plain_passwords": bool(settings.ALLOW_LEGACY_PLAIN_PASSWORDS),
        },
        "integrations": {
            "google_maps_configured": bool(str(settings.GOOGLE_MAPS_API_KEY or "").strip()),
            "upload_dir": settings.UPLOAD_DIR,
            "laudo_pdf_jobs_dir": laudo_pdf_jobs_dir,
            "frases_store": frases_store,
        },
        "warnings": warnings,
        "startup_enforced_issues": startup_enforced_issues,
        "readiness_issues": readiness_issues,
    }


def validate_startup_or_raise() -> dict[str, Any]:
    report = build_runtime_report()

    for warning in report["warnings"]:
        print(f"[startup-check] WARN: {warning}")
    for issue in report["startup_enforced_issues"]:
        print(f"[startup-check] ERROR: {issue}")

    if report["startup_enforced_issues"]:
        raise RuntimeError(" | ".join(report["startup_enforced_issues"]))

    return report
