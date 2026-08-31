# Verify - dashboard-persistent-shell-performance

Data: 2026-08-31  
Responsavel: Codex / equipe FortCordis  
Status: em andamento

## Matriz de verificacao

| Criterio | Evidencia planejada | Status |
| --- | --- | --- |
| CA-001 | `dashboard-shell-routes.test.ts` cobre rotas autenticadas, publicas e a fronteira `/agenda` versus `/agendado` | ok local |
| CA-002 | `npm test` (144 Vitest + 9 Node), `npm run lint`, `npx tsc --noEmit --pretty false` e `npm run build` (43 rotas) | ok local |
| CA-003 | `python3 scripts/ci/check_sdd_guardrail.py --base-sha origin/stage --head-sha HEAD` reconheceu os quatro artefatos e aprovou o diff | ok local |
| CA-004 | workflow terminal e smoke autenticado em stage | pendente |

## Comandos executados localmente

```bash
cd frontend && npm test
cd frontend && npm run lint -- --quiet
cd frontend && npx tsc --noEmit --pretty false
cd frontend && npm run build
```

## Riscos residuais

- Push e alertas dependem de ambiente autenticado para smoke real.
- A persistencia e limitada a navegacao interna; logout e rotas publicas desmontam o shell intencionalmente.
