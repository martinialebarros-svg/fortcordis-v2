# Verify - api-05-quality-gate-deploy-for31

Data: 2026-05-14  
Responsavel: Codex  
Status: done

## Matriz de rastreabilidade

| ID | Evidencia | Status |
| --- | --- | --- |
| CA-001 | `deploy-stage.yml` e `deploy.yml` atualizados com job `quality-gate`. | ok |
| CA-002 | Jobs de deploy agora dependem de `quality-gate` e `sdd-guardrail` em `needs`. | ok |
| CA-003 | Execução local de backend tests + frontend lint + frontend build concluída com sucesso. | ok |
| CA-004 | Ajuste em `backend/tests/test_permission_matrix_sync.py` cria `papeis` e `papeis_permissoes` em SQLite limpo antes do `dry-run`. | ok |

## Validacoes executadas

- `cd backend && ./venv/bin/python -m unittest discover -s tests -p "test_*.py"`
- `cd backend && ./venv/bin/python -m unittest backend/tests/test_permission_matrix_sync.py`
- `cd frontend && npm run lint`
- `cd frontend && npm run build`
