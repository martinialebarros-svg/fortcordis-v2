# Intent - promocao-bloqueia-criterio-pendente

Data: 2026-09-13
Responsavel: Martiniano

## Problema

A promocao `stage -> main` de 13/09/2026 (PR #117) subiu para producao a
feature `receita-emitida-em-fuso-operacional` com o criterio `CA-002` ainda
marcado `pendente` no proprio `verify.md` -- a verificacao de tela nunca foi
feita porque o stage nao tinha receita emitida no momento. A pendencia foi
percebida por leitura manual do arquivo, momentos antes do merge. Nada no CI
sinalizou.

O gate SDD (`check_sdd_guardrail.py`) nao cobre isso por desenho: ele exige que
`spec.md` e `verify.md` mudem junto com o codigo, mas nao le o conteudo do
verify. Um `verify.md` cheio de `pendente` passa no gate.

## Por que agora

Producao faz deploy automatico a cada push em `main`. Promover com criterio
aberto significa entregar ao usuario final comportamento que ninguem conferiu,
e o unico anteparo hoje e alguem lembrar de abrir o arquivo.

## Fora de escopo

- Bloquear PRs que miram `stage`. No fluxo stage-first, criterio pendente e o
  estado normal de um PR de feature: boa parte so pode ser verificada depois de
  chegar em stage. Bloquear ali inverteria o processo.
- Varrer os ~240 specs do repo. A promocao responde pelo que ela leva, nao por
  pendencia historica de terceiros.
- Interpretar semanticamente a evidencia. O gate le status, nao julga prova.
