# Plan - Supabase Auth e rotas protegidas

Data: 2026-10-13
Status: correcao documental autorizada; integracao real pendente

## Sequencia desta iteracao

1. Conferir head, draft e checks da PR #348; inspecionar diff e contrato sem
   alterar os arquivos funcionais. A ausencia de SDD foi confirmada no head
   `6e451e4da981d443ba0e33cc0abae805cb4c3684`.
2. Criar `intent.md`, `spec.md`, `plan.md` e `verify.md` retrospectivos, sem
   afirmar que existiam antes da implementacao nem inventar validacao manual.
3. Executar testes focados de auth/guardrail e checks dos workflows pertinentes,
   usando SQLite local/fixtures, sem configuracao ou consultas remotas Supabase.
4. Revisar diff exclusivamente documental, executar guardrail no intervalo
   base/head, commitar e enviar a branch existente. Acompanhar CI do novo SHA
   ate conclusao ou bloqueio real, mantendo a PR draft.

## Plano de verificacao

- Backend: `test_supabase_auth.py` e `test_sdd_guardrail.py` com pytest.
- Migracoes: suite de sete arquivos definida em `migrations-ci.yml`.
- Frontend: dependencias pelo lockfile, `npx tsc --noEmit`, `npm test`.
- Documentacao: revisao dos contratos contra codigo, `git diff --check` e
  `scripts/ci/check_sdd_guardrail.py` no intervalo usado pela PR.
- Testes manuais de login real: nao executar nesta iteracao; requerem ambiente
  configurado e contas vinculadas, alem de autorizacao operacional propria.

## Riscos, rollback e conclusao

Rollback desta correcao: reverter apenas seu commit de documentacao. Nenhum
arquivo funcional, conta ou banco remoto muda. Aprovacao da documentacao e CI
nao autoriza merge, deploy ou ativacao. O criterio de conclusao e documentacao
coerente, commit na mesma PR draft e relato fiel dos checks e limites.
