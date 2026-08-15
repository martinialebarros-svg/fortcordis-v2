# Plan - atendimento-loading-skeleton

Data: 2026-08-12
Responsavel: Claude (pareado com Martiniano)
Status: done

## 1) Sequencia de fases

- Fase 1 (DB/migracoes): nao se aplica.
- Fase 2 (backend/API): nao se aplica.
- Fase 3 (frontend): skeleton JSX no bloco `if (loading)`; limpeza da
  regra `.fc-care-loading` em `globals.css`.
- Fase 4 (integracao/observabilidade): tsc/build, preview local (skeleton
  forcado temporariamente + pagina real pos-fusao de CSS), revisao
  adversarial.

## 2) Tarefas por fase

### Fase 3

- [x] T3.1 Substituir `<div className="fc-care-loading">texto</div>` por
  skeleton estrutural (`fc-care-page` > `fc-care-header animate-pulse` +
  `fc-care-layout` com `fc-care-sidebar`/`fc-care-workspace` pulsando).
- [x] T3.2 Acessibilidade: `role="status"`/`aria-live="polite"` no
  container, `sr-only` com o texto original, `aria-hidden` nos blocos
  visuais.
- [x] T3.3 Remover a regra `.fc-care-loading` de `globals.css`; fundir suas
  propriedades compartilhadas na definicao unica de `.fc-care-page`.
- Criterio de conclusao: `tsc --noEmit` e `npm run build` aprovados.
- Risco: fusao de CSS alterar o layout real da pagina.
- Rollback: reverter o commit.

### Fase 4

- [x] T4.1 `npx tsc --noEmit` e `npm run build` no worktree isolado (2
  rodadas - antes e depois de reverter o hack temporario de verificacao).
- [x] T4.2 Preview local (backend + frontend do worktree, portas
  dedicadas), autenticacao via `fetch()`/`localStorage`.
- [x] T4.3 Tentativas de observar o `loading=true` real via atraso
  artificial de rede (patch de XHR) nao capturaram a janela a tempo (rede
  local rapida demais, mesmo com client-side routing). Contornado forcando
  temporariamente `if (loading || true)` no arquivo do worktree - nunca
  commitado - confirmando estruturalmente: `role="status"` presente,
  `sr-only` com o texto certo, `animate-pulse` no cabecalho, 5 blocos
  pulsando ao todo, 2 filhos na lateral e 2 na area principal. Screenshot
  confirmou visual coerente, sem quebra de layout.
- [x] T4.4 Revertido o hack, confirmado via grep que `if (loading)` voltou
  ao original; recarregada a pagina real (`loading=false`) e confirmado via
  screenshot e `getComputedStyle` que `.fc-care-page` preserva max-width
  (1680px) e demais propriedades apos a fusao de CSS.
- [x] T4.5 Revisao adversarial via agente, focada em: a fusao de CSS nao
  alterar `.fc-care-page`; nenhuma referencia residual a `.fc-care-loading`;
  acessibilidade do novo skeleton; ausencia de regressao na condicao
  `if (loading)` em si.
- Criterio de conclusao: tsc/build limpos, skeleton confirmado
  estruturalmente e visualmente, sem achados nao tratados na revisao
  adversarial.
- Risco: nenhum residual conhecido apos a verificacao.
- Rollback: reverter o commit.

## 3) Plano de testes

- Testes automatizados: nao aplicavel (sem suite de testes de componente
  React no projeto para este modulo).
- Verificacao tipo/build: `tsc --noEmit`, `npm run build`.
- Verificacao funcional: preview local; devido a rede local rapida demais
  para capturar `loading=true` organicamente, a condicao foi forcada
  temporariamente (nao commitada) para inspecionar o skeleton via DOM e
  screenshot.
- Revisao adversarial: agente dedicado lendo o diff final.

## 4) Dependencias e bloqueios

- Dependencia: classes `fc-care-header`/`fc-care-layout`/`fc-care-sidebar`/
  `fc-care-workspace` (ja existentes) - **atendidas**, inalteradas por este
  pacote.
- Sem bloqueios de infraestrutura conhecidos (sem migration, sem mudanca de
  API).

## 5) Checklist para iniciar execucao

- [x] `intent.md` aprovado.
- [x] `spec.md` aprovado.
- [x] Fases e rollback revisados.
- [x] Ambiente de teste definido: worktree isolado + preview local com banco
  copiado (gitignored, removido ao final).
