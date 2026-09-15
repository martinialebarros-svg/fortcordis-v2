# Intent - ci-frontend-testes-gate

Data: 2026-09-14  
Responsavel: Martiniano Barros  
Status: draft

## 1) Problema

Os testes do frontend **nao rodam em CI nenhum**. Rodam so na maquina de quem
implementa.

O `quality-gate` de `deploy-stage.yml` roda a suite do backend
(`python -m unittest discover`), o lint e o build do frontend -- e nunca o
`npm test`. `migrations-ci.yml` e backend. `frontend-ci.yml` (ate esta entrega,
`frontend-typecheck.yml`) roda so `tsc`.

Sao 297 testes vitest e 9 do runner do Node sem nenhuma rede de seguranca
automatica. Nada impede que codigo com teste quebrado entre em `stage`: basta
quem abriu o PR nao ter rodado a suite, ou ter rodado antes do ultimo commit.

Ficou registrado como buraco em aberto na secao 6 do `verify.md` de
`ci-frontend-typecheck-gate`, onde foi deixado de fora de proposito: o pedido de
la era o gate de tipos, e ligar a suite tem custo de pipeline que merecia
decisao propria.

## 2) Objetivo

Teste de frontend quebrado reprova o PR, antes do merge.

## 3) Nao objetivos

- Nao mexer no `quality-gate` nem no fluxo de deploy.
- Nao tornar o check obrigatorio: exige protecao de branch, que `stage` e `main`
  nao tem, e e decisao do responsavel.
- Nao adicionar cobertura minima, relatorio de cobertura ou teste novo. O escopo
  e rodar o que ja existe.

## 4) Contexto e restricoes

- O script do projeto e `npm test` = `vitest run && node --test`. Rodar so o
  `vitest` deixaria os 9 testes do runner do Node de fora, entao o gate usa o
  script, nao o comando direto.
- Mesmo criterio do gate de tipos: so ligar com a suite **verde**. Ligar com
  teste quebrado poria todo PR de frontend vermelho por divida antiga e
  treinaria todo mundo a ignorar o check. Conferido antes: 297 + 9 passando.
- O workflow de typecheck e de ontem e ja esta em producao. Acrescentar os
  testes ali significa renomear `frontend-typecheck.yml` para `frontend-ci.yml`,
  porque o nome antigo passaria a mentir sobre o conteudo. O nome do job de
  tipos (`tipos-devem-compilar`) nao muda, entao o check existente continua com
  o mesmo nome.

## 5) Por que job separado, e nao mais um passo

Falha de tipo e falha de teste sao diagnosticos diferentes e devem aparecer como
checks diferentes. Em um unico job, o `tsc` reprovando abortaria antes de rodar
teste nenhum, e quem olhasse a lista de checks veria so "frontend falhou".

O custo e um `npm ci` a mais, em paralelo -- na pratica, nada de tempo de espera.
