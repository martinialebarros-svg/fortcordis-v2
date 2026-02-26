from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import inspect
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel, Field
from decimal import Decimal

from app.db.database import get_db
from app.models.clinica import Clinica
from app.models.servico import Servico
from app.models.tabela_preco import PrecoServicoClinica
from app.core.security import get_current_user
from app.models.user import User
from app.services.precos_service import calcular_preco_servico

router = APIRouter()


# Schemas
class ClinicaBase(BaseModel):
    nome: str = Field(..., min_length=2, max_length=255)
    cnpj: Optional[str] = ""
    telefone: Optional[str] = ""
    email: Optional[str] = ""
    endereco: Optional[str] = ""
    cidade: Optional[str] = ""
    estado: Optional[str] = ""
    cep: Optional[str] = ""
    observacoes: Optional[str] = ""


class ClinicaCreate(ClinicaBase):
    tabela_preco_id: Optional[int] = 1
    preco_personalizado_km: Optional[float] = 0
    preco_personalizado_base: Optional[float] = 0
    observacoes_preco: Optional[str] = ""


class ClinicaUpdate(ClinicaBase):
    tabela_preco_id: Optional[int] = None
    preco_personalizado_km: Optional[float] = None
    preco_personalizado_base: Optional[float] = None
    observacoes_preco: Optional[str] = None


class ClinicaResponse(BaseModel):
    id: int
    nome: str
    cnpj: Optional[str] = None
    telefone: Optional[str] = None
    email: Optional[str] = None
    endereco: Optional[str] = None
    cidade: Optional[str] = None
    estado: Optional[str] = None
    cep: Optional[str] = None
    observacoes: Optional[str] = None
    tabela_preco_id: int = 1
    preco_personalizado_km: float = 0
    preco_personalizado_base: float = 0
    observacoes_preco: Optional[str] = None
    ativo: bool = True


class PrecoServicoClinicaPayload(BaseModel):
    servico_id: int
    preco_comercial: Optional[float] = Field(default=None, ge=0)
    preco_plantao: Optional[float] = Field(default=None, ge=0)


class PrecosServicosClinicaUpdate(BaseModel):
    items: List[PrecoServicoClinicaPayload] = Field(default_factory=list)


# Dicionário de cidades da Região Metropolitana de Fortaleza
# Se a cidade não estiver nesta lista e não for Fortaleza, é considerada cidade distante
CIDADES_RM_FORTALEZA = [
    "caucaia", "maracanau", "pacatuba", "eusebio", "aquiraz",
    "horizonte", "itaitinga", "guaiuba", "maranguape", "pacajus",
    "sao goncalo do amarante", "chorozinho", "paracuru", "paraipaba",
    "sao luis do curu", "tra ri", "tururu", "uruoca", "varjota"
]


def determinar_tabela_preco(cidade: str) -> int:
    """
    Determina a tabela de preço baseada na cidade.
    
    Retorna:
    1 = Fortaleza
    2 = Região Metropolitana
    3 = Domiciliar (para cidades fora da RM)
    """
    if not cidade:
        return 1  # Default: Fortaleza
    
    cidade_lower = cidade.lower().strip()
    
    if cidade_lower == "fortaleza":
        return 1
    elif cidade_lower in CIDADES_RM_FORTALEZA:
        return 2
    else:
        return 3  # Domiciliar para cidades distantes


@router.get("")
def listar_clinicas(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Lista clinicas com informações completas"""
    query = db.query(Clinica).filter(Clinica.ativo == True)
    
    total = query.count()
    items = query.order_by(Clinica.nome).offset(skip).limit(limit).all()
    
    clinicas = []
    for c in items:
        clinica_dict = {
            "id": c.id,
            "nome": c.nome,
            "cnpj": c.cnpj,
            "telefone": c.telefone,
            "email": c.email,
            "endereco": c.endereco,
            "cidade": c.cidade,
            "estado": c.estado,
            "cep": c.cep,
            "tabela_preco_id": c.tabela_preco_id or 1,
            "ativo": c.ativo
        }
        clinicas.append(clinica_dict)
    
    return {"total": total, "items": clinicas}


@router.post("", status_code=status.HTTP_201_CREATED)
def criar_clinica(
    clinica: ClinicaCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Cria uma nova clinica com suporte a preços personalizados"""
    # Verificar se ja existe clinica com mesmo nome
    existing = db.query(Clinica).filter(
        Clinica.nome.ilike(clinica.nome),
        Clinica.ativo == True
    ).first()
    
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"Ja existe uma clinica com o nome '{clinica.nome}'"
        )
    
    try:
        # Determinar tabela de preço automaticamente se não informada
        tabela_id = clinica.tabela_preco_id
        if tabela_id == 1 and clinica.cidade:  # Se foi deixado como default (Fortaleza)
            tabela_id = determinar_tabela_preco(clinica.cidade)
        
        db_clinica = Clinica(
            nome=clinica.nome,
            cnpj=clinica.cnpj,
            telefone=clinica.telefone,
            email=clinica.email,
            endereco=clinica.endereco,
            cidade=clinica.cidade,
            estado=clinica.estado,
            cep=clinica.cep,
            observacoes=clinica.observacoes,
            tabela_preco_id=tabela_id,
            preco_personalizado_km=Decimal(str(clinica.preco_personalizado_km)) if clinica.preco_personalizado_km else Decimal("0.00"),
            preco_personalizado_base=Decimal(str(clinica.preco_personalizado_base)) if clinica.preco_personalizado_base else Decimal("0.00"),
            observacoes_preco=clinica.observacoes_preco,
            ativo=True
        )
        
        db.add(db_clinica)
        db.commit()
        db.refresh(db_clinica)
        
        return {
            "id": db_clinica.id,
            "nome": db_clinica.nome,
            "cnpj": db_clinica.cnpj,
            "telefone": db_clinica.telefone,
            "email": db_clinica.email,
            "endereco": db_clinica.endereco,
            "cidade": db_clinica.cidade,
            "estado": db_clinica.estado,
            "cep": db_clinica.cep,
            "observacoes": db_clinica.observacoes,
            "tabela_preco_id": db_clinica.tabela_preco_id,
            "preco_personalizado_km": float(db_clinica.preco_personalizado_km) if db_clinica.preco_personalizado_km else 0,
            "preco_personalizado_base": float(db_clinica.preco_personalizado_base) if db_clinica.preco_personalizado_base else 0,
            "observacoes_preco": db_clinica.observacoes_preco,
            "ativo": db_clinica.ativo
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Erro ao criar clinica: {str(e)}")


@router.get("/{clinica_id}")
def obter_clinica(
    clinica_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Obtem detalhes completos de uma clinica"""
    clinica = db.query(Clinica).filter(
        Clinica.id == clinica_id,
        Clinica.ativo == True
    ).first()
    
    if not clinica:
        raise HTTPException(status_code=404, detail="Clinica nao encontrada")
    
    return {
        "id": clinica.id,
        "nome": clinica.nome,
        "cnpj": clinica.cnpj,
        "telefone": clinica.telefone,
        "email": clinica.email,
        "endereco": clinica.endereco,
        "cidade": clinica.cidade,
        "estado": clinica.estado,
        "cep": clinica.cep,
        "observacoes": clinica.observacoes,
        "tabela_preco_id": clinica.tabela_preco_id or 1,
        "preco_personalizado_km": float(clinica.preco_personalizado_km) if clinica.preco_personalizado_km else 0,
        "preco_personalizado_base": float(clinica.preco_personalizado_base) if clinica.preco_personalizado_base else 0,
        "observacoes_preco": clinica.observacoes_preco,
        "ativo": clinica.ativo
    }


@router.get("/{clinica_id}/precos-servicos")
def listar_precos_servicos_clinica(
    clinica_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Lista precos base e precos negociados por servico para uma clinica."""
    clinica = db.query(Clinica).filter(
        Clinica.id == clinica_id,
        Clinica.ativo == True
    ).first()
    if not clinica:
        raise HTTPException(status_code=404, detail="Clinica nao encontrada")

    # Para configuracao de precos negociados, exibimos todos os servicos cadastrados.
    # Isso evita "lista vazia" quando servicos estao temporariamente inativos.
    servicos = db.query(Servico).order_by(Servico.nome).all()
    custom_rows = []
    inspector = inspect(db.bind)
    if "precos_servicos_clinica" in inspector.get_table_names():
        custom_rows = db.query(PrecoServicoClinica).filter(
            PrecoServicoClinica.clinica_id == clinica_id,
            PrecoServicoClinica.ativo == 1
        ).all()
    custom_map = {row.servico_id: row for row in custom_rows}

    items = []
    for servico in servicos:
        preco_base_comercial = calcular_preco_servico(
            db=db,
            clinica_id=clinica_id,
            servico_id=servico.id,
            tipo_horario="comercial",
            usar_preco_clinica=False,
        )
        preco_base_plantao = calcular_preco_servico(
            db=db,
            clinica_id=clinica_id,
            servico_id=servico.id,
            tipo_horario="plantao",
            usar_preco_clinica=False,
        )
        custom = custom_map.get(servico.id)
        items.append(
            {
                "servico_id": servico.id,
                "servico_nome": servico.nome,
                "servico_ativo": bool(servico.ativo),
                "preco_base_comercial": float(preco_base_comercial),
                "preco_base_plantao": float(preco_base_plantao),
                "preco_negociado_comercial": float(custom.preco_comercial) if custom and custom.preco_comercial is not None else None,
                "preco_negociado_plantao": float(custom.preco_plantao) if custom and custom.preco_plantao is not None else None,
            }
        )

    return {"clinica_id": clinica_id, "items": items}


@router.put("/{clinica_id}/precos-servicos")
def salvar_precos_servicos_clinica(
    clinica_id: int,
    payload: PrecosServicosClinicaUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Salva precos negociados por servico para uma clinica."""
    clinica = db.query(Clinica).filter(
        Clinica.id == clinica_id,
        Clinica.ativo == True
    ).first()
    if not clinica:
        raise HTTPException(status_code=404, detail="Clinica nao encontrada")

    inspector = inspect(db.bind)
    if "precos_servicos_clinica" not in inspector.get_table_names():
        raise HTTPException(
            status_code=500,
            detail="Tabela de precos negociados indisponivel. Execute as migracoes pendentes."
        )

    servicos_validos = {row[0] for row in db.query(Servico.id).all()}
    existentes = db.query(PrecoServicoClinica).filter(
        PrecoServicoClinica.clinica_id == clinica_id
    ).all()
    existentes_map = {row.servico_id: row for row in existentes}

    atualizados = 0
    try:
        for item in payload.items:
            if item.servico_id not in servicos_validos:
                raise HTTPException(
                    status_code=400,
                    detail=f"Servico invalido para preco negociado: {item.servico_id}"
                )

            if item.preco_comercial is None and item.preco_plantao is None:
                row_to_disable = existentes_map.get(item.servico_id)
                if row_to_disable and row_to_disable.ativo == 1:
                    row_to_disable.ativo = 0
                    atualizados += 1
                continue

            row = existentes_map.get(item.servico_id)
            if not row:
                row = PrecoServicoClinica(
                    clinica_id=clinica_id,
                    servico_id=item.servico_id,
                    ativo=1,
                )
                db.add(row)
                existentes_map[item.servico_id] = row

            row.preco_comercial = Decimal(str(item.preco_comercial)) if item.preco_comercial is not None else None
            row.preco_plantao = Decimal(str(item.preco_plantao)) if item.preco_plantao is not None else None
            row.ativo = 1
            atualizados += 1

        db.commit()
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Erro ao salvar precos negociados: {str(e)}")

    return {
        "message": "Precos negociados atualizados com sucesso",
        "atualizados": atualizados
    }


@router.put("/{clinica_id}")
def atualizar_clinica(
    clinica_id: int,
    clinica: ClinicaUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Atualiza uma clinica existente"""
    db_clinica = db.query(Clinica).filter(
        Clinica.id == clinica_id,
        Clinica.ativo == True
    ).first()
    
    if not db_clinica:
        raise HTTPException(status_code=404, detail="Clinica nao encontrada")
    
    try:
        # Atualizar campos básicos
        if clinica.nome is not None:
            db_clinica.nome = clinica.nome
        if clinica.cnpj is not None:
            db_clinica.cnpj = clinica.cnpj
        if clinica.telefone is not None:
            db_clinica.telefone = clinica.telefone
        if clinica.email is not None:
            db_clinica.email = clinica.email
        if clinica.endereco is not None:
            db_clinica.endereco = clinica.endereco
        if clinica.cidade is not None:
            db_clinica.cidade = clinica.cidade
        if clinica.estado is not None:
            db_clinica.estado = clinica.estado
        if clinica.cep is not None:
            db_clinica.cep = clinica.cep
        if clinica.observacoes is not None:
            db_clinica.observacoes = clinica.observacoes
        
        # Atualizar tabela de preço
        if clinica.tabela_preco_id is not None:
            db_clinica.tabela_preco_id = clinica.tabela_preco_id
        
        # Atualizar preços personalizados
        if clinica.preco_personalizado_km is not None:
            db_clinica.preco_personalizado_km = Decimal(str(clinica.preco_personalizado_km))
        if clinica.preco_personalizado_base is not None:
            db_clinica.preco_personalizado_base = Decimal(str(clinica.preco_personalizado_base))
        if clinica.observacoes_preco is not None:
            db_clinica.observacoes_preco = clinica.observacoes_preco
        
        db.commit()
        db.refresh(db_clinica)
        
        return {
            "id": db_clinica.id,
            "nome": db_clinica.nome,
            "cnpj": db_clinica.cnpj,
            "telefone": db_clinica.telefone,
            "email": db_clinica.email,
            "endereco": db_clinica.endereco,
            "cidade": db_clinica.cidade,
            "estado": db_clinica.estado,
            "cep": db_clinica.cep,
            "observacoes": db_clinica.observacoes,
            "tabela_preco_id": db_clinica.tabela_preco_id or 1,
            "preco_personalizado_km": float(db_clinica.preco_personalizado_km) if db_clinica.preco_personalizado_km else 0,
            "preco_personalizado_base": float(db_clinica.preco_personalizado_base) if db_clinica.preco_personalizado_base else 0,
            "observacoes_preco": db_clinica.observacoes_preco,
            "message": "Clinica atualizada com sucesso"
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Erro ao atualizar clinica: {str(e)}")


@router.delete("/{clinica_id}")
def deletar_clinica(
    clinica_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Remove uma clinica (soft delete)"""
    db_clinica = db.query(Clinica).filter(Clinica.id == clinica_id).first()
    
    if not db_clinica:
        raise HTTPException(status_code=404, detail="Clinica nao encontrada")
    
    try:
        db_clinica.ativo = False
        db.commit()
        
        return {"message": "Clinica removida com sucesso"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Erro ao excluir clinica: {str(e)}")


@router.get("/tabelas-preco/opcoes")
def listar_opcoes_tabela_preco(
    current_user: User = Depends(get_current_user)
):
    """Retorna as opções de tabela de preço disponíveis"""
    return {
        "items": [
            {"id": 1, "nome": "Fortaleza", "descricao": "Clínicas na capital"},
            {"id": 2, "nome": "Região Metropolitana", "descricao": "Cidades próximas a Fortaleza"},
            {"id": 3, "nome": "Domiciliar", "descricao": "Atendimento domiciliar padrão"},
            {"id": 4, "nome": "Personalizado", "descricao": "Preço negociado para cidade distante"}
        ]
    }


@router.post("/sugerir-tabela-preco")
def sugerir_tabela_preco(
    cidade: str,
    current_user: User = Depends(get_current_user)
):
    """Sugere a tabela de preço baseada na cidade informada"""
    tabela_id = determinar_tabela_preco(cidade)
    
    tabelas = {
        1: {"id": 1, "nome": "Fortaleza", "descricao": "Capital"},
        2: {"id": 2, "nome": "Região Metropolitana", "descricao": "Cidades próximas"},
        3: {"id": 3, "nome": "Domiciliar", "descricao": "Cidade distante"}
    }
    
    return {
        "cidade": cidade,
        "tabela_sugerida": tabelas.get(tabela_id),
        "cidade_reconhecida": cidade.lower().strip() in ["fortaleza"] + CIDADES_RM_FORTALEZA
    }
