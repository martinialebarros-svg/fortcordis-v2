# Intent - ci-frontend-gates-sem-paths

Data: 2026-09-14  
Responsavel: Martiniano Barros  
Status: draft

## 1) Problema

Os dois gates de frontend (`tipos-devem-compilar` e `testes-devem-passar`) foram
criados com filtro `paths: frontend/**`, para nao gastar CI em PR que so mexe em
documentacao. Fazia sentido enquanto eles eram informativos.

Deixa de fazer no momento em que viram **obrigatorios**. Check obrigatorio que
nao roda nao aparece como "pulado": o PR fica parado em *"Expected -- waiting for
status to be reported"* e nunca libera o merge. Nao ha erro, nao ha vermelho --
so um PR que nao fecha.

O repo produz muito PR so de `docs/`: so em 13 e 14 de setembro foram dez, entre
registro de verificacao e correcao de documentacao. Com os gates obrigatorios e
o filtro no lugar, cada um desses travaria.

Isso apareceu ao montar a primeira ruleset do repositorio, com "Require status
checks to pass" ligado e nenhum check escolhido ainda.

## 2) Objetivo

Os dois gates de frontend podem ser marcados como obrigatorios sem travar PR
nenhum.

## 3) Nao objetivos

- Nao ligar a ruleset nem marcar os checks como obrigatorios. Isso exige admin
  do repositorio e e acao do responsavel na interface do GitHub.
- Nao mexer nos outros workflows. `migration-tests` e `sdd-guardrail` ja rodam
  sempre em PR para `stage` e `main`, e ja sao seguros para obrigatorios.
- Nao mexer no `quality-gate` nem no fluxo de deploy.

## 4) Contexto e restricoes

- `branch-flow-guard` (`base-deve-ser-promocao`) e `promotion-verify-guard`
  (`criterios-devem-estar-fechados`) rodam **so** em PR para `main`. Nao e
  problema deste diff, mas e a mesma armadilha: marcados como obrigatorios numa
  ruleset que cubra `stage`, travariam todo PR de feature. O jeito certo e uma
  ruleset por branch.
- Custo de tirar o filtro: os dois jobs rodam em todo PR. Medido nos runs de
  hoje, ~40s o de tipos e ~55s o de testes, em paralelo. Cerca de 1 min de CI
  por PR de documentacao.

## 5) Alternativa descartada

Existe o padrao de um job "sentinela" que roda sempre e reporta o mesmo nome de
check quando os `paths` nao casam, so para satisfazer a obrigatoriedade. Resolve
o deadlock mantendo a economia, mas troca 1 min de CI por um job falso que
mente sobre ter verificado alguma coisa. Nao compensa nesse tamanho de repo.
