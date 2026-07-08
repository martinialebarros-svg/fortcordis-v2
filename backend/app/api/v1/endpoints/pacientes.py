from datetime import datetime
import re
import unicodedata
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import String, cast, func, inspect, or_, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.security import get_current_user
from app.db.database import get_db
from app.models.paciente import Paciente
from app.models.tutor import Tutor
from app.models.user import User
from app.utils.paciente_helpers import extrair_idade_paciente, normalizar_sexo_paciente

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


def _legacy_now_dt() -> datetime:
    return datetime.utcnow()


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

    colunas_texto = {
        "created_at": 'ALTER TABLE "tutores" ADD COLUMN created_at DATETIME',
        "updated_at": 'ALTER TABLE "tutores" ADD COLUMN updated_at DATETIME',
        "place_id": 'ALTER TABLE "tutores" ADD COLUMN place_id TEXT',
        "endereco_normalizado": 'ALTER TABLE "tutores" ADD COLUMN endereco_normalizado TEXT',
    }
    colunas_float = {
        "latitude": 'ALTER TABLE "tutores" ADD COLUMN latitude FLOAT',
        "longitude": 'ALTER TABLE "tutores" ADD COLUMN longitude FLOAT',
    }

    for nome_coluna, sql in colunas_texto.items():
        if nome_coluna not in colunas:
            alteracoes.append(sql)
    for nome_coluna, sql in colunas_float.items():
        if nome_coluna not in colunas:
            alteracoes.append(sql)

    if not alteracoes:
        return

    for sql in alteracoes:
        db.execute(text(sql))
    db.commit()


def _clean_optional_text(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    return str(value).strip()


def _paciente_tem_payload_tutor(paciente: "PacienteCreate") -> bool:
    campos = (
        "tutor_id",
        "tutor",
        "tutor_email",
        "tutor_telefone",
        "tutor_whatsapp",
        "tutor_cpf",
        "tutor_cep",
        "tutor_endereco",
        "tutor_numero",
        "tutor_complemento",
        "tutor_bairro",
        "tutor_cidade",
        "tutor_estado",
    )
    return any(getattr(paciente, campo, None) not in (None, "") for campo in campos)


def _aplicar_dados_tutor(tutor: Tutor, paciente: "PacienteCreate") -> None:
    nome = _clean_optional_text(paciente.tutor)
    if nome:
        tutor.nome = nome
        tutor.nome_key = _gerar_nome_key(nome)

    mapping = {
        "telefone": "tutor_telefone",
        "whatsapp": "tutor_whatsapp",
        "email": "tutor_email",
        "cpf": "tutor_cpf",
        "cep": "tutor_cep",
        "endereco": "tutor_endereco",
        "numero": "tutor_numero",
        "complemento": "tutor_complemento",
        "bairro": "tutor_bairro",
        "cidade": "tutor_cidade",
        "estado": "tutor_estado",
    }
    for attr, payload_attr in mapping.items():
        value = _clean_optional_text(getattr(paciente, payload_attr, None))
        if value:
            setattr(tutor, attr, value)

    if not _clean_optional_text(tutor.whatsapp) and _clean_optional_text(tutor.telefone):
        tutor.whatsapp = _clean_optional_text(tutor.telefone)

    tutor.ativo = 1
    tutor.updated_at = _legacy_now_dt()


def _serialize_tutor_fields(tutor: Tutor | None) -> dict[str, Optional[str] | Optional[int]]:
    return {
        "tutor_id": tutor.id if tutor else None,
        "tutor": tutor.nome if tutor and tutor.nome else "",
        "tutor_email": tutor.email if tutor else None,
        "tutor_telefone": tutor.telefone if tutor else None,
        "tutor_whatsapp": tutor.whatsapp if tutor else None,
        "tutor_cpf": tutor.cpf if tutor else None,
        "tutor_cep": tutor.cep if tutor else None,
        "tutor_endereco": tutor.endereco if tutor else None,
        "tutor_numero": tutor.numero if tutor else None,
        "tutor_complemento": tutor.complemento if tutor else None,
        "tutor_bairro": tutor.bairro if tutor else None,
        "tutor_cidade": tutor.cidade if tutor else None,
        "tutor_estado": tutor.estado if tutor else None,
        "tutor_latitude": float(tutor.latitude) if tutor and tutor.latitude is not None else None,
        "tutor_longitude": float(tutor.longitude) if tutor and tutor.longitude is not None else None,
        "tutor_place_id": tutor.place_id if tutor else None,
        "tutor_endereco_normalizado": tutor.endereco_normalizado if tutor else None,
    }


def _obter_ou_criar_tutor(db: Session, paciente: "PacienteCreate") -> Optional[int]:
    _ensure_tutores_timestamp_columns(db)

    tutor_id = int(paciente.tutor_id or 0)
    if tutor_id > 0:
        tutor = db.query(Tutor).filter(Tutor.id == tutor_id).first()
        if tutor:
            _aplicar_dados_tutor(tutor, paciente)
            db.commit()
            return tutor.id

    tutor_nome_raw = paciente.tutor
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
        _aplicar_dados_tutor(tutor, paciente)
        db.commit()
        return tutor.id

    tutor = Tutor(
        nome=tutor_nome,
        nome_key=tutor_nome_key,
        email=_clean_optional_text(paciente.tutor_email) or "",
        telefone=_clean_optional_text(paciente.tutor_telefone) or "",
        whatsapp=(
            _clean_optional_text(paciente.tutor_whatsapp)
            or _clean_optional_text(paciente.tutor_telefone)
            or ""
        ),
        cpf=_clean_optional_text(paciente.tutor_cpf) or "",
        cep=_clean_optional_text(paciente.tutor_cep) or "",
        endereco=_clean_optional_text(paciente.tutor_endereco) or "",
        numero=_clean_optional_text(paciente.tutor_numero) or "",
        complemento=_clean_optional_text(paciente.tutor_complemento) or "",
        bairro=_clean_optional_text(paciente.tutor_bairro) or "",
        cidade=_clean_optional_text(paciente.tutor_cidade) or "",
        estado=_clean_optional_text(paciente.tutor_estado) or "",
        ativo=1,
        created_at=_legacy_now_dt(),
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
        _aplicar_dados_tutor(tutor, paciente)
        db.commit()
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
    tutor_id: Optional[int] = None
    tutor: Optional[str] = None
    tutor_email: Optional[str] = None
    tutor_telefone: Optional[str] = None
    tutor_whatsapp: Optional[str] = None
    tutor_cpf: Optional[str] = None
    tutor_cep: Optional[str] = None
    tutor_endereco: Optional[str] = None
    tutor_numero: Optional[str] = None
    tutor_complemento: Optional[str] = None
    tutor_bairro: Optional[str] = None
    tutor_cidade: Optional[str] = None
    tutor_estado: Optional[str] = None
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
    tutor_id: Optional[int] = None
    tutor: str
    tutor_email: Optional[str] = None
    tutor_telefone: Optional[str] = None
    tutor_whatsapp: Optional[str] = None
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
            Paciente.especie,
            Paciente.raca,
            Tutor.nome.label("tutor_nome"),
            Tutor.email.label("tutor_email"),
            Tutor.telefone.label("tutor_telefone"),
            Tutor.whatsapp.label("tutor_whatsapp"),
        )
        .outerjoin(Tutor, Paciente.tutor_id == Tutor.id)
        .filter(_filtro_paciente_ativo())
    )

    if search:
        termo = search.strip()
        termo_key = _gerar_nome_key(termo)
        filtros = [
            Paciente.nome.ilike(f"%{termo}%"),
            Tutor.nome.ilike(f"%{termo}%"),
        ]
        if termo_key:
            filtros.extend(
                [
                    func.coalesce(Paciente.nome_key, "").ilike(f"%{termo_key}%"),
                    func.coalesce(Tutor.nome_key, "").ilike(f"%{termo_key}%"),
                ]
            )
        query = query.filter(or_(*filtros))

    total = query.count()
    items = query.order_by(Paciente.nome.asc()).offset(skip).limit(limit).all()

    pacientes = [
        {
            "id": p.id,
            "nome": p.nome,
            "tutor_id": p.tutor_id,
            "tutor": p.tutor_nome or "",
            "tutor_email": p.tutor_email or "",
            "tutor_telefone": p.tutor_telefone or "",
            "tutor_whatsapp": p.tutor_whatsapp or "",
            "especie": (p.especie or "").strip() or "",
            "raca": (p.raca or "").strip() or "",
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
        tutor_id = _obter_ou_criar_tutor(db, paciente)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Erro ao resolver tutor: {str(e)}")
    tutor = db.query(Tutor).filter(Tutor.id == tutor_id).first() if tutor_id else None

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
                **_serialize_tutor_fields(tutor),
                "especie": paciente_existente.especie,
                "raca": paciente_existente.raca,
                "sexo": normalizar_sexo_paciente(paciente_existente.sexo),
                "peso_kg": paciente_existente.peso_kg,
                "message": "Paciente ja existe",
            }

        paciente_existente.ativo = 1
        paciente_existente.nome = nome
        paciente_existente.nome_key = nome_key
        paciente_existente.tutor_id = tutor_id
        paciente_existente.especie = especie
        paciente_existente.raca = paciente.raca
        paciente_existente.sexo = normalizar_sexo_paciente(paciente.sexo)
        paciente_existente.peso_kg = paciente.peso_kg
        paciente_existente.nascimento = paciente.data_nascimento
        paciente_existente.microchip = paciente.microchip
        paciente_existente.observacoes = paciente.observacoes
        paciente_existente.updated_at = _legacy_now_dt()

        db.commit()
        db.refresh(paciente_existente)

        return {
            "id": paciente_existente.id,
            "nome": paciente_existente.nome,
            **_serialize_tutor_fields(tutor),
            "especie": paciente_existente.especie,
            "raca": paciente_existente.raca,
            "sexo": normalizar_sexo_paciente(paciente_existente.sexo),
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
            sexo=normalizar_sexo_paciente(paciente.sexo),
            peso_kg=paciente.peso_kg,
            nascimento=paciente.data_nascimento,
            microchip=paciente.microchip,
            observacoes=paciente.observacoes,
            ativo=1,
            created_at=_legacy_now_dt(),
        )

        db.add(db_paciente)
        db.commit()
        db.refresh(db_paciente)

        return {
            "id": db_paciente.id,
            "nome": db_paciente.nome,
            **_serialize_tutor_fields(tutor),
            "especie": db_paciente.especie,
            "raca": db_paciente.raca,
            "sexo": normalizar_sexo_paciente(db_paciente.sexo),
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
        db.query(Paciente, Tutor)
        .outerjoin(Tutor, Paciente.tutor_id == Tutor.id)
        .filter(Paciente.id == paciente_id)
        .first()
    )

    if not paciente:
        raise HTTPException(status_code=404, detail="Paciente nao encontrado")

    p, tutor = paciente

    return {
        "id": p.id,
        "nome": p.nome,
        **_serialize_tutor_fields(tutor),
        "especie": p.especie,
        "raca": p.raca,
        "sexo": normalizar_sexo_paciente(p.sexo),
        "peso_kg": p.peso_kg,
        "idade": extrair_idade_paciente(p.nascimento, p.observacoes),
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

    if _paciente_tem_payload_tutor(paciente):
        try:
            db_paciente.tutor_id = _obter_ou_criar_tutor(db, paciente)
        except Exception as e:
            db.rollback()
            raise HTTPException(status_code=500, detail=f"Erro ao resolver tutor: {str(e)}")

    db_paciente.nome = paciente.nome
    db_paciente.nome_key = _gerar_nome_key(paciente.nome)
    db_paciente.especie = paciente.especie
    db_paciente.raca = paciente.raca
    db_paciente.sexo = normalizar_sexo_paciente(paciente.sexo)
    db_paciente.peso_kg = paciente.peso_kg
    db_paciente.nascimento = paciente.data_nascimento
    db_paciente.microchip = paciente.microchip
    db_paciente.observacoes = paciente.observacoes
    db_paciente.updated_at = _legacy_now_dt()

    db.commit()
    db.refresh(db_paciente)
    tutor = db.query(Tutor).filter(Tutor.id == db_paciente.tutor_id).first() if db_paciente.tutor_id else None

    return {
        "id": db_paciente.id,
        "nome": db_paciente.nome,
        **_serialize_tutor_fields(tutor),
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
        "cpf": tutor.cpf,
        "cep": tutor.cep,
        "endereco": tutor.endereco,
        "numero": tutor.numero,
        "complemento": tutor.complemento,
        "bairro": tutor.bairro,
        "cidade": tutor.cidade,
        "estado": tutor.estado,
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
        db_paciente.updated_at = _legacy_now_dt()
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
        db_paciente.updated_at = _legacy_now_dt()
        db.commit()
        return {
            "message": "Paciente removido com sucesso (desativado por integridade de dados)",
            "mode": "soft_delete",
            "references": _contar_referencias_paciente(db, paciente_id),
        }
