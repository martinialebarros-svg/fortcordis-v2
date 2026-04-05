from functools import lru_cache

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str
    SECRET_KEY: str = "change-me"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 720
    UPLOAD_DIR: str = "/opt/fortcordis/uploads"
    GOOGLE_MAPS_API_KEY: str = ""
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

    class Config:
        env_file = ".env"
        case_sensitive = True


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
