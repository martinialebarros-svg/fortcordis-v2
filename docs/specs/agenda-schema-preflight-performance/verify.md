# Verificação — PERF-22: preflight de schema fora da requisição da Agenda

## Matriz de rastreabilidade

| ID | Evidência | Estado |
| --- | --- | --- |
| CA-001 | testes de startup e `test_preflight_adds_legacy_columns_and_is_idempotent` | ok_local |
| CA-002 | mock estrito em `test_listar_agendamentos_nao_faz_query_por_item_relacionado` | ok_local |
| CA-003 | limite de quatro `SELECTs` no mesmo teste | ok_local |
| CA-004 | suítes focadas, de Agenda e completa do backend | ok_local |
| CA-005 | compilação, integridade do diff e avaliador do guardrail SDD | ok_local |
| CA-006 | comparação autenticada da release `9e1415a` com 108 amostras | ok_stage |

## Evidência local

- `python -m unittest tests.test_agenda_schema_preflight tests.test_agenda_n_plus_one tests.test_background_worker_isolation`
- Resultado: `Ran 10 tests ... OK`.
- `python -m unittest discover -s tests -p 'test_agenda*.py'`
- Resultado: `Ran 144 tests ... OK`.
- `python -m unittest tests.test_background_worker_isolation tests.test_atendimento_transactional_finalization`
- Resultado: `Ran 21 tests ... OK`.
- `python -m unittest discover -s tests`
- Resultado após rebase em `origin/stage` (`c0df536`):
  `Ran 1438 tests ... OK (skipped=7)`.
- `python -m compileall` dos arquivos alterados: aprovado.
- `git diff --check`: aprovado na revisão final.
- O avaliador central de `scripts/ci/check_sdd_guardrail.py`, alimentado com os
  arquivos rastreados e não rastreados do worktree, aprovou a feature
  `agenda-schema-preflight-performance`. A forma CLI que compara SHAs será
  repetida naturalmente depois do commit no fluxo de entrega.

## Evidência de stage antes da mudança

Release `c758af1`:

- rota principal: 127 amostras, p95 `298,95 ms`, banco p95 `234,21 ms`, app
  p95 `70,86 ms`, consultas p95 `10`, pool p95 `0,14 ms`, zero 5xx;
- relacionados: 104 amostras, p95 `83,58 ms`, consultas p95 `7`, zero 5xx;
- resumo financeiro: 104 amostras, p95 `89,70 ms`, consultas p95 `7`, zero
  5xx.

Nenhuma escrita clínica, financeira ou operacional foi usada para produzir a
linha de base.

## Evidência de stage após a mudança

Release `9e1415a`, publicada pelo workflow `36157588676`:

- 108 amostras autenticadas e somente leitura de `/api/v1/agenda`;
- p50 `67,31 ms`, p95 `115,50 ms`, p99 `323,93 ms` e máximo `352,69 ms`;
- banco p95 `96,73 ms`, app p95 `30,71 ms`, consultas p95 `5` e pool p95
  `0,05 ms`;
- zero requisições acima de `1.200 ms` e zero 5xx;
- em relação à linha de base, o p95 caiu `61,4%`, o banco p95 caiu `58,7%`,
  o app p95 caiu `56,7%` e as consultas p95 caíram de `10` para `5`, atingindo
  a meta de no máximo `6`.

O smoke confirmou `200` no host canônico
`app.stage.fortcordis.com.br/agenda`, redirecionamento do alias
`stage.fortcordis.com.br` para o canônico e `401` na API protegida sem
credenciais. O alias `www.stage.fortcordis.com.br` permaneceu sem resolução
DNS, tratado como pendência independente do comportamento da aplicação.
