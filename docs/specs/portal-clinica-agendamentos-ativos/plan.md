# Plan - portal-clinica-agendamentos-ativos

Data: 2026-08-07
Responsavel: Martiniano + Claude
Status: in-progress (implementado; aguardando revisao humana antes de stage)

## 1) Sequencia de fases

- Fase 1 (DB/migracoes): nao aplicavel.
- Fase 2 (backend/API): endpoints de listagem e cancelamento no portal.
- Fase 3 (frontend): bloco "Agendamentos ativos" no `PortalClinicaWorkspace.tsx`.
- Fase 4 (integracao/observabilidade): auditoria do cancelamento (incluida na Fase 2).

## 2) Tarefas por fase

### Fase 2 (backend)

- [x] T2.1 Schemas `PortalClinicaAgendamentoItemResponse`, `PortalClinicaAgendamentoListResponse`,
      `PortalClinicaAgendamentoCancelResponse` em `backend/app/schemas/portal.py`.
- [x] T2.2 Helper `_exigir_sessao_clinica_portal` (dedup do check `actor_type`/`clinica_id`/clinica
      ativa, ja usado por `listar_exames_clinica_portal`).
- [x] T2.3 `GET /clinicas/agendamentos` — filtra por `clinica_id` da sessao e status visiveis.
- [x] T2.4 `PATCH /clinicas/agendamentos/{id}/cancelar` — valida clinica + status cancelavel,
      adquire lock de escrita da agenda, atualiza status, registra auditoria e nota em
      `observacoes`.
- Criterio de conclusao: testes automatizados (T2.5) verdes + suite completa do backend sem
  regressao.
- Risco: cancelamento indevido de agendamento ja em atendimento/realizado — mitigado por
  `AGENDA_PORTAL_STATUSES_CANCELAVEIS` explicito, testado em T2.5.
- Rollback: reverter o commit de backend; nenhuma migracao envolvida.

- [x] T2.5 Testes automatizados em `backend/tests/test_portal_clinica_agendamentos.py`: listagem
      escopada por clinica, bloqueio de acesso sem `actor_type=clinica`, cancelamento com sucesso
      (com verificacao de auditoria chamada), bloqueio de cancelamento de outra clinica (404),
      bloqueio de cancelamento de agendamento "Realizado" (409), 404 para agendamento inexistente.

### Fase 3 (frontend)

- [x] T3.1 Tipos e funcoes `listPortalClinicAgendamentos`/`cancelPortalClinicAgendamento` em
      `frontend/lib/portal-api.ts`, seguindo o padrao de `listPortalClinicExams`.
- [x] T3.2 Estado + carregamento (`loadAgendamentos`) disparado junto com `loadDashboard` na
      sessao da clinica (nao no modo `admin_preview`).
- [x] T3.3 Bloco de UI com lista, status, botao "Atualizar", confirmacao inline de cancelamento
      (2 cliques) e feedback de sucesso/erro.
- Criterio de conclusao: tsc/eslint limpos nos arquivos alterados; boot do dev server sem erro em
  `/clinica-parceira`.
- Risco: nenhuma cobertura de teste de componente (mesma limitacao ja registrada na feature
  anterior, `agenda-reserva-mensagem-edicao`).
- Rollback: reverter o commit de frontend.

## 3) Plano de testes

- Testes automatizados (backend): `python -m unittest discover -s backend/tests -p "test_*.py"`
  (suite completa, 679 testes) — executado nesta sessao, sem regressao.
- Testes automatizados (frontend): `tsc --noEmit`, `eslint`, `npm run test` (vitest) — executados
  nesta sessao, sem regressao.
- Testes manuais: pendentes (sem backend/DB real disponivel nesta sessao) — ver `verify.md`.

## 4) Dependencias e bloqueios

- Bloqueio: decisoes da secao 7 do `intent.md` (regras de cancelamento e escopo) ainda nao
  confirmadas pelo usuario. Implementacao seguiu os defaults recomendados, documentados, mas o
  release para stage/producao deve esperar revisao humana.

## 5) Checklist para iniciar execucao

- [x] `intent.md` preenchido (status `draft` — decisoes de escopo pendentes de confirmacao).
- [x] `spec.md` preenchido.
- [x] Fases e rollback revisados.
- [x] Ambiente de teste definido: suite automatizada completa (backend) executada localmente
      nesta sessao; QA manual fica pendente de ambiente com backend/DB real.
