# Verify - agenda-visible-related-loading-phase2

Data: 2026-08-30

Responsavel: Codex / equipe FortCordis

Status: ready_for_review

## 1) Matriz de rastreabilidade

| ID | Evidencia esperada | Status |
| --- | --- | --- |
| CA-001 | testes do parser de IDs e limite 100 | ok |
| CA-002 | teste de isolamento do lote | ok |
| CA-003 | teste de deduplicacao mais recente | ok |
| CA-004 | contagem constante de consultas SQL | ok |
| CA-005 | testes de utilitarios frontend | ok |
| CA-006 | smoke autenticado e recursos observados | pendente stage |
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

## 5) Decisao de release

- [x] Pronto para revisao em PR.
- [ ] Aprovado para `stage`.
- [ ] Aprovado para producao.
