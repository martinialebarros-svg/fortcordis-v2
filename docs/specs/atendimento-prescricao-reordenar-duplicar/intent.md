# Intent — Reordenar e duplicar itens de uma receita

## Origem

`docs/AUDITORIA-ATENDIMENTO-UX-FLUXO-2026-08-09.md` — achado #20 (dimensão: Fluxo de prescrição), rastreado em [#39](https://github.com/martiniano-fortcordis/fortcordis-v2/issues/39) (referenciado a partir da issue de rastreamento #57).

**Impacto:** Média · **Esforço:** Médio

## Problema

Cada item de prescrição só tem a ação "Remover". Não existe função de mover um item para cima/baixo, nem de duplicar um item já preenchido. Numa receita com vários itens, priorizar visualmente um medicamento crítico (colocando-o no topo) ou duplicar uma fórmula parecida trocando só dose/horário exige apagar e redigitar tudo do zero.

## Objetivo

Adicionar, no cabeçalho do card de cada item (ao lado do "Remover"/"Limpar" já existente):
- Botões "Mover para cima" e "Mover para baixo" (troca de posição com o item adjacente).
- Botão "Duplicar" (cria uma cópia limpa do item, inserida logo abaixo do original).

## Decisões de design

- **Cópia limpa via `hydratePrescriptionItem` + descarte explícito de `id`/`historico_ajustes`** (mesmo padrão já usado em `salvarPresetPrescricaoAtual`): preserva todos os campos preenchidos pelo usuário no item original (incluindo `peso_referencia_kg`, `dose_mg_kg`, `apresentacao_selecionada`, `unidade_dose_calculo`, `concentracao_personalizada`), descartando apenas `id` (para não ser tratado como o mesmo registro ao salvar) e `historico_ajustes` (o histórico de auditoria pertence à linhagem do item original, não à cópia).
  - **Risco encontrado pela revisão adversarial, corrigido**: a primeira versão reaproveitava `cloneHistoricalPrescriptionItem` (função existente, usada para copiar um item de uma receita **histórica de outro atendimento**) por parecer a convenção mais próxima de "clonar item" já estabelecida. Essa função zera `peso_referencia_kg`, o que é correto no seu caso de uso original (peso de uma visita passada está desatualizado por definição), mas é uma regressão real ao duplicar **dentro da mesma receita**: `peso_referencia_kg` não é um campo derivado — é uma sobrescrita manual e deliberada do peso usado no cálculo de dose daquele item (ex.: peso ideal/magro em vez do peso real de um paciente obeso), com precedência sobre o peso da triagem em `calcularDosePrescricaoItem`. Duplicar um item com esse campo preenchido perderia essa customização silenciosamente na cópia, potencialmente mudando a dose calculada sem qualquer aviso — clinicamente relevante, não cosmético. Corrigido trocando para `hydratePrescriptionItem` (que preserva o campo), reproduzindo o bug e a correção diretamente no preview local antes de aceitar a mudança.
- **Botões de mover ocultos com um único item**: quando há apenas 1 item na receita (`isUnico`), os botões de mover para cima/baixo ficam ocultos (ambos seriam sempre desabilitados simultaneamente, o que só polui a UI sem agregar nada) — mesmo espírito da UI já existente, que troca "Remover" por "Limpar" nesse cenário.
- **Estado de busca/foco do combobox (#40) segue o item na reindexação**: o pacote #40 introduziu um combobox de busca fuzzy por item, com estado (texto digitado, dropdown aberto) indexado por posição (`Record<number, ...>`). Mover ou duplicar um item precisa manter esse estado UI corretamente atrelado ao item certo — não deve vazar para o item errado nem se perder. Implementado com dois novos helpers ao lado do já existente `reindexarAposRemocaoDeItem`:
  - `trocarIndicesAposMover`: troca o estado de dois índices ao mover (mesma troca aplicada ao array de itens).
  - `reindexarAposInsercaoDeItem`: desloca o estado de todo item posterior ao ponto de inserção (ao duplicar), análogo (na direção oposta) ao já existente `reindexarAposRemocaoDeItem`.

## Fora de escopo

- Drag-and-drop (a sugestão original da issue menciona "ou drag handle" como alternativa; botões de mover cima/baixo cobrem a mesma necessidade com implementação mais simples e sem dependência nova).
- Qualquer mudança em `aplicarMedicamentoNaPrescricao`, `medicamentosFuse`, ou nos campos de dose/apresentação/frequência/via de um item — permanecem inalterados.
- Reordenar/duplicar exames ou documentos — fora do escopo desta issue, que é específica de itens de prescrição.

## Trade-off conhecido e aceito

A chave React (`key={`${idx}-${item.id || "novo"}`}`) do card de cada item já usava o índice antes desta mudança. Mover ou duplicar um item desloca os índices de todo item posterior, fazendo React remontar (não apenas re-renderizar) os cards afetados. Como todo o estado relevante é controlado/elevado ao componente pai (não há estado local dentro do card em si), a remontagem não perde nenhum dado — é apenas um custo de performance marginal, pré-existente à esta mudança (não uma regressão introduzida por ela). Corrigir a estratégia de chave para usar um identificador estável está fora do escopo desta issue.
