from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Optional

from pydantic_settings import BaseSettings

ENV_FILE_PATH = Path(__file__).resolve().parents[2] / ".env"


class Settings(BaseSettings):
    DATABASE_URL: str
    APP_ENV: str = "development"
    SECRET_KEY: str = "change-me"
    ENFORCE_STRONG_SECRET_KEY_IN_PRODUCTION: bool = True
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 720
    AUTH_COOKIE_NAME: str = "fortcordis_session"
    AUTH_COOKIE_PATH: str = "/"
    AUTH_COOKIE_SAMESITE: str = "lax"
    AUTH_COOKIE_SECURE: bool = False
    AUTH_COOKIE_DOMAIN: Optional[str] = None
    CSRF_PROTECTION_ENABLED: bool = True
    CSRF_COOKIE_NAME: str = "fortcordis_csrf"
    CSRF_HEADER_NAME: str = "x-csrf-token"
    CSRF_TRUST_SAME_SITE_FETCH_METADATA: bool = True
    UPLOAD_DIR: str = "/opt/fortcordis/uploads"
    GOOGLE_MAPS_API_KEY: str = ""
    GOOGLE_ROUTES_CACHE_MAX_AGE_DAYS: int = 30
    GOOGLE_MAPS_USAGE_METRICS_RETENTION_DAYS: int = 90
    LOGISTICA_FORCE_REFRESH_HEURISTICA_COM_API_KEY: bool = False
    LOGISTICA_ALLOW_LIVE_GOOGLE_LOOKUPS_ON_READ: bool = True
    LOGISTICA_GOOGLE_TRAFFIC_AWARE: bool = False
    REQUIRE_STRONG_SECRET_KEY: bool = False
    REQUIRE_UP_TO_DATE_MIGRATIONS: bool = False
    ALLOW_PERMISSION_MATRIX_FALLBACK: bool = False
    ALLOW_LEGACY_PLAIN_PASSWORDS: bool = False
    UPLOAD_DEDUPE_METRICS_RETENTION_DAYS: int = 90
    UPLOAD_DEDUPE_METRICS_AUTOCLEAN_ENABLED: bool = True
    UPLOAD_DEDUPE_METRICS_AUTOCLEAN_INTERVAL_HOURS: int = 24
    UPLOAD_DEDUPE_METRICS_AUTOCLEAN_TIMEOUT_SECONDS: int = 120
    UPLOAD_DEDUPE_METRICS_AUTOCLEAN_STARTUP_JITTER_SECONDS: int = 120
    UPLOAD_DEDUPE_METRICS_CLEANUP_BATCH_SIZE: int = 5000
    UPLOAD_DEDUPE_CLEANUP_RUNS_RETENTION_DAYS: int = 90
    RUNTIME_HTTP_5XX_ALERT_WINDOW_MINUTES: int = 5
    RUNTIME_HTTP_5XX_ALERT_THRESHOLD: int = 20
    RUNTIME_HTTP_LATENCY_WINDOW_MINUTES: int = 30
    RUNTIME_HTTP_LATENCY_MAX_SAMPLES_PER_ENDPOINT: int = 2000
    RUNTIME_HTTP_LATENCY_PRIORITY_ENDPOINTS: str = (
        "/api/v1/agenda,/api/v1/atendimentos,/api/v1/relatorios,/api/v1/fiscal,/api/v1/logistica"
    )
    WEB_PUSH_VAPID_PUBLIC_KEY: str = ""
    WEB_PUSH_VAPID_PRIVATE_KEY: str = ""
    WEB_PUSH_VAPID_CLAIMS_SUB: str = "mailto:suporte@fortcordis.local"
    WEB_PUSH_GROUP_WINDOW_SECONDS: int = 90
    WEB_PUSH_SCHEDULER_ENABLED: bool = True
    WEB_PUSH_SCHEDULER_POLL_SECONDS: int = 30
    WEB_PUSH_SCHEDULER_DISTRIBUTED_LOCK_ENABLED: bool = True
    WEB_PUSH_SCHEDULER_DISTRIBUTED_LOCK_KEY: int = 80433001
    WEB_PUSH_PENDING_REMINDER_DEFAULT_HOURS: int = 6
    ASSISTENTE_AGENDA_TOKEN: str = ""
    ASSISTENTE_AGENDA_MAX_WINDOW_DAYS: int = 14
    PORTAL_CHALLENGE_EXPIRE_MINUTES: int = 15
    PORTAL_SESSION_TOKEN_EXPIRE_MINUTES: int = 30
    PORTAL_DOWNLOAD_TOKEN_EXPIRE_MINUTES: int = 5
    PORTAL_MAX_CHALLENGE_ATTEMPTS: int = 5
    PORTAL_DEBUG_EXPOSE_CODE: bool = False
    PORTAL_EMAIL_SMTP_HOST: str = ""
    PORTAL_EMAIL_SMTP_PORT: int = 587
    PORTAL_EMAIL_SMTP_USERNAME: str = ""
    PORTAL_EMAIL_SMTP_PASSWORD: str = ""
    PORTAL_EMAIL_SMTP_USE_TLS: bool = True
    PORTAL_EMAIL_SMTP_USE_SSL: bool = False
    PORTAL_EMAIL_FROM_EMAIL: str = "portal@fortcordis.local"
    PORTAL_EMAIL_FROM_NAME: str = "Portal Fort Cordis"
    PORTAL_EMAIL_SUBJECT: str = "Seu codigo de acesso - Portal Fort Cordis"
    PORTAL_WHATSAPP_WEBHOOK_URL: str = ""
    PORTAL_WHATSAPP_WEBHOOK_METHOD: str = "POST"
    PORTAL_WHATSAPP_WEBHOOK_AUTH_HEADER: str = "Authorization"
    PORTAL_WHATSAPP_WEBHOOK_AUTH_TOKEN: str = ""
    PORTAL_WHATSAPP_WEBHOOK_TIMEOUT_SECONDS: int = 10
    PORTAL_REMOTE_STORAGE_AUTH_HEADER: str = "Authorization"
    PORTAL_REMOTE_STORAGE_AUTH_TOKEN: str = ""
    PORTAL_REMOTE_STORAGE_TIMEOUT_SECONDS: int = 20

    class Config:
        env_file = str(ENV_FILE_PATH)
        case_sensitive = True


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
