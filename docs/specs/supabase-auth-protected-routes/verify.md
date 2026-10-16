# Verify - Supabase Auth e rotas protegidas

Data: 2026-10-13
Status: verificacao automatizada local concluida; integracao real pendente

## Matriz de rastreabilidade

| ID | Tipo | Evidencia | Status |
| --- | --- | --- | --- |
| CA-001 | aceitacao | Leitura de `backend/app/core/config.py` e `backend/.env.example`: `AUTH_PROVIDER=local` | ok |
| CA-002 | aceitacao | `backend/tests/test_supabase_auth.py`, executado nesta iteracao com respostas simuladas do provedor e FakeDB | ok |
| CA-003 | aceitacao | Suite frontend, incluindo `server-route-auth.test.ts`, `auth-refresh.test.ts` e `dashboard-shell-routes.test.ts` | ok |
| CA-004 | aceitacao | Teste de identidade em SQLite e 30 testes da suite Migration CI local | ok |
| CA-005 | aceitacao | TypeScript sem erros, 633 testes Vitest e 9 testes Node; guardrail no diff base/head e revisao documental | ok |
| CA-006 | aceitacao | Login, refresh, logout e permissoes reais com conta vinculada no ambiente alvo nao executados nesta iteracao | pendente |
| NFR-001 | seguranca | Testes de cookies HttpOnly/Secure e ausencia de tokens do provedor no corpo; revisao de CSRF/JWT | ok |
| NFR-002 | resiliencia | Testes simulados de middleware: cookie forjado, backend indisponivel, no-store e encaminhamento de cookies | ok |
| NFR-003 | autorizacao | Leitura de `security.py`: vinculo e matriz interna; nenhum arquivo de permissao/RLS modificado nesta correcao | ok |

## Verificacoes executadas nesta iteracao

Checkout isolado da branch da PR #348, partindo de
`6e451e4da981d443ba0e33cc0abae805cb4c3684`. Python 3.11.15 do venv ja
existente, executando o codigo deste checkout; Node 20 e dependencias instaladas
por `npm ci --no-audit --no-fund`, sem mudanca no lockfile.

```bash
DATABASE_URL=sqlite:// SECRET_KEY=sdd-validation-only-strong-key-123456789 \
  python -m pytest backend/tests/test_supabase_auth.py backend/tests/test_sdd_guardrail.py -q

DATABASE_URL=sqlite:////tmp/pr348-migration-ci.db \
  SECRET_KEY=migration-ci-workflow-secret-key-1234567890 \
  python -m unittest \
    backend/tests/test_migration_ci_cycle.py \
    backend/tests/test_people_datetime_normalization_migration.py \
    backend/tests/test_fiscal_numero_unicidade.py \
    backend/tests/test_fiscal_numero_sequence.py \
    backend/tests/test_critical_composite_indexes.py \
    backend/tests/test_portal_escopo_sessao.py \
    backend/tests/test_portal_clinic_device_trust.py

cd frontend
npx tsc --noEmit
npm test
```

Resultados: pytest 18 passed (18 avisos de deprecacao); unittest 30 testes OK;
TypeScript exit 0; Vitest 86 arquivos/633 testes passaram; Node 9 testes passaram.
O erro SMTP presente no log da suite de migracoes e um cenario simulado do teste,
com resultado final OK. Nao houve acesso a banco remoto ou envio real de email.

Revisao: apenas quatro arquivos Markdown adicionados. `git diff --check` e
o guardrail SDD foram executados no diff com os documentos completos. O comando
do guardrail para o commit publicado e:

```bash
python3 scripts/ci/check_sdd_guardrail.py \
  --base-sha 7808a1971b3e6e89f4d51b022e1f7aa0748f02d4 --head-sha HEAD
```

## CI e evidencias anteriores

Na consulta inicial de 13/10/2026, o head anterior tinha Migration CI e os
dois jobs Frontend CI aprovados; SDD Guardrail falhou por ausencia de SDD.
Os resultados do novo commit devem ser consultados nos checks da
[PR #348](https://github.com/martinialebarros-svg/fortcordis-v2/pull/348).
Esta tabela registra a execucao local; nao antecipa o resultado do CI apos push.
As verificacoes historicas descritas em `docs/supabase-auth.md` nao foram
reexecutadas contra Supabase nesta correcao.

## Limites e decisao operacional

Nao foram executados build, lint ou smoke HTTP nesta iteracao exclusivamente
documental; os gates pertinentes sao tipos, testes de frontend, migracoes e SDD.
Nao houve teste manual em navegador ou login Supabase end-to-end. Fixtures
e SQLite nao comprovam comportamento real do provedor, PostgreSQL remoto,
SMTP, rotacao entre abas ou permissoes de usuarios reais. CA-006 permanece
pendente e deve ser validado antes de ativacao.

Nenhum item funcional fora do escopo foi entregue. `AUTH_PROVIDER` continua
local por padrao; nao foram alterados banco remoto, contas, permissoes ou RLS.
PR deve permanecer draft. Merge, deploy e ativacao nao estao autorizados por
esta verificacao nem pela conclusao dos checks.

- [ ] Aprovado para deploy em stage.
- [ ] Aprovado para producao.
- [x] Sem decisao de release: correcao restrita a documentacao e CI da PR.
