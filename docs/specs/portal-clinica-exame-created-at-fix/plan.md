# Plan - portal-clinica-exame-created-at-fix

Data: 2026-08-16
Responsavel: Claude (pareado com Martiniano)
Status: implementado

## Tarefas

- [x] T1 Diagnostico: reproduzir o 500 via sessao real de clinica
  parceira (Clinica #8, stage), confirmar via `journalctl` na VPS
  (console web da Vultr, sem SSH) o traceback exato:
  `psycopg2.errors.DatatypeMismatch: COALESCE types timestamp without
  time zone and text cannot be matched`, e inspecionar via script
  read-only (`app.db.database.engine`) os tipos reais de
  `exames.created_at` (TEXT) e `laudos.created_at`/demais colunas de
  data (ja TIMESTAMP - sem problema).
- [x] T2 Migration `20260816_68_exame_created_at_timestamp_fix.py`,
  seguindo o padrao de `20260514_37_people_datetime_normalization.py`.
- [x] T3 Testes unitarios (`test_exame_created_at_timestamp_migration.py`)
  cobrindo: no-op em SQLite, no-op se tabela ausente, no-op se coluna
  ja e timestamp, conversao real no Postgres, idempotencia.
- [x] T4 Verificacao end-to-end contra Postgres real (nao SQLite): subiu
  um Postgres local descartavel (Homebrew, `initdb`/`pg_ctl`),
  recriou o schema quebrado com dado no formato real
  (`'2026-08-16 00:21:35.626104+00'`), reproduziu o erro exato,
  rodou a migration, confirmou tipo corrigido, idempotencia, e que a
  query que antes quebrava agora roda e devolve o resultado
  semanticamente correto.
- [x] T5 Suite completa do backend (`pytest tests/ -q`) sem regressao.
- [ ] T6 Deploy em stage e reverificacao ao vivo via a mesma sessao
  real de clinica parceira (Clinica #8) que originou o achado -
  confirmar que `/api/v1/portal/clinicas/exames` deixa de retornar
  500.
