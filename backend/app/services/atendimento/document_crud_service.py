from datetime import datetime
from typing import Optional

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.atendimento_clinico import AtendimentoClinico, DocumentoAtendimento
from app.schemas.atendimento import DocumentoAtendimentoUpdatePayload


def _to_iso(value: Optional[datetime]) -> str:
    if not value:
        return ""
    return value.isoformat()


def serializar_documento_atendimento(documento: DocumentoAtendimento) -> dict:
    return {
        "id": documento.id,
        "atendimento_id": documento.atendimento_id,
        "template_id": documento.template_id,
        "titulo": documento.titulo or "",
        "corpo": documento.corpo or "",
        "status": documento.status or "rascunho",
        "criado_por_id": documento.criado_por_id,
        "criado_por_nome": documento.criado_por_nome or "",
        "emitido_at": _to_iso(documento.emitido_at),
        "created_at": _to_iso(documento.created_at),
        "updated_at": _to_iso(documento.updated_at),
    }


def obter_documento_atendimento_ou_404(
    db: Session,
    atendimento_id: int,
    documento_id: int,
) -> DocumentoAtendimento:
    documento = (
        db.query(DocumentoAtendimento)
        .filter(
            DocumentoAtendimento.id == documento_id,
            DocumentoAtendimento.atendimento_id == atendimento_id,
        )
        .first()
    )
    if not documento:
        raise HTTPException(status_code=404, detail="Documento do atendimento nao encontrado.")
    return documento


def listar_documentos_atendimento(db: Session, atendimento_id: int) -> dict:
    documentos = (
        db.query(DocumentoAtendimento)
        .filter(DocumentoAtendimento.atendimento_id == atendimento_id)
        .order_by(DocumentoAtendimento.updated_at.desc(), DocumentoAtendimento.created_at.desc(), DocumentoAtendimento.id.desc())
        .all()
    )
    return {"documentos": [serializar_documento_atendimento(documento) for documento in documentos]}


def atualizar_documento_atendimento(
    db: Session,
    atendimento: AtendimentoClinico,
    atendimento_id: int,
    documento_id: int,
    payload: DocumentoAtendimentoUpdatePayload,
) -> dict:
    documento = obter_documento_atendimento_ou_404(db, atendimento_id, documento_id)
    data = payload.model_dump(exclude_unset=True)
    if "titulo" in data:
        titulo = (data["titulo"] or "").strip()
        if not titulo:
            raise HTTPException(status_code=422, detail="Titulo do documento e obrigatorio.")
        documento.titulo = titulo
    if "corpo" in data:
        corpo = (data["corpo"] or "").strip()
        if not corpo:
            raise HTTPException(status_code=422, detail="Corpo do documento e obrigatorio.")
        documento.corpo = corpo
    if "status" in data and data["status"] is not None:
        status_doc = (data["status"] or "").strip().lower()
        if status_doc not in {"rascunho", "emitido", "arquivado"}:
            raise HTTPException(status_code=422, detail="Status de documento invalido.")
        documento.status = status_doc

    documento.updated_at = datetime.now()
    atendimento.updated_at = datetime.now()
    db.commit()
    db.refresh(documento)
    return serializar_documento_atendimento(documento)


def excluir_documento_atendimento(db: Session, atendimento_id: int, documento_id: int) -> dict:
    documento = obter_documento_atendimento_ou_404(db, atendimento_id, documento_id)
    db.delete(documento)
    atendimento = db.query(AtendimentoClinico).filter(AtendimentoClinico.id == atendimento_id).first()
    if atendimento:
        atendimento.updated_at = datetime.now()
    db.commit()
    return {"message": "Documento removido com sucesso.", "id": documento_id}
