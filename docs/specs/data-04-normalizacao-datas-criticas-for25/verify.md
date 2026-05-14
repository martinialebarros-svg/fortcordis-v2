# Verify - data-04-normalizacao-datas-criticas-for25

Data: 2026-05-14  
Responsavel: Codex  
Status: done

## Matriz de rastreabilidade

| ID | Evidencia | Status |
| --- | --- | --- |
| CA-001 | `test_upgrade_normalizes_legacy_people_timestamps` executa migration em SQLite legado. | ok |
| CA-002 | Asserções validam normalização de timestamps com `T` e limpeza de blanks. | ok |
| CA-003 | Asserções garantem `created_at` preenchido após upgrade. | ok |
| CA-004 | Endpoints de `pacientes`, `tutores` e fluxo de `laudos` passam a gravar datetime via ORM. | ok |

## Validacoes executadas

- `backend/venv/bin/python -m unittest backend/tests/test_people_datetime_normalization_migration.py`
- `backend/venv/bin/python -m unittest backend/tests/test_agenda_busca_periodo_filtros.py`
- `backend/venv/bin/python -m unittest backend/tests/test_agenda_resumo_financeiro.py`
- `python3 scripts/ci/check_sdd_guardrail.py --base-sha 4678cb6ce2844d82f0fb0afe7d1b7a363eb7f135 --head-sha HEAD`

## Ajuste pós-deploy

- Corrigido fallback de migração PostgreSQL para cenários com default textual legado em `created_at`:
  - remoção explícita de default antes do cast de tipo para timestamp.
