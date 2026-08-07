from datetime import datetime
from typing import Optional

from fastapi import HTTPException, Request
from sqlalchemy.orm import Session

from app.models.atendimento_clinico import AtendimentoClinico, DocumentoAtendimento
from app.models.user import User
from app.schemas.atendimento import DocumentoAtendimentoUpdatePayload
from app.services.auditoria_service import registrar_auditoria

_CAMPOS_DOCUMENTO_AUDITAVEIS = ("titulo", "corpo", "status")


def _snapshot_documento(documento: DocumentoAtendimento) -> dict:
    return {
        "titulo": documento.titulo or "",
        "corpo": documento.corpo or "",
        "status": documento.status or "rascunho",
    }


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
    *,
    current_user: User,
    request: Optional[Request] = None,
) -> dict:
    documento = obter_documento_atendimento_ou_404(db, atendimento_id, documento_id)
    valores_anteriores = _snapshot_documento(documento)
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

    valores_novos = _snapshot_documento(documento)
    alteracoes = {
        campo: {"antes": valores_anteriores[campo], "depois": valores_novos[campo]}
        for campo in _CAMPOS_DOCUMENTO_AUDITAVEIS
        if valores_anteriores[campo] != valores_novos[campo]
    }
    if alteracoes:
        # Documento clinico (atestado, receituario avulso, declaracao) pode
        # ser editado depois de emitido/entregue - sem isto, uma disputa
        # sobre o que foi de fato orientado ao tutor nao tem como ser
        # reconstituida (nem o conteudo anterior, nem quem alterou).
        registrar_auditoria(
            current_user=current_user,
            modulo="atendimento",
            entidade="documento_atendimento",
            entidade_id=documento.id,
            acao="DOCUMENTO_ATENDIMENTO_ATUALIZADO",
            descricao=f"Documento clinico #{documento.id} atualizado: {', '.join(sorted(alteracoes))}.",
            detalhes={"atendimento_id": atendimento_id, "alteracoes": alteracoes},
            request=request,
        )
    return serializar_documento_atendimento(documento)


def excluir_documento_atendimento(
    db: Session,
    atendimento_id: int,
    documento_id: int,
    *,
    current_user: User,
    request: Optional[Request] = None,
) -> dict:
    documento = obter_documento_atendimento_ou_404(db, atendimento_id, documento_id)
    conteudo_excluido = _snapshot_documento(documento)
    db.delete(documento)
    atendimento = db.query(AtendimentoClinico).filter(AtendimentoClinico.id == atendimento_id).first()
    if atendimento:
        atendimento.updated_at = datetime.now()
    db.commit()

    registrar_auditoria(
        current_user=current_user,
        modulo="atendimento",
        entidade="documento_atendimento",
        entidade_id=documento_id,
        acao="DOCUMENTO_ATENDIMENTO_EXCLUIDO",
        descricao=(
            f"Documento clinico #{documento_id} "
            f"({conteudo_excluido['titulo'] or 'sem titulo'}) excluido definitivamente."
        ),
        detalhes={"atendimento_id": atendimento_id, "conteudo_excluido": conteudo_excluido},
        request=request,
    )
    return {"message": "Documento removido com sucesso.", "id": documento_id}
