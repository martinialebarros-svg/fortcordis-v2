# Verify - atendimento-upload-dedupe-metrics-retention

Data: 2026-04-04  
Responsavel: Equipe FortCordis  
Status: in-progress

## 1) Matriz de rastreabilidade

| ID | Tipo | Evidencia | Status |
| --- | --- | --- | --- |
| CA-001 | aceitacao | `DELETE` com cutoff em `created_at` e comparacao `< cutoff_datetime` | ok |
| CA-002 | aceitacao | payload do endpoint com `retention_days`, `cutoff_date`, `deleted_rows` | ok |
| CA-003 | aceitacao | endpoint de consulta permanece com testes existentes passando | ok |
| CA-004 | aceitacao | testes de cleanup com expirados e sem expirados | ok |
| CA-005 | aceitacao | suites de upload/dedupe + lint frontend sem regressao | ok |

## 2) Testes automatizados executados

Comandos executados:

```bash
python -m unittest tests.test_atendimento_upload_service tests.test_atendimento_upload_endpoint tests.test_upload_dedupe_metrics_endpoint
npm --prefix frontend run lint -- --file app/atendimento/page.tsx
```

Resumo:
- Backend: 27 testes executados, 27 pass.
- Frontend lint: sem warnings/erros.

## 3) Testes manuais

- Local:
- [x] Executar endpoint `POST /api/v1/atendimentos/upload-metrics/dedupe/cleanup` e confirmar retorno com `deleted_rows`.
- [x] Executar `GET /api/v1/atendimentos/upload-metrics/dedupe` apos cleanup sem erro.

- Stage:
- [ ] Rodar cleanup em `stage.fortcordis.com.br` com massa controlada.
- [ ] Validar endpoint de metrica apos cleanup.

- Producao:
- [ ] Executar smoke test apos promover `main`.

## 4) Regressao e riscos residuais

- Risco residual 1: cleanup depende de execucao manual ate agendamento ser definido.
- Risco residual 2: valor de retencao invalido em ambiente retorna erro 500 no endpoint de cleanup.

## 5) Itens fora de escopo entregues

- Agendamento automatico (cron/startup) da limpeza.
- Dashboard historico de longo prazo.

## 6) Decisao de release

- [x] Aprovado para stage.
- [ ] Aprovado para producao.
- [ ] Nao aprovado (descrever motivo).

Motivo atual:
- Implementacao e testes locais concluidos; validacao em stage/producao pendente.
