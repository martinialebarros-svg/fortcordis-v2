# Plan - frontend-dashboard-shell-lazy-load

Data: 2026-04-14  
Responsavel: Codex  
Status: done

## 1) Sequencia de fases

- Fase 1 (DB/migracoes): nao aplicavel.
- Fase 2 (backend/API): nao aplicavel.
- Fase 3 (frontend): extrair do `layout-dashboard` os bootstraps opcionais e a camada visual do Fortinho para chunks lazy.
- Fase 4 (integracao/observabilidade): validar `build`, `analyze` e preparar smoke test de shell.

## 2) Tarefas por fase

### Fase 1

- [x] T1.1 Confirmar que nao ha alteracao de banco.
- [x] T1.2 Confirmar que nao ha migracao associada.
- Criterio de conclusao: escopo restrito ao frontend.
- Risco: baixo.
- Rollback: nao aplicavel.

### Fase 2

- [x] T2.1 Confirmar que nao ha novos endpoints.
- [x] T2.2 Confirmar que os contratos de push, sessao e configuracao permanecem intactos.
- Criterio de conclusao: escopo restrito ao frontend.
- Risco: baixo.
- Rollback: nao aplicavel.

### Fase 3

- [x] T3.1 Extrair bootstrap de push notifications para componente lazy.
- [x] T3.2 Extrair tratamento de `push_snooze` para componente lazy.
- [x] T3.3 Extrair limpeza de overlays orfaos para componente lazy.
- [x] T3.4 Manter `FortinhoProvider` no shell, mas mover a camada visual para overlay lazy.
- Criterio de conclusao: layout compila e rotas protegidas reduzem bundle inicial.
- Risco: regressao no shell compartilhado e nos casos de borda de push/Fortinho.
- Rollback: reverter o commit desta rodada.

### Fase 4

- [x] T4.1 Rodar `npm run build`.
- [x] T4.2 Rodar `npm run analyze`.
- [x] T4.3 Registrar smoke test em `docs/SMOKE-TEST-DASHBOARD-SHELL-LAZY-LOAD.md`.
- [x] T4.4 Executar smoke test manual do shell.
- [x] T4.5 Consolidar evidencias finais no `verify.md` apos validacao manual.
- Criterio de conclusao: evidencias registradas e release apto para stage.
- Risco: regressao so aparecer em navegacao real ou em cenarios de modais/push.
- Rollback: reverter commit e restaurar a versao anterior do shell.

## 3) Plano de testes

- Testes unitarios: nao aplicavel neste ciclo.
- Testes de integracao: `npm run build`, `npm run analyze`.
- Testes manuais: login, logout, sidebar, Fortinho, push notifications, `push_snooze` e overlays orfaos.

## 4) Dependencias e bloqueios

- Dependencia 1: frontend local compilando com Next.js em modo de producao.
- Dependencia 2: smoke test manual em rotas protegidas apos a modularizacao.

## 5) Checklist para iniciar execucao

- [x] `intent.md` aprovado.
- [x] `spec.md` aprovado.
- [x] Fases e rollback revisados.
- [x] Ambiente de teste definido (local/stage).
