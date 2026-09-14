# Plan - ci-frontend-typecheck-gate

Data: 2026-09-14  
Responsavel: Martiniano Barros  
Status: concluido e verificado

## 1) Tarefas

- [x] T1 confirmar que nenhum workflow roda `tsc` hoje -- e nao supor.
- [x] T2 confirmar que o `next build` nao substitui o `tsc`: `next.config.js` nao
      desliga o typecheck, mas o build so olha o grafo de compilacao, e teste
      nao entra nele.
- [x] T3 criar `.github/workflows/frontend-typecheck.yml` com gatilho de
      `pull_request`.
- [x] T4 validar o YAML.
- [x] T5 CA-002: o workflow roda no PR desta entrega (o proprio arquivo dele
      esta no `paths`) e passa -- o gate se autotesta.
- [x] T6 CA-003: teste negativo com erro de tipo proposital.

## 2) Ordem e dependencias

T1 e T2 antes de tudo. Sem T2 o gate poderia ser redundante com o `npm run
build` que ja existe -- e a resposta so aparece lendo como o Next escolhe o que
verificar, nao olhando o sintoma.

T5 nao precisou esperar um PR de frontend: como o proprio arquivo do workflow
esta no filtro `paths`, o gate roda na entrega que o cria.

## 3) Risco

Baixo. O gate nao escreve nada (`contents: read`), nao toca deploy e nao torna
nada obrigatorio -- um check vermelho informa, nao bloqueia o merge, porque
`main` e `stage` nao tem protecao de branch.

O risco de verdade e o oposto: **ligar o gate com o typecheck ja sujo**, o que
poria todo PR de frontend vermelho por divida antiga e treinaria todo mundo a
ignorar o check. Por isso o momento: `tsc --noEmit` esta limpo desde o #123.

Rollback: apagar o arquivo do workflow. Nada mais muda.

## 4) Entrega

Entra por `stage` no fluxo normal. Nao ha urgencia -- e prevencao, nao correcao.
