"""Endpoints para gerenciamento de referências ecocardiográficas"""
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from pydantic import BaseModel
import csv
import io

from app.db.database import get_db
from app.models.referencia_eco import ReferenciaEco
from app.models.user import User
from app.core.security import get_current_user

router = APIRouter()

# Mapeamento CSV -> modelo (igual ao importar_referencias.py)
_MAPEAMENTO_CSV_CANINOS = {
    "Peso (kg)": "peso_kg", "LVIDd_Min": "lvid_d_min", "LVIDd_Max": "lvid_d_max",
    "IVSd_Min": "ivs_d_min", "IVSd_Max": "ivs_d_max", "LVPWd_Min": "lvpw_d_min", "LVPWd_Max": "lvpw_d_max",
    "LVIDs_Min": "lvid_s_min", "LVIDs_Max": "lvid_s_max", "IVSs_Min": "ivs_s_min", "IVSs_Max": "ivs_s_max",
    "LVPWs_Min": "lvpw_s_min", "LVPWs_Max": "lvpw_s_max", "EDV_Min": "edv_min", "EDV_Max": "edv_max",
    "ESV_Min": "esv_min", "ESV_Max": "esv_max", "SV_Min": "sv_min", "SV_Max": "sv_max",
    "EF_Min": "ef_min", "EF_Max": "ef_max", "FS_Min": "fs_min", "FS_Max": "fs_max",
    "Ao_Min": "ao_min", "Ao_Max": "ao_max", "LA_Min": "la_min", "LA_Max": "la_max",
    "LA_Ao_Min": "la_ao_min", "LA_Ao_Max": "la_ao_max", "Vmax_Ao_Min": "vmax_ao_min", "Vmax_Ao_Max": "vmax_ao_max",
    "Vmax_Pulm_Min": "vmax_pulm_min", "Vmax_Pulm_Max": "vmax_pulm_max",
    "MV_E_Min": "mv_e_min", "MV_E_Max": "mv_e_max", "MV_A_Min": "mv_a_min", "MV_A_Max": "mv_a_max",
    "MV_E_A_Min": "mv_ea_min", "MV_E_A_Max": "mv_ea_max", "MV_DT_Min": "mv_dt_min", "MV_DT_Max": "mv_dt_max",
    "IVRT_Min": "ivrt_min", "IVRT_Max": "ivrt_max",
}
_MAPEAMENTO_CSV_FELINOS = {
    "Peso": "peso_kg", "IVSd_Min": "ivs_d_min", "IVSd_Max": "ivs_d_max", "LVIDd_Min": "lvid_d_min", "LVIDd_Max": "lvid_d_max",
    "LVPWd_Min": "lvpw_d_min", "LVPWd_Max": "lvpw_d_max", "IVSs_Min": "ivs_s_min", "IVSs_Max": "ivs_s_max",
    "LVIDs_Min": "lvid_s_min", "LVIDs_Max": "lvid_s_max", "LVPWs_Min": "lvpw_s_min", "LVPWs_Max": "lvpw_s_max",
    "FS_Min": "fs_min", "FS_Max": "fs_max", "EF_Min": "ef_min", "EF_Max": "ef_max",
    "LA_Min": "la_min", "LA_Max": "la_max", "Ao_Min": "ao_min", "Ao_Max": "ao_max",
    "LA_Ao_Min": "la_ao_min", "LA_Ao_Max": "la_ao_max",
}


def _referencia_to_dict(r: ReferenciaEco) -> dict:
    """Serializa um ReferenciaEco para dict (evita problemas de JSON com objetos SQLAlchemy)."""
    return {
        "id": r.id,
        "especie": r.especie,
        "peso_kg": r.peso_kg,
        "lvid_d_min": r.lvid_d_min, "lvid_d_max": r.lvid_d_max,
        "lvid_s_min": r.lvid_s_min, "lvid_s_max": r.lvid_s_max,
        "ivs_d_min": r.ivs_d_min, "ivs_d_max": r.ivs_d_max,
        "ivs_s_min": r.ivs_s_min, "ivs_s_max": r.ivs_s_max,
        "lvpw_d_min": r.lvpw_d_min, "lvpw_d_max": r.lvpw_d_max,
        "lvpw_s_min": r.lvpw_s_min, "lvpw_s_max": r.lvpw_s_max,
        "fs_min": r.fs_min, "fs_max": r.fs_max,
        "ef_min": r.ef_min, "ef_max": r.ef_max,
        "ao_min": r.ao_min, "ao_max": r.ao_max,
        "la_min": r.la_min, "la_max": r.la_max,
        "la_ao_min": r.la_ao_min, "la_ao_max": r.la_ao_max,
        "vmax_ao_min": r.vmax_ao_min, "vmax_ao_max": r.vmax_ao_max,
        "vmax_pulm_min": r.vmax_pulm_min, "vmax_pulm_max": r.vmax_pulm_max,
        "mv_e_min": r.mv_e_min, "mv_e_max": r.mv_e_max,
        "mv_a_min": r.mv_a_min, "mv_a_max": r.mv_a_max,
        "mv_ea_min": r.mv_ea_min, "mv_ea_max": r.mv_ea_max,
        "edv_min": r.edv_min, "edv_max": r.edv_max,
        "esv_min": r.esv_min, "esv_max": r.esv_max,
        "sv_min": r.sv_min, "sv_max": r.sv_max,
        "mv_dt_min": r.mv_dt_min, "mv_dt_max": r.mv_dt_max,
        "ivrt_min": r.ivrt_min, "ivrt_max": r.ivrt_max,
    }


def _importar_csv_from_content(content: str, especie: str, db: Session) -> int:
    """Importa referências a partir do conteúdo CSV. Substitui as existentes da espécie."""
    mapeamento = _MAPEAMENTO_CSV_CANINOS if especie == "Canina" else _MAPEAMENTO_CSV_FELINOS
    db.query(ReferenciaEco).filter(ReferenciaEco.especie == especie).delete()
    count = 0
    stream = io.StringIO(content)
    reader = csv.DictReader(stream)
    # Normalizar nomes das colunas (strip BOM e espaços)
    if reader.fieldnames:
        reader.fieldnames = [c.strip().strip("\ufeff") for c in reader.fieldnames]
    for row in reader:
        dados = {"especie": especie}
        for csv_col, db_col in mapeamento.items():
            valor = (row.get(csv_col) or "").strip()
            if valor and valor.replace(".", "").replace("-", "").isdigit():
                dados[db_col] = float(valor)
            else:
                dados[db_col] = None
        # Fallback: caninos às vezes têm coluna "Peso" em vez de "Peso (kg)"
        if dados.get("peso_kg") is None and especie == "Canina":
            for alt in ("Peso", "Peso (kg)", "peso", "Peso(kg)"):
                v = (row.get(alt) or "").strip()
                if v and v.replace(".", "").replace("-", "").isdigit():
                    dados["peso_kg"] = float(v)
                    break
        if dados.get("peso_kg") is None:
            continue
        try:
            db.add(ReferenciaEco(**dados))
            count += 1
        except Exception:
            continue
    db.commit()
    return count


class ReferenciaEcoCreate(BaseModel):
    especie: str
    peso_kg: float
    # Câmaras
    lvid_d_min: Optional[float] = None
    lvid_d_max: Optional[float] = None
    lvid_s_min: Optional[float] = None
    lvid_s_max: Optional[float] = None
    # Paredes
    ivs_d_min: Optional[float] = None
    ivs_d_max: Optional[float] = None
    ivs_s_min: Optional[float] = None
    ivs_s_max: Optional[float] = None
    lvpw_d_min: Optional[float] = None
    lvpw_d_max: Optional[float] = None
    lvpw_s_min: Optional[float] = None
    lvpw_s_max: Optional[float] = None
    # Função
    fs_min: Optional[float] = None
    fs_max: Optional[float] = None
    ef_min: Optional[float] = None
    ef_max: Optional[float] = None
    # Vasos
    ao_min: Optional[float] = None
    ao_max: Optional[float] = None
    la_min: Optional[float] = None
    la_max: Optional[float] = None
    la_ao_min: Optional[float] = None
    la_ao_max: Optional[float] = None
    # Fluxos
    vmax_ao_min: Optional[float] = None
    vmax_ao_max: Optional[float] = None
    vmax_pulm_min: Optional[float] = None
    vmax_pulm_max: Optional[float] = None
    mv_e_min: Optional[float] = None
    mv_e_max: Optional[float] = None
    mv_a_min: Optional[float] = None
    mv_a_max: Optional[float] = None
    mv_ea_min: Optional[float] = None
    mv_ea_max: Optional[float] = None
    # Volumes
    edv_min: Optional[float] = None
    edv_max: Optional[float] = None
    esv_min: Optional[float] = None
    esv_max: Optional[float] = None
    sv_min: Optional[float] = None
    sv_max: Optional[float] = None
    # Tempos
    mv_dt_min: Optional[float] = None
    mv_dt_max: Optional[float] = None
    ivrt_min: Optional[float] = None
    ivrt_max: Optional[float] = None


class ReferenciaEcoUpdate(ReferenciaEcoCreate):
    pass


@router.get("", response_model=None)
@router.get("/", response_model=None)
def listar_referencias(
    especie: Optional[str] = None,
    peso: Optional[float] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Lista referências ecocardiográficas com filtros (aceita / e sem barra final)."""
    query = db.query(ReferenciaEco)
    
    if especie:
        query = query.filter(ReferenciaEco.especie.ilike(especie))
    if peso:
        # Busca o peso mais próximo (dentro de uma faixa)
        query = query.filter(
            ReferenciaEco.peso_kg >= peso - 1,
            ReferenciaEco.peso_kg <= peso + 1
        )
    
    referencias = query.order_by(ReferenciaEco.especie, ReferenciaEco.peso_kg).all()
    return {"total": len(referencias), "items": [_referencia_to_dict(r) for r in referencias]}


@router.post("/importar")
def importar_referencias_csv(
    caninos: Optional[UploadFile] = File(None),
    felinos: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Importa referências a partir dos CSVs (caninos e/ou felinos). Substitui as existentes da espécie."""
    result = {"caninos": 0, "felinos": 0, "erros": []}
    if not caninos and not felinos:
        raise HTTPException(
            status_code=400,
            detail="Envie pelo menos um arquivo: caninos e/ou felinos",
        )
    if caninos:
        try:
            content = caninos.file.read().decode("utf-8-sig")
            result["caninos"] = _importar_csv_from_content(content, "Canina", db)
        except Exception as e:
            result["erros"].append(f"Caninos: {str(e)}")
    if felinos:
        try:
            content = felinos.file.read().decode("utf-8-sig")
            result["felinos"] = _importar_csv_from_content(content, "Felina", db)
        except Exception as e:
            result["erros"].append(f"Felinos: {str(e)}")
    return result


@router.get("/{referencia_id}")
def obter_referencia(
    referencia_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Obtém uma referência específica"""
    ref = db.query(ReferenciaEco).filter(ReferenciaEco.id == referencia_id).first()
    if not ref:
        raise HTTPException(status_code=404, detail="Referência não encontrada")
    return ref


@router.get("/buscar/{especie}/{peso_kg}")
def buscar_referencia_por_peso(
    especie: str,
    peso_kg: float,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Busca a referência mais próxima do peso informado"""
    ref = db.query(ReferenciaEco).filter(
        ReferenciaEco.especie.ilike(especie)
    ).order_by(
        func.abs(ReferenciaEco.peso_kg - peso_kg)
    ).first()
    
    if not ref:
        raise HTTPException(status_code=404, detail="Referência não encontrada")
    return ref


@router.post("/", status_code=status.HTTP_201_CREATED)
def criar_referencia(
    referencia: ReferenciaEcoCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Cria uma nova referência"""
    nova_ref = ReferenciaEco(**referencia.dict())
    db.add(nova_ref)
    db.commit()
    db.refresh(nova_ref)
    return nova_ref


@router.put("/{referencia_id}")
def atualizar_referencia(
    referencia_id: int,
    referencia: ReferenciaEcoUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Atualiza uma referência existente"""
    ref = db.query(ReferenciaEco).filter(ReferenciaEco.id == referencia_id).first()
    if not ref:
        raise HTTPException(status_code=404, detail="Referência não encontrada")
    
    for field, value in referencia.dict(exclude_unset=True).items():
        setattr(ref, field, value)
    
    db.commit()
    db.refresh(ref)
    return ref


@router.delete("/{referencia_id}")
def deletar_referencia(
    referencia_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Remove uma referência"""
    ref = db.query(ReferenciaEco).filter(ReferenciaEco.id == referencia_id).first()
    if not ref:
        raise HTTPException(status_code=404, detail="Referência não encontrada")
    
    db.delete(ref)
    db.commit()
    return {"message": "Referência removida com sucesso"}
