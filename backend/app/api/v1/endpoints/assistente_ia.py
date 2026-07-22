from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import require_papel
from app.db.database import get_db
from app.models.user import User
from app.schemas.assistente_ia import (
    AssistenteIAAcaoDecisaoRequest,
    AssistenteIAChatRequest,
    AssistenteIAConhecimentoCreateRequest,
    AssistenteIAFeedbackCreateRequest,
    AssistenteIAMemoriaCreateRequest,
    AssistenteIAMemoriaDecisaoRequest,
)
from app.services.assistente_ia_management import (
    archive_document,
    assistant_metrics,
    create_document,
    create_feedback,
    create_memory,
    decide_memory,
    executive_summary,
    list_clinical_drafts,
    list_documents,
    list_memories,
    list_pending_actions,
)
from app.services.assistente_ia_service import (
    AssistenteIAProviderError,
    conversation_detail,
    create_conversation,
    get_owned_conversation,
    list_conversations,
    run_assistant_turn,
    serialize_conversation,
)
from app.services.assistente_ia_tools import decide_pending_action
from app.services.auditoria_service import registrar_auditoria

router = APIRouter()


@router.get("/status")
def assistente_ia_status(
    current_user: User = Depends(require_papel("admin")),
):
    return {
        "enabled": bool(settings.ASSISTENTE_IA_ENABLED),
        "configured": bool(str(settings.OPENAI_API_KEY or "").strip()),
        "model": str(settings.ASSISTENTE_IA_MODEL),
        "admin_only": True,
        "capabilities": [
            "resumo_executivo_diario",
            "faturamento",
            "agenda",
            "disponibilidade",
            "excecao_de_funcionamento_com_confirmacao",
            "criacao_de_horario_com_confirmacao",
            "reserva_com_confirmacao",
            "mensagem_whatsapp_manual",
            "debitos_pendentes",
            "exclusao_com_confirmacao",
            "remarcacao_e_cancelamento_com_confirmacao",
            "bloqueio_de_slots_com_confirmacao",
            "contatos_de_clinica_com_confirmacao",
            "memoria_supervisionada",
            "base_de_conhecimento_interna",
            "rascunhos_clinicos_sem_finalizacao_automatica",
            "caixa_central_de_aprovacoes",
            "feedback_e_metricas",
        ],
    }


@router.get("/resumo-executivo")
def obter_resumo_executivo_assistente_ia(
    data: str | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_papel("admin")),
):
    try:
        reference = date.fromisoformat(data) if data else None
    except ValueError as exc:
        raise HTTPException(status_code=422, detail="Data invalida. Use YYYY-MM-DD.") from exc
    return executive_summary(db, current_user, reference=reference)


@router.get("/acoes")
def listar_aprovacoes_assistente_ia(
    limit: int = Query(default=100, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_papel("admin")),
):
    return {"items": list_pending_actions(db, current_user, limit=limit)}


@router.get("/memorias")
def listar_memorias_assistente_ia(
    status: str | None = Query(default=None, max_length=24),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_papel("admin")),
):
    return {"items": list_memories(db, status=status)}


@router.post("/memorias")
def criar_memoria_assistente_ia(
    payload: AssistenteIAMemoriaCreateRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_papel("admin")),
):
    memory = create_memory(
            db,
            current_user,
            title=payload.titulo,
            content=payload.conteudo,
            category=payload.categoria,
            approve_immediately=True,
        )
    registrar_auditoria(
        current_user=current_user,
        modulo="assistente_ia",
        entidade="memoria",
        entidade_id=memory["id"],
        acao="ASSISTENTE_IA_MEMORIA_CRIADA",
        descricao="Administrador criou uma memoria aprovada para a Mente FortCordis.",
        detalhes={"titulo": memory["title"], "categoria": memory["category"]},
        request=request,
    )
    return {"memory": memory}


@router.post("/memorias/{memory_id}/decisao")
def decidir_memoria_assistente_ia(
    memory_id: str,
    payload: AssistenteIAMemoriaDecisaoRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_papel("admin")),
):
    return {
        "memory": decide_memory(
            db,
            current_user,
            request,
            memory_id=memory_id,
            decision=payload.decisao,
        )
    }


@router.get("/conhecimento")
def listar_conhecimento_assistente_ia(
    incluir_arquivados: bool = Query(default=False),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_papel("admin")),
):
    return {"items": list_documents(db, include_archived=incluir_arquivados)}


@router.post("/conhecimento")
def criar_conhecimento_assistente_ia(
    payload: AssistenteIAConhecimentoCreateRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_papel("admin")),
):
    document = create_document(
            db,
            current_user,
            title=payload.titulo,
            content=payload.conteudo,
            category=payload.categoria,
            source=payload.fonte,
        )
    registrar_auditoria(
        current_user=current_user,
        modulo="assistente_ia",
        entidade="conhecimento_documento",
        entidade_id=document["id"],
        acao="ASSISTENTE_IA_CONHECIMENTO_ADICIONADO",
        descricao="Administrador adicionou conteudo a base interna da Mente FortCordis.",
        detalhes={"titulo": document["title"], "categoria": document["category"]},
        request=request,
    )
    return {"document": document}


@router.post("/conhecimento/{document_id}/arquivar")
def arquivar_conhecimento_assistente_ia(
    document_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_papel("admin")),
):
    document = archive_document(db, document_id=document_id)
    registrar_auditoria(
        current_user=current_user,
        modulo="assistente_ia",
        entidade="conhecimento_documento",
        entidade_id=document["id"],
        acao="ASSISTENTE_IA_CONHECIMENTO_ARQUIVADO",
        descricao="Administrador arquivou conteudo da base interna da Mente FortCordis.",
        detalhes={"titulo": document["title"]},
        request=request,
    )
    return {"document": document}


@router.post("/feedbacks")
def registrar_feedback_assistente_ia(
    payload: AssistenteIAFeedbackCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_papel("admin")),
):
    return {
        "feedback": create_feedback(
            db,
            current_user,
            message_id=payload.mensagem_id,
            rating=payload.avaliacao,
            category=payload.categoria,
            comment=payload.comentario,
            expected_correction=payload.correcao_esperada,
        )
    }


@router.get("/rascunhos-clinicos")
def listar_rascunhos_clinicos_assistente_ia(
    limit: int = Query(default=100, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_papel("admin")),
):
    return {"items": list_clinical_drafts(db, current_user, limit=limit)}


@router.get("/metricas")
def obter_metricas_assistente_ia(
    dias: int = Query(default=30, ge=1, le=365),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_papel("admin")),
):
    return assistant_metrics(db, current_user, days=dias)


@router.get("/conversas")
def listar_conversas_assistente_ia(
    limit: int = Query(default=40, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_papel("admin")),
):
    return {"items": list_conversations(db, current_user, limit=limit)}


@router.post("/conversas")
def criar_conversa_assistente_ia(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_papel("admin")),
):
    return serialize_conversation(create_conversation(db, current_user))


@router.get("/conversas/{conversation_id}")
def obter_conversa_assistente_ia(
    conversation_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_papel("admin")),
):
    return conversation_detail(db, current_user, conversation_id)


@router.post("/chat")
def conversar_com_assistente_ia(
    payload: AssistenteIAChatRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_papel("admin")),
):
    conversation = (
        get_owned_conversation(db, current_user, payload.conversa_id)
        if payload.conversa_id
        else create_conversation(db, current_user)
    )
    try:
        return run_assistant_turn(
            db=db,
            current_user=current_user,
            request=request,
            message=payload.mensagem,
            conversation=conversation,
        )
    except AssistenteIAProviderError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@router.post("/acoes/{action_id}/decisao")
def decidir_acao_assistente_ia(
    action_id: str,
    payload: AssistenteIAAcaoDecisaoRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_papel("admin")),
):
    action = decide_pending_action(
        db=db,
        current_user=current_user,
        request=request,
        action_id=action_id,
        decision=payload.decisao,
        observation=payload.observacao,
    )
    return {"action": action}
