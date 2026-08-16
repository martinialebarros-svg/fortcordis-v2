# Intent - atendimento-auditoria-ux-fluxo-lote-2026-08-15

Data: 2026-08-15
Responsavel: Claude (pareado com Martiniano)
Status: implementado

## 1) Problema atual

A issue de tracking #57 ("Auditoria UX/Fluxo — Atendimento Clínico:
acompanhamento das 37 correções", origem
`docs/AUDITORIA-ATENDIMENTO-UX-FLUXO-2026-08-09.md`) listava 37
achados de UX/fluxo do modulo de Atendimento Clinico. Ate 2026-08-15,
11 achados de impacto Media/Baixa (esforco Pequeno/Medio/Grande)
seguiam sem correcao:

- **#29** (Media/Medio) - Biblioteca de frases clinicas isolada da tela
  de uso: para criar um atalho reutilizavel a partir de um texto
  digitado, o vet precisava sair da aba Consulta e ir em "Bibliotecas
  clinicas".
- **#24** (Media/Medio) - "Bibliotecas clinicas" nao preservava a aba
  de trabalho anterior (Consulta/Exames/Prescricao/Documentos) ao
  fechar o painel.
- **#23** (Media/Medio) - Duas interfaces de navegacao/progresso
  redundantes: o card "Jornada do atendimento" navegava para as mesmas
  4 areas das abas do topo, com nomenclatura e criterio de "concluido"
  divergentes.
- **#35** (Media/Medio) - Drag-and-drop de arquivo de exame so
  funcionava com o card do exame ja expandido manualmente.
- **#32** (Media/Medio) - Nenhum indicador de que a clinica parceira ja
  visualizou um exame liberado no portal - o vet precisava telefonar
  para confirmar.
- **#49** (Media/Medio) - Nenhuma comparacao de valores clinicos entre
  visitas, exceto peso (temperatura/FC/FR sem serie historica).
- **#55** (Media/Medio) - Modais do modulo sem padrao comum de
  acessibilidade (Escape, clique fora, `role="dialog"`).
- **#25** (Baixa/Pequeno) - Botao "Laudar" com aparencia de acao local,
  mas navega para outro modulo (`/laudos`).
- **#36** (Baixa/Pequeno) - Painel-resumo de exames nao mostrava a
  contagem de "Liberado no portal", apesar do dado ja ser calculado.
- **#56** (Baixa/Pequeno) - Estados vazios de listas filtradas (Casos
  recentes, exames, documentos) eram so texto informativo, sem acao
  para resetar o filtro ativo.
- **#45** (Media/Grande) - Editor de corpo de documento/template
  clinico era texto plano, sem negrito/italico/lista nem no editor nem
  no PDF gerado.

## 2) Objetivo

Fechar os 11 achados restantes da auditoria (issues #23, #24, #25,
#29, #32, #35, #36, #45, #49, #55, #56), cada um com escopo isolado
por arquivos, verificacao propria (testes automatizados + navegador
real quando aplicavel) e commit dedicado - exceto #25/#36/#56, que
compartilhavam arquivo e foram agrupados num commit unico por
tocarem regioes distintas dos mesmos 3 arquivos.

`#45` teve o escopo reduzido combinado com o usuario antes da
implementacao: barra de formatacao (negrito/italico/lista) + conversao
real no PDF, sem preview ao vivo no editor (que exigiria parser/
renderer client-side, esforco bem maior que o resto do lote).

`#32` foi adiado uma vez por conflito de arquivos com uma sessao
paralela (redesign do portal de clinicas parceiras, ja mesclado) e
implementado depois que aquele trabalho foi commitado.

## 3) Rastreamento (issue -> commit)

| Issue | Commit | Resumo |
| --- | --- | --- |
| #29 | `ab2ea490` | Botao "Salvar como frase" no editor de Consulta |
| #24 | `9cd70d86` | Pill "Bibliotecas clinicas" vira toggle com memoria de aba |
| #23 | `0e0b6f7f` | Remove card "Jornada do atendimento" duplicado |
| #35 | `550ec869` | Drag-and-drop de exame com card colapsado |
| #32 | `14463292` | Selo de visualizacao do exame pela clinica parceira |
| #49 | `f99c54c2` | Comparacao de temperatura/FC/FR com a visita anterior |
| #55 | `4a05313c` | Wrapper `Modal` compartilhado de acessibilidade |
| #25, #36, #56 | `71a5d720` | Botao Laudar, tile "No portal", vazios com reset |
| #45 | `a58c579a` | Formatacao minima (negrito/italico/lista) em documentos |
