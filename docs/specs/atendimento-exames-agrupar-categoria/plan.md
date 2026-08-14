# Plan — Agrupar lista de exames por categoria

## Arquivos afetados

- `frontend/app/atendimento/components/AtendimentoExamesSection.tsx`

## Tarefas

1. **Imports**: adicionar `Fragment` e `useMemo` ao import de `"react"` (já havia `useState`).

2. **Agrupamento** (`useMemo`, logo antes do `return` do componente):
   - `gruposExamesVisiveis`: itera `examesVisiveis`, agrupando por `(item.exame?.categoria_exame || "").trim() || "Sem categoria"`, preservando ordem de primeira aparição via um `Map<string, index>` auxiliar.

3. **Extração da renderização do card**: dentro de uma IIFE no JSX (`{(() => { ... })()}`), declarar `const renderExameCard = ({ exame, index, anexosResultado, flowStatus }) => { ...corpo idêntico ao pré-existente... }` — sem alterar nenhuma linha do corpo original do card.

4. **Novo laço de renderização**: a IIFE retorna `gruposExamesVisiveis.map((grupo) => (<Fragment key={grupo.categoria}><div className="sticky ...">{grupo.categoria} ({grupo.itens.length})</div>{grupo.itens.map((item) => renderExameCard(item))}</Fragment>))`.

5. **Cabeçalho sticky**: `sticky top-0 z-10 -mx-1 bg-white/95 px-1 py-2 backdrop-blur-sm xl:top-[330px]` — `z-10` menor que o `z-20` do header global (`.fc-care-header`), para que a hierarquia visual correta (header global sempre por cima) se mantenha em qualquer cenário de sobreposição residual.

## Não tocar

- `examesVisiveis` (calculado em `page.tsx`, já filtra por status — não modificado).
- Corpo interno de cada card (upload, liberar no portal, laudar, histórico de ajustes) — apenas movido para dentro de uma função, sem alteração de conteúdo.
- `.fc-care-header` (CSS do header global, #20) — não modificado; apenas medido para calibrar o `top` do novo cabeçalho de categoria.

## Verificação

- `npx tsc --noEmit` e `npm run build` na worktree.
- Preview local: aplicar um painel de exames com categorias mistas (ex.: "Painel cardiologico basico", que mistura Cardiologia + Imagem); confirmar contagem de itens por grupo bate com o total; confirmar filtro de status reduz corretamente dentro dos grupos, inclusive a zero grupos.
- Revisão adversarial do diff (Agent), focada em: itens sem categoria não desaparecerem, ordem dos grupos, e regressão em qualquer interação existente do card (upload, liberar no portal, expandir/colapsar).
