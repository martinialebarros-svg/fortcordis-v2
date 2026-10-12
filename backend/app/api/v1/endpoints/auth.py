from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from jose import jwt
from passlib.context import CryptContext
from datetime import datetime, timedelta
from typing import Optional
import secrets

from app.db.database import get_db
from app.models.user import User
from app.schemas.user import Token, UserResponse
from app.core.config import settings
from app.core.security import get_current_user, get_request_token
from app.core.csrf import has_valid_csrf_token_pair
from app.services import supabase_auth_service

router = APIRouter()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
_BCRYPT_PREFIXES = ("$2a$", "$2b$", "$2y$", "$2$")


def _request_uses_https(request: Request | None = None) -> bool:
    if request is None:
        return False

    forwarded_proto = (request.headers.get("x-forwarded-proto") or "").strip().lower()
    if forwarded_proto:
        first_value = forwarded_proto.split(",")[0].strip()
        if first_value == "https":
            return True

    return (request.url.scheme or "").strip().lower() == "https"


def _is_cookie_secure(request: Request | None = None) -> bool:
    if settings.AUTH_COOKIE_SECURE:
        return True
    if settings.APP_ENV.lower() in {"production", "staging", "stage"}:
        return True
    return _request_uses_https(request)


def _set_auth_cookie(response: Response, token: str, request: Request | None = None) -> None:
    response.set_cookie(
        key=settings.AUTH_COOKIE_NAME,
        value=token,
        httponly=True,
        secure=_is_cookie_secure(request),
        samesite=settings.AUTH_COOKIE_SAMESITE,
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        path=settings.AUTH_COOKIE_PATH,
        domain=settings.AUTH_COOKIE_DOMAIN,
    )


def _set_csrf_cookie(response: Response, csrf_token: str, request: Request | None = None) -> None:
    response.set_cookie(
        key=settings.CSRF_COOKIE_NAME,
        value=csrf_token,
        httponly=False,
        secure=_is_cookie_secure(request),
        samesite=settings.AUTH_COOKIE_SAMESITE,
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        path=settings.AUTH_COOKIE_PATH,
        domain=settings.AUTH_COOKIE_DOMAIN,
    )


def _clear_auth_cookie(response: Response, request: Request | None = None) -> None:
    response.delete_cookie(
        key=settings.AUTH_COOKIE_NAME,
        path=settings.AUTH_COOKIE_PATH,
        domain=settings.AUTH_COOKIE_DOMAIN,
        secure=_is_cookie_secure(request),
        samesite=settings.AUTH_COOKIE_SAMESITE,
    )


def _clear_csrf_cookie(response: Response, request: Request | None = None) -> None:
    response.delete_cookie(
        key=settings.CSRF_COOKIE_NAME,
        path=settings.AUTH_COOKIE_PATH,
        domain=settings.AUTH_COOKIE_DOMAIN,
        secure=_is_cookie_secure(request),
        samesite=settings.AUTH_COOKIE_SAMESITE,
    )


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifica senha apenas com hash bcrypt (sem fallback legado em texto plano)."""
    if not hashed_password or not hashed_password.startswith(_BCRYPT_PREFIXES):
        return False

    # bcrypt nao aceita senha > 72 bytes; trunca para evitar ValueError.
    pwd_bytes = plain_password.encode("utf-8")[:72]
    plain_truncated = pwd_bytes.decode("utf-8", errors="ignore")
    return pwd_context.verify(plain_truncated, hashed_password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt


def _set_supabase_cookie(response: Response, name: str, value: str, request: Request) -> None:
    response.set_cookie(
        key=name, value=value, httponly=True, secure=_is_cookie_secure(request),
        samesite=settings.AUTH_COOKIE_SAMESITE, path=settings.AUTH_COOKIE_PATH,
        domain=settings.AUTH_COOKIE_DOMAIN, max_age=settings.SUPABASE_REFRESH_MAX_AGE_SECONDS,
    )


def _issue_supabase_session(session: dict, db: Session, response: Response, request: Request) -> dict:
    identity, expires_in = supabase_auth_service.session_identity(session)
    user = db.query(User).filter(User.supabase_auth_id == identity).first()
    if user is None or user.ativo != 1:
        try:
            supabase_auth_service.revoke_session(session["access_token"])
        except HTTPException:
            pass
        raise HTTPException(403, "Conta sem acesso ativo a equipe Fort Cordis.")
    papeis = [papel.nome for papel in user.papeis]
    # JWT local mantem APIs, WebSockets e WhatsApp compativeis. Sua validade
    # nunca excede a do access token recebido do Supabase.
    access_token = create_access_token(
        {"sub": user.email, "user_id": user.id, "auth_provider": "supabase", "supabase_user_id": identity},
        timedelta(seconds=expires_in),
    )
    user.ultimo_acesso = datetime.now()
    db.commit()
    response.set_cookie(
        key=settings.AUTH_COOKIE_NAME, value=access_token, httponly=True,
        secure=_is_cookie_secure(request), samesite=settings.AUTH_COOKIE_SAMESITE,
        path=settings.AUTH_COOKIE_PATH, domain=settings.AUTH_COOKIE_DOMAIN, max_age=expires_in,
    )
    _set_supabase_cookie(response, settings.SUPABASE_REFRESH_COOKIE_NAME, session["refresh_token"], request)
    _set_supabase_cookie(response, settings.SUPABASE_ACCESS_COOKIE_NAME, session["access_token"], request)
    response.set_cookie(
        key=settings.CSRF_COOKIE_NAME, value=request.cookies.get(settings.CSRF_COOKIE_NAME) or secrets.token_urlsafe(32),
        httponly=False, secure=_is_cookie_secure(request), samesite=settings.AUTH_COOKIE_SAMESITE,
        path=settings.AUTH_COOKIE_PATH, domain=settings.AUTH_COOKIE_DOMAIN,
        max_age=settings.SUPABASE_REFRESH_MAX_AGE_SECONDS,
    )
    response.headers["Cache-Control"] = "private, no-store"
    return {"access_token": access_token, "token_type": "bearer", "user_id": user.id,
            "nome": user.nome, "email": user.email, "papeis": papeis}

@router.post("/login", response_model=Token)
def login(
    request: Request,
    response: Response,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    response.headers["Cache-Control"] = "private, no-store"
    if settings.AUTH_PROVIDER == "supabase":
        session = supabase_auth_service.password_session(form_data.username, form_data.password)
        return _issue_supabase_session(session, db, response, request)
    user = db.query(User).filter(User.email == form_data.username).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email ou senha incorretos",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if user.ativo != 1:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Usuário inativo"
        )
    
    if not verify_password(form_data.password, user.senha_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email ou senha incorretos",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Pega os nomes dos papéis
    papeis_nomes = [p.nome for p in user.papeis]
    
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.email, "user_id": user.id, "nome": user.nome, "papeis": papeis_nomes}, 
        expires_delta=access_token_expires
    )
    
    user.ultimo_acesso = datetime.now()
    db.commit()

    _set_auth_cookie(response, access_token, request)
    _set_csrf_cookie(response, secrets.token_urlsafe(32), request)
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user_id": user.id,
        "nome": user.nome,
        "email": user.email,
        "papeis": papeis_nomes
    }


@router.post("/logout")
def logout(request: Request, response: Response):
    revoked = True
    if settings.AUTH_PROVIDER == "supabase":
        try:
            access_token = request.cookies.get(settings.SUPABASE_ACCESS_COOKIE_NAME, "")
            if not access_token and request.cookies.get(settings.SUPABASE_REFRESH_COOKIE_NAME):
                session = supabase_auth_service.refresh_session(request.cookies[settings.SUPABASE_REFRESH_COOKIE_NAME])
                access_token = session["access_token"]
            try:
                supabase_auth_service.revoke_session(access_token)
            except HTTPException as exc:
                if exc.status_code != 401:
                    raise
                refresh_token = request.cookies.get(settings.SUPABASE_REFRESH_COOKIE_NAME, "")
                if refresh_token:
                    session = supabase_auth_service.refresh_session(refresh_token)
                    supabase_auth_service.revoke_session(session["access_token"])
        except HTTPException:
            revoked = False
    _clear_auth_cookie(response, request)
    _clear_csrf_cookie(response, request)
    for name in (settings.SUPABASE_REFRESH_COOKIE_NAME, settings.SUPABASE_ACCESS_COOKIE_NAME):
        response.delete_cookie(
            name, path=settings.AUTH_COOKIE_PATH, domain=settings.AUTH_COOKIE_DOMAIN,
            secure=_is_cookie_secure(request), samesite=settings.AUTH_COOKIE_SAMESITE,
        )
    response.headers["Cache-Control"] = "private, no-store"
    return {"success": True, "provider_session_revoked": revoked}


@router.post("/refresh", response_model=Token)
def refresh(request: Request, response: Response, db: Session = Depends(get_db)):
    if settings.AUTH_PROVIDER != "supabase":
        raise HTTPException(404, "Renovacao de sessao indisponivel.")
    if not has_valid_csrf_token_pair(
        request.headers.get(settings.CSRF_HEADER_NAME), request.cookies.get(settings.CSRF_COOKIE_NAME)
    ):
        raise HTTPException(403, "CSRF: token invalido.")
    token = request.cookies.get(settings.SUPABASE_REFRESH_COOKIE_NAME, "")
    if not token:
        raise HTTPException(401, "Sessao expirada.")
    return _issue_supabase_session(supabase_auth_service.refresh_session(token), db, response, request)

@router.get("/me", response_model=UserResponse)
def read_users_me(request: Request, response: Response, current_user: User = Depends(get_current_user)):
    response.headers["Cache-Control"] = "private, no-store"
    # Sincroniza o Bearer legado apos renovacao feita pelo middleware Next.js.
    response.headers["X-Fortcordis-Session"] = get_request_token(request)
    return current_user
