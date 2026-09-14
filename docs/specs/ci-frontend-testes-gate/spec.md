# Spec - ci-frontend-testes-gate

Data: 2026-09-14  
Responsavel: Martiniano Barros  
Status: implementado

## 1) Escopo

CI. `.github/workflows/frontend-typecheck.yml` vira `frontend-ci.yml` e ganha um
segundo job. Nenhuma mudanca em `backend/`, `frontend/` ou `scripts/`, e nenhuma
mudanca de comportamento do app.

## 2) Requisitos funcionais

- RF-001: teste de frontend quebrado reprova um check em PR que mira `stage` ou
  `main`.
- RF-002: o gate roda `npm test`, cobrindo vitest **e** o runner do Node.
- RF-003: roda tambem em `push` para `stage` e `main`.
- RF-004: PR que nao toca `frontend/` nem o workflow nao dispara os checks.
- RF-005: o gate de tipos segue existindo, com o mesmo nome de job
  (`tipos-devem-compilar`), para nao trocar o nome de um check ja em uso.
- RF-006: falha de tipo e falha de teste aparecem como checks distintos.
- RF-007: `quality-gate` e fluxo de deploy inalterados.

## 3) Requisitos tecnicos

- RT-001: job novo `testes-devem-passar`, rodando `npm test` em
  `working-directory: frontend`.
- RT-002: arquivo renomeado com `git mv`, preservando historico; `paths` dos dois
  gatilhos atualizados para o nome novo.
- RT-003: `concurrency` regrupada para `frontend-ci-...`, cobrindo os dois jobs.
- RT-004: `permissions: contents: read`; o gate nao escreve nada.

## 4) Criterios de aceitacao

- CA-001: YAML valido, nome `Frontend CI`, jobs `tipos-devem-compilar` e
  `testes-devem-passar`.
- CA-002: os dois checks rodam no PR desta entrega -- o proprio arquivo esta no
  `paths` -- e passam.
- CA-003: `npm test` esta verde antes de ligar o gate: 297 vitest + 9 Node.
- CA-004: `npm test` reprova quando ha teste quebrado (teste negativo local).

## 5) Fora de escopo

- Cobertura minima ou relatorio de cobertura.
- Tornar os checks obrigatorios via protecao de branch.
- Suite do `whatsapp-stage-backend`, que ja tem `npm run build` e teste proprios
  no `quality-gate`.
