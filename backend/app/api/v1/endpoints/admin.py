import json
from datetime import datetime
from typing import Dict, List, Optional, Set, Tuple

from fastapi import APIRouter, Depends, HTTPException, status
from passlib.context import CryptContext
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import func, inspect, or_
from sqlalchemy.orm import Session

from app.core.security import require_papel
from app.db.database import get_db
from app.models.auditoria_evento import AuditoriaEvento
from app.models.papel import Papel
from app.models.papel_permissao import PapelPermissao
from app.models.user import User

router = APIRouter()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


PERMISSION_MODULES = [
    {"codigo": "dashboard", "nome": "Dashboard"},
    {"codigo": "agenda", "nome": "Agenda"},
    {"codigo": "pacientes", "nome": "Pacientes e tutores"},
    {"codigo": "clinicas", "nome": "Clinicas"},
    {"codigo": "servicos", "nome": "Servicos"},
    {"codigo": "laudos", "nome": "Laudos"},
    {"codigo": "frases", "nome": "Frases"},
    {"codigo": "referencias_eco", "nome": "Referencias eco"},
    {"codigo": "financeiro", "nome": "Financeiro"},
    {"codigo": "ordens_servico", "nome": "Ordens de servico"},
    {"codigo": "atendimento_clinico", "nome": "Atendimento clinico"},
    {"codigo": "configuracoes", "nome": "Configuracoes"},
    {"codigo": "usuarios_permissoes", "nome": "Usuarios e permissoes"},
]
PERMISSION_MODULE_CODES = {item["codigo"] for item in PERMISSION_MODULES}


class PapelAdminResponse(BaseModel):
    id: int
    nome: str
    descricao: Optional[str] = None


class UsuarioAdminCreate(BaseModel):
    nome: str = Field(..., min_length=2, max_length=120)
    email: EmailStr
    senha: str = Field(..., min_length=6, max_length=200)
    ativo: int = 1
    papeis: List[str] = Field(default_factory=list)


class UsuarioAdminUpdate(BaseModel):
    nome: Optional[str] = Field(default=None, min_length=2, max_length=120)
    email: Optional[EmailStr] = None
    senha: Optional[str] = Field(default=None, min_length=6, max_length=200)
    ativo: Optional[int] = None
    papeis: Optional[List[str]] = None


class PermissaoItemUpdate(BaseModel):
    papel_id: int
    modulo: str
    visualizar: bool
    editar: bool
    excluir: bool


class PermissoesUpdatePayload(BaseModel):
    itens: List[PermissaoItemUpdate] = Field(default_factory=list)


def _serializar_usuario(user: User) -> dict:
    papeis = sorted((p.nome for p in user.papeis), key=lambda nome: nome.lower())
    return {
        "id": user.id,
        "nome": user.nome,
        "email": user.email,
        "ativo": user.ativo,
        "papeis": papeis,
        "criado_em": user.criado_em,
        "ultimo_acesso": user.ultimo_acesso,
    }


def _hash_senha(senha: str) -> str:
    # bcrypt considera apenas os primeiros 72 bytes.
    senha_truncada = senha.encode("utf-8")[:72].decode("utf-8", errors="ignore")
    return pwd_context.hash(senha_truncada)


def _resolver_papeis(db: Session, nomes_papeis: List[str]) -> List[Papel]:
    nomes_normalizados = sorted(
        {
            (nome or "").strip().lower()
            for nome in nomes_papeis
            if (nome or "").strip()
        }
    )
    if not nomes_normalizados:
        return []

    papeis = db.query(Papel).all()
    papeis_por_nome = {(papel.nome or "").strip().lower(): papel for papel in papeis}

    faltantes = [nome for nome in nomes_normalizados if nome not in papeis_por_nome]
    if faltantes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Papel(es) invalido(s): {', '.join(faltantes)}",
        )

    return [papeis_por_nome[nome] for nome in nomes_normalizados]


def _default_permission_flags(nome_papel: str, modulo: str) -> Tuple[int, int, int]:
    papel = (nome_papel or "").strip().lower()
    if papel == "admin":
        return 1, 1, 1
    if modulo == "dashboard":
        return 1, 0, 0
    return 0, 0, 0


def _garantir_matriz_permissoes(db: Session) -> List[Papel]:
    papeis = db.query(Papel).order_by(Papel.nome.asc()).all()
    permissoes_existentes = db.query(PapelPermissao).all()
    mapa_existente: Set[Tuple[int, str]] = {
        (perm.papel_id, (perm.modulo or "").strip())
        for perm in permissoes_existentes
    }

    criou_novo_registro = False
    for papel in papeis:
        for modulo in PERMISSION_MODULE_CODES:
            chave = (papel.id, modulo)
            if chave in mapa_existente:
                continue
            visualizar, editar, excluir = _default_permission_flags(papel.nome, modulo)
            db.add(
                PapelPermissao(
                    papel_id=papel.id,
                    modulo=modulo,
                    visualizar=visualizar,
                    editar=editar,
                    excluir=excluir,
                )
            )
            criou_novo_registro = True

    if criou_novo_registro:
        db.commit()

    return papeis


@router.get("/dashboard")
def admin_dashboard(current_user: User = Depends(require_papel("admin"))):
    return {
        "message": "Bem-vindo ao painel de admin",
        "user": current_user.nome,
        "papeis": [p.nome for p in current_user.papeis],
    }


@router.get("/papeis", response_model=List[PapelAdminResponse])
def listar_papeis(
    current_user: User = Depends(require_papel("admin")),
    db: Session = Depends(get_db),
):
    _ = current_user
    papeis = db.query(Papel).order_by(Papel.nome.asc()).all()
    return [
        {"id": papel.id, "nome": papel.nome, "descricao": papel.descricao}
        for papel in papeis
    ]


@router.get("/permissoes")
def listar_permissoes(
    current_user: User = Depends(require_papel("admin")),
    db: Session = Depends(get_db),
):
    _ = current_user
    papeis = _garantir_matriz_permissoes(db)

    permissoes = db.query(PapelPermissao).all()
    por_chave: Dict[Tuple[int, str], PapelPermissao] = {
        (perm.papel_id, perm.modulo): perm for perm in permissoes
    }

    payload_papeis = []
    for papel in papeis:
        permissoes_papel = []
        for modulo in PERMISSION_MODULES:
            codigo = modulo["codigo"]
            registro = por_chave.get((papel.id, codigo))
            if registro is None:
                visualizar, editar, excluir = _default_permission_flags(papel.nome, codigo)
                permissoes_papel.append(
                    {
                        "modulo": codigo,
                        "visualizar": bool(visualizar),
                        "editar": bool(editar),
                        "excluir": bool(excluir),
                    }
                )
            else:
                permissoes_papel.append(
                    {
                        "modulo": codigo,
                        "visualizar": bool(registro.visualizar),
                        "editar": bool(registro.editar),
                        "excluir": bool(registro.excluir),
                    }
                )

        payload_papeis.append(
            {
                "id": papel.id,
                "nome": papel.nome,
                "descricao": papel.descricao,
                "permissoes": permissoes_papel,
            }
        )

    return {"modulos": PERMISSION_MODULES, "papeis": payload_papeis}


@router.put("/permissoes")
def atualizar_permissoes(
    payload: PermissoesUpdatePayload,
    current_user: User = Depends(require_papel("admin")),
    db: Session = Depends(get_db),
):
    _ = current_user
    if not payload.itens:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Nenhuma permissao enviada.",
        )

    papeis = db.query(Papel).all()
    papel_ids = {papel.id for papel in papeis}

    permissoes_existentes = db.query(PapelPermissao).all()
    por_chave: Dict[Tuple[int, str], PapelPermissao] = {
        (perm.papel_id, perm.modulo): perm for perm in permissoes_existentes
    }

    for item in payload.itens:
        modulo = (item.modulo or "").strip()
        if modulo not in PERMISSION_MODULE_CODES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Modulo invalido: {modulo}",
            )

        if item.papel_id not in papel_ids:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Papel invalido: {item.papel_id}",
            )

        chave = (item.papel_id, modulo)
        registro = por_chave.get(chave)
        if registro is None:
            registro = PapelPermissao(papel_id=item.papel_id, modulo=modulo)
            db.add(registro)
            por_chave[chave] = registro

        registro.visualizar = 1 if item.visualizar else 0
        registro.editar = 1 if item.editar else 0
        registro.excluir = 1 if item.excluir else 0

    db.commit()
    return {"message": "Permissoes atualizadas com sucesso.", "total": len(payload.itens)}


@router.get("/usuarios")
def listar_usuarios(
    current_user: User = Depends(require_papel("admin")),
    db: Session = Depends(get_db),
):
    _ = current_user
    usuarios = db.query(User).order_by(User.nome.asc()).all()
    return [_serializar_usuario(usuario) for usuario in usuarios]


@router.post("/usuarios", status_code=status.HTTP_201_CREATED)
def criar_usuario(
    payload: UsuarioAdminCreate,
    current_user: User = Depends(require_papel("admin")),
    db: Session = Depends(get_db),
):
    _ = current_user
    email_normalizado = payload.email.strip().lower()
    existente = db.query(User).filter(func.lower(User.email) == email_normalizado).first()
    if existente:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ja existe um usuario com este e-mail.",
        )

    papeis = _resolver_papeis(db, payload.papeis)

    novo_usuario = User(
        nome=payload.nome.strip(),
        email=email_normalizado,
        senha_hash=_hash_senha(payload.senha),
        ativo=1 if payload.ativo else 0,
        criado_por=current_user.id,
        tentativas_login=0,
        bloqueado_ate=None,
    )
    novo_usuario.papeis = papeis

    db.add(novo_usuario)
    db.commit()
    db.refresh(novo_usuario)
    return _serializar_usuario(novo_usuario)


@router.put("/usuarios/{usuario_id}")
def atualizar_usuario(
    usuario_id: int,
    payload: UsuarioAdminUpdate,
    current_user: User = Depends(require_papel("admin")),
    db: Session = Depends(get_db),
):
    usuario = db.query(User).filter(User.id == usuario_id).first()
    if not usuario:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuario nao encontrado.",
        )

    if payload.nome is not None:
        usuario.nome = payload.nome.strip()

    if payload.email is not None:
        email_normalizado = payload.email.strip().lower()
        existente = (
            db.query(User)
            .filter(func.lower(User.email) == email_normalizado, User.id != usuario_id)
            .first()
        )
        if existente:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Ja existe outro usuario com este e-mail.",
            )
        usuario.email = email_normalizado

    if payload.ativo is not None:
        if current_user.id == usuario_id and payload.ativo == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Nao e permitido desativar o proprio usuario.",
            )
        usuario.ativo = 1 if payload.ativo else 0

    if payload.senha:
        usuario.senha_hash = _hash_senha(payload.senha)

    if payload.papeis is not None:
        papeis = _resolver_papeis(db, payload.papeis)
        usuario.papeis = papeis

    db.commit()
    db.refresh(usuario)
    return _serializar_usuario(usuario)


@router.delete("/usuarios/{usuario_id}")
def desativar_usuario(
    usuario_id: int,
    current_user: User = Depends(require_papel("admin")),
    db: Session = Depends(get_db),
):
    usuario = db.query(User).filter(User.id == usuario_id).first()
    if not usuario:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuario nao encontrado.",
        )

    if current_user.id == usuario_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Nao e permitido desativar o proprio usuario.",
        )

    usuario.ativo = 0
    db.commit()
    return {"message": "Usuario desativado com sucesso.", "id": usuario_id, "ativo": 0}


@router.get("/auditoria")
def listar_auditoria(
    modulo: Optional[str] = None,
    acao: Optional[str] = None,
    entidade: Optional[str] = None,
    busca: Optional[str] = None,
    data_inicio: Optional[str] = None,
    data_fim: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(require_papel("admin")),
    db: Session = Depends(get_db),
):
    _ = current_user
    if "auditoria_eventos" not in inspect(db.bind).get_table_names():
        return {"total": 0, "items": [], "modulos": [], "acoes": []}

    query = db.query(AuditoriaEvento)

    if modulo:
        query = query.filter(AuditoriaEvento.modulo == modulo.strip())
    if acao:
        query = query.filter(AuditoriaEvento.acao == acao.strip())
    if entidade:
        query = query.filter(AuditoriaEvento.entidade == entidade.strip())

    if busca:
        termo = f"%{busca.strip()}%"
        query = query.filter(
            or_(
                AuditoriaEvento.usuario_nome.ilike(termo),
                AuditoriaEvento.usuario_email.ilike(termo),
                AuditoriaEvento.descricao.ilike(termo),
                AuditoriaEvento.entidade_id.ilike(termo),
            )
        )

    if data_inicio:
        query = query.filter(func.date(AuditoriaEvento.created_at) >= data_inicio)
    if data_fim:
        query = query.filter(func.date(AuditoriaEvento.created_at) <= data_fim)

    total = query.count()
    rows = (
        query.order_by(AuditoriaEvento.created_at.desc(), AuditoriaEvento.id.desc())
        .offset(skip)
        .limit(max(1, min(limit, 500)))
        .all()
    )

    modulos = [row[0] for row in db.query(AuditoriaEvento.modulo).distinct().order_by(AuditoriaEvento.modulo.asc()).all()]
    acoes = [row[0] for row in db.query(AuditoriaEvento.acao).distinct().order_by(AuditoriaEvento.acao.asc()).all()]

    def _parse_detalhes(raw: Optional[str]) -> dict:
        if not raw:
            return {}
        try:
            value = json.loads(raw)
            return value if isinstance(value, dict) else {"raw": value}
        except Exception:
            return {"raw": raw}

    items = [
        {
            "id": row.id,
            "created_at": row.created_at.isoformat() if isinstance(row.created_at, datetime) else str(row.created_at),
            "usuario_id": row.usuario_id,
            "usuario_nome": row.usuario_nome,
            "usuario_email": row.usuario_email,
            "modulo": row.modulo,
            "entidade": row.entidade,
            "entidade_id": row.entidade_id,
            "acao": row.acao,
            "descricao": row.descricao,
            "detalhes": _parse_detalhes(row.detalhes_json),
            "ip_origem": row.ip_origem,
            "rota": row.rota,
            "metodo": row.metodo,
        }
        for row in rows
    ]

    return {
        "total": total,
        "items": items,
        "modulos": modulos,
        "acoes": acoes,
    }
