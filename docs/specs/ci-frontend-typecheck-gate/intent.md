# Intent - ci-frontend-typecheck-gate

Data: 2026-09-14  
Responsavel: Martiniano Barros  
Status: draft

## 1) Problema

Tres erros `TS2322` em `frontend/app/whatsapp-stage/AppointmentQueue.test.tsx`
chegaram em stage e ficaram dias sem ninguem ver -- com build, lint e todos os
checks verdes o tempo todo. Foram registrados como "pre-existentes, fora do
diff" em pelo menos tres `verify.md` diferentes antes de alguem corrigir.

O CI nao roda `tsc`. Conferido: o `quality-gate` em `deploy-stage.yml` executa
`npm run lint` e `npm run build` no frontend, e mais nada. Nenhum workflow roda
`tsc --noEmit`.

E o `next build` nao cobre o buraco: ele so verifica tipos do que entra no grafo
de compilacao, e arquivo de teste nao e importado por pagina nenhuma. O
`next.config.js` **nao** desliga o typecheck -- o build simplesmente nunca olhou
para aqueles arquivos.

## 2) Objetivo

Erro de tipo no frontend reprova o PR, antes do merge.

## 3) Nao objetivos

- Nao rodar `vitest` neste gate. O frontend tambem nao tem seus testes no CI, o
  que e um buraco maior, mas e decisao a parte -- ver secao 5.
- Nao mexer no `quality-gate` existente nem no fluxo de deploy.
- Nao adicionar protecao de branch nem tornar o check obrigatorio. Isso exige
  admin do repositorio e e decisao do responsavel.

## 4) Contexto e restricoes

- Tem de rodar em `pull_request`: gate que so roda depois do merge nao e gate.
  Roda tambem em `push` para `stage` e `main`, para pegar o que entrar por outro
  caminho.
- Filtrado por `paths: frontend/**`. O repo recebe muitos PRs so de `docs/` -- so
  hoje foram varios -- e nenhum deles pode quebrar tipo de frontend.
- Momento escolhido de proposito: `tsc --noEmit` esta **limpo** pela primeira
  vez, desde que o #123 corrigiu os `TS2322`. Ligando agora o gate nasce verde.
  Esperar significa acumular divida e ter que limpar antes de ligar.

## 5) Fora de escopo, mas anotado

Os testes do frontend (`vitest`, 297 em 42 arquivos) **nao rodam em CI nenhum**.
Rodam so na maquina de quem esta implementando. E um buraco maior que o do
typecheck e merece decisao propria: o `quality-gate` roda a suite do backend,
mas nao a do frontend.
