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

    class Config:
        env_file = ".env"
        case_sensitive = True


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
