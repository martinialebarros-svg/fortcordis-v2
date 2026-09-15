# Intent - portal-clinica-exame-created-at-fix

Data: 2026-08-16
Responsavel: Claude (pareado com Martiniano)
Status: implementado

## Motivacao

Durante a verificacao pendente de `portal-clinica-parceira-redesign`
("Risco residual 2: sessao real de clinica parceira nao testada"), o
usuario ativou de verdade uma conta de clinica em stage (convite ->
senha -> login com MFA) e testou o login real do `/clinica-parceira` -
nao mais so o espelho administrativo (`/clinicas/portal/espelho`).

O login funcionou; o painel de exames da clinica, porem, retornou
`500 Internal Server Error` (confirmado via journalctl na VPS,
`GET /api/v1/portal/clinicas/exames`). O espelho administrativo nunca
pegou esse bug porque so foi testado com uma clinica sintetica sem
exames "externos" (sem `laudo_id`) - o ramo de codigo que quebra so e
exercitado quando existe pelo menos um exame desse tipo, como e o caso
da clinica real usada no teste.

## Causa raiz confirmada

`exames.created_at` esta como `TEXT` no Postgres de stage (drift de uma
migracao antiga - `20260324_19_exames_schema_drift_compat.py` - que so
adiciona a coluna quando ausente, nunca corrige o tipo de uma coluna
existente). `_build_clinic_operational_panel`
(`backend/app/api/v1/endpoints/portal.py`) faz
`func.coalesce(Exame.data_solicitacao, Exame.data_resultado, Exame.created_at)`
para contar exames "externos" (sem laudo) realizados hoje; com
`created_at` como texto, o Postgres rejeita o COALESCE:
`psycopg2.errors.DatatypeMismatch: COALESCE types timestamp without
time zone and text cannot be matched`.

## Escopo

- Migration que corrige o tipo de `exames.created_at` em bases Postgres
  legadas (texto -> timestamp), seguindo o mesmo padrao ja usado em
  `20260514_37_people_datetime_normalization.py` para
  `pacientes`/`tutores.created_at`.
- Nenhuma mudanca de codigo de aplicacao e necessaria - o bug e
  exclusivamente de schema; uma vez a coluna com o tipo certo, o
  `COALESCE` volta a funcionar sem alteracao no endpoint.

## Fora de escopo

- `exames.data_exame` tambem aparece como `TEXT` no Postgres real, mas
  e uma coluna orfa (nao existe no modelo `Exame` atual, so em
  `Laudo`) e nao e referenciada por nenhum coalesce/query em uso -
  nao ha bug ativo associado, entao nao foi corrigida agora.
