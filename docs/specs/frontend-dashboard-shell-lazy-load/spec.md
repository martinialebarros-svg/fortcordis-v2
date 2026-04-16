# Spec - frontend-dashboard-shell-lazy-load

Data: 2026-04-14  
Responsavel: Codex  
Status: done

## 1) Escopo funcional

Este ciclo cobre a extracao lazy de comportamentos opcionais do shell do dashboard, incluindo bootstrap de push notifications, tratamento de `push_snooze`, limpeza de overlays orfaos e camada visual do Fortinho. A entrega preserva autenticacao, navegacao, logout e uso do contexto `useFortinho` nas paginas protegidas.

## 2) Requisitos funcionais (RF)

- RF-001: o shell do dashboard deve carregar bootstrap de push notifications sob demanda.
- RF-002: o tratamento de `push_snooze` via query string deve continuar funcionando, mas fora do chunk inicial do layout.
- RF-003: a limpeza de overlays orfaos deve continuar ativa apos a extracao para bootstrap lazy.
- RF-004: o `FortinhoProvider` deve manter o contexto global, mas sua camada visual deve ser carregada sob demanda.
- RF-005: login, logout, sidebar e navegacao entre rotas protegidas devem continuar funcionando sem regressao perceptivel.

## 3) Requisitos nao funcionais (NFR)

- NFR-001 (performance): as rotas protegidas devem apresentar reducao perceptivel de `First Load JS` local apos a modularizacao do shell.
- NFR-002 (compatibilidade): nenhum contrato de backend, permissao de sessao ou fluxo de autenticacao deve ser alterado.
- NFR-003 (observabilidade): o impacto deve ser verificavel via `npm run build`, `npm run analyze` e smoke test documentado.

## 4) Contratos tecnicos

### API

- Endpoint: sem novos endpoints.
- Metodo: sem alteracao.
- Payload: sem alteracao.
- Resposta: sem alteracao.

### Banco/migracoes

- Tabelas/colunas afetadas: nenhuma.
- Indices/constraints: nenhum.
- Migracao necessaria: nao

### Frontend

- Telas afetadas: `frontend/app/layout-dashboard.tsx` e todas as rotas protegidas que o utilizam.
- Componentes afetados: `frontend/components/fortinho/FortinhoProvider.tsx`, `frontend/components/fortinho/FortinhoOverlay.tsx`, `frontend/components/layout/PushNotificationsBootstrap.tsx`, `frontend/components/layout/DashboardPushSnoozeHandler.tsx`, `frontend/components/layout/DashboardOverlayCleanup.tsx`.
- Regras de exibicao/erro: shell deve montar normalmente; push e Fortinho podem carregar sob demanda sem tela branca, loop ou perda funcional.

## 5) Compatibilidade e rollout

- Backward compatibility: mantida; mesmas rotas, mesmos fluxos e mesmas chamadas existentes.
- Feature flag (se houver): nao.
- Estrategia de rollback: reverter o commit desta rodada e restaurar o shell anterior.

## 6) Criterios de aceitacao (CA)

- CA-001: `npm run build` e `npm run analyze` concluem com sucesso apos a extracao lazy do shell.
- CA-002: `agenda/fullcalendar` reduz de `154 kB` para aproximadamente `151 kB` de `First Load JS`.
- CA-003: `atendimento` reduz de `177 kB` para aproximadamente `174 kB` de `First Load JS`.
- CA-004: `dashboard` reduz de `139 kB` para aproximadamente `137 kB` de `First Load JS`.
- CA-005: smoke test do shell documentado em `docs/SMOKE-TEST-DASHBOARD-SHELL-LAZY-LOAD.md` passa sem regressao funcional perceptivel.

## 7) Casos de borda

- CB-001: navegadores sem permissao de notificacao nao podem quebrar o carregamento do dashboard.
- CB-002: `push_snooze` deve executar apenas uma vez por URL e limpar a query apos processar.
- CB-003: overlays visuais presos apos fechar modal ou navegar devem continuar sendo limpos.
- CB-004: telas que usam `useFortinho` devem seguir exibindo avisos e confirmacoes.

## 8) Fora de escopo

- Otimizacao profunda do runtime compartilhado de `React/Next`.
- Refatoracao estetica do layout do dashboard.
- Reescrita dos fluxos de push notifications.
