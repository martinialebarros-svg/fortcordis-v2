# Plan - atendimento-layout-mobile-prioridade

Data: 2026-08-12
Responsavel: Claude (pareado com Martiniano)
Status: em andamento

## 1) Sequencia de fases

- Fase 1 (frontend): `order-*`/`xl:order-none` em `.fc-care-sidebar` e
  `.fc-care-workspace` (2 linhas).
- Fase 2 (verificacao): `tsc`/`build`, verificacao visual em 2
  larguras (1024px estreito, 1440px desktop), confirmacao de que o
  sticky do #20 continua intacto, revisao adversarial, `verify.md`.

## 2) Tarefas por fase

### Fase 1

- [x] T1.1 `page.tsx`, `.fc-care-sidebar`: adicionar `order-2
  xl:order-none`.
- [x] T1.2 `page.tsx`, `.fc-care-workspace`: adicionar `order-1
  xl:order-none`.
- Criterio de conclusao: `tsc --noEmit` limpo, `npm run build` verde.
- Risco: baixo - `order` CSS puro, nao interfere com `col-span`/grid-
  template, nao tocado no #20.

### Fase 2

- [x] T2.1 `npx tsc --noEmit` e `npm run build` no worktree - ambos
  limpos.
- [x] T2.2 Verificacao visual via preview local (login por `fetch()`
  autenticado + `localStorage`, mesmo padrao dos pacotes anteriores
  desta sessao onde o clique do Browser tool ficou instavel):
  - 1024px, aba Consulta, painel de casos aberto: `.fc-care-workspace`
    (`getBoundingClientRect().top = 622.5`, `order` computado = `1`)
    renderiza ANTES de `.fc-care-sidebar` (`top = 4590`, `order`
    computado = `2`) - confirmado via DOM, a friccao da auditoria
    (rolar pelo painel de casos antes do editor) eliminada.
  - 1440px (`xl`+): ambos com `order` computado = `0`
    (`xl:order-none` revertendo corretamente); `.fc-care-sidebar.left
    = 280` e `.fc-care-workspace.left = 570`, mesmo `top` - layout
    lado a lado identico ao anterior, confirmado tambem via
    screenshot visual.
  - Sticky do #20 (`.fc-care-sidebar > div`) confirmado intacto a
    1440px: `position: sticky`, `top: 500px` via
    `getComputedStyle` - sem regressao na calibracao do pacote
    anterior.
- [x] T2.3 Revisao por 1 agente ceptico, com foco em nao reabrir a
  calibracao sensivel do #20.
- [x] T2.4 `verify.md`.
- Criterio de conclusao: revisao sem achados bloqueantes.

## 3) Plano de testes

- Frontend: sem suite automatizada de UI no projeto para esta pagina;
  verificacao via `tsc`/`build` + medicoes reais de DOM
  (`getBoundingClientRect`, `getComputedStyle`) em 2 larguras
  representativas, descritas acima.
- Sem mudanca de backend, sem teste de backend necessario - mudanca
  100% de CSS/classe no frontend.

## 4) Rollback

Reverter o commit deste pacote - 2 linhas de classe CSS, sem
migration, sem mudanca de contrato de API, sem interacao com o pacote
#20.
