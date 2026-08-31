# Verify - agenda-visible-related-loading-phase2

Data: 2026-08-30

Responsavel: Codex / equipe FortCordis

Status: done_in_stage

## 1) Matriz de rastreabilidade

| ID | Evidencia esperada | Status |
| --- | --- | --- |
| CA-001 | testes do parser de IDs e limite 100 | ok |
| CA-002 | teste de isolamento do lote | ok |
| CA-003 | teste de deduplicacao mais recente | ok |
| CA-004 | contagem constante de consultas SQL | ok |
| CA-005 | testes de utilitarios frontend | ok |
| CA-006 | smoke autenticado em stage e recursos observados | ok |
| CA-007 | testes, lint, build, diff e SDD | ok |

## 2) Linha de base

- Producao, `/agenda`, 2026-08-30: estabilizacao em 3467 ms.
- Na amostra sem agendamentos relacionados, a entrada ainda solicitou `/clinicas?limit=1000` e `/servicos?limit=1000`.
- O codigo anterior da lista e do FullCalendar tambem previa `/laudos?limit=1000`, `/ordens-servico?limit=2000`, `/clinicas?limit=1000` e `/tutores?limit=2000` quando o periodo possuia itens relacionados.

## 3) Validacoes planejadas

```bash
cd backend && /Users/martiniano/fortcordis-v2/backend/venv/bin/python -m pytest \
  tests/test_agenda_relacionados_visiveis.py tests/test_agenda_n_plus_one.py \
  tests/test_agenda_busca_periodo_filtros.py tests/test_agenda_resumo_financeiro.py -q  # 10 aprovados
cd frontend && ./node_modules/.bin/vitest run lib/agenda-loading.test.ts \
  lib/agenda-shared-actions.test.ts lib/agenda-reabilitar-reserva.test.ts  # 17 aprovados
cd frontend && ./node_modules/.bin/eslint app/agenda/page.tsx \
  app/agenda/fullcalendar/page.tsx lib/agenda-loading.ts lib/agenda-loading.test.ts \
  --max-warnings=0 && ./node_modules/.bin/tsc --noEmit  # aprovado
cd frontend && npm test       # 135 Vitest + 9 Node aprovados
cd frontend && npm run lint   # aprovado, zero warnings
cd frontend && npm run build  # aprovado, 43 paginas geradas
cd .. && python3 scripts/ci/check_sdd_guardrail.py --base-sha origin/stage --head-sha HEAD  # aprovado
cd .. && git diff --check origin/stage...HEAD && git merge-base --is-ancestor origin/stage HEAD  # aprovado
```

## 4) Aceite stage planejado

- Abrir `/agenda` autenticado e confirmar ausencia dos dois catalogos na entrada.
- Confirmar no recurso carregado que os relacionados usam `agenda/relacionados` com IDs da pagina.
- Abrir os filtros de clinica e servico e confirmar uma carga independente por filtro.
- Atualizar/navegar o periodo e confirmar que lista, atalhos e mapa permanecem funcionais.
- Abrir `/agenda/fullcalendar` e confirmar o mesmo contrato agregado, sem as quatro listagens amplas.

## 5) Evidencia de stage

- PR: [#92](https://github.com/martinialebarros-svg/fortcordis-v2/pull/92), merge commit `6953a6b4` em 2026-08-31.
- Workflow: [Deploy to Stage (VPS)](https://github.com/martinialebarros-svg/fortcordis-v2/actions/runs/33343693205) aprovado; quality gate e deploy concluiram sem falha.
- Smoke autenticado: `/agenda` estabilizou em 1579 ms na amostra de 2026-08-30 e exibiu somente as opcoes base dos filtros na entrada.
- Abrir o filtro de clinicas carregou suas opcoes sem carregar servicos; abrir o filtro de servicos em seguida carregou suas opcoes de forma independente.
- Smoke autenticado: `/agenda/fullcalendar` exibiu 13 eventos no periodo 2026-07-26 a 2026-09-05, com conexao em tempo real ativa e sem erro visivel.

## 6) Riscos residuais

- A medicao de 1579 ms e uma amostra de stage, nao um percentil de producao; telemetria persistente continua no PERF-17/18.
- Catalogos dos filtros ainda chegam com limite 1000 quando o usuario escolhe abri-los; cache/paginacao ficam para PERF-10/PERF-13.
- A promocao para producao exige reconciliacao e validacao separada do snapshot de stage.

## 7) Decisao de release

- [x] Pronto para revisao em PR.
- [x] Aprovado para `stage`.
- [ ] Aprovado para producao.
