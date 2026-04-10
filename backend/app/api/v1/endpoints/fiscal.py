"""Endpoints REST para o modulo fiscal."""

from typing import Annotated, Optional

from fastapi import APIRouter, Body, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.schemas.fiscal import (
    CNPJConsultaResponse,
    NotaFiscalCreate,
    NotaFiscalListResponse,
    NotaFiscalResponse,
    NotaFiscalUpdate,
)
from app.services import cnpj_consulta, fiscal_export_service
from app.services.fiscal_service import (
    atualizar_nota_fiscal,
    buscar_nota_fiscal,
    buscar_os_para_fiscal,
    buscar_os_por_ids_para_exportacao,
    criar_nota_fiscal,
    excluir_nota_fiscal,
    listar_notas_fiscais,
    marcar_exportada,
)


class ExportarLoteRequest(BaseModel):
    nota_ids: list[int]
    formato: str = Field(..., pattern="^(pdf|csv|xlsx)$")


class DadosTomadorExportacao(BaseModel):
    tipo_cliente: str = Field(default="PJ", pattern="^(PF|PJ)$")
    cliente_nome: Optional[str] = None
    cliente_documento: Optional[str] = None
    cliente_endereco: Optional[str] = None
    cliente_bairro: Optional[str] = None
    cliente_cidade: Optional[str] = None
    cliente_estado: Optional[str] = None
    cliente_cep: Optional[str] = None
    cliente_telefone: Optional[str] = None
    cliente_email: Optional[str] = None
    atividade_cnae: Optional[str] = None
    descricao_servico: Optional[str] = None
    natureza_operacao: Optional[str] = None
    aliquota_iss: Optional[float] = None


class ExportarOSLoteRequest(BaseModel):
    os_ids: list[int] = Field(..., min_length=1)
    formato: str = Field(..., pattern="^(pdf|csv|xlsx)$")
    dados_tomador: Optional[DadosTomadorExportacao] = None
    modo_multiclinica: bool = False


router = APIRouter()


@router.get("/consulta-cnpj/{cnpj}", response_model=CNPJConsultaResponse)
def consultar_cnpj(cnpj: str):
    """
    Consulta dados de empresa pelo CNPJ usando a API Receita WS.
    Retorna razao social, endereco, telefone, email, CNAE, etc.
    """
    return cnpj_consulta.consultar_cnpj(cnpj)


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
        db,
        skip=skip,
        limit=limit,
        status=status,
        tipo_cliente=tipo_cliente,
        data_inicio=data_inicio,
        data_fim=data_fim,
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
    """Cria uma nova nota fiscal. Dados sao pre-preenchidos a partir de OS vinculada."""
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
        raise HTTPException(status_code=404, detail="Nota fiscal nao encontrada.")
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
        raise HTTPException(status_code=404, detail="Nota fiscal nao encontrada.")
    return NotaFiscalResponse.model_validate(nota)


@router.delete("/notas-fiscais/{nota_id}", status_code=204)
def excluir_nota(
    nota_id: int,
    db: Session = Depends(get_db),
):
    """Exclui (cancela) uma nota fiscal."""
    if not excluir_nota_fiscal(db, nota_id):
        raise HTTPException(status_code=404, detail="Nota fiscal nao encontrada.")


@router.get("/os-para-fiscal")
def listar_os_para_fiscal(
    search: Optional[str] = Query(None),
    clinica_id: Optional[int] = Query(None),
    clinica_ids: Optional[list[int]] = Query(None),
    data_inicio: Optional[str] = Query(None),
    data_fim: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=1000),
    db: Session = Depends(get_db),
):
    """
    Lista OS disponiveis para exportacao fiscal.
    Permite filtrar por clinica e periodo sem restringir status da OS.
    """
    items, total = buscar_os_para_fiscal(
        db,
        search=search,
        clinica_id=clinica_id,
        clinica_ids=clinica_ids,
        data_inicio=data_inicio,
        data_fim=data_fim,
        skip=skip,
        limit=limit,
    )
    return {"total": total, "items": items}


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
        raise HTTPException(status_code=404, detail="Nota fiscal nao encontrada.")

    if formato == "pdf":
        content, filename = fiscal_export_service.exportar_pdf([nota], db)
        media_type = "application/pdf"
    elif formato == "csv":
        content, filename = fiscal_export_service.exportar_csv([nota], db)
        media_type = "text/csv; charset=utf-8"
    else:
        content, filename = fiscal_export_service.exportar_xlsx([nota], db)
        media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

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
    Exporta multiplas notas fiscais em lote no formato especificado.
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
        media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

    for nota in notas:
        marcar_exportada(db, nota.id, body.formato)

    return StreamingResponse(
        iter([content]),
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/os/exportar-lote")
def exportar_os_lote(
    body: Annotated[ExportarOSLoteRequest, Body(...)],
    db: Session = Depends(get_db),
):
    """
    Exporta dados de OS para contabilidade sem gerar nota fiscal.
    Aceita exportacao em lote com multiplas OS selecionadas.
    """
    os_items = buscar_os_por_ids_para_exportacao(db, body.os_ids)
    if not os_items:
        raise HTTPException(status_code=400, detail="Nenhuma OS valida encontrada para exportacao.")
    dados_tomador = body.dados_tomador.model_dump(exclude_none=True) if body.dados_tomador else None

    if body.modo_multiclinica:
        clinicas_invalidas = _validar_dados_clinicas_para_exportacao(os_items)
        if clinicas_invalidas:
            raise HTTPException(
                status_code=422,
                detail={
                    "message": "Existem clinicas com dados incompletos para exportacao.",
                    "clinicas": clinicas_invalidas,
                },
            )
        if dados_tomador:
            # No modo multiclinica os dados cadastrais do tomador vem de cada clinica.
            # Mantemos apenas campos fiscais globais que podem ser compartilhados.
            dados_tomador = {
                "atividade_cnae": dados_tomador.get("atividade_cnae"),
                "descricao_servico": dados_tomador.get("descricao_servico"),
                "natureza_operacao": dados_tomador.get("natureza_operacao"),
                "aliquota_iss": dados_tomador.get("aliquota_iss"),
            }

    if body.formato == "pdf":
        content, filename = fiscal_export_service.exportar_os_pdf(os_items, db, dados_tomador=dados_tomador)
        media_type = "application/pdf"
    elif body.formato == "csv":
        content, filename = fiscal_export_service.exportar_os_csv(os_items, db, dados_tomador=dados_tomador)
        media_type = "text/csv; charset=utf-8"
    else:
        content, filename = fiscal_export_service.exportar_os_xlsx(os_items, db, dados_tomador=dados_tomador)
        media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

    return StreamingResponse(
        iter([content]),
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


def _validar_dados_clinicas_para_exportacao(os_items: list[dict]) -> list[dict]:
    required_map = {
        "clinica_nome": "razao/nome",
        "clinica_cnpj": "cnpj",
        "clinica_endereco": "logradouro",
        "clinica_bairro": "bairro",
        "clinica_cidade": "cidade",
        "clinica_estado": "estado",
        "clinica_cep": "cep",
        "clinica_telefone": "telefone",
        "clinica_email": "e-mail",
    }
    clinica_por_id: dict[str, dict] = {}
    for item in os_items:
        clinica_id = str(item.get("clinica_id") or item.get("clinica_nome") or "sem-clinica")
        if clinica_id not in clinica_por_id:
            clinica_por_id[clinica_id] = item

    invalidas: list[dict] = []
    for row in clinica_por_id.values():
        faltando = [
            label for key, label in required_map.items() if not str(row.get(key) or "").strip()
        ]
        if faltando:
            invalidas.append(
                {
                    "clinica_id": row.get("clinica_id"),
                    "clinica_nome": row.get("clinica_nome") or "Clinica sem nome",
                    "faltando": faltando,
                }
            )
    return invalidas
