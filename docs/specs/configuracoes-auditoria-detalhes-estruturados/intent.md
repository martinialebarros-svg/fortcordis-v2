# Intent - configuracoes-auditoria-detalhes-estruturados

Data: 2026-08-07
Responsavel: Claude (Sonnet 5)
Status: done

## 1) Problema atual

O pedido original era "UI para visualizar trilhas de auditoria dos
achados #9/#10/#12/#15/#21 (hoje só existentes no banco)". Investigando
antes de implementar, descobri que essa premissa estava PARCIALMENTE
errada: uma UI de auditoria completa já existe em
`frontend/app/configuracoes/page.tsx` (aba "Usuarios" > secao "Auditoria
de acoes"), consumindo `GET /api/v1/admin/auditoria` (que tambem ja
existia, em `backend/app/api/v1/endpoints/admin.py`), com filtros por
modulo/acao/busca/intervalo de datas e paginacao - genérica para
QUALQUER modulo do sistema, não so atendimento.

A lacuna real, confirmada lendo o codigo: a tabela renderiza
`created_at`, `usuario_nome/email`, `acao`, `modulo/entidade`,
`descricao` e `rota/metodo` - mas NUNCA renderiza `item.detalhes`
(`Record<string, any>`, ja buscado da API e tipado, so nunca exibido).
`detalhes` e exatamente onde os achados #9 (conteudo clinico), #10/#15
(alerta clinico) e #21 (documento clinico) guardam o antes/depois de
cada campo alterado (`{"alteracoes": {campo: {"antes", "depois"}}}`) -
sem isso, a tela mostra QUE algo mudou (via `descricao`, ex.: "Atendimento
#3 teve conteudo clinico atualizado: queixa_principal") mas nao O QUE
mudou de fato.

## 2) Objetivo

Completar a UI de auditoria ja existente renderizando `item.detalhes` de
forma legivel, genericamente (sem hardcoded por achado/modulo) - um
botao "Ver detalhes" por linha que expande mostrando o antes/depois
estruturado.

## 3) Nao objetivos

- Nao inclui criar uma tela nova do zero - a tela e o endpoint ja
  existiam e cobrem TODOS os modulos (agenda, financeiro, ordens de
  servico, assistente_ia, portal etc.), nao so atendimento.
- Nao inclui mudar o backend (`GET /admin/auditoria`) - `detalhes` ja
  era retornado pela API, so nao era consumido pelo frontend.
- Nao inclui uma UI de auditoria por atendimento especifico (ex.: um
  link direto de dentro de `/atendimento` para "ver auditoria deste
  atendimento") - a tela generica em `/configuracoes` com filtro por
  `modulo=atendimento` e `busca` ja cobre esse caso de uso, e criar uma
  segunda entrada de navegacao para o mesmo dado seria redundante.

## 4) Contexto e restricoes

- Restricao tecnica: `detalhes` segue exatamente 2 formatos no codigo
  (confirmado lendo todos os call sites de `registrar_auditoria` nos
  achados relevantes): `{"alteracoes": {campo: {"antes", "depois"}}}`
  para updates, ou chave-valor simples (`{"paciente_id": 9, "tipo": ...}`)
  para criacao/exclusao/estado pontual. O renderizador cobre AMBOS os
  formatos sem branch especifico por acao/modulo - generico para
  qualquer chamada futura de `registrar_auditoria` que siga o mesmo
  padrao (nao so atendimento).
- Restricao de UX: a tabela principal ja tem `overflow-x-auto` (muitas
  colunas); a linha expandida de detalhes esta dentro do mesmo scroll
  horizontal - resolvido com `position: sticky` para a mini-tabela de
  detalhes permanecer visivel mesmo com a tabela principal rolada para
  a direita (onde fica o botao "Ver detalhes").
- Restricoes de prazo: nenhuma.

## 5) Impacto esperado

- Usuarios impactados: administradores (a secao e `require_papel("admin")`
  no backend) investigando o que mudou num atendimento, alerta ou
  documento clinico.
- Modulos impactados: apenas `frontend/app/configuracoes/page.tsx`.
- Risco de regressao: minimo - aditivo (nova coluna + linha expansivel
  condicional), nenhum comportamento existente da tabela e alterado.

## 6) Riscos iniciais

- Risco 1: o corte visual residual descrito acima (sticky nao compensa
  100% o padding do `<td>` pai em todos os graus de scroll) - mitigado
  mas nao eliminado; documentado como risco residual em verify.md, nao
  bloqueia o uso (o usuario ve o essencial e pode rolar mais para a
  esquerda se precisar do restante).

## 7) Perguntas abertas

Nenhuma - implementacao concluida e validada visualmente com dados
reais (backend + frontend locais, evento real de
`ATENDIMENTO_CONTEUDO_CLINICO_ATUALIZADO` gerado por uma sessao de teste
anterior).

## 8) Definition of Ready (gate para spec)

- [x] Problema e objetivo estao claros.
- [x] Escopo e nao escopo estao explicitos.
- [x] Restricoes estao registradas.
- [x] Riscos iniciais estao mapeados.
