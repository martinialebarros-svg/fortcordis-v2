# Verify - atendimento-upload-backend-dedupe

Data: 2026-04-04  
Responsavel: Equipe FortCordis  
Status: approved

## 1) Matriz de rastreabilidade

| ID | Tipo | Evidencia | Status |
| --- | --- | --- | --- |
| CA-001 | aceitacao | `test_upload_anexo_returns_200_existing_attachment_when_hash_matches` | ok |
| CA-002 | aceitacao | `test_upload_anexo_returns_201_payload_when_storage_succeeds` | ok |
| CA-003 | aceitacao | validacao manual em atendimento diferente e escopos distintos | ok |
| CA-004 | aceitacao | `store_atendimento_attachment_file` nao chamado em dedupe (`call_count=0`) | ok |
| CA-005 | aceitacao | suites upload backend + lint frontend | ok |

## 2) Testes automatizados executados

Comandos executados:

```bash
backend/.venv/Scripts/python -m unittest backend/tests/test_atendimento_upload_service.py backend/tests/test_atendimento_upload_endpoint.py -v
npm --prefix frontend run lint -- --file app/atendimento/page.tsx
```

Resumo:
- Backend: 17 testes executados, 17 pass.
- Frontend lint: sem warnings/erros.

## 3) Testes manuais

- Local:
- [x] Mesmo arquivo no mesmo atendimento/exame retorna dedupe (`200`, sem novo registro).
- [x] Mesmo arquivo em atendimento diferente cria novo anexo (nao dedupe).
- [x] Mesmo arquivo com `exame_id` diferente no mesmo atendimento respeita escopo.
- [x] Mensagem frontend para dedupe exibida sem erro vermelho.

- Stage:
- [x] Repetir os 4 cenarios acima em `stage.fortcordis.com.br`.

- Producao:
- [x] Smoke test apos deploy da `main` concluido sem regressao de upload.

## 4) Regressao e riscos residuais

- Risco residual 1: condicao de corrida em uploads identicos quase simultaneos.
- Risco residual 2: registros antigos sem `arquivo_hash` nao participam de dedupe ate novo upload.

## 5) Itens fora de escopo entregues

- Dedupe global cross-atendimento.
- Backfill retroativo de hash para anexos antigos.

## 6) Decisao de release

- [x] Aprovado para stage.
- [x] Aprovado para producao.
- [ ] Nao aprovado (descrever motivo).

Motivo atual:
- Entrega validada em local, stage e producao.
