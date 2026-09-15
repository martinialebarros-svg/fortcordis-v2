# Plan — Combobox de busca fuzzy para editar item de prescrição existente

## Arquivos afetados

- `frontend/app/atendimento/page.tsx`

## Tarefas

1. **Estado por item** (topo do componente, junto a `prescricaoBuscaRapida`):
   - `medicamentoBuscaPorItem: Record<number, string>` — texto de busca digitado, por índice do item.
   - `medicamentoFocoPorItem: Record<number, boolean>` — se o dropdown do item está aberto, por índice.

2. **Cálculo de resultados por item** (dentro de `renderPrescricaoItemCard(item, idx)`, junto ao já existente `medicamentoSelecionado`):
   - `medicamentoBuscaAtual = medicamentoBuscaPorItem[idx] || ""`.
   - `medicamentoResultados`: usa `medicamentosFuse.search(term)` quando disponível (fallback: filtro `includes()` case-insensitive nas mesmas 4 chaves), limitado a 8 itens, `[]` quando o termo é vazio.

3. **Substituição de JSX**: trocar o bloco `<select value={item.medicamento_id || ""} onChange={...}>...</select>` por:
   - `<input>` controlado por `medicamentoBuscaPorItem[idx]`, com `onFocus`/`onBlur` atualizando `medicamentoFocoPorItem[idx]`, placeholder = nome do medicamento atual ou texto instrutivo.
   - Dropdown condicional (`medicamentoFocoPorItem[idx] && medicamentoResultados.length > 0`) com um `<button>` por resultado:
     - `onMouseDown={(e) => e.preventDefault()}` (evita perda do clique por blur prematuro).
     - `onClick`: fecha o dropdown do item + limpa a busca do item + chama `aplicarMedicamentoNaPrescricao(idx, med.id)` — nessa ordem, para a correção proativa do bug de #34 valer independente de timing.

4. **Não tocar**: `aplicarMedicamentoNaPrescricao`, `medicamentosFuse`, o restante do card do item (dose, apresentação, frequência, via, instruções).

5. **Correções pós-revisão adversarial** (ver intent.md, seção "Riscos encontrados pela revisão adversarial"):
   - `onChange` do input também marca o item como focado (`medicamentoFocoPorItem[idx] = true`), não apenas `onFocus` — corrige o dropdown ficando preso fechado após selecionar e digitar de novo sem sair do campo.
   - Nova função utilitária de módulo `reindexarAposRemocaoDeItem<T>(registro, idxRemovido)`, aplicada a `medicamentoBuscaPorItem`/`medicamentoFocoPorItem` dentro de `removerItemPrescricao` — evita texto de busca abandonado migrar para o item errado após uma remoção.
   - Botão "Limpar seleção" (visível apenas quando `medicamentoSelecionado` existe) chamando `aplicarMedicamentoNaPrescricao(idx, null)` — restaura a capacidade de desvincular o medicamento sem excluir o item, equivalente à opção em branco do `<select>` antigo.
   - `onKeyDown` no input: `Enter` aplica o primeiro resultado da busca atual; `Escape` fecha o dropdown.
   - Helper local `selecionarMedicamentoDoItem(medId)` dentro de `renderPrescricaoItemCard`, reaproveitado pelo clique no resultado, pelo `Enter` e pelo botão "Limpar seleção", para manter a sequência fechar-dropdown → limpar-busca → aplicar consistente em todos os pontos de entrada.

## Verificação

- `npx tsc --noEmit` e `npm run build` na worktree.
- Preview local: abrir atendimento existente, adicionar item(ns) de prescrição, testar busca/seleção/troca de medicamento, testar isolamento entre múltiplos itens, testar blur sem seleção.
- Revisão adversarial do diff (Agent), focada em: reentrância do dropdown pós-seleção (classe de bug de #34), vazamento de estado entre itens, e regressão na lógica de `aplicarMedicamentoNaPrescricao`.
