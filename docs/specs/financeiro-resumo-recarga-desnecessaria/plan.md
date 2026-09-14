# Plan - financeiro-resumo-recarga-desnecessaria

Data: 2026-09-13  
Responsavel: Martiniano Barros  
Status: concluido e verificado em stage

## 1) Tarefas

- [x] T1 confirmar a causa lendo o codigo, nao so o sintoma: a carga do resumo e
      a unica sem gating, e o efeito depende de pagina, filtros, busca e aba.
- [x] T2 confirmar que a URL do resumo varia so com `periodo`.
- [x] T3 criar `deveRecarregarResumo` em `frontend/lib/financeiro-loading.ts`.
- [x] T4 testes em `frontend/lib/financeiro-loading.test.ts`, incluindo o caso
      de recarga manual no mesmo periodo.
- [x] T5 ligar a guarda em `page.tsx`: parametro `origem` com default `manual`,
      ref do periodo gravado no `onSuccess`, efeito passando `"efeito"`.
- [x] T6 corrigir os `onClick={carregarDados}` que passavam o handler direto.
- [x] T7 teste negativo.
- [x] T8 verificacao manual em stage (CA-006) - executada em 2026-09-13.

## 2) Ordem e dependencias

T1 e T2 antes de tudo: sem os dois, a correcao seria palpite. T3 antes de T5.
T6 so apareceu porque o `tsc` reprovou depois de T5 -- ver secao 3.

## 3) Risco

O risco real nao era o resumo deixar de atualizar quando deve; era **onde** isso
poderia acontecer sem ninguem notar.

Ao adicionar o parametro `origem`, os dois `onClick={carregarDados}` passariam o
`MouseEvent` como `origem`. Sendo um objeto, nao e `"manual"`, entao cairia na
comparacao de periodo e **os botoes de "Recarregar" parariam de recarregar o
resumo** -- exatamente os botoes cuja unica funcao e recarregar. Nao daria erro,
nao apareceria valor errado: so ficaria velho.

Foi o `tsc --noEmit` que pegou, antes de rodar qualquer teste. Mitigado por T6 e
registrado em RT-004.

Segundo risco, menor: marcar o periodo como carregado antes da resposta faria uma
falha de rede "consumir" a recarga. Mitigado gravando o ref dentro do
`onSuccess`.

Rollback: reverter o commit. Sem migracao, sem estado persistido, sem mudanca de
contrato.

## 4) Entrega

Limpeza, nao correcao urgente -- nao ha valor errado em tela. Entra por `stage`
no fluxo normal.
