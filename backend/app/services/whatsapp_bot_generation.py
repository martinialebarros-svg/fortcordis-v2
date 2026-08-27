"""Orquestracao da geracao de resposta (Fase 4, P4.1-P4.5).

Fluxo de um turno:
  resolve identidade -> recorta contexto por persona -> provider pede tools
  -> executa tools escopadas -> gera resposta final -> guardrail -> decide
  (draft | blocked | suppressed)

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
from datetime import datetime, timezone
from typing import Any, Optional

from fastapi import HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.whatsapp_bot import WhatsAppBotResposta
from app.services.whatsapp_bot_context import build_safe_context
from app.services.whatsapp_bot_servico_match import AFINIDADE_EXATA
from app.services.whatsapp_bot_gates import resolve_modo_efetivo
from app.services.whatsapp_bot_guardrails import (
    GuardrailVeredito,
    avaliar_resposta,
    contar_respostas_do_dia,
    turno_a_partir_dos_resultados,
)
from app.services.whatsapp_bot_prompt import (
    build_input_payload,
    build_instructions,
    montar_historico,
    resolve_prompt_version,
)
from app.services.whatsapp_bot_providers import (
    MAX_TOOL_ROUNDS,
    WhatsAppBotProviderError,
    get_whatsapp_bot_reply_provider,
)
from app.services.whatsapp_bot_tools import (
    TOOL_SCHEMAS,
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
    clinica_id: Optional[int] = None


def _max_tokens_per_day() -> int:
    try:
        parsed = int(settings.WHATSAPP_BOT_MAX_TOKENS_PER_DAY)
    except Exception:
        parsed = 100000
    return parsed if parsed > 0 else 100000


def contar_tokens_do_dia(db: Session, *, now: Optional[datetime] = None) -> int:
    """Custo global ja registrado hoje, antes de abrir uma nova chamada paga."""
    now = now or datetime.now(timezone.utc)
    inicio_do_dia = datetime.combine(now.date(), datetime.min.time(), tzinfo=timezone.utc)
    total = (
        db.query(
            func.coalesce(func.sum(WhatsAppBotResposta.input_tokens), 0)
            + func.coalesce(func.sum(WhatsAppBotResposta.output_tokens), 0)
        )
        .filter(WhatsAppBotResposta.created_at >= inicio_do_dia)
        .scalar()
    )
    return int(total or 0)


def _somar_tokens(total: Optional[int], parcela: Optional[int]) -> Optional[int]:
    if parcela is None:
        return total
    return int(total or 0) + int(parcela)


def _argumentos_da_tool(raw: Any) -> dict[str, Any]:
    if isinstance(raw, dict):
        return raw
    try:
        parsed = json.loads(str(raw or "{}"))
    except (TypeError, ValueError, json.JSONDecodeError):
        return {}
    return parsed if isinstance(parsed, dict) else {}


def _resultado_ok(
    resultados: list[tuple[str, dict[str, Any]]], nome: str
) -> Optional[dict[str, Any]]:
    for tool_nome, resultado in reversed(resultados):
        if tool_nome == nome and isinstance(resultado, dict) and resultado.get("ok"):
            return resultado
    return None


def _aviso_plantao(quantidade: int) -> str:
    """Concordancia importa: a frase generica lista tres valores."""
    sujeito = "Esse é o valor" if quantidade == 1 else "Esses são os valores"
    return f" {sujeito} de horário comercial. Para plantão, confirme com a secretaria."

_ETIQUETA_REGIAO = {
    "fortaleza": " (tabela Clínicas Fortaleza)",
    "rm": " (tabela Região Metropolitana)",
    "domiciliar": " (tabela Atendimento Domiciliar)",
}


def _moeda(valor: Any) -> str:
    return "R$ " + str(valor or "").replace(".", ",")


def _corpo_de_preco(resultado: Optional[dict[str, Any]]) -> str:
    """Frase de preco montada a partir do payload, com o servico PEDIDO na frente.

    A versao anterior despejava `itens[:3]` numa lista unica. Como a tool
    ordenava por nome, "quanto custa o eco" respondia com tres combinacoes e
    omitia o `Ecocardiograma` avulso -- cotando mais caro que a tabela. Aqui
    a resposta segue o grau de aderencia calculado pela tool: havendo
    correspondencia exata, ela responde sozinha; so na ausencia dela e que a
    frase vira lista de opcoes.

    O par servico<->valor continua colado por construcao. O guardrail so
    confere se o NUMERO citado veio da tool; ele nao verifica a qual servico
    o numero pertence. Deixar o modelo redigir esta frase reabriria a
    possibilidade de anunciar R$ 410,00 ("Consulta + Eco") como preco do eco
    avulso -- erro de preco aprovado pelo guardrail.

    O aviso de plantao acompanha TODA resposta com valor, e nao so os servicos
    que tem `preco_*_plantao` preenchido. Em 26/08 apenas `Consulta` e
    `Eco + Eletro` tinham a coluna cadastrada; avisar so neles daria a
    entender que os outros quatro nao tem plantao, quando na verdade a celula
    esta vazia. O bot le apenas as colunas `_comercial` (RF-019), entao
    qualificar o valor citado e o unico jeito honesto de nao prometer preco de
    plantao que ele nunca consultou.
    """
    if (resultado or {}).get("orientacao") == "escolher_tipo_atendimento":
        # Fluxo que a secretaria ja pratica: pergunta o tipo de atendimento
        # antes de cotar. Com a memoria de conversa (RF-P16) o segundo turno
        # funciona -- o bot lembra qual exame foi perguntado.
        #
        # A oferta de indicar clinica por bairro so entrou aqui DEPOIS de a
        # capacidade existir (RF-P19). Antes disso a frase a omitia de
        # proposito: prometer o que o bot nao faz e pior que nao oferecer.
        return (
            "o valor depende do tipo de atendimento. Se for atendimento domiciliar, "
            "me diga que eu passo o valor. Se for na clínica, quem define o valor e a "
            "agenda é a clínica parceira — me diga seu bairro que eu indico uma perto "
            "de você."
        )

    itens = list((resultado or {}).get("itens") or [])
    if not itens:
        return ""

    # A base da cotacao fica VISIVEL sempre que vier do cadastro (persona
    # clinica). Nao e enfeite: uma clinica com `tabela_preco_id` errado passaria
    # despercebida se a frase so trouxesse o numero. Com a etiqueta, quem revisa
    # o rascunho ve a divergencia antes de enviar. Persona tutor nao recebe
    # etiqueta -- ali nao ha cadastro que possa estar errado.
    etiqueta = ""
    if (resultado or {}).get("regiao_do_cadastro"):
        etiqueta = _ETIQUETA_REGIAO.get(str((resultado or {}).get("regiao") or ""), "")

    exatos = [item for item in itens if item.get("aderencia") == AFINIDADE_EXATA]
    if exatos:
        # Responde exatamente o que foi perguntado. Combinacoes existem, mas
        # entram so se a pessoa pedir - foi o excesso de opcoes nao pedidas
        # que gerou confusao no piloto.
        escolhidos = exatos[:2]
        detalhes = " e ".join(
            f"{str(item.get('servico') or 'servico')} custa {_moeda(item.get('valor'))}"
            for item in escolhidos
        )
        return f"{detalhes}{etiqueta}.{_aviso_plantao(len(escolhidos))}"

    pedido = list((resultado or {}).get("pedido") or [])
    escolhidos = itens[:2] if pedido else itens[:3]
    detalhes = "; ".join(
        f"{str(item.get('servico') or 'servico')}: {_moeda(item.get('valor'))}"
        for item in escolhidos
    )
    if pedido:
        # Nao ha o servico avulso: as opcoes reais sao combinacoes.
        return f"esse exame entra nestas opções de tabela - {detalhes}{etiqueta}.{_aviso_plantao(len(escolhidos))}"
    return f"valores de tabela - {detalhes}{etiqueta}.{_aviso_plantao(len(escolhidos))}"


def _telefone_legivel(digitos: Any) -> str:
    """(85) 99999-9999. O guardrail compara pela cauda de digitos, entao a
    formatacao nao afeta a ancoragem."""
    d = "".join(ch for ch in str(digitos or "") if ch.isdigit())
    if len(d) == 11:
        return f"({d[:2]}) {d[2:7]}-{d[7:]}"
    if len(d) == 10:
        return f"({d[:2]}) {d[2:6]}-{d[6:]}"
    return d


def _corpo_de_clinica_proxima(resultado: Optional[dict[str, Any]]) -> str:
    """Sugestao de clinica parceira, montada do payload literal.

    Nome, endereco e telefone de TERCEIRO sao dado sensivel pela mesma razao
    que preco: o guardrail confere se o telefone veio de uma fonte, nao se
    pertence aquela clinica. Deixar o modelo redigir permitiria colar o
    telefone da clinica A no nome da clinica B e passar na RF-022.
    """
    criterio = str((resultado or {}).get("criterio") or "")
    if criterio == "precisa_bairro":
        return "me diga em que bairro você fica que eu indico a clínica parceira mais perto."
    if criterio == "sem_clinica_no_bairro":
        bairro = str((resultado or {}).get("bairro_consultado") or "").strip()
        onde = f" em {bairro}" if bairro else " nesse bairro"
        # Sem "pessoa da equipe" aqui: o sufixo da RF-024 ja diz isso logo
        # em seguida, e repetir soa a script.
        return f"não temos clínica parceira{onde} ainda."

    itens = list((resultado or {}).get("itens") or [])[:2]
    if not itens:
        return ""

    partes = []
    for item in itens:
        trecho = str(item.get("nome") or "clínica")
        bairro = item.get("bairro")
        if bairro:
            # "no bairro X" e nao "no X": o genero varia (o Centro, a Aldeota)
            # e nao ha como acerta-lo a partir do nome.
            trecho += f", no bairro {bairro}"
        cidade = item.get("cidade")
        if cidade:
            # Sem a cidade, "Centro" e ambiguo entre 5 municipios no cadastro
            # real -- e o cliente nao teria como perceber.
            trecho += f", em {cidade}"
        endereco = item.get("endereco")
        if endereco:
            trecho += f" ({endereco})"
        telefone = _telefone_legivel(item.get("telefone"))
        if telefone:
            trecho += f", telefone {telefone}"
        partes.append(trecho)

    # "mais perto" e afirmacao: so pode ser dita quando houve calculo de
    # distancia. Sem coordenadas o bot lista o que encontrou no bairro, sem
    # ordenar nada e sem prometer proximidade.
    mediu = bool((resultado or {}).get("ordenado_por_distancia"))
    if mediu:
        abertura = (
            "a clínica parceira mais perto de você é"
            if len(partes) == 1
            else "as parceiras mais perto de você são"
        )
    else:
        abertura = (
            "a clínica parceira que temos por aí é"
            if len(partes) == 1
            else "as parceiras que temos por aí são"
        )
    # Fecho neutro: "com ela" nao concordaria na variante com duas clinicas.
    return (
        f"{abertura} {'; e '.join(partes)}. "
        "O agendamento e o valor são tratados direto com a clínica."
    )

def _texto_deterministico_para_dado_sensivel(
    *, intent: str, texto_modelo: str, resultados: list[tuple[str, dict[str, Any]]]
) -> str:
    """Preco e status saem do payload literal, nao da redacao livre do modelo."""
    sufixo = " Se quiser falar com uma pessoa, é só pedir."
    if intent == "preco_servico":
        resultado = _resultado_ok(resultados, "consultar_preco_tabela")
        corpo = _corpo_de_preco(resultado)
        if corpo:
            return f"Atendimento automático da FortCordis: {corpo}{sufixo}"

    if intent == "clinica_proxima":
        corpo = _corpo_de_clinica_proxima(_resultado_ok(resultados, "buscar_clinica_parceira"))
        if corpo:
            return f"Atendimento automático da FortCordis: {corpo}{sufixo}"

    if intent == "status_laudo":
        resultado = _resultado_ok(resultados, "consultar_status_laudo")
        itens = list((resultado or {}).get("itens") or [])[:3]
        if itens:
            detalhes = []
            for item in itens:
                pet = str(item.get("pet_nome") or "pet")
                tipo = str(item.get("tipo_exame") or "exame")
                status = "está pronto" if item.get("status_cliente") == "pronto" else "ainda não está pronto"
                detalhes.append(f"{tipo} de {pet} {status}")
            return f"Atendimento automático da FortCordis: {'; '.join(detalhes)}.{sufixo}"

    return texto_modelo


def _tools_usadas_json(
    persona: str,
    resultados: list[tuple[str, dict[str, Any]]],
    *,
    fontes_declaradas: Optional[list[str]] = None,
) -> str:
    turno = turno_a_partir_dos_resultados(persona, resultados)
    return json.dumps(
        {
            "tools_tentadas": [nome for nome, _ in resultados],
            "tools_ok": turno.tools_ok,
            "fontes_declaradas": fontes_declaradas or [],
            "tem_trecho_conhecimento": turno.tem_trecho_conhecimento,
        },
        ensure_ascii=False,
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
    persona_forcada: Optional[str] = None,
    estado: Any = None,
    historico: Optional[list[dict[str, Any]]] = None,
) -> ResultadoGeracao:
    """Gera (ou recusa gerar) uma resposta para uma mensagem inbound.

    `persona_forcada` existe apenas para a SIMULACAO do painel de
    configuracao, onde nao ha cliente real: a identidade sintetica resolve
    como `not_found` e o fluxo abortaria antes de exercitar as tools. Com ela,
    a persona e assumida e o escopo de dado do cliente fica VAZIO (ids
    sinteticos que nunca casam registro), entao as tools institucionais
    funcionam e as de dado do cliente devolvem vazio - sem vazar nada de
    ninguem. Nunca use isso no caminho de atendimento real: fora da
    simulacao, persona sem identidade resolvida e handoff (RF-016).
    """
    contexto = _resolver_contexto(db, wa_identity)
    resolution = str(contexto.get("resolution") or "not_found")
    match_type, tutor_id, clinica_id = _escopo_da_persona(contexto)

    if persona_forcada in ("tutor", "clinica"):
        match_type = persona_forcada
        tutor_id = 0 if persona_forcada == "tutor" else None
        clinica_id = 0 if persona_forcada == "clinica" else None
        resolution = "simulacao"

    # RF-P04: participacao por clinica. Roda aqui, e nao junto dos portoes de
    # `_process_job`, porque `clinica_id` so existe depois de resolver a
    # identidade - e roda ANTES de tools e provider, entao barrar nao custa
    # token nem consulta de dado.
    #
    # A simulacao do painel passa direto: e ferramenta de admin sobre escopo
    # sintetico, nao atendimento a cliente real.
    if persona_forcada is None:
        # `estado` vem de `_process_job`, que ja o resolveu para os portoes -
        # passar adiante evita reconsultar a mesma linha no caminho quente.
        modo_efetivo, bloqueio_participacao = resolve_modo_efetivo(
            db,
            wa_identity=wa_identity,
            match_type=match_type,
            clinica_id=clinica_id,
            modo_atual=modo,
            estado=estado,
        )
        if bloqueio_participacao is not None:
            return ResultadoGeracao(
                decisao="suppressed",
                motivo=bloqueio_participacao,
                resolution=resolution,
                match_type=match_type,
                clinica_id=clinica_id,
            )
        modo = modo_efetivo

    # RF-025: teto diario por conversa, antes de gastar token.
    if contar_respostas_do_dia(db, wa_identity) >= int(
        settings.WHATSAPP_BOT_MAX_REPLIES_PER_CONVERSATION_DAY or 20
    ):
        return ResultadoGeracao(
            decisao="suppressed",
            motivo="teto_diario",
            resolution=resolution,
            match_type=match_type,
            clinica_id=clinica_id,
        )

    # RF-016/CA-013: sem identidade resolvida, nenhuma tool de dado roda e
    # nenhum dado de registro entra no prompt. Nesta fase isso e handoff.
    if match_type is None:
        return ResultadoGeracao(
            decisao="handoff",
            motivo="identidade_nao_resolvida",
            resolution=resolution,
            match_type=None,
            clinica_id=None,
        )

    # NFR-005: inclui drafts e bloqueios, pois ambos ja consumiram tokens.
    # Ao atingir o teto, nao abre nova chamada paga nem envia em `auto`: cria
    # um rascunho operacional para o atendimento humano continuar.
    if contar_tokens_do_dia(db) >= _max_tokens_per_day():
        return ResultadoGeracao(
            decisao="draft",
            motivo="teto_global_tokens",
            texto_gerado=(
                "Atendimento automático temporariamente direcionado para revisão da equipe."
            ),
            prompt_version=resolve_prompt_version(match_type),
            resolution=resolution,
            match_type=match_type,
            clinica_id=clinica_id,
        )

    try:
        tool_ctx = WhatsAppBotToolContext(
            db=db, match_type=match_type, tutor_id=tutor_id, clinica_id=clinica_id
        )
    except WhatsAppBotToolError:
        logger.exception("Escopo incoerente ao montar contexto de tools do bot.")
        return ResultadoGeracao(
            decisao="handoff",
            motivo="escopo_incoerente",
            resolution=resolution,
            match_type=match_type,
            clinica_id=clinica_id,
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
        resultados_de_tools=[],
        historico=montar_historico(historico),
    )

    provider = provider or get_whatsapp_bot_reply_provider()
    iniciado = time.perf_counter()
    resultados: list[tuple[str, dict[str, Any]]] = []
    continuation_input: Optional[list[Any]] = None
    input_tokens: Optional[int] = None
    output_tokens: Optional[int] = None
    tool_rounds = 0
    gerado = None
    try:
        while True:
            gerado = provider.generate(
                instructions=instructions,
                payload=payload,
                tools=list(TOOL_SCHEMAS),
                safety_scope=wa_identity,
                continuation_input=continuation_input,
            )
            input_tokens = _somar_tokens(input_tokens, gerado.input_tokens)
            output_tokens = _somar_tokens(output_tokens, gerado.output_tokens)

            if gerado.tool_calls:
                if tool_rounds >= MAX_TOOL_ROUNDS:
                    return ResultadoGeracao(
                        decisao="draft",
                        motivo="limite_rodadas_tools",
                        texto_gerado=(
                            "Atendimento automático da FortCordis: não consegui confirmar "
                            "essa informação com segurança. A equipe pode continuar o atendimento."
                        ),
                        modelo=gerado.model,
                        prompt_version=prompt_version,
                        tools_usadas=_tools_usadas_json(match_type, resultados),
                        input_tokens=input_tokens,
                        output_tokens=output_tokens,
                        latencia_ms=int((time.perf_counter() - iniciado) * 1000),
                        resolution=resolution,
                        match_type=match_type,
                        clinica_id=clinica_id,
                    )

                tool_outputs: list[dict[str, Any]] = []
                for call in gerado.tool_calls:
                    call_id = str(call.get("call_id") or "").strip()
                    nome = str(call.get("name") or "").strip()
                    if not call_id:
                        raise WhatsAppBotProviderError(
                            "Tool call sem identificador.", code="invalid_tool_call"
                        )
                    resultado_tool = execute_bot_tool(
                        tool_ctx, nome, _argumentos_da_tool(call.get("arguments"))
                    )
                    resultados.append((nome, resultado_tool))
                    tool_outputs.append(
                        {
                            "type": "function_call_output",
                            "call_id": call_id,
                            "output": json.dumps(resultado_tool, ensure_ascii=False, default=str),
                        }
                    )
                continuation_input = [*gerado.continuation_input, *tool_outputs]
                tool_rounds += 1
                continue

            if gerado.output is None:
                raise WhatsAppBotProviderError(
                    "Resposta final ausente.", code="invalid_structured_output"
                )
            break
    except WhatsAppBotProviderError as exc:
        return ResultadoGeracao(
            decisao="handoff",
            motivo=f"provider:{exc.code}",
            modelo=gerado.model if gerado is not None else None,
            prompt_version=prompt_version,
            tools_usadas=_tools_usadas_json(match_type, resultados),
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            resolution=resolution,
            match_type=match_type,
            clinica_id=clinica_id,
            latencia_ms=int((time.perf_counter() - iniciado) * 1000),
        )
    latencia_ms = int((time.perf_counter() - iniciado) * 1000)
    assert gerado is not None and gerado.output is not None

    texto_final = _texto_deterministico_para_dado_sensivel(
        intent=gerado.output.intent,
        texto_modelo=gerado.output.texto,
        resultados=resultados,
    )

    turno = turno_a_partir_dos_resultados(match_type, resultados)
    veredito: GuardrailVeredito = avaliar_resposta(
        texto=texto_final,
        intent=gerado.output.intent,
        modo=modo,
        turno=turno,
    )

    tools_usadas = _tools_usadas_json(
        match_type,
        resultados,
        fontes_declaradas=gerado.output.fontes,
    )

    base = ResultadoGeracao(
        decisao="draft",
        motivo="",
        texto_gerado=texto_final,
        modelo=gerado.model,
        prompt_version=prompt_version,
        tools_usadas=tools_usadas,
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        latencia_ms=latencia_ms,
        resolution=resolution,
        match_type=match_type,
        clinica_id=clinica_id,
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

    if modo == "auto" and not veredito.auto_elegivel:
        base.decisao = "draft"
        base.motivo = str(veredito.motivo or "intent_fora_allowlist")
        return base

    # Aprovado. Em `auto` o envio entraria aqui - mas RF-027 depende de
    # mudanca no servico Node (ver docstring do modulo), entao ate a Fase 6
    # toda resposta aprovada e rascunho para a equipe.
    base.decisao = "draft"
    base.motivo = "aprovado_aguardando_envio_fase6" if modo == "auto" else "modo_suggest"
    return base
