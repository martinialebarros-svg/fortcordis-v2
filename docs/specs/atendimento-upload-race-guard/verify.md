# Verify - atendimento-upload-race-guard

Data: 2026-04-04  
Responsavel: Equipe FortCordis  
Status: approved

## 1) Matriz de rastreabilidade

| ID | Tipo | Evidencia | Status |
| --- | --- | --- | --- |
| CA-001 | aceitacao | teste de colisao com `IntegrityError` + anexo unico recuperado | ok |
| CA-002 | aceitacao | resposta deduplicada em caminho concorrente (`200`, `deduplicado=true`) | ok |
| CA-003 | aceitacao | fluxo normal de upload continua criando novos anexos | ok |
| CA-004 | aceitacao | `test_upload_anexo_handles_integrity_error_as_dedupe_response` | ok |
| CA-005 | aceitacao | migracao 20260404_22 + testes backend/lint frontend | ok |

## 2) Testes automatizados executados

Comandos executados:

```bash
backend/.venv/Scripts/python -m unittest backend/tests/test_atendimento_upload_service.py backend/tests/test_atendimento_upload_endpoint.py -v
npm --prefix frontend run lint -- --file app/atendimento/page.tsx
```

Resumo:
- Backend: 20 testes executados, 20 pass.
- Frontend lint: sem warnings/erros.

## 3) Testes manuais

- Local:
- [x] Simular dois uploads identicos quase simultaneos e validar um unico registro final.
- [x] Confirmar que segunda tentativa retorna dedupe sem erro 500.
- [x] Confirmar cleanup de arquivo temporario em colisao (sem lixo em storage).

- Stage:
- [x] Repetir os 3 cenarios acima em `stage.fortcordis.com.br`.

- Producao:
- [x] Smoke test apos deploy da `main` sem regressao no fluxo de upload.

## 4) Regressao e riscos residuais

- Risco residual 1: diferencas de transacao entre SQLite e Postgres sob carga alta.
- Risco residual 2: anexos legados sem `dedupe_key` dependem de uploads novos para cobertura completa.

## 5) Itens fora de escopo entregues

- Lock distribuido multi-instancia.
- Deduplicacao cross-atendimento.

## 6) Decisao de release

- [x] Aprovado para stage.
- [x] Aprovado para producao.
- [ ] Nao aprovado (descrever motivo).

Motivo atual:
- Entrega validada em local, stage e producao.
