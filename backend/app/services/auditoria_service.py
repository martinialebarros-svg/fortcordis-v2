from __future__ import annotations

import json
from typing import Any, Optional

from fastapi import Request

from app.db.database import SessionLocal
from app.models.auditoria_evento import AuditoriaEvento
from app.models.user import User


def _json_safe(value: Any) -> str:
    try:
        return json.dumps(value or {}, ensure_ascii=False, default=str)
    except Exception:
        return "{}"


def _request_meta(request: Optional[Request]) -> tuple[Optional[str], Optional[str], Optional[str]]:
    if not request:
        return None, None, None

    forwarded_for = request.headers.get("x-forwarded-for", "").strip()
    if forwarded_for:
        ip = forwarded_for.split(",")[0].strip() or None
    else:
        ip = request.client.host if request.client else None

    rota = request.url.path if request.url else None
    metodo = request.method if request.method else None
    return ip, rota, metodo


def registrar_auditoria(
    *,
    current_user: Optional[User],
    modulo: str,
    entidade: str,
    acao: str,
    descricao: str,
    entidade_id: Optional[Any] = None,
    detalhes: Optional[dict[str, Any]] = None,
    request: Optional[Request] = None,
) -> None:
    """Registra evento de auditoria em best-effort (nao interrompe fluxo principal)."""
    session = SessionLocal()
    try:
        ip, rota, metodo = _request_meta(request)
        evento = AuditoriaEvento(
            usuario_id=getattr(current_user, "id", None),
            usuario_nome=getattr(current_user, "nome", None),
            usuario_email=getattr(current_user, "email", None),
            modulo=(modulo or "").strip() or "sistema",
            entidade=(entidade or "").strip() or "geral",
            entidade_id=str(entidade_id) if entidade_id is not None else None,
            acao=(acao or "").strip() or "ACAO",
            descricao=(descricao or "").strip() or None,
            detalhes_json=_json_safe(detalhes),
            ip_origem=ip,
            rota=rota,
            metodo=metodo,
        )
        session.add(evento)
        session.commit()
    except Exception as exc:
        session.rollback()
        print(f"[AUDITORIA] Falha ao registrar evento: {exc}")
    finally:
        session.close()
