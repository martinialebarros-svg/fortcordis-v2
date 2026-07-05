# Plan - clinical-scope-ui-priority

Data: 2026-07-05
Responsavel: Equipe FortCordis
Status: ready-for-stage

## Fase 1 - Navegacao e atalhos

- [x] Remover `US Abdominal` da navegacao lateral principal.
- [x] Atualizar o menu `Laudar` da agenda padrao para destacar `Ecocardiograma`, `Eletrocardiograma` e `Pressao Arterial`.
- [x] Atualizar o menu `Laudar` da agenda FullCalendar com a mesma prioridade.

## Fase 2 - Fluxo de Pressao Arterial

- [x] Criar entrada direta de `PA` para `/laudos/novo` com contexto dedicado.
- [x] Abrir o novo laudo de `PA` ja no modo de pressao arterial.
- [x] Dar contexto visual dedicado para `PA` nas telas de novo laudo, edicao e visualizacao.

## Fase 3 - Validacao e rollout

- [x] Executar `eslint` focado nos arquivos alterados.
- [x] Executar `npm run build`.
- [x] Executar `git diff --check`.
- [ ] Publicar em `stage`.
