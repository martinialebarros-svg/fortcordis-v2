# Spec - portal-clinica-exame-created-at-fix

Data: 2026-08-16
Responsavel: Claude (pareado com Martiniano)
Status: implementado

## Requisitos funcionais (RF)

- RF-1: em bancos Postgres onde `exames.created_at` ainda e do tipo
  texto, uma migration corrige o tipo para `TIMESTAMP`, preservando os
  valores existentes (parse do formato `YYYY-MM-DD HH:MI:SS[.ffffff][+TZ]`
  ja usado na base real).
- RF-2: linhas com `created_at` nulo ou vazio apos a conversao recebem
  `NOW()` como valor (mesmo criterio ja usado em
  `20260324_19_exames_schema_drift_compat.py` para backfill de
  colunas obrigatorias).
- RF-3: a migration e idempotente - rodar de novo sobre uma coluna ja
  corrigida nao executa nenhum `ALTER`/`UPDATE`.
- RF-4: em SQLite (dev/testes locais) a migration e um no-op - a
  coluna ja nasce com o tipo certo a partir do modelo
  (`Column(DateTime(timezone=True))`), o drift so existe em bases
  Postgres antigas.
- RF-5: apos a migration, `GET /api/v1/portal/clinicas/exames` (sessao
  real de clinica) deixa de retornar 500 para clinicas com exames sem
  `laudo_id` (o ramo de `_build_clinic_operational_panel` que fazia o
  `COALESCE` quebrado).

## Nao-funcionais

- NFR-1: nenhuma mudanca de codigo de aplicacao (`app/api/...`,
  `app/models/...`) - o fix e so de schema/migration.
- NFR-2: a migration segue o mesmo padrao ja estabelecido em
  `20260514_37_people_datetime_normalization.py` (usa `inspect` para
  checar o tipo atual, `CASE`/regex pra validar o formato antes do
  cast, `DROP DEFAULT`/`SET DEFAULT NOW()` em volta do `ALTER COLUMN
  TYPE`).
