# Intent - clinical-scope-ui-priority

Data: 2026-07-05
Responsavel: Equipe FortCordis
Status: ready-for-stage

## Contexto

O Fort Cordis opera, neste momento, com tres fluxos clinicos principais: `Ecocardiograma`, `Eletrocardiograma` e `Pressao Arterial`. A interface ainda destaca `Ultrassonografia Abdominal` em areas de navegacao e acao rapida, enquanto `Pressao Arterial` permanece menos visivel do que deveria.

## Objetivo

Reposicionar a interface para refletir o escopo clinico atual do produto, trazendo `Eco`, `Eletro` e `PA` para o centro do fluxo diario e reduzindo o destaque da ultrassonografia sem remover seu suporte tecnico para uso futuro.

## Resultado esperado

- menus principais e atalhos de agenda priorizam `Eco`, `Eletro` e `PA`;
- `Pressao Arterial` ganha entrada direta no fluxo `Laudar`;
- telas de novo laudo, edicao e visualizacao deixam claro quando o usuario esta em um fluxo dedicado de `PA`;
- `Ultrassonografia Abdominal` permanece acessivel por rota, mas sai do palco principal da operacao atual.
