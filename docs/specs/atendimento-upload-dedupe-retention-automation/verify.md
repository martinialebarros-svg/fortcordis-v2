# Verify - atendimento-upload-dedupe-retention-automation

Data: 2026-04-05  
Responsavel: Equipe FortCordis  
Status: done

## 1) Matriz de rastreabilidade

| ID | Tipo | Evidencia | Status |
| --- | --- | --- | --- |
| CA-001 | aceitacao | worker iniciado no startup (`backend/app/main.py`) e loop interno com polling no servico (`backend/app/services/upload_dedupe_cleanup_service.py`) | ok |
| CA-002 | aceitacao | regra `interval_not_reached` no servico + teste `test_run_automatic_cleanup_respects_interval_not_reached` | ok |
| CA-003 | aceitacao | endpoint `GET /upload-metrics/dedupe/cleanup/status` + payload consolidado no servico | ok |
| CA-004 | aceitacao | excecoes tratadas sem derrubar API (`maybe_run_automatic_upload_dedupe_cleanup`) e run de erro persistido | ok |
| CA-005 | aceitacao | endpoint manual `POST /upload-metrics/dedupe/cleanup` preservado | ok |
| CA-006 | aceitacao | `_require_admin_cleanup_access` com `403` + testes de autorizacao admin/nao-admin | ok |
| CA-007 | aceitacao | lock local e lock transacional Postgres (`pg_try_advisory_xact_lock`) para evitar concorrencia | ok |
| CA-008 | aceitacao | retencao de historico em `upload_dedupe_cleanup_runs` no proprio cleanup + config dedicada | ok |
| CA-009 | aceitacao | timeout configuravel (`UPLOAD_DEDUPE_METRICS_AUTOCLEAN_TIMEOUT_SECONDS`) com erro controlado | ok |
| CA-010 | aceitacao | jitter no startup (`UPLOAD_DEDUPE_METRICS_AUTOCLEAN_STARTUP_JITTER_SECONDS`) aplicado antes do primeiro ciclo | ok |
| CA-011 | aceitacao | contador de falhas consecutivas + `alert_active` e log de alerta a partir de 3 falhas | ok |
| CA-012 | aceitacao | delete em lotes por `batch_size` para metricas e runs | ok |

## 2) Testes automatizados executados

Comandos:

```bash
backend/venv/Scripts/python.exe -m unittest backend/tests/test_upload_dedupe_cleanup_service.py backend/tests/test_upload_dedupe_metrics_endpoint.py -v
```

Resumo dos resultados:
- 14 testes executados.
- 14 testes aprovados.
- Cobertura direta: intervalo, falhas consecutivas/alerta, endpoint manual/status e autorizacao admin.

## 3) Testes manuais

- Stage: validacao operacional de cleanup automatico/manual e endpoint tecnico durante rollout.
- Producao: smoke apos deploy concluido e estabilidade confirmada pelo operador.

## 4) Regressao e riscos residuais

- Risco residual 1: testes automatizados atuais nao simulam multi-instancia real em Postgres; mitigacao parcial por lock advisory no codigo.
- Risco residual 2: jitter e timeout estao cobertos por implementacao/config, com validacao operacional principal em stage/producao.

## 5) Itens fora de escopo entregues

- Nenhum.

## 6) Decisao de release

- [x] Aprovado para stage.
- [x] Aprovado para producao.
- [ ] Nao aprovado (descrever motivo).
