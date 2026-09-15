# Plan - promocao-bloqueia-criterio-pendente

Data: 2026-09-13
Responsavel: Martiniano

## T1 Calibrar a classificacao sobre o corpus real

- [x] T1.1 Levantar o vocabulario da coluna `Status` nos 240 `verify.md`
      (1631 linhas): o repo usa texto livre -- `ok`, `passou`, `aprovado`,
      `local_pass`, `concluido`, `parcial`, `pendente`, ...
- [x] T1.2 Descartar whitelist de aprovacao: reprovaria `passou`/`aprovado`.
- [x] T1.3 Medir regra "marcador no inicio" (41 linhas) contra "marcador em
      qualquer posicao" (58 linhas) e inspecionar a diferenca.
- [x] T1.4 Concluir que a diferenca contem pendencia real
      (`aprovado em stage; producao pendente`) e falso positivo real
      (`indice unico parcial de idempotency_key`), o que motivou o par
      forte/generico.

## T2 Script

- [x] T2.1 `scripts/ci/check_promotion_verify_pending.py`, seguindo a CLI do
      `check_sdd_guardrail.py` (`--base-sha`, `--head-sha`, `--repo-root`).
- [x] T2.2 Parser de tabela markdown ancorado no header `Status`.
- [x] T2.3 Flag `--allow-pending` para o escape hatch.

## T3 Wiring

- [x] T3.1 `.github/workflows/promotion-verify-guard.yml` em
      `pull_request: branches: [main]`, com `labeled`/`unlabeled` para a label
      re-disparar o check.
- [x] T3.2 Checkout em `head.sha` (nao no merge ref), para o `verify.md` lido
      ser exatamente o que o diff aponta.

## T4 Testes

- [x] T4.1 `backend/tests/test_promotion_verify_pending.py`, com o padrao
      `sys.modules[SPEC.name]` ja usado em `test_sdd_guardrail.py`.
- [x] T4.2 Simular a promocao PR #117 ponta a ponta.

## Risco residual

A classificacao e lexical. Um status que diga estar pendente sem usar nenhum
dos marcadores passa batido; um marcador em prosa incomum pode reprovar sem
motivo. Os dois casos sao visiveis no log do check, e a label destrava.
