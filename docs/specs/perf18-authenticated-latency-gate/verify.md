# Verificação — PERF-18: gate autenticado de latência

## Evidência automatizada planejada

- `backend/venv/bin/python -m unittest backend.tests.test_deploy_authenticated_canary -v`
- `python -m py_compile scripts/deploy_authenticated_canary.py`
- `bash -n scripts/deploy_prod_vps.sh`
- `bash -n scripts/deploy_stage_vps.sh`
- `python3 scripts/ci/check_sdd_guardrail.py --base-sha origin/stage --head-sha HEAD`

## Matriz de aceitação

| ID | Evidência | Estado |
| --- | --- | --- |
| CA-001 | `test_http_401_e_403_nao_sao_sucesso_de_canario` | ok |
| CA-002 | `test_latencia_da_agenda_exige_todas_as_amostras` | ok |
| CA-003 | `test_latencia_da_agenda_reprova_p95_acima_do_limite` | ok |
| CA-004 | `test_canario_mede_cinco_leituras_autenticadas_da_agenda` e `test_deploy_propaga_limite_e_release_para_o_canario` | ok |

## Evidência de stage e produção

- [x] Stage: workflow terminal aprovado; canário autenticado do release `3aef3d7` com 5/5 leituras, p50 de 180,5 ms e p95 de 330,7 ms (limite 1.200 ms).
- [x] Stage: smoke autenticado de Agenda e Desempenho aprovado; painel mostrou `3aef3d7`, p95 de 474,85 ms para Agenda e 0 erros 5xx.
- [x] Produção: snapshot exato de stage promovido para `main` (`3aef3d7`), workflows terminais aprovados e canário com 5/5 leituras, p50 de 171,53 ms e p95 de 459,24 ms (limite 1.200 ms). Smoke autenticado mostrou p95 de 455,36 ms para Agenda e 0 erros 5xx.
