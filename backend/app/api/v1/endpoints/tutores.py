from datetime import datetime, timezone
import json
import math
import re
import unicodedata
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import String, cast, func, inspect, or_, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.security import get_current_user, require_papel
from app.db.database import get_db
from app.models.paciente import Paciente
from app.models.tutor import Tutor
from app.models.user import User
from app.models.tutor_mesclagem import TutorMesclagem
from app.services.tutor_identidade_service import exigir_tutor_utilizavel
from app.services.tutor_mesclagem_service import obter_previa, mesclar
from app.services.geocoding_service import GeocodingError, geocodificar_endereco_google, montar_endereco_completo
from app.core.config import settings

router = APIRouter()


def _filtro_tutor_ativo():
    """Compatibilidade com registros legados onde `ativo` ficou NULL/texto."""
    return (func.lower(func.coalesce(cast(Tutor.ativo, String), "1")).in_(["1", "true", "t"]) & Tutor.mesclado_em_id.is_(None))


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


def _variantes_busca_nome(termo_key: str) -> set[str]:
    """Aceita pequenas variacoes comuns, como Jeferson/Jefferson."""
    termo = str(termo_key or "").strip()
    if not termo:
        return set()

    variantes = {termo, re.sub(r"(.)\1+", r"\1", termo)}
    for indice, caractere in enumerate(termo):
        if caractere.isalnum():
            variantes.add(f"{termo[:indice]}{caractere}{termo[indice:]}")
    return {item for item in variantes if item}


def _legacy_now_dt() -> datetime:
    return datetime.utcnow()


def _ensure_tutores_georef_columns(db: Session) -> None:
    # A autenticacao ja pode ocupar uma conexao; reutilize-a na introspeccao.
    insp = inspect(db.connection())
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
        "identificacao_pendente": tutor.identificacao_pendente,
        "origem_cadastro": tutor.origem_cadastro,
        "identificacao_observacoes": tutor.identificacao_observacoes,
        "mesclado_em_id": tutor.mesclado_em_id,
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
        "identificacao_pendente": tutor.identificacao_pendente,
        "origem_cadastro": tutor.origem_cadastro,
        "identificacao_observacoes": tutor.identificacao_observacoes,
        "mesclado_em_id": tutor.mesclado_em_id,
        "telefone": tutor.telefone,
        "whatsapp": tutor.whatsapp,
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
    nome: str = Field(min_length=1)
    identificacao_pendente: bool = True
    origem_cadastro: Optional[str] = None
    identificacao_observacoes: Optional[str] = None
    confirmar_reativacao: bool = False
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
    identificacao_pendente: Optional[bool] = None
    origem_cadastro: Optional[str] = None
    identificacao_observacoes: Optional[str] = None
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
        termo = busca.strip()
        if termo:
            termo_escapado = (
                termo.replace("\\", "\\\\")
                .replace("%", "\\%")
                .replace("_", "\\_")
            )
            termo_key = _gerar_nome_key(termo)
            filtros = [
                Tutor.nome.ilike(f"%{termo_escapado}%", escape="\\"),
                Tutor.telefone.ilike(f"%{termo_escapado}%", escape="\\"),
                Tutor.whatsapp.ilike(f"%{termo_escapado}%", escape="\\"),
                Tutor.origem_cadastro.ilike(f"%{termo_escapado}%", escape="\\"),
                Tutor.email.ilike(f"%{termo_escapado}%", escape="\\"),
                Tutor.cidade.ilike(f"%{termo_escapado}%", escape="\\"),
            ]
            variantes_nome = _variantes_busca_nome(termo_key)
            for variante in variantes_nome:
                variante_escapada = (
                    variante.replace("\\", "\\\\")
                    .replace("%", "\\%")
                    .replace("_", "\\_")
                )
                filtros.append(
                    Tutor.nome_key.ilike(f"%{variante_escapada}%", escape="\\")
                )
            filtros_pet = [
                Paciente.nome.ilike(f"%{termo_escapado}%", escape="\\")
            ]
            for variante in variantes_nome:
                variante_escapada = (
                    variante.replace("\\", "\\\\")
                    .replace("%", "\\%")
                    .replace("_", "\\_")
                )
                filtros_pet.append(
                    Paciente.nome_key.ilike(f"%{variante_escapada}%", escape="\\")
                )
            tutores_por_pet = (
                db.query(Paciente.tutor_id)
                .filter(Paciente.tutor_id.isnot(None), or_(*filtros_pet))
            )
            filtros.append(Tutor.id.in_(tutores_por_pet))
            query = query.filter(or_(*filtros))

    total = query.count()
    items = (
        query.order_by(Tutor.nome.asc(), Tutor.id.asc())
        .offset(skip)
        .limit(limit)
        .all()
    )

    items_serializados = [_serialize_tutor_lista_item(tutor) for tutor in items]
    if items_serializados:
        tutor_ids = [item["id"] for item in items_serializados]
        pets_por_tutor: dict[int, list[dict[str, object]]] = {
            tutor_id: [] for tutor_id in tutor_ids
        }
        pets = (
            db.query(Paciente.id, Paciente.nome, Paciente.tutor_id)
            .filter(Paciente.tutor_id.in_(tutor_ids))
            .order_by(Paciente.nome.asc(), Paciente.id.asc())
            .all()
        )
        for pet_id, pet_nome, tutor_id in pets:
            pets_por_tutor.setdefault(int(tutor_id), []).append(
                {"id": int(pet_id), "nome": str(pet_nome or "")}
            )
        for item in items_serializados:
            item["pets"] = pets_por_tutor.get(item["id"], [])
            item["total_pets"] = len(item["pets"])

    return {
        "total": total,
        "items": items_serializados,
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

    if not nome:
        raise HTTPException(422, "Informe o nome do tutor.")
    if tutor.confirmar_reativacao:
        raise HTTPException(422, "Reative explicitamente pelo ID; o nome nao identifica uma pessoa.")

    novo_tutor = Tutor(
        nome=nome,
        nome_key=nome_key,
        identificacao_pendente=tutor.identificacao_pendente,
        origem_cadastro=tutor.origem_cadastro,
        identificacao_observacoes=tutor.identificacao_observacoes,
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
        raise HTTPException(409, "Nao foi possivel criar um cadastro separado. Verifique se a migracao de homonimos foi aplicada.")

    return {
        **_serialize_tutor(novo_tutor),
        "message": "Tutor criado com sucesso"
    }


class MesclagemPreviaPayload(BaseModel):
    principal_id: int = Field(gt=0)
    secundario_id: int = Field(gt=0)


class MesclagemPayload(MesclagemPreviaPayload):
    token_previa: str = Field(min_length=64, max_length=64)
    escolhas: dict[str, str] = Field(default_factory=dict)
    motivo: str = Field(min_length=5, max_length=2000)
    confirmar: bool = False


@router.post("/mesclagens/previa")
def previa_mesclagem(payload: MesclagemPreviaPayload, db: Session = Depends(get_db),
                    current_user: User = Depends(require_papel("admin"))):
    return obter_previa(db, payload.principal_id, payload.secundario_id)


@router.post("/mesclagens")
def confirmar_mesclagem(payload: MesclagemPayload, db: Session = Depends(get_db),
                       current_user: User = Depends(require_papel("admin"))):
    return mesclar(db, payload, current_user)


@router.get("/{tutor_id}/mesclagens")
def historico_mesclagens(tutor_id: int, db: Session = Depends(get_db),
                        current_user: User = Depends(require_papel("admin"))):
    # A -> B -> C deve manter visivel tambem a mesclagem original de A.
    ids = {tutor_id}
    while True:
        rows = db.query(TutorMesclagem).filter(or_(TutorMesclagem.principal_id.in_(ids),
                                                 TutorMesclagem.secundario_id.in_(ids))).order_by(TutorMesclagem.id.desc()).all()
        relacionados = ids | {r.principal_id for r in rows} | {r.secundario_id for r in rows}
        if relacionados == ids:
            break
        ids = relacionados
    return {"items": [{"id": r.id, "principal_id": r.principal_id, "secundario_id": r.secundario_id,
                       "usuario_id": r.usuario_id, "usuario_nome": r.usuario_nome, "motivo": r.motivo,
                       "created_at": r.created_at.replace(tzinfo=r.created_at.tzinfo or timezone.utc).isoformat(),
                       "detalhes": json.loads(r.detalhes_json)} for r in rows]}


class ReativacaoPayload(BaseModel):
    confirmar: bool = False


@router.post("/{tutor_id}/reativar")
def reativar_tutor(tutor_id: int, payload: ReativacaoPayload, db: Session = Depends(get_db),
                   current_user: User = Depends(get_current_user)):
    tutor = db.query(Tutor).filter(Tutor.id == tutor_id).populate_existing().with_for_update().first()
    if not tutor:
        raise HTTPException(404, "Tutor nao encontrado.")
    if tutor.mesclado_em_id:
        raise HTTPException(409, "Cadastro mesclado nao pode ser reativado.")
    if not payload.confirmar:
        raise HTTPException(422, "Confirme a reativacao deste ID.")
    tutor.ativo = 1
    db.commit()
    return {**_serialize_tutor(tutor), "message": "Tutor reativado com sucesso"}


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
    db_tutor = exigir_tutor_utilizavel(db, tutor_id)
    for campo in ("identificacao_pendente", "origem_cadastro", "identificacao_observacoes"):
        if getattr(tutor, campo) is not None:
            setattr(db_tutor, campo, getattr(tutor, campo))
    if tutor.nome is not None and not tutor.nome.strip():
        raise HTTPException(422, "Informe o nome do tutor.")

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
