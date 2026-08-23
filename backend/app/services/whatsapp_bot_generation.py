"""Orquestracao da geracao de resposta (Fase 4, P4.1-P4.5).

Fluxo de um turno:
  resolve identidade -> recorta contexto por persona -> roda tools da persona
  -> gera com o provider -> guardrail -> decide (draft | blocked | suppressed)

O que este modulo NAO faz nesta fase: enviar ao cliente. O envio (RF-027)
depende de o servico Node aceitar `metadata` do chamador, o que hoje ele NAO
faz (`sendConversationMessage` crava `{source: "agent_api"}`) - decisao
registrada em verify.md. Alem disso o endpoint de envio nao tem idempotencia
e o caminho de texto reclassifica para `failed` quando o banco falha DEPOIS
de o Meta aceitar, o que combinado com o retry do worker poderia entregar a
mesma resposta duas vezes. Por isso `decisao="sent"` nao e alcancavel aqui.
"""
from __future__ import annotations

import json
import logging
import time
from dataclasses import dataclass
from typing import Any, Optional

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.core.config import settings
from app.services.whatsapp_bot_context import build_safe_context
from app.services.whatsapp_bot_guardrails import (
    GuardrailVeredito,
    avaliar_resposta,
    contar_respostas_do_dia,
    turno_a_partir_dos_resultados,
)
from app.services.whatsapp_bot_prompt import (
    build_input_payload,
    build_instructions,
    resolve_prompt_version,
)
from app.services.whatsapp_bot_providers import (
    WhatsAppBotProviderError,
    get_whatsapp_bot_reply_provider,
)
from app.services.whatsapp_bot_tools import (
    TOOL_SCHEMAS,
    TOOLS_POR_PERSONA,
    WhatsAppBotToolContext,
    WhatsAppBotToolError,
    execute_bot_tool,
)

logger = logging.getLogger(__name__)


@dataclass
class ResultadoGeracao:
    """O que o worker precisa para gravar `whatsapp_bot_respostas` (RF-026)."""

    decisao: str
    motivo: str
    texto_gerado: Optional[str] = None
    texto_enviado: Optional[str] = None
    modelo: Optional[str] = None
    prompt_version: Optional[str] = None
    tools_usadas: Optional[str] = None
    input_tokens: Optional[int] = None
    output_tokens: Optional[int] = None
    latencia_ms: Optional[int] = None
    resolution: Optional[str] = None
    match_type: Optional[str] = None


# Tools rodadas por intent presumida. Nesta fase nao ha classificacao previa
# de intent (o modelo classifica na saida), entao rodamos o conjunto barato e
# somente-leitura da persona e deixamos o modelo usar o que precisar. Isso
# mantem o teto de 1 rodada de tools do provider.
_TOOLS_DE_PARTIDA = (
    "consultar_horario_funcionamento",
    "consultar_dados_institucionais",
)


def _resolver_contexto(db: Session, wa_identity: str) -> dict[str, Any]:
    """CB-004: numero invalido e `not_found`, nao erro de job.

    `normalize_whatsapp_number` levanta HTTPException(422) e
    `resolve_whatsapp_context` nao captura - a excecao subiria do meio do
    worker. Retry nunca conserta um numero invalido.
    """
    from app.api.v1.endpoints.whatsapp_contexto import resolve_whatsapp_context

    try:
        return resolve_whatsapp_context(db, wa_identity)
    except HTTPException:
        return {"resolution": "not_found", "match_type": None}
    except Exception:
        logger.exception("Falha ao resolver contexto do WhatsApp para o bot.")
        return {"resolution": "not_found", "match_type": None}


def _escopo_da_persona(contexto: dict[str, Any]) -> tuple[Optional[str], Optional[int], Optional[int]]:
    match_type = contexto.get("match_type")
    if match_type == "tutor":
        tutores = contexto.get("tutores") or []
        tutor_id = tutores[0].get("id") if tutores and isinstance(tutores[0], dict) else None
        return ("tutor", tutor_id, None) if tutor_id else (None, None, None)
    if match_type == "clinica":
        clinicas = contexto.get("clinicas") or []
        clinica_id = clinicas[0].get("id") if clinicas and isinstance(clinicas[0], dict) else None
        return ("clinica", None, clinica_id) if clinica_id else (None, None, None)
    return (None, None, None)


def gerar_resposta(
    db: Session,
    *,
    wa_identity: str,
    corpo_mensagem: str,
    modo: str,
    provider: Any = None,
) -> ResultadoGeracao:
    """Gera (ou recusa gerar) uma resposta para uma mensagem inbound."""
    contexto = _resolver_contexto(db, wa_identity)
    resolution = str(contexto.get("resolution") or "not_found")
    match_type, tutor_id, clinica_id = _escopo_da_persona(contexto)

    # RF-025: teto diario por conversa, antes de gastar token.
    if contar_respostas_do_dia(db, wa_identity) >= int(
        settings.WHATSAPP_BOT_MAX_REPLIES_PER_CONVERSATION_DAY or 20
    ):
        return ResultadoGeracao(
            decisao="suppressed",
            motivo="teto_diario",
            resolution=resolution,
            match_type=match_type,
        )

    # RF-016/CA-013: sem identidade resolvida, nenhuma tool de dado roda e
    # nenhum dado de registro entra no prompt. Nesta fase isso e handoff.
    if match_type is None:
        return ResultadoGeracao(
            decisao="handoff",
            motivo="identidade_nao_resolvida",
            resolution=resolution,
            match_type=None,
        )

    try:
        tool_ctx = WhatsAppBotToolContext(
            db=db, match_type=match_type, tutor_id=tutor_id, clinica_id=clinica_id
        )
    except WhatsAppBotToolError:
        logger.exception("Escopo incoerente ao montar contexto de tools do bot.")
        return ResultadoGeracao(
            decisao="handoff", motivo="escopo_incoerente", resolution=resolution, match_type=match_type
        )

    resultados: list[tuple[str, dict[str, Any]]] = []
    for nome in _TOOLS_DE_PARTIDA:
        if nome in (TOOLS_POR_PERSONA.get(match_type) or {}):
            resultados.append((nome, execute_bot_tool(tool_ctx, nome)))

    # A base institucional e a fonte de "como agendar"/"area de atendimento",
    # que nao tem tabela propria no sistema.
    resultados.append(
        (
            "buscar_conhecimento_institucional",
            execute_bot_tool(
                tool_ctx, "buscar_conhecimento_institucional", {"consulta": corpo_mensagem}
            ),
        )
    )

    contexto_seguro = build_safe_context(
        contexto, match_type=match_type, tutor_id=tutor_id, clinica_id=clinica_id
    )
    instructions = build_instructions(match_type)
    prompt_version = resolve_prompt_version(match_type)
    payload = build_input_payload(
        mensagem_cliente=corpo_mensagem,
        persona=match_type,
        contexto_seguro=contexto_seguro,
        resultados_de_tools=[{"tool": n, "resultado": r} for n, r in resultados],
    )

    provider = provider or get_whatsapp_bot_reply_provider()
    iniciado = time.perf_counter()
    try:
        gerado = provider.generate(
            instructions=instructions,
            payload=payload,
            tools=list(TOOL_SCHEMAS),
            safety_scope=wa_identity,
        )
    except WhatsAppBotProviderError as exc:
        return ResultadoGeracao(
            decisao="handoff",
            motivo=f"provider:{exc.code}",
            prompt_version=prompt_version,
            resolution=resolution,
            match_type=match_type,
            latencia_ms=int((time.perf_counter() - iniciado) * 1000),
        )
    latencia_ms = int((time.perf_counter() - iniciado) * 1000)

    turno = turno_a_partir_dos_resultados(match_type, resultados)
    veredito: GuardrailVeredito = avaliar_resposta(
        texto=gerado.output.texto,
        intent=gerado.output.intent,
        modo=modo,
        turno=turno,
    )

    tools_usadas = json.dumps(
        {
            "tools_ok": turno.tools_ok,
            "fontes_declaradas": gerado.output.fontes,
            "tem_trecho_conhecimento": turno.tem_trecho_conhecimento,
        },
        ensure_ascii=False,
    )

    base = ResultadoGeracao(
        decisao="draft",
        motivo="",
        texto_gerado=gerado.output.texto,
        modelo=gerado.model,
        prompt_version=prompt_version,
        tools_usadas=tools_usadas,
        input_tokens=gerado.input_tokens,
        output_tokens=gerado.output_tokens,
        latencia_ms=latencia_ms,
        resolution=resolution,
        match_type=match_type,
    )

    if not veredito.aprovado:
        # Bloqueio NUNCA vira silencio: vira rascunho com o motivo gravado.
        base.decisao = "blocked"
        base.motivo = str(veredito.motivo or "bloqueado")
        return base

    if gerado.output.precisa_humano:
        base.decisao = "handoff"
        base.motivo = "modelo_pediu_humano"
        return base

    # Aprovado. Em `auto` o envio entraria aqui - mas RF-027 depende de
    # mudanca no servico Node (ver docstring do modulo), entao ate a Fase 6
    # toda resposta aprovada e rascunho para a equipe.
    base.decisao = "draft"
    base.motivo = "aprovado_aguardando_envio_fase6" if modo == "auto" else "modo_suggest"
    return base
