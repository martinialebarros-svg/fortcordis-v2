# Verificação — PERF-19: latência de Ordens e Cobranças

## Matriz de rastreabilidade

| ID | Evidência | Estado |
| --- | --- | --- |
| CA-001 | `test_http_latency_monitor_tracks_exact_financeiro_reads_separately` confirma cinco prefixos + duas rotas exatas | ok |
| CA-002 | teste em memória e `test_exact_financeiro_reads_persist_as_separate_safe_groups` confirmam grupos distintos | ok |
| CA-003 | testes focados ignoram detalhe, método ausente e não-GET, inclusive com prefixo sobreposto | ok |
| CA-004 | `test_http_latency_monitor_warns_when_endpoint_limits_are_exceeded` | ok |
| CA-005 | 25 testes focados, suíte backend completa e avaliação do guardrail SDD | ok |
| CA-006 | release correto, rotas separadas, `truncated=false`, amostra preliminar >= 20, p95 abaixo de 1.200 ms e zero 5xx em stage | parcial — stage aprovado; janela operacional preferencial de 100 amostras e produção permanecem pendentes |

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

## Aceite autenticado em stage — 2026-09-19

- Release validado: `75a58ba48938d23469d13b34a86179f95a6dff68`.
- Workflow `Deploy to Stage` `35471139175`: terminal com sucesso; quality gate,
  guardrail SDD e deploy aprovados.
- Smoke autenticado e somente leitura; nenhuma baixa, pagamento, envio ou
  exclusão foi executado.
- O painel não exibiu o aviso condicionado a `truncated=true`; portanto a
  consulta administrativa usada na leitura estava com `truncated=false`.

| Rota exata | Amostras | p50 | p95 | p99 | Banco p95 | Pool p95 | 5xx |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `/api/v1/ordens-servico` | 21 | 64,83 ms | 217,34 ms | 475,14 ms | 118,28 ms | 0,03 ms | 0 |
| `/api/v1/ordens-servico/cobrancas` | 20 | 71,44 ms | 111,98 ms | 2.889,97 ms | 77,02 ms | 0,03 ms | 0 |

As duas rotas ficaram separadas e com p95 abaixo da meta inicial de 1.200 ms.
A amostra atingiu o mínimo preliminar de 20 leituras por rota/release e não
teve erro 5xx. O p99 de Cobranças registrou um outlier de 2.889,97 ms; por isso
a evidência aprova o smoke e o p95 preliminar, mas não substitui uma janela
operacional maior.

Smokes HTTP externos após o deploy:

- rota web de stage: `200` em 310 ms;
- alias de stage: `200` em 522 ms;
- API protegida sem sessão: `401` em 375 ms, conforme esperado.

## Pendências operacionais

- [x] Confirmar em stage as duas rotas exatas, separadas e no release correto.
- [x] Executar somente `GET`, sem pagamentos, baixas, envios ou exclusões.
- [x] Obter ao menos 20 amostras por rota/release com `truncated=false`.
- [ ] Preferir 100 amostras por rota/release antes de comparar releases ou
  concluir sobre a cauda p99.
- [ ] Validar em produção somente após promover o snapshot exato de stage.
