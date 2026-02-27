from datetime import datetime
import re
import unicodedata
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import String, cast, func, inspect, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.security import get_current_user
from app.db.database import get_db
from app.models.paciente import Paciente
from app.models.tutor import Tutor
from app.models.user import User

router = APIRouter()


def _gerar_nome_key(nome: Optional[str]) -> str:
    """Gera chave normalizada para compatibilidade com schema legado."""
    if not nome:
        return ""
    texto = unicodedata.normalize("NFKD", nome)
    texto = "".join(c for c in texto if not unicodedata.combining(c))
    texto = texto.lower().strip()
    texto = re.sub(r"[^a-z0-9\s]", "", texto)
    texto = re.sub(r"\s+", " ", texto)
    return texto


def _legacy_now_str() -> str:
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


def _filtro_paciente_ativo():
    """Compatibilidade entre bancos legados com ativo como INTEGER/BOOLEAN/TEXT."""
    return func.lower(func.coalesce(cast(Paciente.ativo, String), "1")).in_(["1", "true", "t"])


def _is_ativo(valor) -> bool:
    if valor is None:
        return True
    if isinstance(valor, bool):
        return valor
    if isinstance(valor, (int, float)):
        return int(valor) != 0
    return str(valor).strip().lower() in {"1", "true", "t", "yes", "y"}


def _ensure_tutores_timestamp_columns(db: Session) -> None:
    """
    Compatibilidade com bases legadas (ex.: SQLite local) onde a tabela tutores
    não possui created_at/updated_at.
    """
    bind = db.get_bind()
    insp = inspect(bind)
    if "tutores" not in insp.get_table_names():
        return

    colunas = {col["name"] for col in insp.get_columns("tutores")}
    alteracoes: list[str] = []

    if "created_at" not in colunas:
        alteracoes.append('ALTER TABLE "tutores" ADD COLUMN created_at TEXT')
    if "updated_at" not in colunas:
        alteracoes.append('ALTER TABLE "tutores" ADD COLUMN updated_at TEXT')

    if not alteracoes:
        return

    for sql in alteracoes:
        db.execute(text(sql))
    db.commit()


def _obter_ou_criar_tutor(db: Session, tutor_nome_raw: Optional[str]) -> Optional[int]:
    _ensure_tutores_timestamp_columns(db)

    if not tutor_nome_raw:
        return None

    tutor_nome = tutor_nome_raw.strip()
    if not tutor_nome:
        return None

    tutor_nome_key = _gerar_nome_key(tutor_nome)
    tutor = db.query(Tutor).filter(Tutor.nome_key == tutor_nome_key).first()
    if not tutor:
        tutor = db.query(Tutor).filter(Tutor.nome.ilike(tutor_nome)).first()

    if tutor:
        return tutor.id

    tutor = Tutor(
        nome=tutor_nome,
        nome_key=tutor_nome_key,
        email="",
        telefone="",
        ativo=1,
        created_at=_legacy_now_str(),
    )
    db.add(tutor)

    try:
        db.commit()
        db.refresh(tutor)
        return tutor.id
    except IntegrityError:
        db.rollback()
        tutor = db.query(Tutor).filter(Tutor.nome_key == tutor_nome_key).first()
        if not tutor:
            tutor = db.query(Tutor).filter(Tutor.nome.ilike(tutor_nome)).first()
        if not tutor:
            raise
        return tutor.id


def _buscar_paciente_por_chave(
    db: Session,
    *,
    nome_key: str,
    tutor_id: Optional[int],
    especie: str,
):
    query = db.query(Paciente).filter(Paciente.nome_key == nome_key)

    if tutor_id is None:
        query = query.filter(Paciente.tutor_id.is_(None))
    else:
        query = query.filter(Paciente.tutor_id == tutor_id)

    query = query.filter(func.lower(func.coalesce(Paciente.especie, "")) == especie.lower())
    return query.order_by(Paciente.id.desc()).first()


def _contar_referencias_paciente(db: Session, paciente_id: int) -> dict[str, int]:
    """Conta registros em qualquer tabela que tenha coluna paciente_id."""
    bind = db.get_bind()
    insp = inspect(bind)
    referencias: dict[str, int] = {}

    for tabela in insp.get_table_names():
        if tabela == Paciente.__tablename__:
            continue

        colunas = {col["name"] for col in insp.get_columns(tabela)}
        if "paciente_id" not in colunas:
            continue

        total = db.execute(
            text(f'SELECT COUNT(*) FROM "{tabela}" WHERE paciente_id = :paciente_id'),
            {"paciente_id": paciente_id},
        ).scalar()

        total_int = int(total or 0)
        if total_int > 0:
            referencias[tabela] = total_int

    return referencias


# Schemas
class PacienteCreate(BaseModel):
    nome: str
    tutor: Optional[str] = None
    especie: Optional[str] = "Canina"
    raca: Optional[str] = ""
    sexo: Optional[str] = "Macho"
    peso_kg: Optional[float] = None
    data_nascimento: Optional[str] = None
    microchip: Optional[str] = ""
    observacoes: Optional[str] = ""


class PacienteResponse(BaseModel):
    id: int
    nome: str
    tutor: str
    especie: Optional[str] = None
    raca: Optional[str] = None
    sexo: Optional[str] = None
    peso_kg: Optional[float] = None


@router.get("")
def listar_pacientes(
    skip: int = 0,
    limit: int = 100,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Lista pacientes ativos com nome do tutor."""
    query = (
        db.query(
            Paciente.id,
            Paciente.nome,
            Paciente.tutor_id,
            Tutor.nome.label("tutor_nome"),
        )
        .outerjoin(Tutor, Paciente.tutor_id == Tutor.id)
        .filter(_filtro_paciente_ativo())
    )

    if search:
        query = query.filter(Paciente.nome.ilike(f"%{search}%"))

    total = query.count()
    items = query.offset(skip).limit(limit).all()

    pacientes = [
        {
            "id": p.id,
            "nome": p.nome,
            "tutor_id": p.tutor_id,
            "tutor": p.tutor_nome or "",
        }
        for p in items
    ]

    return {"total": total, "items": pacientes}


@router.post("", response_model=PacienteResponse, status_code=status.HTTP_201_CREATED)
def criar_paciente(
    paciente: PacienteCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Cria um novo paciente ou reativa um paciente desativado equivalente."""
    nome = (paciente.nome or "").strip()
    if not nome:
        raise HTTPException(status_code=400, detail="Nome do paciente e obrigatorio")

    nome_key = _gerar_nome_key(nome)
    especie = (paciente.especie or "Canina").strip() or "Canina"

    try:
        tutor_id = _obter_ou_criar_tutor(db, paciente.tutor)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Erro ao resolver tutor: {str(e)}")

    paciente_existente = _buscar_paciente_por_chave(
        db,
        nome_key=nome_key,
        tutor_id=tutor_id,
        especie=especie,
    )
    if paciente_existente:
        if _is_ativo(paciente_existente.ativo):
            return {
                "id": paciente_existente.id,
                "nome": paciente_existente.nome,
                "tutor": paciente.tutor or "",
                "especie": paciente_existente.especie,
                "raca": paciente_existente.raca,
                "sexo": paciente_existente.sexo,
                "peso_kg": paciente_existente.peso_kg,
                "message": "Paciente ja existe",
            }

        paciente_existente.ativo = 1
        paciente_existente.nome = nome
        paciente_existente.nome_key = nome_key
        paciente_existente.tutor_id = tutor_id
        paciente_existente.especie = especie
        paciente_existente.raca = paciente.raca
        paciente_existente.sexo = paciente.sexo
        paciente_existente.peso_kg = paciente.peso_kg
        paciente_existente.nascimento = paciente.data_nascimento
        paciente_existente.microchip = paciente.microchip
        paciente_existente.observacoes = paciente.observacoes
        paciente_existente.updated_at = _legacy_now_str()

        db.commit()
        db.refresh(paciente_existente)

        return {
            "id": paciente_existente.id,
            "nome": paciente_existente.nome,
            "tutor": paciente.tutor or "",
            "especie": paciente_existente.especie,
            "raca": paciente_existente.raca,
            "sexo": paciente_existente.sexo,
            "peso_kg": paciente_existente.peso_kg,
            "message": "Paciente reativado com sucesso",
        }

    try:
        db_paciente = Paciente(
            nome=nome,
            nome_key=nome_key,
            tutor_id=tutor_id,
            especie=especie,
            raca=paciente.raca,
            sexo=paciente.sexo,
            peso_kg=paciente.peso_kg,
            nascimento=paciente.data_nascimento,
            microchip=paciente.microchip,
            observacoes=paciente.observacoes,
            ativo=1,
            created_at=_legacy_now_str(),
        )

        db.add(db_paciente)
        db.commit()
        db.refresh(db_paciente)

        return {
            "id": db_paciente.id,
            "nome": db_paciente.nome,
            "tutor": paciente.tutor or "",
            "especie": db_paciente.especie,
            "raca": db_paciente.raca,
            "sexo": db_paciente.sexo,
            "peso_kg": db_paciente.peso_kg,
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Erro ao criar paciente: {str(e)}")


@router.get("/{paciente_id}")
def obter_paciente(
    paciente_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Obtem detalhes de um paciente."""
    paciente = (
        db.query(Paciente, Tutor.nome.label("tutor_nome"))
        .outerjoin(Tutor, Paciente.tutor_id == Tutor.id)
        .filter(Paciente.id == paciente_id)
        .first()
    )

    if not paciente:
        raise HTTPException(status_code=404, detail="Paciente nao encontrado")

    p, tutor_nome = paciente

    return {
        "id": p.id,
        "nome": p.nome,
        "tutor": tutor_nome or "",
        "especie": p.especie,
        "raca": p.raca,
        "sexo": p.sexo,
        "peso_kg": p.peso_kg,
        "data_nascimento": p.nascimento,
        "microchip": p.microchip,
        "observacoes": p.observacoes,
    }


@router.put("/{paciente_id}")
def atualizar_paciente(
    paciente_id: int,
    paciente: PacienteCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Atualiza um paciente existente."""
    db_paciente = db.query(Paciente).filter(Paciente.id == paciente_id).first()

    if not db_paciente:
        raise HTTPException(status_code=404, detail="Paciente nao encontrado")

    if paciente.tutor:
        try:
            db_paciente.tutor_id = _obter_ou_criar_tutor(db, paciente.tutor)
        except Exception as e:
            db.rollback()
            raise HTTPException(status_code=500, detail=f"Erro ao resolver tutor: {str(e)}")

    db_paciente.nome = paciente.nome
    db_paciente.nome_key = _gerar_nome_key(paciente.nome)
    db_paciente.especie = paciente.especie
    db_paciente.raca = paciente.raca
    db_paciente.sexo = paciente.sexo
    db_paciente.peso_kg = paciente.peso_kg
    db_paciente.nascimento = paciente.data_nascimento
    db_paciente.microchip = paciente.microchip
    db_paciente.observacoes = paciente.observacoes
    db_paciente.updated_at = _legacy_now_str()

    db.commit()
    db.refresh(db_paciente)

    return {
        "id": db_paciente.id,
        "nome": db_paciente.nome,
        "message": "Paciente atualizado com sucesso",
    }


@router.get("/{paciente_id}/tutor")
def obter_tutor_paciente(
    paciente_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Obtem o tutor de um paciente."""
    paciente = db.query(Paciente).filter(Paciente.id == paciente_id).first()

    if not paciente:
        raise HTTPException(status_code=404, detail="Paciente nao encontrado")

    if not paciente.tutor_id:
        raise HTTPException(status_code=404, detail="Paciente nao tem tutor cadastrado")

    tutor = db.query(Tutor).filter(Tutor.id == paciente.tutor_id).first()

    if not tutor:
        raise HTTPException(status_code=404, detail="Tutor nao encontrado")

    return {
        "id": tutor.id,
        "nome": tutor.nome,
        "telefone": tutor.telefone,
        "whatsapp": tutor.whatsapp,
        "email": tutor.email,
    }


@router.delete("/{paciente_id}")
def deletar_paciente(
    paciente_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Remove paciente com protecao de integridade para historico."""
    db_paciente = db.query(Paciente).filter(Paciente.id == paciente_id).first()

    if not db_paciente:
        raise HTTPException(status_code=404, detail="Paciente nao encontrado")

    referencias = _contar_referencias_paciente(db, paciente_id)
    if referencias:
        db_paciente.ativo = 0
        db_paciente.updated_at = _legacy_now_str()
        db.commit()
        return {
            "message": "Paciente removido com sucesso (desativado por possuir historico vinculado)",
            "mode": "soft_delete",
            "references": referencias,
        }

    try:
        db.delete(db_paciente)
        db.commit()
        return {
            "message": "Paciente removido com sucesso",
            "mode": "hard_delete",
            "references": {},
        }
    except IntegrityError:
        db.rollback()
        db_paciente = db.query(Paciente).filter(Paciente.id == paciente_id).first()
        if not db_paciente:
            raise HTTPException(status_code=404, detail="Paciente nao encontrado")

        db_paciente.ativo = 0
        db_paciente.updated_at = _legacy_now_str()
        db.commit()
        return {
            "message": "Paciente removido com sucesso (desativado por integridade de dados)",
            "mode": "soft_delete",
            "references": _contar_referencias_paciente(db, paciente_id),
        }
