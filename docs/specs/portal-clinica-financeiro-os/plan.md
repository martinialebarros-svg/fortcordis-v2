# Plan - portal-clinica-financeiro-os

Data: 2026-08-08
Responsavel: Martiniano + Claude
Status: concluido (implementado; aguardando QA manual do usuario em stage)

## 1) Sequencia de fases

- Fase 1 (DB/migracoes): nao aplicavel.
- Fase 2 (backend/API): endpoint de financeiro por clinica.
- Fase 3 (frontend): bloco "Financeiro da unidade" no `PortalClinicaWorkspace.tsx`.

## 2) Tarefas por fase

### Fase 2 (backend)

- [x] T2.1 Schemas `PortalClinicaOrdemServicoItemResponse`, `PortalClinicaFinanceiroSummaryResponse`,
      `PortalClinicaFinanceiroResponse` em `backend/app/schemas/portal.py`.
- [x] T2.2 `GET /clinicas/financeiro` — reaproveita `_exigir_sessao_clinica_portal`; consulta
      `OrdemServico` com join em `Paciente`/`Servico`; separa pendentes (limite 200) e pagas
      (limite 50, mais recentes); resumo agregado via `func.sum`/`func.count` sobre o total real.
- Criterio de conclusao: testes automatizados verdes + suite completa do backend sem regressao.
- Risco: nenhum dado de tabela financeira interna (`Transacao`/`ContaPagar`/`ContaReceber`)
  vazado — mitigado nao importando essas tabelas no endpoint novo (verificado por leitura de
  codigo).
- Rollback: reverter o commit de backend; nenhuma migracao envolvida.

- [x] T2.3 Testes automatizados em `backend/tests/test_portal_clinica_financeiro.py`: escopo por
      clinica (exclui outra clinica e OS cancelada), bloqueio de acesso sem `actor_type=clinica`,
      resumo zerado para clinica sem movimentacao.

### Fase 3 (frontend)

- [x] T3.1 Tipos e funcao `getPortalClinicFinanceiro` em `frontend/lib/portal-api.ts`.
- [x] T3.2 Estado + carregamento (`loadFinanceiro`) disparado junto com `loadDashboard`/
      `loadAgendamentos` na sessao da clinica (nao no modo `admin_preview`).
- [x] T3.3 Bloco de UI com resumo (2 cards) + duas listas (pendentes/pagas), aviso de truncamento
      quando aplicavel, formatação de moeda BRL local (`formatCurrencyBRL`, mesmo padrao usado em
      `app/fiscal` e `app/agenda/fullcalendar`).
- Criterio de conclusao: tsc/eslint limpos nos arquivos alterados; boot do dev server sem erro em
  `/clinica-parceira`.
- Risco: nenhuma cobertura de teste de componente (mesma limitacao ja registrada nas duas
  entregas anteriores desta sessao).
- Rollback: reverter o commit de frontend.

## 3) Plano de testes

- Testes automatizados (backend): `python -m unittest discover -s backend/tests -p "test_*.py"`
  (suite completa, 682 testes antes desta entrega adicionar mais 3) — executado nesta sessao, sem
  regressao.
- Testes automatizados (frontend): `tsc --noEmit`, `eslint`, `npm run test` (vitest) — executados
  nesta sessao, sem regressao.
- Testes manuais: pendentes — usuario vai liberar para stage para isso (ver `verify.md`).

## 4) Dependencias e bloqueios

- Nenhum bloqueio ativo. Usuario ja autorizou a implementacao ("continue para a 3"); QA manual
  fica por conta do fluxo stage -> main que o proprio usuario conduz.

## 5) Checklist para iniciar execucao

- [x] `intent.md` preenchido.
- [x] `spec.md` preenchido.
- [x] Fases e rollback revisados.
- [x] Ambiente de teste definido: suite automatizada completa (backend) executada localmente
      nesta sessao; QA manual fica pendente de ambiente com backend/DB real (stage).
