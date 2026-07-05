# Verify - clinical-scope-ui-priority

Data: 2026-07-05
Responsavel: Equipe FortCordis
Status: ready-for-stage

## 1) Matriz de rastreabilidade

| ID | Tipo | Evidencia | Status |
| --- | --- | --- | --- |
| CA-001 | frontend | `frontend/app/layout-dashboard.tsx` | ok |
| CA-002 | frontend | `frontend/app/agenda/page.tsx` | ok |
| CA-003 | frontend | `frontend/app/agenda/fullcalendar/page.tsx` | ok |
| CA-004 | frontend | `frontend/app/laudos/novo/page.tsx` | ok |
| CA-005 | frontend | `frontend/app/laudos/[id]/editar/page.tsx` | ok |
| CA-006 | frontend | `frontend/app/laudos/[id]/page.tsx` | ok |
| CA-007 | validacao | eslint + build + diff check | ok |

## 2) Testes automatizados planejados

```bash
cd frontend && npx eslint \
  app/layout-dashboard.tsx \
  app/agenda/page.tsx \
  app/agenda/fullcalendar/page.tsx \
  app/laudos/novo/page.tsx \
  app/laudos/[id]/page.tsx \
  app/laudos/[id]/editar/page.tsx \
  --max-warnings=0

cd frontend && npm run build

git diff --check
python3 scripts/ci/check_sdd_guardrail.py --base-sha origin/stage --head-sha HEAD
```

Resultados executados:

- `cd frontend && npx eslint app/layout-dashboard.tsx app/agenda/page.tsx app/agenda/fullcalendar/page.tsx app/laudos/novo/page.tsx app/laudos/[id]/page.tsx app/laudos/[id]/editar/page.tsx --max-warnings=0`: ok.
- `cd frontend && npm run build`: ok.
- `git diff --check`: ok.

## 3) Testes manuais sugeridos em stage

- Cenario 1: abrir o menu lateral e confirmar que `US Abdominal` nao aparece como item principal.
- Cenario 2: abrir a agenda padrao, acionar `Laudar` e confirmar `Ecocardiograma`, `Eletrocardiograma` e `Pressao Arterial`.
- Cenario 3: repetir o teste na agenda FullCalendar.
- Cenario 4: clicar em `Pressao Arterial` e confirmar que `Novo Laudo` abre em contexto de `PA`.
- Cenario 5: abrir um laudo existente de `PA` para editar e confirmar foco inicial na aba de pressao.
- Cenario 6: abrir um laudo existente de `PA` para visualizar e confirmar titulo e resumo do exame.

## 4) Riscos residuais

- Risco residual 1: `Ultrassonografia Abdominal` continua disponivel por rota direta, mesmo sem destaque na navegacao principal.
- Risco residual 2: o editor de `Novo Laudo` ainda preserva abas de ecocardiograma mesmo quando aberto pelo fluxo dedicado de `PA`, para nao romper o uso combinado em casos especificos.
