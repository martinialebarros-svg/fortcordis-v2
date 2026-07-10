# Verify - frontend-dashboard-premium-visual-refresh

Responsavel: Equipe FortCordis
Data: 2026-07-10

## Matriz de verificacao

| Criterio | Tipo | Evidencia | Status |
| --- | --- | --- | --- |
| CA-001 | lint | `cd frontend && npm run lint` | ok |
| CA-002 | typecheck | `cd frontend && npx tsc --noEmit --pretty false` | ok |
| CA-003 | build | `cd frontend && npm run build` | ok |
| CA-004 | diff hygiene | `git diff --check` | ok |
| CA-005 | smoke local | `curl -I http://127.0.0.1:3003/dashboard` retornou `200 OK` | ok |
| CA-006 | SDD guardrail | `python3 scripts/ci/check_sdd_guardrail.py --base-sha origin/stage --head-sha HEAD` retornou `PASSED` | ok |

## QA visual esperado

- Cabecalho compacto, com ECG integrado e indicadores legiveis.
- Cards de metricas alinhados e consistentes.
- Empty state da agenda sem corte do complexo QRS.
- Sidebar com grupos funcionais e nome completo da empresa em quebra de linha.
- Sem mudanca de contrato API ou fluxo de autenticacao.
