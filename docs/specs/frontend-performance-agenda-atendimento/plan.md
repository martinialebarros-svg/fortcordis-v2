# Plan - frontend-performance-agenda-atendimento

Data: 2026-04-13  
Responsavel: Codex  
Status: done

## 1) Sequencia de fases

- Fase 1 (DB/migracoes): nao aplicavel.
- Fase 2 (backend/API): nao aplicavel.
- Fase 3 (frontend): modularizar `agenda` e `atendimento`, configurar analyzer e reduzir bundle inicial.
- Fase 4 (integracao/observabilidade): validar `build`, registrar checklist e consolidar evidencias no `verify.md`.

## 2) Tarefas por fase

### Fase 1

- [x] T1.1 Confirmar que nao ha alteracao de banco.
- [x] T1.2 Confirmar que nao ha migracao associada.
- Criterio de conclusao: escopo reduzido ao frontend.
- Risco: baixo.
- Rollback: nao aplicavel.

### Fase 2

- [x] T2.1 Confirmar que nao ha novos endpoints.
- [x] T2.2 Confirmar que contratos existentes de agenda/atendimento permanecem intactos.
- Criterio de conclusao: escopo reduzido ao frontend.
- Risco: baixo.
- Rollback: nao aplicavel.

### Fase 3

- [x] T3.1 Configurar analyzer de bundle no frontend.
- [x] T3.2 Extrair o calendario da agenda para ilha lazy.
- [x] T3.3 Extrair workspaces e modais do atendimento para componentes sob demanda.
- [x] T3.4 Remover codigo morto legado do `atendimento/page.tsx`.
- [x] T3.5 Fazer passada leve de organizacao nos componentes extraidos.
- Criterio de conclusao: build funcional e bundle reduzido nas rotas alvo.
- Risco: regressao de UI em fluxos clinicos ou de agenda.
- Rollback: reverter os commits de modularizacao do frontend.

### Fase 4

- [x] T4.1 Rodar `npm run build`.
- [x] T4.2 Executar `eslint` focado na area de atendimento.
- [x] T4.3 Validar manualmente agenda e atendimento com smoke test.
- [x] T4.4 Registrar resultados de bundle e checklist no `verify.md`.
- Criterio de conclusao: evidencias registradas e release apto para stage.
- Risco: diferenca entre ambiente local e stage.
- Rollback: reverter commit e repetir deploy anterior.

## 3) Plano de testes

- Testes unitarios: nao aplicavel neste ciclo.
- Testes de integracao: `npm run build`.
- Testes manuais: login, navegacao, agenda fullcalendar, atendimento, prescricao, exames, documentos e anexos.

## 4) Dependencias e bloqueios

- Dependencia 1: frontend local compilando com Next.js em modo de producao.
- Dependencia 2: smoke test manual nas rotas criticas apos cada rodada maior.

## 5) Checklist para iniciar execucao

- [x] `intent.md` aprovado.
- [x] `spec.md` aprovado.
- [x] Fases e rollback revisados.
- [x] Ambiente de teste definido (local/stage).
