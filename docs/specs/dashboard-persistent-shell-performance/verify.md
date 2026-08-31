# Verify - dashboard-persistent-shell-performance

Data: 2026-08-31  
Responsavel: Codex / equipe FortCordis  
Status: validado em stage

## Matriz de verificacao

| Criterio | Evidencia planejada | Status |
| --- | --- | --- |
| CA-001 | `dashboard-shell-routes.test.ts` cobre rotas autenticadas, publicas e a fronteira `/agenda` versus `/agendado` | ok local |
| CA-002 | `npm test` (144 Vitest + 9 Node), `npm run lint`, `npx tsc --noEmit --pretty false` e `npm run build` (43 rotas) | ok local |
| CA-003 | `python3 scripts/ci/check_sdd_guardrail.py --base-sha origin/stage --head-sha HEAD` reconheceu os quatro artefatos e aprovou o diff | ok local |
| CA-004 | Migration CI `33361796056`, Deploy to Stage `33361796055`, Dashboard -> Agenda -> Atendimento -> Financeiro sem loader transitorio, shell unico e bibliotecas preservadas | ok stage |

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

## Smoke de stage

- `/financeiro` respondeu `200` em 0,24 s; `GET /api/v1/auth/me` sem credenciais respondeu o esperado `401`.
- Na sessao autenticada, a navegacao entre Dashboard, Agenda, Atendimento e Financeiro manteve a sidebar, nao exibiu `PREPARANDO AMBIENTE` ou `Carregando...` e preservou a dica de busca sob demanda do Atendimento.
- Os workflows de stage terminaram com sucesso: Migration CI `33361796056` e Deploy to Stage `33361796055` (guardrail SDD, quality gate e deploy-stage).

## Decisao de release

- [x] Aprovado para stage.
- [ ] Aprovado para producao.
- [ ] Nao aprovado (descrever motivo).
