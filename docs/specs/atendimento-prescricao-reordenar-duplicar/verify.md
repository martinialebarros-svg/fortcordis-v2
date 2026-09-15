# Verify — Reordenar e duplicar itens de uma receita

## Testes automatizados

- `npx tsc --noEmit` — passou sem erros (exit 0).
- `npm run build` — passou sem erros; `/atendimento` compilado normalmente (49.3 kB / 186 kB First Load JS).

## Verificação manual (preview local)

Ambiente: worktree `atendimento-prescricao-reordenar-duplicar`, backend na porta 8135, frontend na porta 3115, banco copiado da produção (uso local e descartável, removido ao final).

Atendimento de teste: caso #2 (paciente "junio"). Três itens adicionados manualmente: Amlodipina, Atenolol, Benazepril (nesta ordem).

1. **Estado inicial dos botões**: confirmado via inspeção do DOM que o item 0 (Amlodipina) tem "Mover para cima" desabilitado; o item 2 (Benazepril, último) tem "Mover para baixo" desabilitado; o item do meio (Atenolol) tem ambos habilitados.
2. **Mover**: clicar "Mover para baixo" no item 0 (Amlodipina) trocou corretamente sua posição com o item 1 (Atenolol), resultando em `[Atenolol, Amlodipina, Benazepril]`.
3. **Duplicar**: clicar "Duplicar" no item do meio (Amlodipina, após o passo 2) inseriu uma cópia imediatamente abaixo, resultando em `[Atenolol, Amlodipina, Amlodipina (cópia), Benazepril]`, sem alterar nenhum outro item.
4. **Interação reindexação (remover) x busca abandonada (#40)**: digitado um texto de busca não confirmado ("texto-abandonado-benazepril") no último item (Benazepril, índice 3); removido o item do meio (a cópia de Amlodipina, índice 2); confirmado que o texto de busca seguiu corretamente o Benazepril para seu novo índice (2), sem vazar para nenhum outro item.
5. **Interação reindexação (mover) x busca abandonada (#40)**: digitado um texto de busca não confirmado ("busca-atenolol-nao-confirmada") no item 0 (Atenolol); movido esse item para baixo (troca com Amlodipina); confirmado que o texto de busca seguiu corretamente o Atenolol para o índice 1, e que Amlodipina (que veio para o índice 0) ficou com o campo de busca vazio (sem herdar nada indevidamente). O item Benazepril, não envolvido na troca, manteve seu próprio texto de busca intacto.

## Console / rede

- Nenhum erro novo introduzido pela mudança.
- Confirmado (como em todos os pacotes anteriores desta sessão): `/api/v1/alertas-internos` retorna 500 de forma consistente — artefato de drift de schema do snapshot de banco de produção copiado para uso local, não relacionado a esta mudança.

## Revisão adversarial

Agente `general-purpose` revisou o diff real (`git diff origin/stage`) e o código ao redor, com foco em corretude dos helpers de reindexação (`trocarIndicesAposMover`, `reindexarAposInsercaoDeItem`) em combinação com o já existente `reindexarAposRemocaoDeItem`, e em segurança de reaproveitamento de funções existentes.

**Achado real (corrigido)**: a implementação inicial reaproveitava `cloneHistoricalPrescriptionItem` para gerar a cópia do "Duplicar". Essa função zera `peso_referencia_kg` — correto para seu caso de uso original (copiar de uma receita histórica de outro atendimento, onde o peso registrado está desatualizado por definição), mas incorreto para duplicar um item **dentro da mesma receita**: `peso_referencia_kg` é um input editável pelo usuário (`page.tsx`, campo "Peso kg", com precedência sobre o peso da triagem em `calcularDosePrescricaoItem`), não um valor derivado. Duplicar um item com esse campo preenchido perderia a customização silenciosamente, mudando a dose calculada da cópia sem qualquer aviso.

**Verificação da correção**: reproduzido o bug e a correção diretamente no preview local — preenchido `peso_referencia_kg = "8"` num item, duplicado, e confirmado que a cópia preservava `8` (após trocar `cloneHistoricalPrescriptionItem` por `hydratePrescriptionItem` com `id`/`historico_ajustes` descartados explicitamente, mesmo padrão já usado em `salvarPresetPrescricaoAtual`). `tsc --noEmit` reconfirmado limpo após a correção.

**Demais pontos verificados pelo agente e confirmados corretos** (não exigiram correção): `trocarIndicesAposMover` (troca correta de índices, sem entradas fantasma quando um lado está vazio); `reindexarAposInsercaoDeItem` (desloca corretamente todo índice >= ponto de inserção, sem herdar estado para a posição nova); sequências encadeadas de mover/duplicar/remover (estado sempre segue o item certo); ausência de mutação in-place do array; guard interno de limites em `moverItemPrescricao` (independente do atributo `disabled` do botão); visibilidade do botão "Duplicar" com 1 único item.
