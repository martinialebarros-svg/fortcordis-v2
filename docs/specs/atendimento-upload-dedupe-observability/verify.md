# Verify - atendimento-upload-dedupe-observability

Data: 2026-04-04  
Responsavel: Equipe FortCordis  
Status: approved

## 1) Matriz de rastreabilidade

| ID | Tipo | Evidencia | Status |
| --- | --- | --- | --- |
| CA-001 | aceitacao | instrumentacao `upload_novo` no endpoint | ok |
| CA-002 | aceitacao | instrumentacao `dedupe_precheck` no endpoint | ok |
| CA-003 | aceitacao | instrumentacao `dedupe_collision` no endpoint | ok |
| CA-004 | aceitacao | `test_consultar_metricas_upload_dedupe_returns_daily_aggregation` | ok |
| CA-005 | aceitacao | fluxo de upload preservado + lint frontend | ok |

## 2) Testes automatizados executados

Comandos executados:

```bash
backend/.venv/Scripts/python -m unittest backend/tests/test_atendimento_upload_service.py backend/tests/test_atendimento_upload_endpoint.py backend/tests/test_upload_dedupe_metrics_endpoint.py -v
npm --prefix frontend run lint -- --file app/atendimento/page.tsx
```

Resumo:
- Backend: 23 testes executados, 23 pass.
- Frontend lint: sem warnings/erros.

## 3) Testes manuais

- Local:
- [x] Executar uploads novos e deduplicados e validar contagem no endpoint de metrica.
- [x] Validar filtro por `clinica_id`.
- [x] Validar intervalo `data_inicio/data_fim`.

- Stage:
- [x] Repetir os 3 cenarios acima em `stage.fortcordis.com.br`.

- Producao:
- [x] Smoke test apos deploy da `main` sem regressao no endpoint de metrica/dedupe.

## 4) Regressao e riscos residuais

- Risco residual 1: contagem pode divergir se houver rollback apos registro em cenarios extremos.
- Risco residual 2: crescimento da tabela de metrica requer politica futura de retencao.

## 5) Itens fora de escopo entregues

- Dashboard grafico e alertas automaticos.

## 6) Decisao de release

- [x] Aprovado para stage.
- [x] Aprovado para producao.
- [ ] Nao aprovado (descrever motivo).

Motivo atual:
- Entrega validada em local, stage e producao.
