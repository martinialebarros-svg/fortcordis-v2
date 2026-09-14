# Plan - ci-frontend-testes-gate

Data: 2026-09-14  
Responsavel: Martiniano Barros  
Status: concluido e verificado

## 1) Tarefas

- [x] T1 confirmar que nenhum workflow roda os testes do frontend -- conferido em
      `deploy-stage.yml`, `migrations-ci.yml` e `frontend-typecheck.yml`.
- [x] T2 confirmar qual comando cobre as duas suites: `npm test` e
      `vitest run && node --test`.
- [x] T3 rodar `npm test` antes de ligar o gate, para nao ligar com a suite suja.
- [x] T4 renomear `frontend-typecheck.yml` para `frontend-ci.yml` com `git mv` e
      atualizar os `paths` dos dois gatilhos.
- [x] T5 acrescentar o job `testes-devem-passar`.
- [x] T6 validar o YAML.
- [x] T7 teste negativo: quebrar um teste e ver `npm test` reprovar.

## 2) Ordem e dependencias

T3 antes de T5, e nao ao contrario: ligar o gate primeiro e conferir depois
inverteria o unico cuidado que importa aqui.

T4 antes de T5 porque o nome `frontend-typecheck.yml` passaria a mentir assim
que o job de testes entrasse no arquivo.

## 3) Risco

Baixo, e do mesmo tipo do gate de tipos: o risco nao e o gate falhar, e **ligar
com a suite ja vermelha**. Isso poria todo PR de frontend vermelho por divida
antiga e treinaria todo mundo a ignorar o check. Mitigado por T3 -- 297 vitest e
9 Node passando antes de escrever o workflow.

Risco secundario: a renomeacao do arquivo. O nome do **job** de tipos nao muda
(`tipos-devem-compilar`), entao o check existente segue com o mesmo nome; o que
muda e o nome do workflow, de "Frontend Typecheck" para "Frontend CI". Nada
depende dele -- nao ha protecao de branch nem check obrigatorio.

Rollback: reverter o commit. O arquivo volta ao nome e conteudo anteriores.

## 4) Entrega

Prevencao, nao correcao. Entra por `stage` no fluxo normal.
