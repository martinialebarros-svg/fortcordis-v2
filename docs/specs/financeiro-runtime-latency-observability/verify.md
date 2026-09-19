# Verificação — PERF-19: latência de Ordens e Cobranças

## Matriz de rastreabilidade

| ID | Evidência | Estado |
| --- | --- | --- |
| CA-001 | `test_http_latency_monitor_tracks_exact_financeiro_reads_separately` confirma cinco prefixos + duas rotas exatas | ok |
| CA-002 | teste em memória e `test_exact_financeiro_reads_persist_as_separate_safe_groups` confirmam grupos distintos | ok |
| CA-003 | testes focados ignoram detalhe, método ausente e não-GET, inclusive com prefixo sobreposto | ok |
| CA-004 | `test_http_latency_monitor_warns_when_endpoint_limits_are_exceeded` | ok |
| CA-005 | 25 testes focados, suíte backend completa e avaliação do guardrail SDD | ok |
| CA-006 | smoke autenticado e painel em stage | pendente — requer publicação autorizada |

## Validações executadas em 2026-09-19

```bash
cd backend
./venv/bin/python -m unittest \
  tests/test_runtime_observability_service.py \
  tests/test_runtime_http_latency_persistence.py \
  tests/test_runtime_checks_observability.py \
  tests/test_admin_hardening_readiness.py \
  tests/test_sdd_guardrail.py -v
```

- Resultado: `Ran 25 tests ... OK`.

```bash
cd backend
./venv/bin/python -m unittest discover -s tests -p 'test_*.py'
```

- Resultado: `Ran 1409 tests ... OK (skipped=7)`.
- `git diff --check`: aprovado.
- `scripts/ci/check_sdd_guardrail.py::evaluate_guardrail`, aplicado ao conjunto
  real de arquivos alterados: aprovado para
  `financeiro-runtime-latency-observability`.
- Os logs ruidosos de tabelas ausentes e falhas simuladas fazem parte dos
  cenários negativos existentes; a suíte terminou com código zero.

## Validação operacional futura

- Confirmar no runtime report as duas rotas exatas e os cinco prefixos.
- Executar somente `GET`, sem pagamentos, baixas, envios ou exclusões.
- Verificar grupos distintos no painel administrativo e release igual ao SHA.
- Não concluir sobre p95 quando `truncated=true`; usar ao menos 20 amostras para
  leitura preliminar e preferir 100 por rota/release para comparação.
