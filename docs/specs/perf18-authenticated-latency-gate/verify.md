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

- [ ] Stage: workflow terminal e canário autenticado aprovados.
- [ ] Stage: smoke autenticado de Agenda e Desempenho aprovado.
- [ ] Produção: promoção do snapshot exato de stage e canário aprovado.
