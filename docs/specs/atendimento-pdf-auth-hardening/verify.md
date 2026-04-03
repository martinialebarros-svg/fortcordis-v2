# Verify - atendimento-pdf-auth-hardening

Data: 2026-04-03  
Responsavel: Equipe FortCordis  
Status: approved

## 1) Matriz de rastreabilidade

| ID | Tipo | Evidencia | Status |
| --- | --- | --- | --- |
| CA-001 | aceitacao | `test_rejects_access_token_query_even_with_valid_bearer` | ok |
| CA-002 | aceitacao | `test_requires_bearer_header` | ok |
| CA-003 | aceitacao | `test_rejects_invalid_bearer` | ok |
| CA-004 | aceitacao | `test_returns_user_for_valid_bearer` | ok |
| CA-005 | aceitacao | `backend/.venv/Scripts/python -m unittest backend/tests/test_atendimento_pdf_auth.py -v` | ok |
| NFR-001 | nao funcional | bloqueio explicito no helper `_autenticar_usuario_pdf` | ok |
| NFR-002 | nao funcional | testes cobrindo `400` (query token), `401` (sem/invalid bearer), `403` (usuario inativo) | ok |
| NFR-003 | nao funcional | detalhe de erro orientativo para uso de header bearer | ok |

## 2) Testes automatizados executados

Comandos:

```bash
# backend
backend/.venv/Scripts/python -m unittest backend/tests/test_atendimento_pdf_auth.py -v
backend/.venv/Scripts/python -m unittest backend/tests/test_atendimento_pdf_auth.py backend/tests/test_atendimento_upload_service.py backend/tests/test_atendimento_upload_endpoint.py -v
```

Resumo dos resultados:
- Backend: suite alvo (5/5 pass) e regressao relacionada (19/19 pass).
- Frontend: nao aplicavel nesta iteracao.

## 3) Testes manuais

- Cenario 1: download PDF prescricao com sessao autenticada.
- Cenario 2: download PDF exames com sessao autenticada.
- Cenario 3: tentativa manual com query token sem header (esperado: bloqueio `400`).
- Status: pendente (nao executado nesta rodada local automatizada).

## 4) Regressao e riscos residuais

- Risco residual 1: cliente externo legado com query token deixar de funcionar.
- Risco residual 2: ausencia de teste de integracao HTTP fim a fim nesta iteracao.

## 5) Itens fora de escopo entregues

- Nenhum item fora de escopo entregue nesta iteracao.

## 6) Decisao de release

- [ ] Aprovado para stage.
- [ ] Aprovado para producao.
- [ ] Nao aprovado (descrever motivo).

## 7) Checklist operacional rapido (stage)

1. Abrir atendimento autenticado no stage e gerar PDF de prescricao.
2. Gerar PDF de exames no mesmo atendimento.
3. Chamar endpoint PDF manualmente com `?access_token=abc` e sem header.
4. Confirmar retorno `400` com mensagem orientando `Authorization: Bearer`.
5. Confirmar que nao houve erro `500` nos logs do backend stage.
