"""Endpoints REST para o módulo fiscal."""
from typing import Optional, Annotated

from fastapi import APIRouter, Body, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.schemas.fiscal import (
    CNPJConsultaResponse,
    NotaFiscalCreate,
    NotaFiscalListResponse,
    NotaFiscalResponse,
    NotaFiscalUpdate,
)
from pydantic import BaseModel, Field


class ExportarLoteRequest(BaseModel):
    nota_ids: list[int]
    formato: str = Field(..., pattern="^(pdf|csv|xlsx)$")
from app.services import cnpj_consulta
from app.services import fiscal_export_service
from app.services.fiscal_service import (
    atualizar_nota_fiscal,
    buscar_nota_fiscal,
    criar_nota_fiscal,
    excluir_nota_fiscal,
    listar_notas_fiscais,
    marcar_exportada,
    buscar_os_para_fiscal,
)

router = APIRouter()


# ─── Consulta CNPJ ─────────────────────────────────────────────────────────────

@router.get("/consulta-cnpj/{cnpj}", response_model=CNPJConsultaResponse)
def consultar_cnpj(cnpj: str):
    """
    Consulta dados de empresa pelo CNPJ usando a API Receita WS.
    Retorna razão social, endereço, telefone, email, CNAE, etc.
    """
    return cnpj_consulta.consultar_cnpj(cnpj)


# ─── CRUD Notas Fiscais ────────────────────────────────────────────────────────

@router.get("/notas-fiscais", response_model=NotaFiscalListResponse)
def listar_notas(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    status: Optional[str] = Query(None),
    tipo_cliente: Optional[str] = Query(None),
    data_inicio: Optional[str] = Query(None),
    data_fim: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    """Lista notas fiscais com filtros opcionais."""
    items, total = listar_notas_fiscais(
        db, skip=skip, limit=limit,
        status=status, tipo_cliente=tipo_cliente,
        data_inicio=data_inicio, data_fim=data_fim,
    )
    return NotaFiscalListResponse(
        total=total,
        items=[NotaFiscalResponse.model_validate(n) for n in items],
    )


@router.post("/notas-fiscais", response_model=NotaFiscalResponse, status_code=201)
def criar_nota(
    data: NotaFiscalCreate,
    db: Session = Depends(get_db),
):
    """Cria uma nova nota fiscal. Dados são pré-preenchidos a partir de OS vinculada."""
    nota = criar_nota_fiscal(db, data)
    return NotaFiscalResponse.model_validate(nota)


@router.get("/notas-fiscais/{nota_id}", response_model=NotaFiscalResponse)
def buscar_nota(
    nota_id: int,
    db: Session = Depends(get_db),
):
    """Busca uma nota fiscal pelo ID."""
    nota = buscar_nota_fiscal(db, nota_id)
    if not nota:
        raise HTTPException(status_code=404, detail="Nota fiscal não encontrada.")
    return NotaFiscalResponse.model_validate(nota)


@router.patch("/notas-fiscais/{nota_id}", response_model=NotaFiscalResponse)
def atualizar_nota(
    nota_id: int,
    data: NotaFiscalUpdate,
    db: Session = Depends(get_db),
):
    """Atualiza uma nota fiscal existente."""
    nota = atualizar_nota_fiscal(db, nota_id, data)
    if not nota:
        raise HTTPException(status_code=404, detail="Nota fiscal não encontrada.")
    return NotaFiscalResponse.model_validate(nota)


@router.delete("/notas-fiscais/{nota_id}", status_code=204)
def excluir_nota(
    nota_id: int,
    db: Session = Depends(get_db),
):
    """Exclui (cancela) uma nota fiscal."""
    if not excluir_nota_fiscal(db, nota_id):
        raise HTTPException(status_code=404, detail="Nota fiscal não encontrada.")


# ─── OS para vinculação ───────────────────────────────────────────────────────

@router.get("/os-para-fiscal")
def listar_os_para_fiscal(
    search: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    """
    Lista OS disponíveis para vinculação a nota fiscal.
    Para PF busca por Tutor, para PJ por Clinica.
    """
    items, total = buscar_os_para_fiscal(db, search=search, skip=skip, limit=limit)
    return {"total": total, "items": items}


# ─── Exportação ────────────────────────────────────────────────────────────────

@router.get("/notas-fiscais/{nota_id}/exportar/{formato}")
def exportar_nota(
    nota_id: int,
    formato: str,
    db: Session = Depends(get_db),
):
    """
    Exporta uma nota fiscal individual no formato especificado.
    Retorna arquivo para download.
    """
    nota = buscar_nota_fiscal(db, nota_id)
    if not nota:
        raise HTTPException(status_code=404, detail="Nota fiscal não encontrada.")

    if formato == "pdf":
        content, filename = fiscal_export_service.exportar_pdf([nota], db)
        media_type = "application/pdf"
    elif formato == "csv":
        content, filename = fiscal_export_service.exportar_csv([nota], db)
        media_type = "text/csv; charset=utf-8"
    else:
        content, filename = fiscal_export_service.exportar_xlsx([nota], db)
        media_type = (
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )

    # Marca como exportada
    marcar_exportada(db, nota_id, formato)

    return StreamingResponse(
        iter([content]),
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/notas-fiscais/exportar-lote")
def exportar_lote(
    body: ExportarLoteRequest,
    db: Session = Depends(get_db),
):
    """
    Exporta múltiplas notas fiscais em lote no formato especificado.
    Retorna arquivo para download.
    """
    notas = [buscar_nota_fiscal(db, nid) for nid in body.nota_ids]
    notas = [n for n in notas if n is not None]

    if not notas:
        raise HTTPException(status_code=400, detail="Nenhuma nota fiscal encontrada.")

    if body.formato == "pdf":
        content, filename = fiscal_export_service.exportar_pdf(notas, db)
        media_type = "application/pdf"
    elif body.formato == "csv":
        content, filename = fiscal_export_service.exportar_csv(notas, db)
        media_type = "text/csv; charset=utf-8"
    else:
        content, filename = fiscal_export_service.exportar_xlsx(notas, db)
        media_type = (
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )

    # Marca todas como exportadas
    for nota in notas:
        marcar_exportada(db, nota.id, body.formato)

    return StreamingResponse(
        iter([content]),
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
