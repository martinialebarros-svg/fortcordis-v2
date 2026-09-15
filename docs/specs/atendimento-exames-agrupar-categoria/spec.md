# Spec — Agrupar lista de exames por categoria

## Requisitos funcionais

- **RF1**: A lista de exames (`AtendimentoExamesSection.tsx`) agrupa os itens de `examesVisiveis` (a lista já filtrada pelo status rápido selecionado) por `exame.categoria_exame`, preservando a ordem de primeira aparição de cada categoria.
- **RF2**: Exames sem `categoria_exame` preenchido (string vazia ou ausente) caem em um grupo "Sem categoria".
- **RF3**: Cada grupo exibe um cabeçalho de seção (nome da categoria + contagem de itens do grupo) fixo (`sticky`) ao rolar a lista.
- **RF4**: O filtro de status rápido (Todos/Sem arquivo/Com arquivo/Interpretados/No portal) continua funcionando como antes — reduz `examesVisiveis` **antes** do agrupamento, portanto atua como refinamento dentro de cada grupo. Um grupo sem nenhum item correspondente ao filtro atual não é criado/exibido (não há cabeçalhos de grupo vazios).
- **RF5**: Quando `examesVisiveis` está vazio (nenhum exame corresponde ao filtro atual), a mensagem "Nenhum exame encontrado para o filtro atual." continua sendo exibida, sem nenhum cabeçalho de grupo.
- **RF6**: Todo o comportamento existente de cada card de exame (expandir/colapsar, upload de anexo, drag-and-drop, liberar no portal, laudar, histórico de ajustes) permanece inalterado — o agrupamento é puramente uma reorganização visual do laço de renderização, sem alterar a lógica interna de cada card.

## Requisitos não funcionais

- **NFR1**: Nenhuma nova chamada de rede é introduzida — o agrupamento é computado via `useMemo` a partir de `examesVisiveis`, já disponível no componente.
- **NFR2**: Nenhuma função existente (`removerExame`, `atualizarExame`, `alternarLiberacaoExameNoPortal`, upload de anexos, etc.) é modificada.
- **NFR3**: `npx tsc --noEmit` e `npm run build` devem passar sem novos erros/warnings.

## Critérios de aceite

1. Um atendimento com exames de 2+ categorias diferentes exibe cabeçalhos de seção distintos, cada um com a contagem correta de itens.
2. A soma dos itens de todos os grupos é igual ao total de `examesVisiveis`.
3. Aplicar o filtro de status "Com arquivo" (ou qualquer outro) quando nenhum exame corresponde reduz a exibição a zero grupos e mostra a mensagem de "nenhum exame encontrado", sem cabeçalhos de grupo vazios.
4. Um exame sem categoria preenchida aparece no grupo "Sem categoria", sem desaparecer da lista.
5. `tsc --noEmit` e `npm run build` passam sem erros novos.

## Limitação conhecida (documentada, não bloqueante)

O valor de `top` do cabeçalho sticky de categoria (`xl:top-[330px]`) foi calibrado a partir de uma medição real da altura do header global fixo em um estado específico do atendimento de teste (~320px). Como a altura desse header varia com o conteúdo (nome do paciente, presença do banner de "registro histórico", etc.), há um risco residual pequeno de que, em algum estado de conteúdo mais alto que o medido, o cabeçalho de categoria fique parcialmente coberto ao rolar em telas `xl:` (≥1280px). Ver verify.md para detalhes da verificação e da limitação da ferramenta de automação que impediu uma reconfirmação mais ampla nesta sessão.
