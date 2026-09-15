# Spec — Reordenar e duplicar itens de uma receita

## Requisitos funcionais

- **RF1**: O cabeçalho do card de cada item de prescrição (`renderPrescricaoItemCard`) exibe, quando há 2 ou mais itens na receita, dois botões: "Mover para cima" (ícone `ChevronUp`) e "Mover para baixo" (ícone `ChevronDown`), ao lado do botão "Duplicar" e do já existente "Remover"/"Limpar".
- **RF2**: O botão "Mover para cima" fica desabilitado (`disabled`) quando o item é o primeiro da lista (`idx === 0`); o botão "Mover para baixo" fica desabilitado quando o item é o último (`idx === form.prescricao_itens.length - 1`).
- **RF3**: Clicar em "Mover para cima"/"Mover para baixo" troca a posição do item com o item imediatamente adjacente (acima ou abaixo, respectivamente) no array `form.prescricao_itens`, preservando todos os campos de ambos os itens.
- **RF4**: Quando há apenas 1 item na receita, os botões de mover ficam ocultos (não apenas desabilitados) — não há utilidade em mover um item sozinho.
- **RF5**: Um botão "Duplicar" (ícone `Copy`), sempre visível e habilitado, cria uma cópia do item clicado e a insere imediatamente após o item original no array. A cópia usa `hydratePrescriptionItem` com `id` e `historico_ajustes` explicitamente descartados — preserva todos os demais campos preenchidos pelo usuário no original (incluindo `peso_referencia_kg`, uma sobrescrita manual de peso usada no cálculo de dose, que tem precedência sobre o peso da triagem), sem carregar `id` (para ser tratada como um item novo ao salvar) nem `historico_ajustes` (auditoria não se transfere para a cópia).
- **RF6**: O estado de busca (`medicamentoBuscaPorItem`) e de foco/dropdown aberto (`medicamentoFocoPorItem`) do combobox de cada item (introduzido em #40) acompanha corretamente o item ao mover ou duplicar:
  - Ao mover, o estado dos dois índices trocados é trocado entre si.
  - Ao duplicar, o estado de todo item em posição posterior ao ponto de inserção é deslocado (a nova cópia nasce sem estado de busca/foco preexistente).
- **RF7**: A numeração exibida ("Item N") e a lógica de remoção/reindexação já existente (`removerItemPrescricao`, `reindexarAposRemocaoDeItem`) continuam funcionando corretamente após qualquer combinação de mover/duplicar/remover.

## Requisitos não funcionais

- **NFR1**: Nenhuma nova chamada de rede é introduzida — mover/duplicar são operações client-side puras sobre o array já carregado em `form.prescricao_itens`.
- **NFR2**: Nenhuma função existente (`aplicarMedicamentoNaPrescricao`, cálculo de dose/apresentação, validação de itens) é modificada.
- **NFR3**: Os botões de mover (ícone-apenas) têm `title` e `aria-label` descritivos, para não introduzir uma nova regressão de acessibilidade (lição já aplicada em #40, onde um controle sem rótulo visível foi identificado como risco de a11y).
- **NFR4**: `npx tsc --noEmit` e `npm run build` devem passar sem novos erros/warnings.

## Critérios de aceite

1. Com 3+ itens na receita, mover o primeiro item para baixo troca sua posição com o segundo; o botão "mover para cima" do novo primeiro item fica desabilitado.
2. Mover o último item para cima troca sua posição com o penúltimo; o botão "mover para baixo" do novo último item fica desabilitado.
3. Duplicar um item do meio da lista insere a cópia imediatamente abaixo do original, sem alterar a ordem ou os dados de nenhum outro item.
4. Com 1 único item, os botões de mover não aparecem; o botão "Duplicar" continua visível.
5. Texto de busca não confirmado (digitado no combobox de medicamento de um item, sem selecionar nenhum resultado) segue corretamente o item correspondente após mover, duplicar, ou remover outro item da lista — nunca aparece no card de um item diferente.
6. `tsc --noEmit` e `npm run build` passam sem erros novos.
