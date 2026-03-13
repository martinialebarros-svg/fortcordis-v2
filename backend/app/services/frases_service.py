"""
Service para gerenciamento de frases qualitativas.

O banco e a fonte primaria quando as tabelas de frases existem.
frases.json e mantido como espelho temporario de compatibilidade e fallback.
"""
from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Set

from sqlalchemy import func, inspect, or_
from sqlalchemy.exc import IntegrityError, OperationalError, ProgrammingError
from sqlalchemy.orm import Session

from app.db.database import SessionLocal
from app.models.frase import FraseQualitativa, FraseQualitativaHistorico

DATA_DIR = Path(__file__).parent.parent.parent / "data"
FRASES_FILE = DATA_DIR / "frases.json"
PATOLOGIAS_FILE = DATA_DIR / "patologias.json"

GRAUS_SIDEBAR_ORDEM = ["Leve", "Moderada", "Importante"]
_GRAUS_CANONICOS = {
    "leve": "Leve",
    "moderada": "Moderada",
    "moderado": "Moderada",
    "importante": "Importante",
}


def _ensure_data_dir() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)


def _load_json(filepath: Path, default: Any = None) -> Any:
    if not filepath.exists():
        return default
    try:
        return json.loads(filepath.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return default


def _save_json(filepath: Path, data: Any) -> None:
    _ensure_data_dir()
    filepath.write_text(
        json.dumps(data, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )


def _to_int(value: Any) -> Optional[int]:
    if isinstance(value, bool):
        return None
    if isinstance(value, int):
        return value
    if isinstance(value, float):
        return int(value)
    if isinstance(value, str):
        raw = value.strip()
        if raw.isdigit():
            return int(raw)
    return None


def _serialize_datetime(value: Any) -> Any:
    if hasattr(value, "isoformat"):
        return value.isoformat()
    return value


def _parse_datetime_value(value: Any) -> Any:
    if not value or not isinstance(value, str):
        return None
    raw = value.strip().replace("Z", "+00:00")
    try:
        return datetime.fromisoformat(raw)
    except ValueError:
        return None


def _normalize_detalhado(value: Any) -> Dict[str, Any]:
    return value if isinstance(value, dict) else {}


def _normalize_frases_ids(frases: List[Dict[str, Any]]) -> bool:
    changed = False
    used_ids: set[int] = set()

    valid_ids = []
    for frase in frases:
        frase_id = _to_int(frase.get("id"))
        if frase_id is not None:
            valid_ids.append(frase_id)
    next_id = (max(valid_ids) + 1) if valid_ids else 1

    for frase in frases:
        original_id = frase.get("id")
        frase_id = _to_int(original_id)

        if frase_id is None or frase_id in used_ids:
            while next_id in used_ids:
                next_id += 1
            frase_id = next_id
            next_id += 1
            changed = True

        if original_id != frase_id:
            changed = True

        frase["id"] = frase_id
        used_ids.add(frase_id)

    return changed


def _load_frases_data() -> Dict[str, Any]:
    data = _load_json(FRASES_FILE, {"frases": [], "version": "1.0"})
    if not isinstance(data, dict):
        data = {"frases": [], "version": "1.0"}

    frases = data.get("frases", [])
    if not isinstance(frases, list):
        frases = []
    data["frases"] = frases

    if _normalize_frases_ids(frases):
        data["last_updated"] = datetime.now().isoformat()
        _save_json(FRASES_FILE, data)

    return data


def _generate_id(frases: List[Dict[str, Any]]) -> int:
    if not frases:
        return 1

    ids = [_to_int(frase.get("id")) for frase in frases]
    valid_ids = [item for item in ids if item is not None]
    if not valid_ids:
        return 1
    return max(valid_ids) + 1


def _legacy_listar_frases(
    patologia: Optional[str] = None,
    grau: Optional[str] = None,
    busca: Optional[str] = None,
    ativo: Optional[int] = 1,
    skip: int = 0,
    limit: int = 100,
) -> Dict[str, Any]:
    data = _load_frases_data()
    frases = data.get("frases", [])

    if ativo is not None:
        frases = [frase for frase in frases if frase.get("ativo", 1) == ativo]

    if patologia:
        frases = [frase for frase in frases if patologia.lower() in frase.get("patologia", "").lower()]

    if grau:
        frases = [frase for frase in frases if grau.lower() in frase.get("grau", "").lower()]

    if busca:
        busca_lower = busca.lower()
        frases = [
            frase
            for frase in frases
            if (
                busca_lower in frase.get("patologia", "").lower()
                or busca_lower in frase.get("chave", "").lower()
                or busca_lower in frase.get("conclusao", "").lower()
            )
        ]

    total = len(frases)
    return {"items": frases[skip : skip + limit], "total": total}


def _legacy_obter_frase(frase_id: int) -> Optional[Dict[str, Any]]:
    data = _load_frases_data()
    frase_id = _to_int(frase_id) or frase_id
    for frase in data.get("frases", []):
        if _to_int(frase.get("id")) == frase_id and frase.get("ativo", 1) == 1:
            return frase
    return None


def _legacy_obter_frase_por_chave(chave: str) -> Optional[Dict[str, Any]]:
    data = _load_frases_data()
    for frase in data.get("frases", []):
        if frase.get("chave") == chave and frase.get("ativo", 1) == 1:
            return frase
    return None


def _legacy_criar_frase(frase_data: Dict[str, Any]) -> Dict[str, Any]:
    data = _load_frases_data()
    frases = data.get("frases", [])

    chave = frase_data.get("chave")
    if chave and any(frase.get("chave") == chave for frase in frases):
        raise ValueError(f"Ja existe uma frase com a chave '{chave}'")

    nova_frase = {
        "id": _generate_id(frases),
        "chave": frase_data.get("chave", ""),
        "patologia": frase_data.get("patologia", ""),
        "grau": frase_data.get("grau", "Normal"),
        "valvas": frase_data.get("valvas", ""),
        "camaras": frase_data.get("camaras", ""),
        "funcao": frase_data.get("funcao", ""),
        "pericardio": frase_data.get("pericardio", ""),
        "vasos": frase_data.get("vasos", ""),
        "ad_vd": frase_data.get("ad_vd", ""),
        "conclusao": frase_data.get("conclusao", ""),
        "detalhado": _normalize_detalhado(frase_data.get("detalhado")),
        "layout": frase_data.get("layout", "detalhado"),
        "ativo": 1,
        "created_at": datetime.now().isoformat(),
        "updated_at": datetime.now().isoformat(),
        "created_by": frase_data.get("created_by"),
    }

    frases.append(nova_frase)
    data["frases"] = frases
    data["last_updated"] = datetime.now().isoformat()
    _save_json(FRASES_FILE, data)
    return nova_frase


def _legacy_atualizar_frase(frase_id: int, frase_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    data = _load_frases_data()
    frases = data.get("frases", [])
    frase_id = _to_int(frase_id) or frase_id

    for index, frase in enumerate(frases):
        if _to_int(frase.get("id")) != frase_id:
            continue

        for key, value in frase_data.items():
            if value is not None and key not in {"id", "created_at"}:
                frase[key] = value

        frase["updated_at"] = datetime.now().isoformat()
        frases[index] = frase
        data["frases"] = frases
        data["last_updated"] = datetime.now().isoformat()
        _save_json(FRASES_FILE, data)
        return frase

    return None


def _legacy_set_ativo(frase_id: int, ativo: int) -> bool:
    data = _load_frases_data()
    frases = data.get("frases", [])
    frase_id = _to_int(frase_id) or frase_id

    for frase in frases:
        if _to_int(frase.get("id")) != frase_id:
            continue

        frase["ativo"] = ativo
        frase["updated_at"] = datetime.now().isoformat()
        data["frases"] = frases
        data["last_updated"] = datetime.now().isoformat()
        _save_json(FRASES_FILE, data)
        return True

    return False


def _legacy_listar_patologias_das_frases() -> Dict[str, Set[str]]:
    data = _load_frases_data()
    patologias_map: Dict[str, Set[str]] = {}

    for frase in data.get("frases", []):
        if frase.get("ativo", 1) != 1:
            continue

        patologia = (frase.get("patologia") or "").strip()
        if not patologia:
            continue

        grau = (frase.get("grau") or "").strip()
        patologias_map.setdefault(patologia, set())
        if grau:
            patologias_map[patologia].add(grau)

    return patologias_map


def _normalizar_graus_sidebar(graus: List[str], patologia: Optional[str] = None) -> List[str]:
    if (patologia or "").strip().lower() == "normal":
        return ["Normal"]

    graus_validos = set()
    for grau in graus or []:
        canonico = _GRAUS_CANONICOS.get((grau or "").strip().lower())
        if canonico:
            graus_validos.add(canonico)

    ordenados = [grau for grau in GRAUS_SIDEBAR_ORDEM if grau in graus_validos]
    return ordenados or GRAUS_SIDEBAR_ORDEM.copy()


def _legacy_listar_patologias() -> List[str]:
    patologias_map = _legacy_listar_patologias_das_frases()
    if patologias_map:
        return sorted(patologias_map.keys())

    data = _load_json(PATOLOGIAS_FILE, {"patologias": []})
    patologias = [item.get("nome") for item in data.get("patologias", []) if item.get("nome")]
    return sorted(patologias)


def _legacy_listar_graus_por_patologia(patologia: Optional[str] = None) -> List[str]:
    patologias_map = _legacy_listar_patologias_das_frases()
    if patologias_map:
        if patologia:
            return _normalizar_graus_sidebar(list(patologias_map.get(patologia, set())), patologia)

        graus_set: Set[str] = set()
        for graus in patologias_map.values():
            graus_set.update(graus)
        return _normalizar_graus_sidebar(list(graus_set))

    data = _load_json(PATOLOGIAS_FILE, {"patologias": []})
    if patologia:
        for item in data.get("patologias", []):
            if item.get("nome") == patologia:
                return _normalizar_graus_sidebar(item.get("graus", []), patologia)
        return _normalizar_graus_sidebar([], patologia)

    graus_set = set()
    for item in data.get("patologias", []):
        graus_set.update(item.get("graus", []))
    return _normalizar_graus_sidebar(list(graus_set))


def _legacy_buscar_frase_por_patologia_grau(
    patologia: str,
    grau_refluxo: Optional[str] = None,
    grau_geral: Optional[str] = None,
) -> Optional[Dict[str, Any]]:
    if patologia == "Normal":
        chave = "Normal (Normal)"
    elif patologia == "Endocardiose Mitral":
        chave = f"{patologia} ({grau_refluxo or 'Leve'})"
    else:
        chave = f"{patologia} ({grau_geral or 'Leve'})"

    frase = _legacy_obter_frase_por_chave(chave)
    if frase:
        return frase

    data = _load_frases_data()
    for frase in data.get("frases", []):
        if patologia.lower() in frase.get("patologia", "").lower() and frase.get("ativo", 1) == 1:
            return frase
    return None


def _frase_tables_ready(db: Session) -> bool:
    try:
        tables = set(inspect(db.get_bind()).get_table_names())
    except Exception:
        return False
    return "frases_qualitativas" in tables and "frases_qualitativas_historico" in tables


def _db_has_frases(db: Session) -> bool:
    try:
        return db.query(FraseQualitativa.id).first() is not None
    except (ProgrammingError, OperationalError):
        db.rollback()
        return False


def _frase_model_to_dict(frase: FraseQualitativa) -> Dict[str, Any]:
    return {
        "id": frase.id,
        "chave": frase.chave,
        "patologia": frase.patologia,
        "grau": frase.grau,
        "valvas": frase.valvas or "",
        "camaras": frase.camaras or "",
        "funcao": frase.funcao or "",
        "pericardio": frase.pericardio or "",
        "vasos": frase.vasos or "",
        "ad_vd": frase.ad_vd or "",
        "conclusao": frase.conclusao or "",
        "detalhado": _normalize_detalhado(frase.detalhado),
        "layout": frase.layout or "detalhado",
        "ativo": int(frase.ativo or 0),
        "created_at": frase.created_at,
        "updated_at": frase.updated_at,
        "created_by": frase.created_by,
    }


def _frase_model_to_json_dict(frase: FraseQualitativa) -> Dict[str, Any]:
    payload = _frase_model_to_dict(frase)
    payload["created_at"] = _serialize_datetime(payload["created_at"])
    payload["updated_at"] = _serialize_datetime(payload["updated_at"])
    return payload


def ensure_frases_store_seeded(db: Session) -> Dict[str, Any]:
    report = {
        "tables_ready": _frase_tables_ready(db),
        "seeded": False,
        "seeded_count": 0,
        "db_count": 0,
        "json_count": 0,
    }
    if not report["tables_ready"]:
        return report

    try:
        report["db_count"] = db.query(FraseQualitativa).count()
    except (ProgrammingError, OperationalError):
        db.rollback()
        report["tables_ready"] = False
        return report

    data = _load_frases_data()
    frases_json = data.get("frases", [])
    report["json_count"] = len(frases_json)
    if not frases_json:
        return report

    existing_rows = db.query(FraseQualitativa.id, FraseQualitativa.chave).all()
    existing_keys = {str(item.chave or "").strip() for item in existing_rows if str(item.chave or "").strip()}
    existing_ids = {int(item.id) for item in existing_rows if item.id is not None}

    inserted = 0
    for item in sorted(frases_json, key=lambda frase: _to_int(frase.get("id")) or 0):
        chave = str(item.get("chave") or "").strip()
        if not chave or chave in existing_keys:
            continue

        frase_id = _to_int(item.get("id"))
        if frase_id in existing_ids:
            frase_id = None

        db.add(
            FraseQualitativa(
                id=frase_id,
                chave=chave,
                patologia=item.get("patologia", ""),
                grau=item.get("grau", "Normal"),
                valvas=item.get("valvas", ""),
                camaras=item.get("camaras", ""),
                funcao=item.get("funcao", ""),
                pericardio=item.get("pericardio", ""),
                vasos=item.get("vasos", ""),
                ad_vd=item.get("ad_vd", ""),
                conclusao=item.get("conclusao", ""),
                detalhado=_normalize_detalhado(item.get("detalhado")),
                layout=item.get("layout", "detalhado"),
                ativo=int(item.get("ativo", 1) or 0),
                created_by=_to_int(item.get("created_by")),
                created_at=_parse_datetime_value(item.get("created_at")),
                updated_at=_parse_datetime_value(item.get("updated_at")),
            )
        )
        inserted += 1

    if inserted == 0:
        report["db_count"] = db.query(FraseQualitativa).count()
        return report

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        report["db_count"] = db.query(FraseQualitativa).count()
        return report
    report["seeded"] = True
    report["db_count"] = db.query(FraseQualitativa).count()
    report["seeded_count"] = inserted
    return report


def sync_frases_json_mirror(db: Session) -> Dict[str, Any]:
    if not _frase_tables_ready(db):
        return {"synced": False, "count": 0}

    frases = db.query(FraseQualitativa).order_by(FraseQualitativa.id.asc()).all()
    payload = {
        "version": "2.0",
        "last_updated": datetime.now().isoformat(),
        "frases": [_frase_model_to_json_dict(frase) for frase in frases],
    }
    _save_json(FRASES_FILE, payload)
    return {"synced": True, "count": len(frases)}


def _record_frase_history(
    db: Session,
    frase: FraseQualitativa,
    acao: str,
    actor_id: Optional[int],
) -> None:
    if not _frase_tables_ready(db):
        return

    historico = FraseQualitativaHistorico(
        frase_id=frase.id,
        chave=frase.chave,
        patologia=frase.patologia,
        grau=frase.grau,
        conteudo=_frase_model_to_dict(frase),
        acao=acao,
        created_by=actor_id,
    )
    db.add(historico)
    db.commit()


def _build_frase_query(db: Session, include_inactive: bool = False):
    query = db.query(FraseQualitativa)
    if not include_inactive:
        query = query.filter(FraseQualitativa.ativo == 1)
    return query


def _use_database_store(db: Session) -> bool:
    if not _frase_tables_ready(db):
        return False
    ensure_frases_store_seeded(db)
    return _db_has_frases(db)


def listar_frases(
    db: Session,
    patologia: Optional[str] = None,
    grau: Optional[str] = None,
    busca: Optional[str] = None,
    ativo: Optional[int] = 1,
    skip: int = 0,
    limit: int = 100,
) -> Dict[str, Any]:
    if not _use_database_store(db):
        return _legacy_listar_frases(patologia, grau, busca, ativo, skip, limit)

    query = db.query(FraseQualitativa)
    if ativo is not None:
        query = query.filter(FraseQualitativa.ativo == ativo)
    if patologia:
        query = query.filter(func.lower(FraseQualitativa.patologia).like(f"%{patologia.lower()}%"))
    if grau:
        query = query.filter(func.lower(FraseQualitativa.grau).like(f"%{grau.lower()}%"))
    if busca:
        busca_like = f"%{busca.lower()}%"
        query = query.filter(
            or_(
                func.lower(FraseQualitativa.patologia).like(busca_like),
                func.lower(FraseQualitativa.chave).like(busca_like),
                func.lower(FraseQualitativa.conclusao).like(busca_like),
            )
        )

    total = query.count()
    items = (
        query.order_by(FraseQualitativa.patologia.asc(), FraseQualitativa.grau.asc(), FraseQualitativa.id.asc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    return {"items": [_frase_model_to_dict(frase) for frase in items], "total": total}


def obter_frase(db: Session, frase_id: int) -> Optional[Dict[str, Any]]:
    if not _use_database_store(db):
        return _legacy_obter_frase(frase_id)

    frase = _build_frase_query(db).filter(FraseQualitativa.id == frase_id).first()
    return _frase_model_to_dict(frase) if frase else None


def obter_frase_por_chave(db: Session, chave: str) -> Optional[Dict[str, Any]]:
    if not _use_database_store(db):
        return _legacy_obter_frase_por_chave(chave)

    frase = _build_frase_query(db).filter(FraseQualitativa.chave == chave).first()
    return _frase_model_to_dict(frase) if frase else None


def criar_frase(db: Session, frase_data: Dict[str, Any], created_by: Optional[int] = None) -> Dict[str, Any]:
    if not _frase_tables_ready(db):
        frase_data = {**frase_data, "created_by": created_by}
        return _legacy_criar_frase(frase_data)

    ensure_frases_store_seeded(db)
    chave = (frase_data.get("chave") or "").strip()
    if chave and db.query(FraseQualitativa).filter(FraseQualitativa.chave == chave).first():
        raise ValueError(f"Ja existe uma frase com a chave '{chave}'")

    nova_frase = FraseQualitativa(
        chave=chave,
        patologia=frase_data.get("patologia", ""),
        grau=frase_data.get("grau", "Normal"),
        valvas=frase_data.get("valvas", ""),
        camaras=frase_data.get("camaras", ""),
        funcao=frase_data.get("funcao", ""),
        pericardio=frase_data.get("pericardio", ""),
        vasos=frase_data.get("vasos", ""),
        ad_vd=frase_data.get("ad_vd", ""),
        conclusao=frase_data.get("conclusao", ""),
        detalhado=_normalize_detalhado(frase_data.get("detalhado")),
        layout=frase_data.get("layout", "detalhado"),
        ativo=1,
        created_by=created_by,
    )
    db.add(nova_frase)
    db.commit()
    db.refresh(nova_frase)
    _record_frase_history(db, nova_frase, "CREATE", created_by)
    sync_frases_json_mirror(db)
    return _frase_model_to_dict(nova_frase)


def atualizar_frase(
    db: Session,
    frase_id: int,
    frase_data: Dict[str, Any],
    actor_id: Optional[int] = None,
) -> Optional[Dict[str, Any]]:
    if not _frase_tables_ready(db):
        return _legacy_atualizar_frase(frase_id, frase_data)

    ensure_frases_store_seeded(db)
    frase = db.query(FraseQualitativa).filter(FraseQualitativa.id == frase_id).first()
    if not frase:
        return None

    if "chave" in frase_data and frase_data.get("chave"):
        existente = (
            db.query(FraseQualitativa)
            .filter(
                FraseQualitativa.chave == frase_data["chave"],
                FraseQualitativa.id != frase_id,
            )
            .first()
        )
        if existente:
            raise ValueError(f"Ja existe uma frase com a chave '{frase_data['chave']}'")

    for key, value in frase_data.items():
        if value is None or key in {"id", "created_at"}:
            continue
        if key == "detalhado":
            value = _normalize_detalhado(value)
        setattr(frase, key, value)

    frase.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(frase)
    _record_frase_history(db, frase, "UPDATE", actor_id)
    sync_frases_json_mirror(db)
    return _frase_model_to_dict(frase)


def deletar_frase(db: Session, frase_id: int, actor_id: Optional[int] = None) -> bool:
    if not _frase_tables_ready(db):
        return _legacy_set_ativo(frase_id, 0)

    ensure_frases_store_seeded(db)
    frase = db.query(FraseQualitativa).filter(FraseQualitativa.id == frase_id).first()
    if not frase:
        return False

    frase.ativo = 0
    frase.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(frase)
    _record_frase_history(db, frase, "DELETE", actor_id)
    sync_frases_json_mirror(db)
    return True


def restaurar_frase(db: Session, frase_id: int, actor_id: Optional[int] = None) -> bool:
    if not _frase_tables_ready(db):
        return _legacy_set_ativo(frase_id, 1)

    ensure_frases_store_seeded(db)
    frase = db.query(FraseQualitativa).filter(FraseQualitativa.id == frase_id).first()
    if not frase:
        return False

    frase.ativo = 1
    frase.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(frase)
    _record_frase_history(db, frase, "RESTORE", actor_id)
    sync_frases_json_mirror(db)
    return True


def buscar_frase_por_patologia_grau(
    db: Session,
    patologia: str,
    grau_refluxo: Optional[str] = None,
    grau_geral: Optional[str] = None,
) -> Optional[Dict[str, Any]]:
    if patologia == "Normal":
        chave = "Normal (Normal)"
    elif patologia == "Endocardiose Mitral":
        chave = f"{patologia} ({grau_refluxo or 'Leve'})"
    else:
        chave = f"{patologia} ({grau_geral or 'Leve'})"

    if not _use_database_store(db):
        return _legacy_buscar_frase_por_patologia_grau(patologia, grau_refluxo, grau_geral)

    frase = _build_frase_query(db).filter(FraseQualitativa.chave == chave).first()
    if frase:
        return _frase_model_to_dict(frase)

    fallback = (
        _build_frase_query(db)
        .filter(func.lower(FraseQualitativa.patologia).like(f"%{patologia.lower()}%"))
        .order_by(FraseQualitativa.id.asc())
        .first()
    )
    return _frase_model_to_dict(fallback) if fallback else None


def listar_patologias(db: Session) -> List[str]:
    if not _use_database_store(db):
        return _legacy_listar_patologias()

    rows = (
        db.query(FraseQualitativa.patologia)
        .filter(FraseQualitativa.ativo == 1)
        .distinct()
        .order_by(FraseQualitativa.patologia.asc())
        .all()
    )
    patologias = [row[0] for row in rows if row[0]]
    return patologias or _legacy_listar_patologias()


def listar_graus_por_patologia(db: Session, patologia: Optional[str] = None) -> List[str]:
    if not _use_database_store(db):
        return _legacy_listar_graus_por_patologia(patologia)

    query = db.query(FraseQualitativa.grau).filter(FraseQualitativa.ativo == 1)
    if patologia:
        query = query.filter(FraseQualitativa.patologia == patologia)

    graus = [row[0] for row in query.distinct().all() if row[0]]
    if graus:
        return _normalizar_graus_sidebar(graus, patologia)
    return _legacy_listar_graus_por_patologia(patologia)


def adicionar_patologia(nome: str, graus: List[str]) -> bool:
    data = _load_json(PATOLOGIAS_FILE, {"patologias": [], "version": "1.0"})
    patologias = data.get("patologias", [])

    if any(item.get("nome") == nome for item in patologias):
        return False

    patologias.append({"nome": nome, "graus": graus})
    data["patologias"] = patologias
    data["last_updated"] = datetime.now().isoformat()
    _save_json(PATOLOGIAS_FILE, data)
    return True


def atualizar_patologia(nome: str, graus: List[str]) -> bool:
    data = _load_json(PATOLOGIAS_FILE, {"patologias": []})
    patologias = data.get("patologias", [])

    for item in patologias:
        if item.get("nome") != nome:
            continue

        item["graus"] = graus
        data["patologias"] = patologias
        data["last_updated"] = datetime.now().isoformat()
        _save_json(PATOLOGIAS_FILE, data)
        return True

    return False


def get_frases_store_report() -> Dict[str, Any]:
    json_data = _load_frases_data()
    json_frases = json_data.get("frases", [])
    json_keys = {str(item.get("chave") or "").strip() for item in json_frases if str(item.get("chave") or "").strip()}

    db = SessionLocal()
    try:
        tables_ready = _frase_tables_ready(db)
        db_rows = 0
        db_keys: set[str] = set()
        if tables_ready:
            db_items = db.query(FraseQualitativa.id, FraseQualitativa.chave).all()
            db_rows = len(db_items)
            db_keys = {str(item.chave or "").strip() for item in db_items if str(item.chave or "").strip()}

        missing_in_db = sorted(json_keys - db_keys)
        extra_in_db = sorted(db_keys - json_keys)
        active_source = "database" if tables_ready and db_rows > 0 else "json"

        warnings: list[str] = []
        if not tables_ready:
            warnings.append("Tabelas versionadas de frases ausentes; sistema depende do espelho JSON.")
        if tables_ready and db_rows == 0 and json_keys:
            warnings.append("Tabela de frases vazia; sistema ainda depende do espelho JSON.")
        if missing_in_db:
            warnings.append(f"{len(missing_in_db)} frase(s) presentes no JSON e ausentes no banco.")
        if extra_in_db:
            warnings.append(f"{len(extra_in_db)} frase(s) presentes no banco e ausentes no JSON.")

        return {
            "tables_ready": tables_ready,
            "active_source": active_source,
            "database_count": db_rows,
            "json_count": len(json_frases),
            "missing_in_database_count": len(missing_in_db),
            "extra_in_database_count": len(extra_in_db),
            "missing_in_database_examples": missing_in_db[:5],
            "extra_in_database_examples": extra_in_db[:5],
            "warnings": warnings,
        }
    finally:
        db.close()
