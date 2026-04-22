from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings

ENV_FILE_PATH = Path(__file__).resolve().parents[2] / ".env"


class Settings(BaseSettings):
    DATABASE_URL: str
    SECRET_KEY: str = "change-me"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 720
    UPLOAD_DIR: str = "/opt/fortcordis/uploads"
    GOOGLE_MAPS_API_KEY: str = ""
    GOOGLE_ROUTES_CACHE_MAX_AGE_DAYS: int = 7
    GOOGLE_MAPS_USAGE_METRICS_RETENTION_DAYS: int = 90
    LOGISTICA_FORCE_REFRESH_HEURISTICA_COM_API_KEY: bool = False
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
    WEB_PUSH_VAPID_PUBLIC_KEY: str = ""
    WEB_PUSH_VAPID_PRIVATE_KEY: str = ""
    WEB_PUSH_VAPID_CLAIMS_SUB: str = "mailto:suporte@fortcordis.local"
    WEB_PUSH_GROUP_WINDOW_SECONDS: int = 90
    WEB_PUSH_SCHEDULER_ENABLED: bool = True
    WEB_PUSH_SCHEDULER_POLL_SECONDS: int = 30
    WEB_PUSH_PENDING_REMINDER_DEFAULT_HOURS: int = 6

    class Config:
        env_file = str(ENV_FILE_PATH)
        case_sensitive = True


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
