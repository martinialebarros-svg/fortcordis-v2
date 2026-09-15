# Spec — Combobox de busca fuzzy para editar item de prescrição existente

## Requisitos funcionais

- **RF1**: O card de cada item da receita (renderizado por `renderPrescricaoItemCard(item, idx)` em `frontend/app/atendimento/page.tsx`) exibe um campo de busca (`<input>`) no lugar do `<select>` nativo anterior, sob o label "Medicamento da biblioteca".
- **RF2**: O placeholder do input mostra o nome do medicamento atualmente selecionado no item (`medicamentoSelecionado.nome`), ou um texto instrutivo genérico quando nenhum medicamento está selecionado.
- **RF3**: Ao digitar no input, os resultados são calculados via a instância `medicamentosFuse` (Fuse.js) já existente e reaproveitada — mesmas chaves de busca (`nome`, `principio_ativo`, `categoria`, `classe_terapeutica`) usadas na busca de adição de item novo. Limitado a 8 resultados.
  - Fallback: se `medicamentosFuse` não estiver disponível, busca por `includes()` case-insensitive nos mesmos campos.
- **RF4**: O dropdown de resultados só aparece quando o input está focado **e** há termo de busca não vazio com pelo menos 1 resultado — não há "sugestões" ao focar vazio (diferente do padrão de Exames em #34; aqui o campo já mostra o medicamento atual no placeholder, então uma lista de sugestões padrão não agrega o mesmo valor).
- **RF5**: Clicar em um resultado do dropdown:
  1. Fecha o dropdown do item correspondente (`medicamentoFocoPorItem[idx] = false`) — **antes** de aplicar a seleção, para garantir fechamento determinístico independente do timing de blur do navegador (ver intent.md, lição de #34).
  2. Limpa o texto de busca do item (`medicamentoBuscaPorItem[idx] = ""`).
  3. Chama `aplicarMedicamentoNaPrescricao(idx, med.id)` — mesma função já usada pelo `<select>` nativo anterior, sem nenhuma alteração em sua lógica interna.
- **RF6**: O estado de busca (texto digitado) e de foco (dropdown aberto/fechado) é isolado por item da receita, indexado por `idx` (`Record<number, string>` e `Record<number, boolean>`), garantindo que abrir/buscar no combobox de um item não afete o estado de outros itens simultaneamente presentes na receita.
- **RF7**: Clicar fora do input (blur) sem selecionar nenhum resultado fecha o dropdown, preservando o texto já digitado no input (não limpa a busca).
- **RF8**: Digitar um novo termo de busca sempre marca o item como focado (independente de um evento `onFocus` ter disparado), garantindo que o dropdown reabra corretamente com os novos resultados mesmo quando o usuário seleciona um medicamento e, sem sair do campo, digita imediatamente um novo termo.
- **RF9**: Ao remover um item da receita, o estado de busca/foco dos itens restantes é reindexado para acompanhar o deslocamento de posições no array — nenhum texto de busca "abandonado" (digitado e nunca selecionado) deve aparecer sob um item diferente daquele em que foi originalmente digitado.
- **RF10**: Quando um item já tem um medicamento selecionado, um botão "Limpar seleção" (ao lado do label) permite desvincular o medicamento do item (`medicamento_id = null`) sem excluir o item da receita — equivalente à opção em branco do `<select>` nativo anterior. O botão só aparece quando há medicamento selecionado.
- **RF11**: O input responde a `Enter` (aplica o primeiro resultado da busca atual, se houver) e `Escape` (fecha o dropdown sem aplicar nada), oferecendo um caminho mínimo de seleção por teclado.

## Requisitos não funcionais

- **NFR1**: Nenhuma nova chamada de rede é introduzida — a lista de medicamentos (`medicamentos`) e a instância `medicamentosFuse` já são carregadas e computadas no escopo de `page.tsx` antes desta mudança.
- **NFR2**: `aplicarMedicamentoNaPrescricao` permanece inalterada — toda a lógica de sugestão de dose/apresentação/frequência/via ao trocar medicamento continua funcionando exatamente como antes.
- **NFR3**: `npx tsc --noEmit` e `npm run build` devem passar sem novos erros/warnings.
- **NFR4**: O combobox usa o mesmo padrão visual (classe CSS) já estabelecido em #34 para o dropdown de busca de Exames — consistência visual entre os dois pontos de busca fuzzy do módulo Atendimento.

## Critérios de aceite

1. Abrir um atendimento com item(ns) de prescrição já existente(s) mostra um `<input>` de busca no lugar do `<select>` nativo, com o nome do medicamento atual como placeholder.
2. Digitar parte do nome, princípio ativo ou classe terapêutica de um medicamento no input filtra os resultados corretamente (fuzzy).
3. Selecionar um resultado atualiza o item (nome, classe/princípio ativo exibidos, e dose/apresentação/frequência/via sugeridas via `aplicarMedicamentoNaPrescricao`), limpa o input e fecha o dropdown — sem reabrir.
4. Com múltiplos itens na receita, buscar em um item não interfere no estado (texto de busca/foco) de outro item.
5. Clicar fora do input sem selecionar fecha o dropdown sem alterar o medicamento do item.
6. `tsc --noEmit` e `npm run build` passam sem erros novos.
