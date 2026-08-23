"""Tools do chatbot de atendimento do WhatsApp (Fase 4, RF-018).

Modulo PROPRIO, deliberadamente separado de `assistente_ia_tools.py`. As 25
tools do assistente interno rodam com autoridade de staff: a autorizacao
delas mora no endpoint (`require_papel("admin")`), nao nas tools, e o
redator `tool_result_for_model` falha ABERTO (devolve o payload cru para 23
dos 25 nomes). Instanciar aquele contexto aqui reproduziria alcance de admin
sem gate nenhum.

As regras estruturais deste modulo:

- O escopo (`tutor_id` / `clinica_id`) vem do contexto Python resolvido pela
  Fase 3, nunca de argumento do modelo. O LLM nao ve esses parametros no
  schema das tools.
- Cada tool injeta o filtro de escopo no proprio query.
- A allowlist e POR PERSONA e consultada antes do dispatch; nome fora dela
  falha fechado.
- Todo payload de retorno e montado campo a campo (whitelist por
  construcao). Nunca serializa ORM, nunca faz `**vars(obj)`.
"""
from __future__ import annotations

import logging
import unicodedata
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import Any, Callable, Literal, Optional

from sqlalchemy import String, cast, func, or_
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.portal_release import (
    PORTAL_RELEASED_EXAM_STATUSES,
    PORTAL_RELEASED_LAUDO_STATUSES,
)
from app.models.atendimento_clinico import AtendimentoClinico
from app.models.configuracao import Configuracao
from app.models.laudo import Exame, Laudo
from app.models.paciente import Paciente
from app.models.servico import Servico

# Reuso legitimo: helpers PUROS de agenda, que recebem so db/date e nao
# carregam autoridade de staff nem entram em TOOL_DEFINITIONS. Precedente ja
# na branch: whatsapp_bot_handoff_service.py faz o mesmo import.
from app.services.assistente_ia_tools import (
    LOCAL_TZ,
    _agenda_configuration_rules,
    _agenda_day_window,
)

logger = logging.getLogger(__name__)

MAX_SERVICOS_NO_PAYLOAD = 8
MAX_LAUDOS_NO_PAYLOAD = 6
MAX_TRECHOS_CONHECIMENTO = 3
EXCERPT_MAX_CHARS = 500

# Pisos de relevancia, um por ESCALA de sinal. `search_knowledge` mistura dois
# sinais em `score` (0.35 * keyword_normalizado + 0.65 * cosseno), e a
# normalizacao lexical divide pelo maior keyword_score do lote - o melhor hit
# lexical vale SEMPRE exatamente 0.35, independente de ter casado um termo ou
# vinte. Por isso um piso sobre `score` nao mede relevancia absoluta.
#
# Regressao real: a primeira versao deste modulo comparava `score` contra 2.0,
# que e inalcancavel (o teto de `score` e 1.0). O resultado foi
# `buscar_conhecimento_institucional` devolvendo ok=False para toda pergunta e
# todo documento, o que deixava `area_atendimento`, `como_agendar` e
# `como_solicitar_exame` permanentemente em `sem_fonte`. Nenhum teste ligava o
# wrapper ao retorno real de `search_knowledge`, e o bug atravessou tres fases.
# `test_whatsapp_bot_conhecimento.py` agora fecha esse caminho.

# keyword_score e absoluto: 5 por termo casado no titulo, 1 por termo no
# conteudo. 2.0 = ao menos dois casamentos no corpo, ou um no titulo.
CONHECIMENTO_KEYWORD_SCORE_MINIMO = 2.0
# semantic_score e cosseno. O piso interno do buscador semantico e 0.20;
# aqui subimos um pouco porque a resposta vai para cliente.
CONHECIMENTO_SEMANTIC_SCORE_MINIMO = 0.25

# A base de conhecimento e COMPARTILHADA com o assistente interno e nao tem
# coluna de audiencia; o default de categoria em toda a cadeia de criacao e
# "manual", o balde onde ja mora procedimento clinico de staff. Por isso a
# audiencia do bot e explicita por categoria, e "manual" NAO entra: alargar o
# balde default faria manual clinico interno alimentar resposta a cliente.
#
# O casamento e tolerante de proposito (acento, caixa, espaco, hifen,
# underscore e sufixo livre), porque a UI de admin e um campo de texto livre -
# quem digita "Institucional - Tutor" quer o mesmo que "institucional_tutor".
CATEGORIAS_INSTITUCIONAIS = frozenset({
    "institucional",
    "atendimento",
})


def _categoria_e_institucional(categoria: Any) -> bool:
    normalizada = _normalizar(categoria).replace("-", " ").replace("_", " ")
    if not normalizada:
        return False
    primeira = normalizada.split()[0]
    return primeira in CATEGORIAS_INSTITUCIONAIS


# Status de laudo/exame que o cliente pode ver. Nunca escrever
# "Liberado no portal" na mao - `Laudo.status` mistura ciclo clinico e
# publicacao, e "Finalizado" NAO e "pronto".
_RELEASED_EXAM = tuple(PORTAL_RELEASED_EXAM_STATUSES)
_RELEASED_LAUDO = tuple(PORTAL_RELEASED_LAUDO_STATUSES)


class WhatsAppBotToolError(RuntimeError):
    """Erro de uso das tools do bot (escopo incoerente, persona invalida)."""


@dataclass(frozen=True)
class WhatsAppBotToolContext:
    """Escopo imutavel de uma conversa.

    Escopo que pode ser None e escopo que vaza: o `__post_init__` recusa
    contexto incoerente em vez de escolher um lado silenciosamente.
    """

    db: Session
    match_type: Literal["tutor", "clinica"]
    tutor_id: Optional[int] = None
    clinica_id: Optional[int] = None

    def __post_init__(self) -> None:
        if self.match_type not in ("tutor", "clinica"):
            raise WhatsAppBotToolError(f"match_type invalido: {self.match_type!r}")
        if self.match_type == "tutor":
            if self.tutor_id is None:
                raise WhatsAppBotToolError("Persona tutor exige tutor_id resolvido.")
            if self.clinica_id is not None:
                raise WhatsAppBotToolError("Persona tutor nao pode carregar clinica_id.")
        else:
            if self.clinica_id is None:
                raise WhatsAppBotToolError("Persona clinica exige clinica_id resolvido.")
            if self.tutor_id is not None:
                raise WhatsAppBotToolError("Persona clinica nao pode carregar tutor_id.")


def _legacy_active(column):
    """Mesmo criterio de `whatsapp_contexto._legacy_active`: NULL e ativo.

    Escolhido de proposito para casar com a resolucao de identidade que
    trouxe a conversa ate aqui (o portal usa `== 1`, mais estrito). Coberto
    por teste.
    """
    return func.lower(func.coalesce(cast(column, String), "1")).in_(["1", "true", "t"])


def _normalizar(value: Any) -> str:
    raw = str(value or "").strip().lower()
    decomposed = unicodedata.normalize("NFKD", raw)
    return "".join(char for char in decomposed if not unicodedata.combining(char))


def _to_iso(value: Any) -> Optional[str]:
    if value is None:
        return None
    return value.isoformat() if hasattr(value, "isoformat") else str(value)


def _configuracao(db: Session) -> Optional[Configuracao]:
    """Leitura padronizada.

    `Configuracao` nao tem unique constraint e o codebase a le de tres
    formas diferentes; `order_by(id.asc())` casa com
    `_agenda_configuration_rules`, para horario e endereco nao vierem de
    registros distintos. Nunca cria a linha a partir do worker.
    """
    return db.query(Configuracao).order_by(Configuracao.id.asc()).first()


# --------------------------------------------------------------------------
# Tools
# --------------------------------------------------------------------------


def consultar_horario_funcionamento(
    ctx: WhatsAppBotToolContext, *, data: Optional[str] = None
) -> dict[str, Any]:
    """Janela operacional da agenda para uma data.

    `_agenda_day_window` devolve `inicio`/`fim` preenchidos MESMO quando
    `ativo` e False (feriado herda a janela semanal). Por isso o horario so
    entra no payload quando `ativo` e True - senao o bot diria "hoje
    funcionamos de 08:00 as 14:00" num feriado.
    """
    hoje = datetime.now(LOCAL_TZ).date()
    if data:
        try:
            referencia = date.fromisoformat(str(data).strip())
        except ValueError:
            return {"ok": False, "error": "Data invalida. Use o formato AAAA-MM-DD."}
        # O bot nao precisa responder sobre daqui a um ano.
        if not (hoje - timedelta(days=1) <= referencia <= hoje + timedelta(days=30)):
            return {"ok": False, "error": "Data fora da janela consultavel."}
    else:
        referencia = hoje

    exceptions, weekly, holidays = _agenda_configuration_rules(ctx.db)
    janela = _agenda_day_window(
        referencia, exceptions=exceptions, weekly=weekly, holidays=holidays
    )
    aberto = bool(janela.get("ativo"))
    return {
        "ok": True,
        "data": janela.get("data"),
        "aberto": aberto,
        "inicio": janela.get("inicio") if aberto else None,
        "fim": janela.get("fim") if aberto else None,
        "motivo_fechado": None if aberto else (janela.get("motivo") or "fora do expediente"),
        "fonte": janela.get("fonte"),
    }


def consultar_dados_institucionais(ctx: WhatsAppBotToolContext) -> dict[str, Any]:
    """Endereco, telefone e contato publicos, de `Configuracao`.

    Nunca use `DEFAULT_AGENDA_ROTA_REGRAS["base"]`: e o endereco da base
    operacional (residencial), nao endereco institucional publicavel. E
    nunca `horario_comercial_inicio/fim`, que sao legados e contradizem a
    agenda real.
    """
    config = _configuracao(ctx.db)
    if config is None:
        return {"ok": False, "error": "Dados institucionais nao configurados."}
    return {
        "ok": True,
        "nome_empresa": config.nome_empresa or None,
        "endereco": config.endereco or None,
        "telefone": config.telefone or None,
        "email": config.email or None,
        "cidade": config.cidade or None,
        "estado": config.estado or None,
        "website": config.website or None,
    }


_REGIAO_COLUNAS = {
    "fortaleza": "preco_fortaleza_comercial",
    "rm": "preco_rm_comercial",
    "domiciliar": "preco_domiciliar_comercial",
}


def consultar_preco_tabela(
    ctx: WhatsAppBotToolContext,
    *,
    servico_nome: Optional[str] = None,
    regiao: str = "fortaleza",
) -> dict[str, Any]:
    """Preco de TABELA, lido direto das colunas de `Servico`.

    Deliberadamente NAO usa `calcular_preco_servico`: ela prioriza o preco
    negociado da clinica por design, e `usar_preco_clinica=False` nao a
    torna independente de clinica (a tabela ainda e escolhida por
    `clinica.tabela_preco_id`). Com `clinica_id=None` ela levanta
    HTTPException(404), que escaparia do worker como resposta HTTP.

    A assinatura nao tem parametro de clinica em NENHUMA persona: a RF-019
    autoriza "preco de servico em tabela" para as duas, e repasse/negociacao
    esta fora da allowlist. Vazamento de preco negociado fica impossivel por
    construcao, nao por instrucao de prompt.
    """
    chave = _normalizar(regiao) or "fortaleza"
    coluna = _REGIAO_COLUNAS.get(chave)
    if coluna is None:
        return {"ok": False, "error": "Regiao invalida para consulta de preco."}

    query = ctx.db.query(Servico).filter(_legacy_active(Servico.ativo))
    if servico_nome:
        alvo = _normalizar(servico_nome)
        candidatos = [s for s in query.order_by(Servico.nome.asc()).all() if alvo in _normalizar(s.nome)]
    else:
        candidatos = query.order_by(Servico.nome.asc()).limit(MAX_SERVICOS_NO_PAYLOAD).all()

    itens: list[dict[str, Any]] = []
    for servico in candidatos[:MAX_SERVICOS_NO_PAYLOAD]:
        bruto = getattr(servico, coluna, None)
        try:
            valor = Decimal(str(bruto)) if bruto is not None else Decimal("0")
        except Exception:
            valor = Decimal("0")
        # `to_decimal` do precos_service converte NULL em 0.00 em silencio, e
        # "R$ 0,00" e um resultado alcancavel. Servico sem preco configurado
        # nao entra no payload - sem valor nao ha o que afirmar.
        if valor <= 0:
            continue
        itens.append({
            "servico": servico.nome,
            "valor": f"{valor:.2f}",
            "regiao": chave,
            "tipo_horario": "comercial",
            "fonte": f"tabela:{coluna}",
        })

    if not itens:
        return {"ok": False, "error": "Nenhum servico com preco de tabela configurado para essa consulta."}
    return {"ok": True, "itens": itens, "total": len(itens)}


def _status_cliente(exame_status: Any, laudo_status: Any) -> str:
    """Colapsa o estado interno em binario para o cliente (RF-019).

    So `Liberado no portal` conta como pronto. "Finalizado" e
    `aguardando_liberacao`, e dizer "pronto" nesse estado seria prometer um
    documento que o cliente nao consegue abrir.
    """
    if str(exame_status or "").strip() in _RELEASED_EXAM:
        return "pronto"
    if str(laudo_status or "").strip() in _RELEASED_LAUDO:
        return "pronto"
    return "ainda_nao"


def consultar_status_laudo(
    ctx: WhatsAppBotToolContext, *, pet_nome: Optional[str] = None
) -> dict[str, Any]:
    """Status binario de laudo/exame no escopo da conversa.

    A liberacao e por EXAME e o filtro do portal e um OR assimetrico
    (`_portal_exam_release_filter`): consultar so `Laudo.status` perde os
    exames de atendimento liberados que nunca tocam a tabela `laudos`, e so
    `Exame.status` perde o caso inverso. Por isso o outerjoin duplo.

    Nenhum campo clinico entra no payload - sem `descricao`, `diagnostico`,
    `observacoes`, `resultado`, `valor_referencia`, `titulo` (texto livre) e
    sem `anexos` (que carrega blob de medidas estruturadas).
    """
    query = (
        ctx.db.query(
            Exame.tipo_exame,
            Exame.status,
            Exame.data_solicitacao,
            Laudo.status.label("laudo_status"),
            Paciente.nome.label("pet_nome"),
        )
        .outerjoin(Laudo, Laudo.id == Exame.laudo_id)
        .join(Paciente, Paciente.id == Exame.paciente_id)
        .filter(_legacy_active(Paciente.ativo))
    )

    if ctx.match_type == "tutor":
        query = query.filter(Paciente.tutor_id == ctx.tutor_id)
    else:
        # `Laudo` nao tem tutor_id e o vinculo com clinica as vezes so existe
        # via AtendimentoClinico - o portal usa exatamente este OR.
        query = query.outerjoin(
            AtendimentoClinico, AtendimentoClinico.id == Exame.atendimento_id
        ).filter(
            or_(
                AtendimentoClinico.clinica_id == ctx.clinica_id,
                Laudo.clinic_id == ctx.clinica_id,
            )
        )

    if pet_nome:
        # Refinamento DENTRO do conjunto ja escopado. `pet_nome` vem do
        # modelo, portanto nunca e criterio de autorizacao - se nao casar
        # nada, o resultado e vazio, nunca o conjunto inteiro.
        alvo = _normalizar(pet_nome)
        rows = [row for row in query.order_by(Exame.id.desc()).all() if alvo in _normalizar(row.pet_nome)]
    else:
        rows = query.order_by(Exame.id.desc()).limit(MAX_LAUDOS_NO_PAYLOAD).all()

    itens: list[dict[str, Any]] = []
    for row in rows[:MAX_LAUDOS_NO_PAYLOAD]:
        itens.append({
            "tipo_exame": row.tipo_exame or "exame",
            "pet_nome": row.pet_nome,
            "status_cliente": _status_cliente(row.status, row.laudo_status),
            "data_solicitacao": _to_iso(row.data_solicitacao),
        })

    if not itens:
        # Sem registro NAO e "ainda nao": negar existencia de exame que pode
        # existir em outro escopo seria afirmar algo sem fonte.
        return {"ok": False, "error": "Nenhum exame encontrado no escopo desta conversa."}
    return {"ok": True, "itens": itens, "total": len(itens)}


def _trecho_relevante(item: dict[str, Any]) -> bool:
    """Relevancia avaliada na escala PROPRIA de cada sinal.

    Aceita o item se ele qualifica por palavra-chave OU por semantica. Um
    item achado so pela semantica tem `keyword_score == 0`, e um achado so
    lexicalmente tem `semantic_score is None` - avaliar os dois pelo mesmo
    numero rejeitaria metade dos acertos legitimos.
    """
    try:
        keyword_score = float(item.get("keyword_score") or 0)
    except (TypeError, ValueError):
        keyword_score = 0.0
    try:
        semantic_score = float(item.get("semantic_score") or 0)
    except (TypeError, ValueError):
        semantic_score = 0.0
    return (
        keyword_score >= CONHECIMENTO_KEYWORD_SCORE_MINIMO
        or semantic_score >= CONHECIMENTO_SEMANTIC_SCORE_MINIMO
    )


def buscar_conhecimento_institucional(
    ctx: WhatsAppBotToolContext, *, consulta: str
) -> dict[str, Any]:
    """Wrapper filtrado sobre `search_knowledge`.

    `search_knowledge` e read-only e sem `current_user`, entao chamar e
    legitimo - o que a RF-018 proibe e `consultar_conhecimento_interno` de
    `assistente_ia_tools`. Mas a base tem escopo ZERO, nao tem coluna de
    audiencia e contem procedimento clinico de staff. Daí os tres filtros:
    categoria institucional, `source` obrigatoria (RF-020 exige fonte citavel
    e a coluna e nullable) e piso de relevancia por escala.

    Todo descarte e CONTADO e devolvido em `descartados`. Sem isso, um admin
    que cadastra o documento com a categoria default (`manual`) ou sem fonte
    ve o bot responder "nao sei" sem nenhuma pista do motivo - foi exatamente
    o que aconteceu na primeira versao deste modulo.
    """
    from app.services.assistente_ia_management import search_knowledge

    texto = str(consulta or "").strip()
    if len(texto) < 3:
        return {
            "ok": False,
            "error": "Consulta muito curta para a base institucional.",
            "motivo": "consulta_curta",
        }

    try:
        resultado = search_knowledge(ctx.db, query=texto, limit=10)
    except Exception:
        logger.exception("Falha ao consultar a base institucional para o bot do WhatsApp.")
        return {
            "ok": False,
            "error": "Base institucional indisponivel.",
            "motivo": "base_indisponivel",
        }

    # Retorno bifurcado: no ramo de falha nao existe a chave `items`.
    if not resultado.get("ok"):
        return {
            "ok": False,
            "error": "Nada encontrado na base institucional.",
            "motivo": "sem_resultado_na_busca",
            "descartados": {},
        }

    descartados = {"categoria": 0, "sem_fonte": 0, "pouco_relevante": 0}
    trechos: list[dict[str, Any]] = []
    for item in resultado.get("items") or []:
        if not isinstance(item, dict):
            continue
        if not _categoria_e_institucional(item.get("category")):
            descartados["categoria"] += 1
            continue
        fonte = str(item.get("source") or "").strip()
        if not fonte:
            descartados["sem_fonte"] += 1
            continue
        if not _trecho_relevante(item):
            descartados["pouco_relevante"] += 1
            continue
        try:
            score = float(item.get("score") or 0)
        except (TypeError, ValueError):
            score = 0.0
        trechos.append({
            "document_id": item.get("document_id"),
            # `chunk_id` so existe no caminho semantico.
            "chunk_id": item.get("chunk_id"),
            "titulo": item.get("title"),
            "fonte": fonte,
            "trecho": str(item.get("excerpt") or "")[:EXCERPT_MAX_CHARS],
            "score": score,
            "retrieval": item.get("retrieval"),
        })
        if len(trechos) >= MAX_TRECHOS_CONHECIMENTO:
            break

    if not trechos:
        if any(descartados.values()):
            logger.info(
                "Base institucional tinha candidatos mas todos foram descartados "
                "(categoria=%s, sem_fonte=%s, pouco_relevante=%s).",
                descartados["categoria"],
                descartados["sem_fonte"],
                descartados["pouco_relevante"],
            )
        return {
            "ok": False,
            "error": "Nada encontrado na base institucional.",
            "motivo": "todos_descartados" if any(descartados.values()) else "sem_candidato",
            "descartados": descartados,
        }
    return {
        "ok": True,
        "trechos": trechos,
        "total": len(trechos),
        "descartados": descartados,
    }


# --------------------------------------------------------------------------
# Allowlist por persona e dispatcher
# --------------------------------------------------------------------------

_TOOLS_COMUNS: dict[str, Callable[..., dict[str, Any]]] = {
    "consultar_horario_funcionamento": consultar_horario_funcionamento,
    "consultar_dados_institucionais": consultar_dados_institucionais,
    "consultar_preco_tabela": consultar_preco_tabela,
    "consultar_status_laudo": consultar_status_laudo,
    "buscar_conhecimento_institucional": buscar_conhecimento_institucional,
}

# Allowlist e DADO, por persona, consultada antes do dispatch - para a
# classificacao poder ser testada sem chamar o modelo e para uma tool nova
# nao entrar por descuido numa persona.
TOOLS_POR_PERSONA: dict[str, dict[str, Callable[..., dict[str, Any]]]] = {
    "tutor": dict(_TOOLS_COMUNS),
    "clinica": dict(_TOOLS_COMUNS),
}

# Schemas expostos ao modelo. Nenhum tem tutor_id/clinica_id: o escopo vem
# do contexto Python. Formato flat da API Responses, com todo campo
# opcional listado em `required` e tipo uniao - `strict: True` exige isso.
TOOL_SCHEMAS: list[dict[str, Any]] = [
    {
        "type": "function",
        "name": "consultar_horario_funcionamento",
        "description": "Horario de funcionamento da FortCordis numa data (default: hoje).",
        "strict": True,
        "parameters": {
            "type": "object",
            "properties": {"data": {"type": ["string", "null"], "description": "AAAA-MM-DD"}},
            "required": ["data"],
            "additionalProperties": False,
        },
    },
    {
        "type": "function",
        "name": "consultar_dados_institucionais",
        "description": "Endereco, telefone, e-mail e cidade publicos da FortCordis.",
        "strict": True,
        "parameters": {"type": "object", "properties": {}, "required": [], "additionalProperties": False},
    },
    {
        "type": "function",
        "name": "consultar_preco_tabela",
        "description": "Preco de tabela de servicos. Nunca preco negociado nem repasse.",
        "strict": True,
        "parameters": {
            "type": "object",
            "properties": {
                "servico_nome": {"type": ["string", "null"]},
                "regiao": {"type": ["string", "null"], "description": "fortaleza | rm | domiciliar"},
            },
            "required": ["servico_nome", "regiao"],
            "additionalProperties": False,
        },
    },
    {
        "type": "function",
        "name": "consultar_status_laudo",
        "description": "Se o laudo/exame esta pronto. Devolve apenas pronto ou ainda_nao, sem conteudo do laudo.",
        "strict": True,
        "parameters": {
            "type": "object",
            "properties": {"pet_nome": {"type": ["string", "null"]}},
            "required": ["pet_nome"],
            "additionalProperties": False,
        },
    },
    {
        "type": "function",
        "name": "buscar_conhecimento_institucional",
        "description": "Busca informacao institucional (como agendar, area de atendimento, fluxo de exame) na base interna.",
        "strict": True,
        "parameters": {
            "type": "object",
            "properties": {"consulta": {"type": "string"}},
            "required": ["consulta"],
            "additionalProperties": False,
        },
    },
]


def execute_bot_tool(
    ctx: WhatsAppBotToolContext, nome: str, argumentos: dict[str, Any] | None = None
) -> dict[str, Any]:
    """Dispatcher que falha FECHADO.

    Nome fora da allowlist DAQUELA persona nao roda - e nao basta estar na
    uniao das duas. Argumentos sao validados aqui porque com provider fake
    (testes) a garantia do `strict: True` da OpenAI desaparece.
    """
    permitidas = TOOLS_POR_PERSONA.get(ctx.match_type) or {}
    funcao = permitidas.get(str(nome or "").strip())
    if funcao is None:
        return {"ok": False, "error": "Ferramenta nao disponivel para esta conversa."}

    argumentos = argumentos if isinstance(argumentos, dict) else {}
    limpos = {
        chave: valor
        for chave, valor in argumentos.items()
        if chave in {"data", "servico_nome", "regiao", "pet_nome", "consulta"}
        and valor is not None
    }
    try:
        return funcao(ctx, **limpos)
    except TypeError:
        return {"ok": False, "error": "Argumentos invalidos para a ferramenta."}
    except Exception:
        logger.exception("Falha ao executar tool %s do bot de atendimento WhatsApp.", nome)
        return {"ok": False, "error": "Falha ao consultar o dado solicitado."}
