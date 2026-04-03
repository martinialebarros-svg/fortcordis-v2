import os
import sys
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

from fastapi import HTTPException
from jose import jwt
from starlette.requests import Request

BACKEND_DIR = Path(__file__).resolve().parents[1]
os.chdir(BACKEND_DIR)
sys.path.insert(0, str(BACKEND_DIR))

os.environ.setdefault("DATABASE_URL", "sqlite:///./fortcordis.db")
os.environ.setdefault("SECRET_KEY", "atendimento-pdf-auth-test-secret-key-1234567890")

from app.api.v1.endpoints import atendimento
from app.core.config import settings


class _FakeQuery:
    def __init__(self, result):
        self._result = result

    def filter(self, *args, **kwargs):
        return self

    def first(self):
        return self._result


class _FakeDB:
    def __init__(self, user):
        self._user = user

    def query(self, model):
        model_name = getattr(model, "__name__", "")
        if model_name == "User":
            return _FakeQuery(self._user)
        return _FakeQuery(None)


def _make_request(*, authorization: str | None = None, query_string: str = "") -> Request:
    headers = []
    if authorization:
        headers.append((b"authorization", authorization.encode("utf-8")))
    scope = {
        "type": "http",
        "method": "GET",
        "path": "/api/v1/atendimentos/1/prescricao/pdf",
        "raw_path": b"/api/v1/atendimentos/1/prescricao/pdf",
        "query_string": query_string.encode("utf-8"),
        "headers": headers,
        "client": ("testclient", 50000),
        "server": ("testserver", 80),
        "scheme": "http",
        "http_version": "1.1",
    }
    return Request(scope)


class AtendimentoPdfAuthTest(unittest.TestCase):
    def setUp(self) -> None:
        self.active_user = SimpleNamespace(
            id=1,
            email="veterinario@example.com",
            nome="Veterinario",
            ativo=1,
        )
        self.inactive_user = SimpleNamespace(
            id=2,
            email="inativo@example.com",
            nome="Inativo",
            ativo=0,
        )

    def _make_token(self, email: str) -> str:
        return jwt.encode(
            {"sub": email},
            settings.SECRET_KEY,
            algorithm=settings.ALGORITHM,
        )

    def test_rejects_access_token_query_even_with_valid_bearer(self) -> None:
        token = self._make_token(self.active_user.email)
        request = _make_request(
            authorization=f"Bearer {token}",
            query_string="access_token=legacy-token",
        )
        db = _FakeDB(self.active_user)

        with patch.object(atendimento, "_authorize_request_by_matrix") as authorize_mock:
            with self.assertRaises(HTTPException) as ctx:
                atendimento._autenticar_usuario_pdf(request, db)

        self.assertEqual(ctx.exception.status_code, 400)
        self.assertIn("Nao use access_token na URL", str(ctx.exception.detail))
        self.assertEqual(authorize_mock.call_count, 0)

    def test_requires_bearer_header(self) -> None:
        request = _make_request()
        db = _FakeDB(self.active_user)

        with self.assertRaises(HTTPException) as ctx:
            atendimento._autenticar_usuario_pdf(request, db)

        self.assertEqual(ctx.exception.status_code, 401)
        self.assertEqual(ctx.exception.headers.get("WWW-Authenticate"), "Bearer")

    def test_rejects_invalid_bearer(self) -> None:
        request = _make_request(authorization="Bearer token-invalido")
        db = _FakeDB(self.active_user)

        with self.assertRaises(HTTPException) as ctx:
            atendimento._autenticar_usuario_pdf(request, db)

        self.assertEqual(ctx.exception.status_code, 401)
        self.assertEqual(ctx.exception.headers.get("WWW-Authenticate"), "Bearer")

    def test_returns_user_for_valid_bearer(self) -> None:
        token = self._make_token(self.active_user.email)
        request = _make_request(authorization=f"Bearer {token}")
        db = _FakeDB(self.active_user)

        with patch.object(atendimento, "_authorize_request_by_matrix") as authorize_mock:
            result = atendimento._autenticar_usuario_pdf(request, db)

        self.assertIs(result, self.active_user)
        self.assertEqual(authorize_mock.call_count, 1)

    def test_rejects_inactive_user_with_403(self) -> None:
        token = self._make_token(self.inactive_user.email)
        request = _make_request(authorization=f"Bearer {token}")
        db = _FakeDB(self.inactive_user)

        with patch.object(atendimento, "_authorize_request_by_matrix") as authorize_mock:
            with self.assertRaises(HTTPException) as ctx:
                atendimento._autenticar_usuario_pdf(request, db)

        self.assertEqual(ctx.exception.status_code, 403)
        self.assertIn("Usuario inativo", str(ctx.exception.detail))
        self.assertEqual(authorize_mock.call_count, 0)


if __name__ == "__main__":
    unittest.main()
