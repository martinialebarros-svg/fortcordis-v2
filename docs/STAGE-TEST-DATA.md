# Stage Test Data Playbook

Scripts added for safe test-data operations on stage:

- `scripts/seed_stage_vps.sh`
- `scripts/reset_test_data_stage.sh`

Both scripts have guardrails and will refuse to run when:

1. Repo path does not look like stage (contains `stage`), unless `REQUIRE_STAGE_PATH=0`.
2. Current git branch is not `stage`, unless `EXPECTED_BRANCH` is changed.
3. `DATABASE_URL` is empty.
4. `DATABASE_URL` equals `PROD_DATABASE_URL` (when this env var is present).

## 1) Seed stage baseline

Run on stage VPS inside repo:

```bash
bash scripts/seed_stage_vps.sh
```

What it does:

1. Loads `backend/.env`.
2. Runs migrations/setup (`backend/setup_database.py`).
3. Runs synthetic baseline seed (`backend/seed_data.py`).
4. Runs idempotent seeders for exam catalog and clinical phrases.
5. Prints summary counts for key tables.

Optional custom phrase import:

```bash
IMPORT_CUSTOM_PHRASES=1 bash scripts/seed_stage_vps.sh
```

## 2) Reset prefixed test data

Default mode is dry-run:

```bash
bash scripts/reset_test_data_stage.sh --prefix TST-
```

Apply deletion:

```bash
bash scripts/reset_test_data_stage.sh --prefix TST- --apply
```

Delete only old test rows (when `created_at` exists):

```bash
bash scripts/reset_test_data_stage.sh --prefix TST- --older-than-days 7 --apply
```

The cleanup script removes only rows linked to prefixed test entities and their dependent data (agenda, laudos, exames, atendimento clinico, financeiro, OS, etc).
