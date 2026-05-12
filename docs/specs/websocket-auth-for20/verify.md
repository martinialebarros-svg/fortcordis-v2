# Verify - websocket-auth-for20

Data: 2026-05-12  
Responsavel: Codex  
Status: done

## Matriz de rastreabilidade

| ID | Evidencia | Status |
| --- | --- | --- |
| CA-001 | `test_accepts_active_user` autentica usuario valido. | ok |
| CA-002 | `test_rejects_missing_credentials` retorna `1008`. | ok |
| CA-003 | `test_rejects_invalid_token` e `test_rejects_unknown_user` retornam `1008`. | ok |
| CA-004 | `test_rejects_inactive_user` retorna `1008`. | ok |

## Validacoes executadas

- `python3 -m unittest backend/tests/test_websocket_auth.py`
- `python3 -m py_compile backend/app/core/security.py backend/app/main.py`
