# Intent - atendimento-layout-mobile-prioridade

Data: 2026-08-12
Responsavel: Claude (pareado com Martiniano)
Status: em andamento

## 1) Problema atual

GitHub issue #52 ("[UX] Layout de 3 colunas só a partir de 1280px"),
origem achado #33 da auditoria UX/fluxo
(`docs/AUDITORIA-ATENDIMENTO-UX-FLUXO-2026-08-09.md`, issue de tracking
#57): o grid de colunas (`.fc-care-layout`) so ativa o breakpoint `xl`
(1280px). Abaixo disso, a pagina empilha em coluna unica na ORDEM DO
DOM: primeiro o painel de casos (`.fc-care-sidebar` - filtros, busca,
lista paginada, prontuario longitudinal, dinamica de peso), so depois
o workspace clinico (`.fc-care-workspace` - abas + editor). Nao havia
nenhuma classe `order-*` para reordenar por prioridade em telas
estreitas.

Em notebook menor (1366x768 com navegador nao maximizado), janela em
split-screen ou tablet em paisagem - cenarios comuns em consultorio -
o veterinario precisa rolar por todo o painel de casos antes de
alcancar o editor da consulta que esta tentando preencher.

## 2) Objetivo

A auditoria oferece 2 alternativas ("e/ou"): baixar o breakpoint do
grid para `lg` (1024px), e/ou aplicar `order-*` para priorizar o
workspace quando empilhado.

Optei pela segunda: `.fc-care-workspace` recebe `order-1` e
`.fc-care-sidebar` recebe `order-2` (ambos com `xl:order-none` para
reverter ao comportamento atual em telas grandes) - o workspace
clinico passa a aparecer visualmente ANTES do painel de casos sempre
que a pagina estiver empilhada em coluna unica (abaixo de `xl`), sem
exigir rolagem pelo painel de casos para alcancar as abas clinicas.

## 3) Por que reordenar em vez de baixar o breakpoint

O pacote anterior desta mesma auditoria (`atendimento-header-fixo`,
achado #20) fez o header e o painel de casos ficarem `sticky` **so a
partir do breakpoint `xl`**, com offsets (`xl:top-[500px]`,
`xl:top-[488px]`, `xl:max-h-[calc(100vh-516px)]`) calculados
especificamente para a altura do header no breakpoint `xl` (calibrados
com margem de seguranca apos 2 rodadas de revisao adversarial - ver
`docs/specs/atendimento-header-fixo/`).

Baixar o breakpoint do GRID para `lg` (1024px) sem tambem revisar e
recalibrar TODOS esses offsets de `sticky` para `lg` criaria uma faixa
de largura (1024px-1279px) onde as colunas jah aparecem lado a lado,
mas o comportamento sticky do header/sidebar so ativaria em 1280px -
um estado hibrido inconsistente, exigindo uma nova rodada de medicao e
calibracao de offsets (o mesmo trabalho sensivel que exigiu 2 rodadas
de revisao adversarial no pacote #20).

Reordenar via `order-*` resolve a friccao central descrita pela
auditoria ("rolar pelo painel de casos antes de chegar as abas
clinicas") sem tocar em nenhum breakpoint ou offset de `sticky` ja
calibrado - mudanca de 2 linhas, isolada, sem reabrir a calibracao
delicada do pacote #20.

## 4) Nao objetivos

- Nao altera o breakpoint do grid (`xl:grid-cols-12` permanece em
  `xl`) - so a ordem visual dos 2 itens quando empilhados.
- Nao altera nenhum offset ou breakpoint de `sticky` do pacote
  `atendimento-header-fixo` (achado #20).
- Nao torna o painel de casos colapsavel/oculto por padrao abaixo de
  `xl` (a auditoria sugere isso como parte da alternativa "baixar o
  breakpoint", nao como requisito da alternativa de reordenacao
  escolhida aqui) - o painel de casos continua com sua visibilidade
  atual (controlada por `painelCasosAberto`, independente deste
  pacote), so aparece DEPOIS do workspace quando aberto e empilhado.
