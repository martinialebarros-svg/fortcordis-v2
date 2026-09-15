# Verify - portal-clinica-exame-created-at-fix

Data: 2026-08-16
Responsavel: Claude (pareado com Martiniano)
Status: implementado, deploy em stage confirmado

## 1) Matriz de rastreabilidade

| ID | Evidencia | Status |
| --- | --- | --- |
| RF-1 | Postgres local descartavel: coluna `created_at TEXT` com valores reais (`'2026-08-16 00:21:35.626104+00'`, `'2026-07-05 20:29:27.614885+00'`) convertida para `timestamp without time zone` preservando os valores (`SELECT` pos-migration confirma). | ok |
| RF-2 | Linha com `created_at` nulo antes da migration recebeu `NOW()` apos o `ALTER` (confirmado no mesmo teste local). | ok |
| RF-3 | `test_upgrade_e_idempotente` + segunda chamada manual de `upgrade()` no Postgres local: nenhum `ALTER`/`UPDATE` adicional na segunda vez. | ok |
| RF-4 | `test_upgrade_ignora_dialetos_diferentes_de_postgres`: `connection.execute` nunca chamado com `dialect="sqlite"`. | ok |
| RF-5 | Reproduzido no Postgres local: a mesma query de `_build_clinic_operational_panel` (`coalesce(data_solicitacao, data_resultado, created_at)` sobre exames sem `laudo_id`) falhava com `DatatypeMismatch` antes da migration e roda normalmente depois, com resultado semanticamente correto (so contou o exame cuja data cai no dia certo). | ok |
| NFR-1 | `git diff` do fix contem so a migration + os testes - nenhum arquivo em `app/api`/`app/models` alterado. | ok |
| NFR-2 | Migration revisada lado a lado com `20260514_37_people_datetime_normalization.py` - mesma estrutura (`inspect`, `CASE`/regex, `DROP DEFAULT`/`SET DEFAULT NOW()`). | ok |

## 2) Diagnostico (como o traceback real foi obtido)

Sem acesso SSH a VPS (nem eu nem o usuario tinhamos a chave), o
traceback foi obtido via console web da Vultr (`console.vultr.com` ->
instancia `fortcordis-prod-sp`, que hospeda tanto stage quanto
producao -> "View Console", terminal no navegador sem precisar de
chave SSH) rodando:

```bash
journalctl -u fortcordis-stage-backend -n 1000 --no-pager | tail -150
```

Traceback relevante:

```
sqlalchemy.exc.ProgrammingError: (psycopg2.errors.DatatypeMismatch) COALESCE types timestamp without time zone and text cannot be matched
LINE 4: ...e(exames.data_solicitacao, exames.data_resultado, exames.cre...
[SQL: SELECT count(*) AS count_1 FROM (SELECT ... FROM exames JOIN atendimentos_clinicos ON atendimentos_clinicos.id = exames.atendimento_id WHERE atendimentos_clinicos.clinica_id = %(clinica_id_1)s AND exames.laudo_id IS NULL AND coalesce(exames.data_solicitacao, exames.data_resultado, exames.created_at) >= %(coalesce_1)s AND coalesce(...) < %(coalesce_2)s) AS anon_1]
[parameters: {'clinica_id_1': 8, 'coalesce_1': datetime.datetime(2026, 8, 16, 0, 0), 'coalesce_2': datetime.datetime(2026, 8, 17, 0, 0)}]
```

Os tipos reais das colunas foram confirmados rodando, na propria VPS,
um script Python read-only usando `app.db.database.engine`:

```
exames -> {'data_exame': 'TEXT', 'created_at': 'TEXT', 'data_solicitacao': 'TIMESTAMP', 'data_resultado': 'TIMESTAMP'}
laudos -> {'data_laudo': 'TIMESTAMP', 'created_at': 'TIMESTAMP', 'updated_at': 'TIMESTAMP', 'data_exame': 'TIMESTAMP'}
```

(`exames.data_exame` tambem esta como TEXT, mas e coluna orfa sem uso
no modelo/codigo atual - ver `intent.md`, secao "Fora de escopo".)

A sessao usada para achar o bug foi validada como uma sessao real de
clinica parceira (nao o preview administrativo) decodificando o JWT do
header `Authorization` da requisicao que falhou:
`portal_auth_method: "password_mfa"`, `portal_channel:
"email_password"`, `portal_account_id`/`portal_session_id` presentes -
confirma que o login real (convite -> ativacao -> senha -> MFA)
funcionou de ponta a ponta; o 500 e um bug de dados/schema separado,
nao um problema no fluxo de autenticacao.

## 3) Testes automatizados executados

```bash
cd backend && venv/bin/python -m pytest tests/test_exame_created_at_timestamp_migration.py -v
# 5 passed

cd backend && venv/bin/python -m pytest tests/ -q
# 745 passed, 25 warnings, 41 subtests passed
```

## 4) Verificacao manual contra Postgres real (nao SQLite)

Como o bug e uma incompatibilidade de tipos especifica do Postgres (a
suite de testes do projeto roda inteiramente em SQLite, que nao
distingue TEXT de TIMESTAMP da mesma forma), a correcao foi validada
contra uma instancia Postgres local descartavel (Homebrew,
`initdb`/`pg_ctl`, removida ao final):

1. Recriado o schema quebrado (`exames.created_at TEXT`,
   `data_solicitacao`/`data_resultado TIMESTAMP`) com 3 linhas usando o
   formato de valor real encontrado em stage.
2. Confirmado que a query de `_build_clinic_operational_panel` falha
   com o mesmo erro exato antes da migration.
3. Rodada `migration.upgrade(conn, "postgresql")` - sucesso, coluna
   convertida, valores preservados.
4. Rodada de novo - idempotente, nenhum `ALTER`/`UPDATE` extra.
5. A mesma query voltou a funcionar, com resultado correto.

## 5) Regressao e riscos residuais

- Risco residual 1: `exames.data_exame` (coluna orfa, TEXT) nao foi
  corrigida por estar fora de escopo (sem uso ativo) - se algum codigo
  futuro passar a le-la, o mesmo tipo de bug pode se repetir. Vale
  revisitar/remover essa coluna orfa numa limpeza futura.
- Risco residual 2: nao investiguei se outras tabelas alem de
  `exames`/`laudos` tem o mesmo tipo de drift (`created_at`/`updated_at`
  como texto) - o escopo desta correcao foi estritamente o bug
  reproduzido.

## 6) Confirmacao ao vivo em stage

Push para `origin/stage` (commit `24076b05`) -> `quality-gate`,
`sdd-guardrail` e `deploy-stage` passaram (migration rodou no deploy).
Usuario recarregou a mesma sessao real de clinica parceira (Clinica #8)
que originou o achado: erro sumiu, exames carregando normalmente.

- [x] Deploy em stage e reverificacao ao vivo confirmados.
