"""Supabase Auth via API oficial; tokens de renovacao ficam apenas no servidor/cookie HttpOnly."""
from __future__ import annotations

from urllib.parse import urlparse
from uuid import UUID

import httpx
from fastapi import HTTPException

from app.core.config import settings


def _auth_request(method: str, path: str, *, body: dict | None = None, token: str = "") -> dict:
    base = settings.SUPABASE_URL.rstrip("/")
    if urlparse(base).scheme != "https" or not settings.SUPABASE_PUBLISHABLE_KEY:
        raise HTTPException(503, "Supabase Auth nao configurado.")
    headers = {"apikey": settings.SUPABASE_PUBLISHABLE_KEY}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    try:
        with httpx.Client(timeout=settings.SUPABASE_AUTH_TIMEOUT_SECONDS) as client:
            response = client.request(method, f"{base}/auth/v1/{path}", headers=headers, json=body)
        if response.status_code == 429:
            raise HTTPException(429, "Muitas tentativas. Aguarde e tente novamente.")
        if response.status_code >= 500:
            raise HTTPException(503, "Servico de autenticacao temporariamente indisponivel.")
        if response.status_code >= 400:
            raise HTTPException(401, "Credenciais invalidas.")
        return response.json() if response.content else {}
    except (httpx.HTTPError, ValueError) as exc:
        # Nao incluir URL, corpo, senha ou tokens na mensagem/logs.
        raise HTTPException(503, "Servico de autenticacao temporariamente indisponivel.") from exc


def password_session(email: str, password: str) -> dict:
    return _auth_request("POST", "token?grant_type=password", body={"email": email, "password": password})


def refresh_session(refresh_token: str) -> dict:
    return _auth_request("POST", "token?grant_type=refresh_token", body={"refresh_token": refresh_token})


def session_identity(session: dict) -> tuple[str, int]:
    try:
        identity = str(UUID(session["user"]["id"]))
        expires_in = int(session["expires_in"])
        if expires_in <= 0 or not session["access_token"] or not session["refresh_token"]:
            raise ValueError("sessao incompleta")
        return identity, min(expires_in, settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60)
    except (KeyError, TypeError, ValueError) as exc:
        raise HTTPException(503, "Resposta de autenticacao invalida.") from exc


def revoke_session(access_token: str) -> None:
    if access_token:
        _auth_request("POST", "logout?scope=local", token=access_token)
