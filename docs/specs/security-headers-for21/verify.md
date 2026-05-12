# Verify - security-headers-for21

Data: 2026-05-12  
Responsavel: Codex  
Status: done

## Matriz de rastreabilidade

| ID | Evidencia | Status |
| --- | --- | --- |
| CA-001 | `test_always_sets_frame_and_nosniff_headers` | ok |
| CA-002 | `test_sets_csp_for_api_paths` e `test_sets_csp_for_health_endpoints` | ok |
| CA-003 | `test_does_not_set_csp_for_non_api_paths` | ok |
| CA-004 | `frontend/next.config.js` com `headers()` global e trio de headers | ok |

## Validacoes executadas

- `backend/venv/bin/python -m unittest backend/tests/test_security_headers.py`
- `backend/venv/bin/python -m py_compile backend/app/main.py backend/app/core/security_headers.py`
- `python3 -m unittest backend/tests/test_sdd_guardrail.py`
