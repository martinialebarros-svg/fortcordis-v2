# Spec - ci-frontend-typecheck-gate

Data: 2026-09-14  
Responsavel: Martiniano Barros  
Status: implementado

## 1) Escopo

CI. Workflow novo `.github/workflows/frontend-typecheck.yml`. Nenhuma mudanca em
`backend/`, `frontend/` ou `scripts/`, e nenhuma mudanca de comportamento do app.

## 2) Requisitos funcionais

- RF-001: erro de tipo no frontend reprova o check em PR que mira `stage` ou
  `main`.
- RF-002: o check cobre arquivos que o `next build` nao verifica -- teste
  incluso.
- RF-003: roda tambem em `push` para `stage` e `main`.
- RF-004: PR que nao toca `frontend/` nao dispara o workflow.
- RF-005: o `quality-gate` e o fluxo de deploy seguem inalterados.

## 3) Requisitos tecnicos

- RT-001: job unico rodando `npx tsc --noEmit` em `working-directory: frontend`.
- RT-002: `paths` filtrando `frontend/**` e o proprio arquivo do workflow.
- RT-003: `concurrency` por PR (ou por ref, no push) com `cancel-in-progress`,
  para que um push em sequencia nao deixe conclusao velha valendo.
- RT-004: `permissions: contents: read`. O gate nao escreve nada.
- RT-005: `npm ci` com cache de `frontend/package-lock.json`, como no
  `quality-gate`.

## 4) Criterios de aceitacao

- CA-001: o YAML e valido e declara os gatilhos `pull_request`, `push` e
  `workflow_dispatch`.
- CA-002: o workflow roda no PR desta entrega -- o proprio arquivo dele esta no
  filtro `paths` -- e passa. O gate se autotesta na entrega.
- CA-003: `tsc --noEmit` reprova quando ha erro de tipo (teste negativo local).
- CA-004: PR que nao toca `frontend/` nem este workflow nao dispara o check.

> **Revisado em 2026-09-14.** Este requisito valia enquanto os checks eram
> informativos. Com eles virando obrigatorios, o filtro `paths` passou a ser
> armadilha: check obrigatorio que nao roda deixa o PR parado em "Expected --
> waiting for status to be reported". O filtro foi removido em
> `docs/specs/ci-frontend-gates-sem-paths/`, e os checks passam a rodar em todo
> PR para `stage` e `main`.


## 5) Fora de escopo

- `vitest` no CI.
- Tornar o check obrigatorio via protecao de branch.
- Typecheck do `whatsapp-stage-backend`, que ja tem `npm run build` proprio no
  `quality-gate`.
