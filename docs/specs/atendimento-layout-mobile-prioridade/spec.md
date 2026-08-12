# Spec - atendimento-layout-mobile-prioridade

Data: 2026-08-12
Responsavel: Claude (pareado com Martiniano)
Status: em andamento

## 1) Comportamento esperado

`frontend/app/atendimento/page.tsx`, dentro de `.fc-care-layout`
(so quando `showCaseSidebar` e `true` - painel de casos aberto e fora
das abas Prescricao/Bibliotecas, que ja escondem o painel por design
pre-existente):

- `.fc-care-sidebar`: `order-2 xl:order-none` (adicionado a
  `self-start xl:col-span-3` existente).
- `.fc-care-workspace`: `order-1 xl:order-none` (adicionado a
  `${showCaseSidebar ? "xl:col-span-9" : ""}` existente).

Efeito:
- Abaixo de `xl` (1280px), grid em coluna unica: `.fc-care-workspace`
  (order 1) renderiza visualmente ANTES de `.fc-care-sidebar`
  (order 2) - o vet ve as abas clinicas e o editor imediatamente,
  sem rolar pelo painel de casos.
- A partir de `xl`, ambos revertem para `order: 0` (`xl:order-none`)
  - a posicao volta a ser determinada so pela ordem do DOM + o grid
  de 12 colunas (`xl:col-span-3`/`xl:col-span-9`), idêntico ao
  comportamento anterior a este pacote.

## 2) Casos de borda

- `showCaseSidebar` falso (Prescricao/Bibliotecas, ou painel de casos
  fechado): `.fc-care-sidebar` nao e renderizado; `.fc-care-workspace`
  e o unico filho do grid - `order-1`/`xl:order-none` presentes na
  classe mas sem efeito visual (ordem so importa com 2+ itens).
- Sticky do pacote #20 (`xl:sticky xl:top-[500px]` no `.fc-care-sidebar
  > div`, offsets do `.fc-care-aside`): inalterado, aplicado so a
  partir de `xl`, onde `order` volta a `none` - sem interacao com a
  mudanca deste pacote.
- `workspaceGridClass` (sub-grid interno do workspace, usado para o
  layout Exames/Prescricao com aside lateral): sub-grid independente,
  nao e filho direto de `.fc-care-layout` - nao afetado pela
  reordenacao dos 2 itens de nivel superior.

## 3) Fora de escopo

- Breakpoint do grid principal (permanece `xl`).
- Colapsar/ocultar painel de casos por padrao em telas estreitas.
- Qualquer alteracao de offset/breakpoint de `sticky`.
