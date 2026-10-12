import os
import sys
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

import httpx
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from jose import JWTError, jwt
from sqlalchemy import create_engine, text

BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_DIR))
os.environ.setdefault("DATABASE_URL", "sqlite://")
os.environ.setdefault("SECRET_KEY", "supabase-auth-tests-only-strong-key-123456789")

from app.api.v1.endpoints import auth
from app.core import security
from app.core.config import settings
from app.db.database import get_db
from app.services import supabase_auth_service as provider
from migrations.runner import _load_migration

IDENTITY = "beec3a53-7d40-4c41-95dd-f39a7b2dcd16"
SESSION = {"user": {"id": IDENTITY}, "access_token": "provider-access",
           "refresh_token": "provider-refresh", "expires_in": 3600}


class FakeDB:
    def __init__(self, user):
        self.user = user
    def query(self, model):
        return self
    def filter(self, *args):
        return self
    def first(self):
        return self.user
    def commit(self):
        pass


@pytest.fixture
def setup(monkeypatch):
    monkeypatch.setattr(settings, "AUTH_PROVIDER", "supabase")
    monkeypatch.setattr(settings, "APP_ENV", "stage")
    user = SimpleNamespace(id=7, email="equipe@example.com", nome="Equipe", ativo=1,
                           supabase_auth_id=IDENTITY,
                           papeis=[SimpleNamespace(id=2, nome="veterinario", descricao="Veterinario")])
    db = FakeDB(user)
    app = FastAPI()
    app.include_router(auth.router, prefix="/api/v1/auth")
    app.dependency_overrides[get_db] = lambda: db
    return TestClient(app, base_url="https://app.example.com"), db


def test_login_uses_supabase_and_bounds_local_session(setup):
    client, db = setup
    with patch.object(provider, "password_session", return_value=SESSION) as login, patch.object(auth, "verify_password") as local:
        response = client.post("/api/v1/auth/login", data={"username": db.user.email, "password": "password"})
    assert response.status_code == 200
    login.assert_called_once_with(db.user.email, "password")
    local.assert_not_called()
    body = response.json()
    assert "provider-refresh" not in response.text
    assert "provider-access" not in response.text
    claims = jwt.decode(body["access_token"], settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    assert claims["supabase_user_id"] == IDENTITY
    assert body["papeis"] == ["veterinario"]
    cookies = response.headers.get_list("set-cookie")
    assert any("fortcordis_session=" in c and "Max-Age=3600" in c and "HttpOnly" in c and "Secure" in c for c in cookies)
    assert any("fortcordis_supabase_refresh=" in c and "HttpOnly" in c for c in cookies)
    assert response.headers["cache-control"] == "private, no-store"


@pytest.mark.parametrize("user", [None, SimpleNamespace(ativo=0)])
def test_unmapped_or_inactive_account_cannot_login(setup, user):
    client, db = setup
    db.user = user
    with patch.object(provider, "password_session", return_value=SESSION), patch.object(provider, "revoke_session") as revoke:
        response = client.post("/api/v1/auth/login", data={"username": "any@example.com", "password": "pw"})
    assert response.status_code == 403
    assert not response.headers.get_list("set-cookie")
    revoke.assert_called_once_with("provider-access")


def test_refresh_requires_csrf_even_when_access_cookie_expired(setup):
    client, _ = setup
    client.cookies.set(settings.SUPABASE_REFRESH_COOKIE_NAME, "refresh-old")
    with patch.object(provider, "refresh_session") as refresh:
        assert client.post("/api/v1/auth/refresh").status_code == 403
        refresh.assert_not_called()


def test_me_synchronizes_legacy_bearer_after_server_refresh(setup):
    client, db = setup
    token = auth.create_access_token({"sub": db.user.email, "auth_provider": "supabase", "supabase_user_id": IDENTITY})
    client.cookies.set(settings.AUTH_COOKIE_NAME, token)
    response = client.get("/api/v1/auth/me")
    assert response.status_code == 200
    assert response.headers["x-fortcordis-session"] == token
    assert response.headers["cache-control"] == "private, no-store"


def test_refresh_rotates_http_only_cookie(setup):
    client, _ = setup
    client.cookies.set(settings.SUPABASE_REFRESH_COOKIE_NAME, "refresh-old")
    client.cookies.set(settings.CSRF_COOKIE_NAME, "csrf-pair")
    with patch.object(provider, "refresh_session", return_value=SESSION) as refresh:
        response = client.post("/api/v1/auth/refresh", headers={settings.CSRF_HEADER_NAME: "csrf-pair"})
    assert response.status_code == 200
    refresh.assert_called_once_with("refresh-old")
    assert "fortcordis_supabase_refresh=provider-refresh" in response.headers.get("set-cookie")
    assert "provider-refresh" not in response.text


def test_supabase_mode_rejects_local_or_reassigned_identity(setup):
    _, db = setup
    for claims in [
        {"sub": db.user.email},
        {"sub": db.user.email, "auth_provider": "supabase", "supabase_user_id": "another-account"},
    ]:
        token = auth.create_access_token(claims)
        with pytest.raises(JWTError):
            security._decode_token_and_load_user(db, token)


def test_logout_revokes_provider_and_clears_all_cookies(setup):
    client, _ = setup
    client.cookies.set(settings.SUPABASE_ACCESS_COOKIE_NAME, "provider-access")
    with patch.object(provider, "revoke_session") as revoke:
        response = client.post("/api/v1/auth/logout")
    revoke.assert_called_once_with("provider-access")
    assert response.json()["provider_session_revoked"] is True
    assert len(response.headers.get_list("set-cookie")) == 4
    assert all("Max-Age=0" in cookie for cookie in response.headers.get_list("set-cookie"))


def test_provider_uses_api_key_and_password_grant(monkeypatch):
    monkeypatch.setattr(settings, "SUPABASE_URL", "https://example.supabase.co")
    monkeypatch.setattr(settings, "SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test")
    with patch.object(provider.httpx, "Client") as factory:
        request = factory.return_value.__enter__.return_value.request
        request.return_value = httpx.Response(200, json=SESSION)
        assert provider.password_session("email@example.com", "pw") == SESSION
        assert request.call_args.args == ("POST", "https://example.supabase.co/auth/v1/token?grant_type=password")
        assert request.call_args.kwargs["headers"] == {"apikey": "sb_publishable_test"}


@pytest.mark.parametrize("status, expected", [(400, 401), (429, 429), (503, 503)])
def test_provider_failures_do_not_expose_tokens(monkeypatch, status, expected):
    monkeypatch.setattr(settings, "SUPABASE_URL", "https://example.supabase.co")
    monkeypatch.setattr(settings, "SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test")
    with patch.object(provider.httpx, "Client") as factory:
        factory.return_value.__enter__.return_value.request.return_value = httpx.Response(status, json={"message": "SECRET"})
        with pytest.raises(auth.HTTPException) as error:
            provider.refresh_session("refresh-secret")
    assert error.value.status_code == expected
    assert "SECRET" not in error.value.detail


def test_identity_migration_is_idempotent_and_unique():
    engine = create_engine("sqlite://")
    migration = _load_migration(BACKEND_DIR / "migrations/versions/20261012_97_supabase_auth_identity.py")
    with engine.begin() as connection:
        connection.execute(text("CREATE TABLE usuarios (id INTEGER PRIMARY KEY)"))
        migration.upgrade(connection, "sqlite")
        migration.upgrade(connection, "sqlite")
        connection.execute(text("INSERT INTO usuarios (id, supabase_auth_id) VALUES (1, :id)"), {"id": IDENTITY})
        with pytest.raises(Exception):
            connection.execute(text("INSERT INTO usuarios (id, supabase_auth_id) VALUES (2, :id)"), {"id": IDENTITY})
