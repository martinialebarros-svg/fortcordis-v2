# Plan - alertas-internos-cancelamento-portal

Data: 2026-08-08
Status: concluido (implementado; aguardando QA manual do usuario em stage)

## 1) Sequencia de fases

- Fase 1 (DB/migracoes): tabela `alertas_internos`.
- Fase 2 (backend/API): modelo, schemas, servico, endpoints, integracao com o cancelamento do
  portal.
- Fase 3 (frontend): componente de sino + montagem no layout compartilhado.

## 2) Tarefas por fase

### Fase 1

- [x] Migracao `20260808_65_alertas_internos.py` (sqlite + postgresql), validada pelo runner real
      (`test_migration_ci_cycle`, ciclo completo com as 65 migracoes).

### Fase 2 (backend)

- [x] Modelo `AlertaInterno` (`backend/app/models/alerta_interno.py`).
- [x] Schemas `AlertaInternoResponse`, `AlertaInternoListResponse`, `AlertaInternoAckResponse`
      (`backend/app/schemas/alerta_interno.py`).
- [x] Servico `criar_alerta_interno` (`backend/app/services/alerta_interno_service.py`) — cria na
      MESMA sessao/transacao do chamador (ver `intent.md` para a justificativa).
- [x] Endpoints `backend/app/api/v1/endpoints/alertas_internos.py`: listar, marcar um como lido,
      marcar todos como lidos. Registrado em `main.py` (import + `include_router`).
- [x] `cancelar_agendamento_clinica_portal` (`portal.py`) chama `criar_alerta_interno` antes do
      `db.commit()` existente.
- Criterio de conclusao: testes automatizados verdes + suite completa do backend sem regressao.
- Risco: nenhum alerta criado nos caminhos de erro do cancelamento (403/404/409) — coberto por
  teste.
- Rollback: reverter os commits; a migracao so adiciona uma tabela nova.

- [x] Testes automatizados: `backend/tests/test_alertas_internos.py` (listar/marcar
      lido/marcar todos/404) + novo teste em `test_portal_clinica_agendamentos.py`
      (cancelamento cria exatamente um alerta com os dados certos; os caminhos de erro nao criam
      nenhum).

### Fase 3 (frontend)

- [x] `frontend/components/layout/AlertasInternosBell.tsx` — sino fixo, contagem, dropdown,
      marcar lido (individual/lote), polling de 45s, fecha ao clicar fora.
- [x] Montado em `frontend/app/layout-dashboard.tsx` via `next/dynamic` (`ssr:false`), junto aos
      demais utilitarios de layout.
- Criterio de conclusao: tsc/eslint limpos; boot do dev server sem erro nas paginas internas
  (`/dashboard`, `/agenda`, `/financeiro`) e confirmacao de que o portal externo
  (`/clinica-parceira`) continua inalterado (nao usa esse layout).
- Risco: sem verificacao visual real do sino (requer sessao interna logada, nao disponivel neste
  ambiente) — QA manual pendente.
- Rollback: reverter o commit de frontend.

## 3) Plano de testes

- Automatizado (backend): suite completa, 690 testes, 0 falhas, 1 skip pre-existente.
- Automatizado (frontend): `tsc --noEmit`, `eslint`, boot do `next dev` em 4 rotas.
- Manual: pendente — precisa de sessao interna real (login) para ver o sino, testar o polling, o
  dropdown e o fluxo de marcar como lido de ponta a ponta.

## 4) Dependencias e bloqueios

- Nenhum bloqueio ativo. Depende do deploy aplicar a migracao `20260808_65` antes do primeiro uso
  (automatico, via `run_migrations()` no startup, mesmo mecanismo das demais 64 migracoes).

## 5) Checklist para iniciar execucao

- [x] `intent.md` preenchido.
- [x] `spec.md` preenchido.
- [x] Fases e rollback revisados.
- [x] Ambiente de teste definido: suite automatizada completa (backend) + runner real de
      migracoes executados localmente nesta sessao; QA manual do sino fica pendente de stage.
