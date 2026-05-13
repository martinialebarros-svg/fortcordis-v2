# Verify - fiscal-numero-sequence-for23

Data: 2026-05-12  
Responsavel: Codex  
Status: done

## Matriz de rastreabilidade

| ID | Evidencia | Status |
| --- | --- | --- |
| CA-001 | `test_migration_backfills_sequence_table_with_existing_numbers` valida backfill por ano. | ok |
| CA-002 | `test_concurrent_creations_generate_unique_numbers` valida unicidade sob concorrencia. | ok |
| CA-003 | Mesmo teste valida `ultimo_numero` no ano corrente igual ao total criado. | ok |
| CA-004 | `fiscal_service._gerar_numero` possui fallback para estrategia legada ao detectar tabela ausente. | ok |

## Validacoes executadas

- `backend/venv/bin/python -m unittest backend/tests/test_fiscal_numero_sequence.py`
- `backend/venv/bin/python -m unittest backend/tests/test_fiscal_numero_unicidade.py`
- `backend/venv/bin/python -m py_compile backend/app/services/fiscal_service.py backend/app/main.py backend/app/models/fiscal.py backend/migrations/versions/20260512_35_fiscal_numero_sequence.py`
- `python3 -m unittest backend/tests/test_sdd_guardrail.py`
