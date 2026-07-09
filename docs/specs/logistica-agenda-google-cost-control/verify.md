# Verify - logistica-agenda-google-cost-control

Data: 2026-04-22  
Responsavel: Codex  
Status: done

## 1) Matriz de rastreabilidade

| ID | Tipo | Evidencia | Status |
| --- | --- | --- | --- |
| CA-001 | aceitacao | helper cacheado em `backend/app/api/v1/endpoints/agenda.py` aplicado nos loops de sugestao/validacao | ok |
| CA-002 | aceitacao | gate default `False` em `backend/app/core/config.py` e logica em `backend/app/services/logistica_service.py` | ok |
| CA-003 | aceitacao | teste `backend/tests/test_logistica_refresh_gate.py` cobre gate desligado/ligado | ok |
| CA-004 | aceitacao | `pytest` focado + suite backend executados com sucesso | ok |
| CA-005 | aceitacao | guardrail SDD executado no diff do commit | ok |
| CA-006 | aceitacao | `backend/app/api/v1/endpoints/logistica.py` expoe `/google-maps/custos-quotas` e resumo inclui `cost_and_quotas` | ok |
| CA-007 | aceitacao | default `LOGISTICA_ALLOW_LIVE_GOOGLE_LOOKUPS_ON_READ=True` em `backend/app/core/config.py` | ok |
| CA-008 | aceitacao | `qpm_soft_limit_recommended` calculado com piso `1` e limite hard de Distance Matrix separado | ok |

## 2) Validacoes executadas

Comandos:

```bash
backend/venv/bin/python -m pytest -q backend/tests/test_logistica_cobertura_matriz.py backend/tests/test_logistica_refresh_gate.py backend/tests/test_agenda_deslocamento_cache.py backend/tests/test_agenda_resumo_financeiro.py
backend/venv/bin/python -m pytest -q backend/tests
backend/venv/bin/python -m pytest -q backend/tests/test_logistica_google_cost_controls.py backend/tests/test_logistica_google_cost_report.py backend/tests/test_logistica_refresh_gate.py
backend/venv/bin/python -m pytest -q backend/tests/test_logistica*.py
python3 scripts/ci/check_sdd_guardrail.py --base-sha <base> --head-sha <head>
```

Resumo:
- Testes focados: passaram.
- Suite backend: `109 passed`.
- Suite de logistica: `8 passed`.
- Guardrail SDD: aprovado para o diff desta entrega.

## 3) Riscos residuais

- Risco residual 1: sem cache cross-request, chamadas repetidas entre requisicoes independentes continuam possiveis (escopo atual e por requisicao).
- Risco residual 2: ativar gate de refresh pode elevar chamadas externas; requer decisao operacional.
- Risco residual 3: estimativas de custo dependem de modelo local por SKU e devem ser calibradas periodicamente com faturamento real.

## 4) Validacao operacional em producao (2026-07-09)

- Ambiente validado: `https://app.fortcordis.com.br` com deploy do commit `718fa30`.
- Configuracao efetiva confirmada no backend de producao: `LOGISTICA_ALLOW_LIVE_GOOGLE_LOOKUPS_ON_READ=True`, `LOGISTICA_GOOGLE_TRAFFIC_AWARE=False` e `GOOGLE_MAPS_API_KEY` presente.
- Evidencia de comportamento: pares operacionais com tutor domiciliar foram encontrados em `clinica_deslocamentos` com ID sintetico negativo e consultas recentes registradas em `google_maps_usage_metricas`, confirmando materializacao da matriz e reuso posterior no fluxo domiciliar.
- Decisao operacional registrada: manter `LOGISTICA_ALLOW_LIVE_GOOGLE_LOOKUPS_ON_READ=true` explicitamente no `.env` de producao para permitir lookup ao vivo apenas no primeiro miss, com persistencia do resultado para leituras seguintes do mesmo par.

## 5) Decisao de release

- [x] Aprovado para stage.
- [x] Aprovado para producao.
- [ ] Nao aprovado.
