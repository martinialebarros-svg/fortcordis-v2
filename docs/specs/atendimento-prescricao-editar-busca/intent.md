# Intent — Combobox de busca fuzzy para editar item de prescrição existente

## Origem

`docs/AUDITORIA-ATENDIMENTO-UX-FLUXO-2026-08-09.md` — achado #21 (dimensão: Fluxo de prescrição), rastreado em [#40](https://github.com/martiniano-fortcordis/fortcordis-v2/issues/40) (referenciado a partir da issue de rastreamento #57).

**Impacto:** Média · **Esforço:** Médio

## Problema

Ao adicionar um item novo na receita, o veterinário busca o medicamento por nome, princípio ativo ou classe terapêutica via busca fuzzy (Fuse.js) — mesmo padrão usado em Exames ([#34](https://github.com/martiniano-fortcordis/fortcordis-v2/issues/34)). Porém, ao editar um item **já existente** na receita (trocar o medicamento selecionado), o campo é um `<select>` HTML nativo que lista todos os medicamentos da biblioteca sem qualquer filtro ou busca.

Com uma biblioteca de medicamentos grande, corrigir o medicamento de um item já criado é mais lento (rolar/digitar no nativo do navegador para localizar) e inconsistente com a experiência rápida de adicionar um item do zero.

## Objetivo

Substituir o `<select>` nativo por um combobox de busca fuzzy (input + dropdown), reaproveitando a mesma instância `medicamentosFuse` (Fuse.js) já usada na busca de adição de item, e mantendo intacto o handler `aplicarMedicamentoNaPrescricao(idx, medId)` — responsável pela lógica de sugestão de dose/apresentação/frequência/via ao trocar o medicamento de um item.

## Fora de escopo

- Qualquer mudança em `aplicarMedicamentoNaPrescricao` (dose/apresentação/frequência/via) — a lógica existente é reaproveitada sem alteração.
- Mudanças no fluxo de **adicionar** um item novo (`AtendimentoPrescricaoWorkspace.tsx`, "Adicionar produto industrializado") — já usa busca fuzzy, não é o alvo desta issue.
- Persistência de "medicamentos mais usados"/frequência de uso — não há dado de uso real no sistema (mesma decisão de honestidade de copy já tomada em [#34](https://github.com/martiniano-fortcordis/fortcordis-v2/issues/34)).

## Lição aplicada proativamente (de [#34](https://github.com/martiniano-fortcordis/fortcordis-v2/issues/34))

A revisão adversarial do pacote #34 (busca de exames) encontrou um bug real: `onMouseDown preventDefault()` — necessário para o clique no resultado não ser perdido por um blur prematuro do input — tinha o efeito colateral de manter o input focado após o clique, o que reabria o dropdown mostrando "Sugestões" quando o fechamento dependia apenas do blur natural.

Esta implementação já nasce com a correção: o `onClick` de cada resultado fecha o dropdown explicitamente (`setMedicamentoFocoPorItem(idx, false)`) **antes** de aplicar a seleção, independente do comportamento de foco/blur do navegador.

## Riscos encontrados pela revisão adversarial (corrigidos)

A revisão adversarial da implementação inicial (ver `verify.md`) encontrou 4 problemas reais, verificados diretamente no código e corrigidos antes do commit final:

1. **"Stuck closed" após selecionar e digitar novamente sem sair do campo**: a correção proativa da lição de #34 (fechar o dropdown explicitamente no `onClick`) tinha um efeito colateral não previsto — como `onMouseDown preventDefault()` mantém o input nativamente focado durante todo o clique, o evento `onFocus` não dispara de novo quando o usuario digita um novo termo imediatamente apos selecionar (sem um blur real entre as duas acoes). O dropdown ficava preso fechado mesmo com resultados validos. Corrigido fazendo o `onChange` tambem marcar o item como focado, resincronizando o estado rastreado com o foco real do navegador a cada tecla digitada.
2. **Texto de busca abandonado migra para o item errado ao remover um item anterior**: o estado de busca/foco por item é indexado por posição no array (`idx`), e `removerItemPrescricao` fazia um `filter` que desloca os índices sem realinhar esses registros. Um texto digitado (e nunca selecionado) num item ficava "grudado" nesse índice e passava a aparecer no item que herdasse essa posição após uma remoção anterior. Corrigido com uma função de reindexação (`reindexarAposRemocaoDeItem`) aplicada aos dois registros de estado sempre que um item é removido.
3. **Nenhuma forma de desvincular o medicamento de um item já selecionado**: o `<select>` nativo antigo permitia voltar à opção em branco (`aplicarMedicamentoNaPrescricao(idx, null)`); o combobox novo não tinha equivalente. Verificado que `toggleFormulaManipuladaPrescricao` (o outro controle do card) NÃO cobre esse caso (só ajusta o nome exibido, nunca zera `medicamento_id`). Corrigido com um botão explícito "Limpar seleção" (visível apenas quando há medicamento selecionado) — uma affordance mais clara do que a opção em branco perdida no meio de um `<select>` longo.
4. **Nenhum caminho por teclado para selecionar um resultado**: diferente dos comboboxes de busca de itens novos (que nunca tiveram baseline de teclado), este substitui um `<select>` nativo — que é operável por teclado por padrão. Corrigido com `Enter` (confirma o primeiro resultado da busca) e `Escape` (fecha o dropdown) no input.

Decisão deliberada: não foi implementada navegação completa por setas (padrão ARIA combobox completo) — seria escopo maior do que o pedido original da issue #40 ("reaproveitar o mesmo componente/lógica de busca fuzzy" já usada em outros pontos do módulo, que também não tem navegação por setas). `Enter`/`Escape` restauram um caminho real por teclado sem introduzir essa complexidade adicional.
