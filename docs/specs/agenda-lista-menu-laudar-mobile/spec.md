# Spec - agenda-lista-menu-laudar-mobile

Data: 2026-09-13  
Responsavel: Martiniano Barros  
Status: implementado

## 1) Escopo

Frontend, apresentacao. `frontend/app/globals.css` e o trecho do menu "Laudar"
em `frontend/app/agenda/page.tsx`. Nenhuma mudanca de comportamento, backend ou
contrato.

## 2) Requisitos funcionais

- RF-001: em qualquer largura, o painel do menu "Laudar" nao e recortado pela
  lista - inclusive no ultimo card.
- RF-002: em telas ate 639px, o painel aberto fica inteiro dentro da viewport,
  sem depender de rolagem.
- RF-003: em telas ate 639px, tocar fora do painel fecha o menu.
- RF-004: os tres itens do menu continuam clicaveis - nada do overlay fica por
  cima deles.
- RF-005: em telas a partir de 640px o menu segue sendo o dropdown ancorado no
  botao, como antes.
- RF-006: a lista mantem o canto arredondado no primeiro e no ultimo card,
  inclusive com o fundo de hover.

## 3) Requisitos tecnicos

- RT-001: `.fc-agenda-list` deixa de usar `overflow-hidden`. O arredondamento
  passa para `.fc-agenda-list-row:first-child` / `:last-child` e para
  `.fc-agenda-empty`.
- RT-002: classes novas `.fc-agenda-row-menu` (o `<details>`) e
  `.fc-agenda-row-menu-panel` (o painel), no lugar das utilitarias soltas.
- RT-003: ate 639px o painel e `position: fixed` ancorado no rodape da
  viewport, respeitando `env(safe-area-inset-bottom)`, com
  `max-height: 70svh` e rolagem propria.
- RT-004: o backdrop e o `::before` do proprio `<summary>`, so quando
  `[open]`. Tocar nele aciona o `<summary>` e o `<details>` fecha sozinho, sem
  JavaScript.
- RT-005: backdrop em `z-index: 40` e painel em `z-index: 50` - abaixo do
  `z-[60]` da sidebar mobile e do `z-index: 100` dos modais.

## 4) Criterios de aceitacao

- CA-001: viewport 375x812, menu do ultimo card aberto - os tres itens tem
  `getBoundingClientRect()` inteiramente dentro da viewport.
- CA-002: no mesmo estado, `document.elementFromPoint` no centro de cada item
  devolve o proprio item (o backdrop nao intercepta).
- CA-003: clicar fora do painel deixa o `<details>` com `open === false`.
- CA-004: viewport >= 640px - o painel volta a `position: absolute` e o
  `bottom` dele passa do `bottom` da lista sem recorte.
- CA-005: `npx vitest run`, `npm run build` e `npm run lint` seguem limpos.

## 5) Fora de escopo

- Menu "Laudar" da Agenda FullCalendar.
- Demais telas que usam `<details>` como dropdown.
