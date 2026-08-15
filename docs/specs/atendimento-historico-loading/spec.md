# Spec - atendimento-historico-loading

Data: 2026-08-12
Responsavel: Claude (pareado com Martiniano)
Status: done

## 1) Escopo funcional

`abrirAtendimento` ganha um estado de loading por item
(`abrindoAtendimentoId: number | null`). As listas que chamam
`abrirAtendimento` a partir de um clique ("Atendimentos recentes" em
`page.tsx`; "Historico terapeutico preservado" em
`AtendimentoPrescricaoHistorySection.tsx`) mostram `Loader2` no item sendo
aberto e desabilitam a interacao com os demais itens enquanto a requisicao
esta em andamento. Nenhuma mudanca de backend.

## 2) Requisitos funcionais (RF)

- RF-001: novo estado `abrindoAtendimentoId` em `page.tsx`, setado com o
  `id` no inicio de `abrirAtendimento` (apos o guard de confirmacao de
  rascunho, junto com o incremento de `abrirAtendimentoRequestIdRef`).
- RF-002: `abrindoAtendimentoId` e limpo (`null`) num bloco `finally`,
  **somente** quando `requestId === abrirAtendimentoRequestIdRef.current`
  no momento da limpeza - mesma condicao de invalidacao ja usada nos 2
  pontos de retorno antecipado da funcao.
- RF-003: na lista "Atendimentos recentes" (`page.tsx`), o item cujo
  `item.id === abrindoAtendimentoId` mostra um icone `Loader2` (`animate-spin`)
  ao lado do badge de status; o botao de abrir desse item e de todos os
  outros fica `disabled` enquanto `abrindoAtendimentoId !== null`.
- RF-004: os demais itens da mesma lista (id diferente de
  `abrindoAtendimentoId`) ganham `pointer-events-none` e opacidade reduzida
  enquanto `abrindoAtendimentoId !== null`, bloqueando tambem os botoes
  "Laudar"/"Excluir" desses itens (nao so o de abrir).
- RF-005: no botao "Abrir original" de
  `AtendimentoPrescricaoHistorySection.tsx`, o icone `ArrowUpRight` e
  substituido por `Loader2` (`animate-spin`) quando
  `abrindoAtendimentoId === atendimento.id`; o botao fica `disabled`
  enquanto `abrindoAtendimentoId !== null` (proprio item ou outro).

## 3) Requisitos nao funcionais (NFR)

- NFR-001 (sem corrida entre loading e dados aplicados): a limpeza do
  loading usa a mesma guarda de `requestId` que ja protege a aplicacao dos
  dados - impossivel o loading indicar "pronto" antes ou depois da hora
  certa em relacao a qual resposta foi de fato aplicada.
- NFR-002 (sem chamada de API nova): toda a logica e client-side, sobre o
  fluxo existente de `abrirAtendimento`.
- NFR-003 (nao invasivo a logica de negocio): a hidratacao do formulario, a
  recuperacao de backup local e o guard de rascunho nao salvo de
  `abrirAtendimento` permanecem exatamente como antes.

## 4) Contratos tecnicos

### API

- Nenhuma mudanca.

### Banco/migracoes

- Nenhuma.

### Frontend

- `frontend/app/atendimento/page.tsx`:
  - Novo estado: `abrindoAtendimentoId`.
  - `abrirAtendimento`: `setAbrindoAtendimentoId(id)` logo apos incrementar
    `abrirAtendimentoRequestIdRef.current`; `finally` guardado limpando o
    estado.
  - Lista "Atendimentos recentes": Loader2 condicional, `disabled` nos
    botoes, `pointer-events-none opacity-60` nos demais itens.
  - Novo prop passado para `AtendimentoPrescricaoHistorySection`:
    `abrindoAtendimentoId`.
- `frontend/app/atendimento/components/AtendimentoPrescricaoHistorySection.tsx`:
  - Novo prop consumido: `abrindoAtendimentoId`.
  - Novo import: `Loader2` (de `lucide-react`).
  - Botao "Abrir original": icone condicional, `disabled` condicional.

## 5) Compatibilidade e rollout

- Backward compatibility: sim - mudanca puramente de apresentacao/feedback;
  a logica de dados de `abrirAtendimento` nao muda.
- Estrategia de rollback: reverter o commit. Sem estado persistido no
  backend.

## 6) Criterios de aceitacao (CA)

- CA-001: clicar num item da lista "Atendimentos recentes" mostra
  `Loader2` nesse item imediatamente, antes da resposta do servidor chegar.
- CA-002: enquanto o loading esta ativo, os demais itens da lista ficam
  visualmente atenuados e nao respondem a clique (incluindo os botoes
  "Laudar"/"Excluir").
- CA-003: apos a resposta chegar (sucesso ou erro), o loading desaparece e
  a lista volta ao estado normal e interativo.
- CA-004: clicar em "Abrir original" no historico de receitas
  (`AtendimentoPrescricaoHistorySection`) mostra o mesmo comportamento
  (icone de loading, botao desabilitado durante a requisicao).
- CA-005: dois cliques rapidos em itens diferentes nao deixam o indicador
  de loading preso no item errado - o loading sempre reflete o clique mais
  recente, mesmo que a resposta do clique mais antigo chegue depois.
- CA-006: `npx tsc --noEmit` e `npm run build` do frontend aprovados sem
  novos erros/warnings.

## 7) Casos de borda

- CB-001: clicar no MESMO item que ja esta selecionado (`selecionado ===
  item.id`) ainda mostra o loading normalmente enquanto a requisicao de
  reabertura esta em andamento (nao ha atalho que pule a chamada de rede).
- CB-002: o guard de confirmacao de rascunho nao salvo (antes do
  `abrirAtendimentoRequestIdRef` incrementar) continua rodando ANTES do
  loading aparecer - cancelar a confirmacao nao ativa nenhum loading
  visual, corretamente.

## 8) Fora de escopo

- Loading no botao "Registrar Evolucao" (`AtendimentoDocumentosSection.tsx`)
  alem do que ja se aplica organicamente via `abrindoAtendimentoId`.
- Loading no botao "Usar em novo atendimento" (`herdarAtendimentoAnterior`).
- Qualquer mudanca no mecanismo de invalidacao de corrida
  (`abrirAtendimentoRequestIdRef`).
