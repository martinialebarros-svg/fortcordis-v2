from datetime import datetime
import math
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
from app.services.geocoding_service import GeocodingError, geocodificar_endereco_google, montar_endereco_completo
from app.core.config import settings

router = APIRouter()


def _filtro_tutor_ativo():
    """Compatibilidade com registros legados onde `ativo` ficou NULL/texto."""
    return func.lower(func.coalesce(cast(Tutor.ativo, String), "1")).in_(["1", "true", "t"])


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


def _ensure_tutores_georef_columns(db: Session) -> None:
    bind = db.get_bind()
    insp = inspect(bind)
    if "tutores" not in insp.get_table_names():
        return

    colunas = {col["name"] for col in insp.get_columns("tutores")}
    alteracoes: dict[str, str] = {
        "latitude": 'ALTER TABLE "tutores" ADD COLUMN latitude FLOAT',
        "longitude": 'ALTER TABLE "tutores" ADD COLUMN longitude FLOAT',
        "place_id": 'ALTER TABLE "tutores" ADD COLUMN place_id TEXT',
        "endereco_normalizado": 'ALTER TABLE "tutores" ADD COLUMN endereco_normalizado TEXT',
    }

    faltantes = [sql for coluna, sql in alteracoes.items() if coluna not in colunas]
    if not faltantes:
        return

    for sql in faltantes:
        db.execute(text(sql))
    db.commit()


def _tutor_tem_endereco_preenchido(tutor: Optional[Tutor]) -> bool:
    if not tutor:
        return False
    return all(
        str(valor or "").strip()
        for valor in [tutor.endereco, tutor.numero, tutor.cidade, tutor.estado]
    )


def _coordenadas_tutor_confiaveis(tutor: Optional[Tutor]) -> tuple[Optional[float], Optional[float]]:
    if not tutor or not _tutor_tem_endereco_preenchido(tutor):
        return None, None
    if tutor.latitude is None or tutor.longitude is None:
        return None, None
    try:
        lat = float(tutor.latitude)
        lng = float(tutor.longitude)
    except (TypeError, ValueError):
        return None, None
    if not math.isfinite(lat) or not math.isfinite(lng):
        return None, None
    if lat < -90.0 or lat > 90.0 or lng < -180.0 or lng > 180.0:
        return None, None
    if abs(lat) < 0.000001 and abs(lng) < 0.000001:
        return None, None
    return lat, lng


def _serialize_tutor(tutor: Tutor) -> dict:
    latitude, longitude = _coordenadas_tutor_confiaveis(tutor)
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
        "latitude": latitude,
        "longitude": longitude,
        "place_id": tutor.place_id,
        "endereco_normalizado": tutor.endereco_normalizado,
        "georreferenciado": latitude is not None and longitude is not None,
    }


def _serialize_tutor_lista_item(tutor: Tutor) -> dict:
    latitude, longitude = _coordenadas_tutor_confiaveis(tutor)
    return {
        "id": tutor.id,
        "nome": tutor.nome,
        "telefone": tutor.telefone,
        "email": tutor.email,
        "endereco": tutor.endereco,
        "numero": tutor.numero,
        "bairro": tutor.bairro,
        "cidade": tutor.cidade,
        "estado": tutor.estado,
        "cep": tutor.cep,
        "endereco_normalizado": tutor.endereco_normalizado,
        "endereco_resumo": ", ".join(
            [item for item in [tutor.endereco, tutor.numero, tutor.bairro, tutor.cidade] if str(item or "").strip()]
        ),
        "latitude": latitude,
        "longitude": longitude,
        "georreferenciado": latitude is not None and longitude is not None,
    }


class TutorCreate(BaseModel):
    nome: str
    telefone: Optional[str] = None
    whatsapp: Optional[str] = None
    email: Optional[str] = None
    cpf: Optional[str] = None
    cep: Optional[str] = None
    endereco: Optional[str] = None
    numero: Optional[str] = None
    complemento: Optional[str] = None
    bairro: Optional[str] = None
    cidade: Optional[str] = None
    estado: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    place_id: Optional[str] = None
    endereco_normalizado: Optional[str] = None


class TutorUpdate(BaseModel):
    nome: Optional[str] = None
    telefone: Optional[str] = None
    whatsapp: Optional[str] = None
    email: Optional[str] = None
    cpf: Optional[str] = None
    cep: Optional[str] = None
    endereco: Optional[str] = None
    numero: Optional[str] = None
    complemento: Optional[str] = None
    bairro: Optional[str] = None
    cidade: Optional[str] = None
    estado: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    place_id: Optional[str] = None
    endereco_normalizado: Optional[str] = None


class GeocodeEnderecoPayload(BaseModel):
    endereco: Optional[str] = ""
    numero: Optional[str] = ""
    complemento: Optional[str] = ""
    bairro: Optional[str] = ""
    cidade: Optional[str] = ""
    estado: Optional[str] = ""
    cep: Optional[str] = ""


@router.get("")
@router.get("/")
def listar_tutores(
    skip: int = 0,
    limit: int = 100,
    busca: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Lista todos os tutores."""
    _ensure_tutores_georef_columns(db)
    query = db.query(Tutor).filter(_filtro_tutor_ativo())

    if busca:
        query = query.filter(Tutor.nome.ilike(f"%{busca}%"))

    total = query.count()
    items = query.offset(skip).limit(limit).all()

    return {
        "total": total,
        "items": [_serialize_tutor_lista_item(t) for t in items]
    }


@router.post("", status_code=status.HTTP_201_CREATED)
@router.post("/", status_code=status.HTTP_201_CREATED)
def criar_tutor(
    tutor: TutorCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Cria um novo tutor."""
    _ensure_tutores_georef_columns(db)
    nome = tutor.nome.strip()
    nome_key = _gerar_nome_key(nome)

    # Evita colisão no índice único de nome_key.
    existente = db.query(Tutor).filter(Tutor.nome_key == nome_key).first()
    if not existente:
        existente = db.query(Tutor).filter(Tutor.nome.ilike(nome)).first()

    if existente:
        return {
            "id": existente.id,
            "nome": existente.nome,
            "message": "Tutor já existe"
        }

    novo_tutor = Tutor(
        nome=nome,
        nome_key=nome_key,
        telefone=tutor.telefone,
        whatsapp=tutor.whatsapp or tutor.telefone,
        email=tutor.email,
        cpf=tutor.cpf,
        cep=tutor.cep,
        endereco=tutor.endereco,
        numero=tutor.numero,
        complemento=tutor.complemento,
        bairro=tutor.bairro,
        cidade=tutor.cidade,
        estado=tutor.estado,
        latitude=tutor.latitude,
        longitude=tutor.longitude,
        place_id=tutor.place_id,
        endereco_normalizado=tutor.endereco_normalizado,
        ativo=1,
        created_at=_legacy_now_dt(),
    )

    db.add(novo_tutor)
    try:
        db.commit()
        db.refresh(novo_tutor)
    except IntegrityError:
        db.rollback()
        existente = db.query(Tutor).filter(Tutor.nome_key == nome_key).first()
        if not existente:
            existente = db.query(Tutor).filter(Tutor.nome.ilike(nome)).first()
        if existente:
            return {
                "id": existente.id,
                "nome": existente.nome,
                "message": "Tutor já existe"
            }
        raise HTTPException(status_code=500, detail="Erro ao criar tutor")

    return {
        **_serialize_tutor(novo_tutor),
        "message": "Tutor criado com sucesso"
    }


@router.get("/{tutor_id}")
def obter_tutor(
    tutor_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Obtém detalhes de um tutor."""
    _ensure_tutores_georef_columns(db)
    tutor = db.query(Tutor).filter(Tutor.id == tutor_id).first()

    if not tutor:
        raise HTTPException(status_code=404, detail="Tutor não encontrado")

    return _serialize_tutor(tutor)


@router.get("/{tutor_id}/panorama")
def obter_panorama_tutor(
    tutor_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Retorna tutor com a lista panoramica de pets vinculados."""
    _ensure_tutores_georef_columns(db)
    tutor = db.query(Tutor).filter(Tutor.id == tutor_id).filter(_filtro_tutor_ativo()).first()
    if not tutor:
        raise HTTPException(status_code=404, detail="Tutor nao encontrado")

    pets = (
        db.query(Paciente)
        .filter(Paciente.tutor_id == tutor_id)
        .order_by(Paciente.nome.asc(), Paciente.id.asc())
        .all()
    )
    pets_items = [
        {
            "id": pet.id,
            "nome": pet.nome,
            "especie": pet.especie,
            "raca": pet.raca,
            "sexo": pet.sexo,
            "ativo": pet.ativo,
        }
        for pet in pets
    ]

    endereco_preenchido = _tutor_tem_endereco_preenchido(tutor)
    latitude, longitude = _coordenadas_tutor_confiaveis(tutor)
    georreferenciado = latitude is not None and longitude is not None

    return {
        "tutor": _serialize_tutor(tutor),
        "pets": pets_items,
        "resumo": {
            "total_pets": len(pets_items),
            "pets_ativos": sum(1 for pet in pets_items if str(pet.get("ativo") or "").strip() not in {"0", "false", "False"}),
            "endereco_preenchido": endereco_preenchido,
            "georreferenciado": georreferenciado,
        },
    }


@router.post("/geocode-endereco")
def geocode_endereco_tutor(
    payload: GeocodeEnderecoPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Geocodifica o endereco do tutor usando Google Geocoding."""
    _ensure_tutores_georef_columns(db)
    endereco_completo = montar_endereco_completo(
        endereco=payload.endereco,
        numero=payload.numero,
        complemento=payload.complemento,
        bairro=payload.bairro,
        cidade=payload.cidade,
        estado=payload.estado,
        cep=payload.cep,
    )
    if not str(endereco_completo or "").strip():
        raise HTTPException(status_code=422, detail="Endereco incompleto para geocoding.")

    try:
        geo = geocodificar_endereco_google(endereco_completo, settings.GOOGLE_MAPS_API_KEY)
    except GeocodingError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    return {
        "ok": True,
        "item": {
            "latitude": geo.latitude,
            "longitude": geo.longitude,
            "place_id": geo.place_id,
            "endereco_normalizado": geo.endereco_normalizado,
            "bairro": geo.bairro,
            "cidade": geo.cidade,
            "estado": geo.estado,
            "cep": geo.cep,
        },
    }


@router.put("/{tutor_id}")
def atualizar_tutor(
    tutor_id: int,
    tutor: TutorUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Atualiza um tutor existente."""
    _ensure_tutores_georef_columns(db)
    db_tutor = db.query(Tutor).filter(Tutor.id == tutor_id).first()

    if not db_tutor:
        raise HTTPException(status_code=404, detail="Tutor não encontrado")

    if tutor.nome is not None:
        db_tutor.nome = tutor.nome
        db_tutor.nome_key = _gerar_nome_key(tutor.nome)
    if tutor.telefone is not None:
        db_tutor.telefone = tutor.telefone
    if tutor.whatsapp is not None:
        db_tutor.whatsapp = tutor.whatsapp
    if tutor.email is not None:
        db_tutor.email = tutor.email
    if tutor.cpf is not None:
        db_tutor.cpf = tutor.cpf
    if tutor.cep is not None:
        db_tutor.cep = tutor.cep
    if tutor.endereco is not None:
        db_tutor.endereco = tutor.endereco
    if tutor.numero is not None:
        db_tutor.numero = tutor.numero
    if tutor.complemento is not None:
        db_tutor.complemento = tutor.complemento
    if tutor.bairro is not None:
        db_tutor.bairro = tutor.bairro
    if tutor.cidade is not None:
        db_tutor.cidade = tutor.cidade
    if tutor.estado is not None:
        db_tutor.estado = tutor.estado
    if tutor.latitude is not None:
        db_tutor.latitude = tutor.latitude
    if tutor.longitude is not None:
        db_tutor.longitude = tutor.longitude
    if tutor.place_id is not None:
        db_tutor.place_id = tutor.place_id
    if tutor.endereco_normalizado is not None:
        db_tutor.endereco_normalizado = tutor.endereco_normalizado

    db.commit()
    db.refresh(db_tutor)

    return {
        **_serialize_tutor(db_tutor),
        "message": "Tutor atualizado com sucesso"
    }


@router.delete("/{tutor_id}")
def deletar_tutor(
    tutor_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Remove um tutor (desativa)."""
    _ensure_tutores_georef_columns(db)
    db_tutor = db.query(Tutor).filter(Tutor.id == tutor_id).first()

    if not db_tutor:
        raise HTTPException(status_code=404, detail="Tutor não encontrado")

    db_tutor.ativo = 0
    db.commit()

    return {"message": "Tutor removido com sucesso"}
