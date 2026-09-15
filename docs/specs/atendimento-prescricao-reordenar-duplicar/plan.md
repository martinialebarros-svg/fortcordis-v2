# Plan — Reordenar e duplicar itens de uma receita

## Arquivos afetados

- `frontend/app/atendimento/page.tsx` (único arquivo alterado; `AtendimentoPrescricaoWorkspace.tsx` apenas mapeia `form.prescricao_itens` chamando `renderPrescricaoItemCard`, sem lógica própria a tocar)

## Tarefas

1. **Ícones**: adicionar `ChevronUp` e `Copy` ao import de `lucide-react` (já existe `ChevronDown`, usado em outro contexto).

2. **Helpers de reindexação** (ao lado do já existente `reindexarAposRemocaoDeItem`):
   - `reindexarAposInsercaoDeItem<T>(registro, idxInserido)`: desloca +1 todo índice `>= idxInserido`.
   - `trocarIndicesAposMover<T>(registro, a, b)`: troca os valores associados às chaves `a` e `b` (removendo a chave se o valor de origem for `undefined`, para não deixar entradas fantasma).

3. **Handlers** (ao lado do já existente `removerItemPrescricao`):
   - `moverItemPrescricao(idx, direcao: -1 | 1)`: calcula `destino = idx + direcao`; no-op se fora dos limites; troca os dois itens no array via `setField`; troca o estado de busca/foco via `trocarIndicesAposMover`.
   - `duplicarItemPrescricao(idx)`: clona `form.prescricao_itens[idx]` via `cloneHistoricalPrescriptionItem`; insere a cópia em `idx + 1`; desloca o estado de busca/foco via `reindexarAposInsercaoDeItem(prev, idx + 1)`.

4. **JSX**: no cabeçalho do card (`renderPrescricaoItemCard`), antes do botão "Remover"/"Limpar" já existente:
   - Bloco condicional (`!isUnico`) com os dois botões de mover (ícone apenas, `title` + `aria-label`, `disabled` nos limites).
   - Botão "Duplicar" (ícone + texto), sempre visível.

## Não tocar

- `aplicarMedicamentoNaPrescricao`, `medicamentosFuse`, `cloneHistoricalPrescriptionItem` (reaproveitada como está), `removerItemPrescricao`/`reindexarAposRemocaoDeItem` (lógica existente, apenas verificada por composição com as novas funções).

## Verificação

- `npx tsc --noEmit` e `npm run build` na worktree.
- Preview local: criar receita com 3 itens; testar mover (limites do primeiro/último item, item do meio); testar duplicar (item do meio); testar interação entre busca não confirmada (#40) e mover/duplicar/remover em combinação.
- Revisão adversarial do diff (Agent), focada em: corretude dos helpers de reindexação em cada combinação de operações, ausência de mutação do array original, e regressão em `removerItemPrescricao` já existente.
