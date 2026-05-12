# Verify - fiscal-numero-unico-for22

Data: 2026-05-12  
Responsavel: Codex  
Status: done

## Matriz de rastreabilidade

| ID | Evidencia | Status |
| --- | --- | --- |
| CA-001 | `test_upgrade_creates_unique_index_and_blocks_new_duplicates` cria `uq_notas_fiscais_numero`. | ok |
| CA-002 | `test_upgrade_fails_when_duplicate_numero_exists` falha com erro de duplicidade. | ok |
| CA-003 | Mesmo teste valida `IntegrityError` ao reinserir numero ja existente. | ok |
| CA-004 | `test_criar_nota_retries_when_numero_conflicts` valida retry e sucesso com novo numero. | ok |

## Validacoes executadas

- `backend/venv/bin/python -m unittest backend/tests/test_fiscal_numero_unicidade.py`
- `backend/venv/bin/python -m unittest backend/tests/test_fiscal_exportacao_consolidada.py`
- `backend/venv/bin/python -m py_compile backend/app/services/fiscal_service.py backend/app/api/v1/endpoints/fiscal.py backend/app/models/fiscal.py backend/migrations/versions/20260512_34_fiscal_numero_unico.py`
- `python3 -m unittest backend/tests/test_sdd_guardrail.py`
