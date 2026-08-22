# FortCordis - orientacoes para agentes

## Fluxo de entrega: stage-first

`main` e produção e faz deploy automatico a cada push. Por isso, **nenhuma
feature entra direto em `main`**:

- PR de feature/fix: base `stage`.
- Produção recebe depois, pelo PR de promocao `stage -> main`
  (`chore(release): promover <resumo>`) ou por `bash scripts/promote_stage_to_main.sh`.
- Hotfix urgente de produção e a unica excecao: branch `hotfix/<slug>` ou label
  `hotfix` no PR, mirando `main`. Depois de mergear o hotfix, faca o backport
  para `stage` na hora: a promocao seguinte resolve conflito em favor de `stage`
  por default e pode desfazer a correcao sem avisar.

`.github/workflows/branch-flow-guard.yml` sinaliza com falha qualquer PR que
mire `main` fora dessas condicoes. Detalhes e passos manuais de configuracao:
`docs/RUNBOOK-STAGE-PROD.md`.

## Mudanca de codigo exige artefatos SDD

Alteracao em `backend/`, `frontend/` ou `scripts/` precisa vir acompanhada de
`docs/specs/<feature-slug>/` com `intent.md`, `spec.md`, `plan.md` e
`verify.md` — `spec.md` e `verify.md` alterados no mesmo diff. O gate
`.github/workflows/sdd-guardrail.yml` reprova o PR sem isso. Processo completo
em `docs/SDD-WORKFLOW.md`.
