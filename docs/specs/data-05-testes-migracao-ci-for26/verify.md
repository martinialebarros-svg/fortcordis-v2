# Verify - data-05-testes-migracao-ci-for26

Data: 2026-05-14  
Responsavel: Codex  
Status: done

## Matriz de rastreabilidade

| ID | Evidencia | Status |
| --- | --- | --- |
| CA-001 | Workflow `.github/workflows/migrations-ci.yml` com gatilhos `push` e `pull_request` em `stage/main`. | ok |
| CA-002 | `test_run_migrations_up_down_up_cycle` valida ciclo `up/down/up` com banco SQLite efêmero. | ok |
| CA-003 | Workflow executa testes de constraints/índices de migração existentes (`fiscal` e índices compostos). | ok |

## Validacoes executadas

- `backend/venv/bin/python -m unittest backend/tests/test_migration_ci_cycle.py`
- `backend/venv/bin/python -m unittest backend/tests/test_people_datetime_normalization_migration.py`
- `backend/venv/bin/python -m unittest backend/tests/test_fiscal_numero_unicidade.py`
- `backend/venv/bin/python -m unittest backend/tests/test_fiscal_numero_sequence.py`
- `backend/venv/bin/python -m unittest backend/tests/test_critical_composite_indexes.py`
