# Verificacao

## Testes automatizados
- `backend/tests/test_jobs_idempotency_migration.py`
- `backend/tests/test_jobs_idempotency_services.py`

## Criterios
1. Migration cria coluna/hash e indices unicos parciais de jobs ativos.
2. Duplicados ativos legados sao normalizados para `failed`.
3. Duas chamadas de enqueue para mesma chave retornam o mesmo `job_id`.
