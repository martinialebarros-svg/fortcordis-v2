# Spec - ci-frontend-gates-sem-paths

Data: 2026-09-14  
Responsavel: Martiniano Barros  
Status: implementado

## 1) Escopo

CI. Remocao do filtro `paths` dos dois gatilhos de
`.github/workflows/frontend-ci.yml`. Nenhuma mudanca em `backend/`, `frontend/`
ou `scripts/`, e nenhuma mudanca de comportamento do app.

## 2) Requisitos funcionais

- RF-001: `tipos-devem-compilar` e `testes-devem-passar` rodam em **todo** PR que
  mira `stage` ou `main`, inclusive PR so de `docs/`.
- RF-002: rodam tambem em todo push para `stage` e `main`.
- RF-003: os nomes dos jobs nao mudam -- sao os nomes dos checks que serao
  marcados como obrigatorios.
- RF-004: nenhuma outra caracteristica do workflow muda (jobs, comandos,
  `permissions`, `concurrency`).

**Revisao explicita:** este RF-001 substitui o RF-004 de
`ci-frontend-typecheck-gate` e o RF-004 de `ci-frontend-testes-gate`, que
diziam o oposto -- "PR que nao toca `frontend/` nao dispara os checks". Aquilo
valia enquanto os checks eram informativos.

## 3) Requisitos tecnicos

- RT-001: remover a chave `paths` de `on.pull_request` e de `on.push`. Nada
  mais.
- RT-002: registrar no cabecalho do workflow por que nao ha filtro, para que
  ninguem o reintroduza "otimizando" e volte a criar o deadlock.

## 4) Criterios de aceitacao

- CA-001: YAML valido; `on.pull_request` e `on.push` sem `paths`.
- CA-002: os dois checks rodam no PR desta entrega, que **nao toca
  `frontend/`** -- e a prova direta de RF-001, porque com o filtro antigo eles
  nao apareceriam.
- CA-003: os dois passam.

## 5) Fora de escopo

- Criar a ruleset e marcar os checks como obrigatorios: acao do responsavel na
  interface do GitHub, com admin do repositorio.
- Os checks `base-deve-ser-promocao` e `criterios-devem-estar-fechados`, que
  rodam so em PR para `main` e por isso exigem ruleset por branch. Nao sao
  tocados aqui.
