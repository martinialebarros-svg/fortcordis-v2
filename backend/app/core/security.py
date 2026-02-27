from fastapi import HTTPException, Depends, Request, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy.exc import OperationalError, ProgrammingError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.database import get_db
from app.models.papel_permissao import PapelPermissao
from app.models.user import User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")

# Prefixos de API para mapeamento da matriz de permissões.
_MODULE_BY_PATH_PREFIX = [
    ("/api/v1/admin/dashboard", "dashboard"),
    ("/api/v1/admin", "usuarios_permissoes"),
    ("/api/v1/agenda", "agenda"),
    ("/api/v1/pacientes", "pacientes"),
    ("/api/v1/tutores", "pacientes"),
    ("/api/v1/clinicas", "clinicas"),
    ("/api/v1/servicos", "servicos"),
    ("/api/v1/laudos", "laudos"),
    ("/api/v1/exames", "laudos"),
    ("/api/v1/xml", "laudos"),
    ("/api/v1/imagens", "laudos"),
    ("/api/v1/frases", "frases"),
    ("/api/v1/referencias-eco", "referencias_eco"),
    ("/api/v1/financeiro", "financeiro"),
    ("/api/v1/tabelas-preco", "financeiro"),
    ("/api/v1/ordens-servico", "ordens_servico"),
    ("/api/v1/configuracoes", "configuracoes"),
    ("/api/v1/atendimentos", "atendimento_clinico"),
]


def _normalize_path(path: str) -> str:
    if not path:
        return "/"
    normalized = path.rstrip("/")
    return normalized or "/"


def _resolve_module_from_path(path: str) -> str | None:
    for prefix, module in _MODULE_BY_PATH_PREFIX:
        if path.startswith(prefix):
            return module
    return None


def _resolve_action_from_method(method: str) -> str:
    method = (method or "").upper()
    if method in {"GET", "HEAD", "OPTIONS"}:
        return "visualizar"
    if method == "DELETE":
        return "excluir"
    return "editar"


def _is_missing_permission_table_error(exc: Exception) -> bool:
    message = str(exc).lower()
    return "papeis_permissoes" in message and (
        "does not exist" in message
        or "undefinedtable" in message
        or "no such table" in message
    )


def _user_has_matrix_permission(db: Session, user: User, module: str, action: str) -> bool:
    papel_ids = [papel.id for papel in user.papeis if papel.id is not None]
    if not papel_ids:
        return False

    try:
        registros = (
            db.query(PapelPermissao)
            .filter(
                PapelPermissao.papel_id.in_(papel_ids),
                PapelPermissao.modulo == module,
            )
            .all()
        )
    except (ProgrammingError, OperationalError) as exc:
        # Compatibilidade temporária para ambientes sem a migração aplicada.
        db.rollback()
        if _is_missing_permission_table_error(exc):
            return True
        raise

    if not registros:
        return False
    return any(getattr(registro, action, 0) == 1 for registro in registros)


def _authorize_request_by_matrix(request: Request, db: Session, user: User) -> None:
    path = _normalize_path(request.url.path)

    # Endpoints de auth não entram na matriz.
    if path.startswith("/api/v1/auth"):
        return

    # Endpoints fora da API v1 ficam sem matriz.
    if not path.startswith("/api/v1"):
        return

    # Admin segue acesso total para evitar lockout operacional.
    if user.tem_papel("admin"):
        return

    module = _resolve_module_from_path(path)
    if module is None:
        return

    action = _resolve_action_from_method(request.method)
    if not _user_has_matrix_permission(db, user, module, action):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Acesso negado: sem permissao de {action} em {module}.",
        )


def get_current_user(
    request: Request,
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Credenciais invalidas",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    user = db.query(User).filter(User.email == email).first()
    if user is None:
        raise credentials_exception
    if user.ativo != 1:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Usuario inativo",
        )

    _authorize_request_by_matrix(request, db, user)
    return user


def require_papel(papel_nome: str):
    """Dependency para exigir um papel especifico."""

    def dependency(current_user: User = Depends(get_current_user)) -> User:
        if not current_user.tem_papel(papel_nome):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Acesso negado. Requer papel: {papel_nome}",
            )
        return current_user

    return dependency


def require_any_papel(*papeis: str):
    """Dependency para exigir qualquer um dos papeis listados."""

    def dependency(current_user: User = Depends(get_current_user)) -> User:
        if not any(current_user.tem_papel(p) for p in papeis):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Acesso negado. Requer um dos papeis: {', '.join(papeis)}",
            )
        return current_user

    return dependency
