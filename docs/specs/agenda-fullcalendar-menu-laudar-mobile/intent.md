# Intent - agenda-fullcalendar-menu-laudar-mobile

Data: 2026-09-13  
Responsavel: Martiniano Barros  
Status: draft

## 1) Problema

Continuacao de `agenda-lista-menu-laudar-mobile`, que corrigiu o menu "Laudar"
da Agenda em modo lista e registrou este caso como observacao fora de escopo
(secao 6 do `verify.md` de la).

A Agenda FullCalendar tem o mesmo menu, com a mesma marcacao
(`<details class="relative">` + painel `absolute`), no card "Detalhes do evento
selecionado" (`app/agenda/fullcalendar/page.tsx:2654`).

**O defeito nao e o mesmo.** La o painel nao e recortado: o card mora em
`.fc-calendar-detail-card`, que nao usa `overflow-hidden` - quem usa e a
`.fc-calendar-surface`, que e irma, nao ancestral. O que sobra e a outra metade
do problema: o menu abre sempre para baixo, e o card de detalhes e o ultimo
bloco da pagina, abaixo do calendario inteiro. No celular, com o calendario
ocupando a tela, o menu aberto cai fora da area visivel e exige rolar para
achar as opcoes.

## 2) Objetivo

No celular, abrir "Laudar" na Agenda FullCalendar mostra as tres opcoes
inteiras, sem rolar - igual ao que a lista ja faz.

## 3) Nao objetivos

- Nao mudar o que o menu faz. Os tres destinos (`laudarSelecionado`) ficam
  iguais.
- Nao mexer no resto do card de detalhes nem no calendario.
- Nao trocar `<details>` por componente controlado.

## 4) Contexto e restricoes

- As classes `.fc-agenda-row-menu` / `.fc-agenda-row-menu-panel` ja existem,
  criadas em `agenda-lista-menu-laudar-mobile`. Esta entrega so precisa de uma
  variante de alinhamento: o menu da lista ancora pela direita do botao
  (`right-0`), o da FullCalendar pela esquerda (`left-0`).
- Mesma restricao de ancestral da entrega anterior: o painel so pode ser
  `position: fixed` porque nenhum ancestral do `<main>` cria bloco contentor
  para fixed. Conferido tambem em `.fc-agenda-page` / `.fc-calendar-page` /
  `.fc-calendar-detail-card` - nenhum tem `transform`, `filter` ou `contain`.
- A variante de alinhamento precisa ser declarada **antes** do bloco `@media`
  que reposiciona o painel no celular. Mesma especificidade (uma classe), entao
  quem vem depois no arquivo ganha - se a ordem inverter, o `left: 0` volta a
  valer no celular e quebra a folha de rodape.

## 5) Dependencia

Depende das classes introduzidas em `agenda-lista-menu-laudar-mobile`. Por isso
entra no mesmo PR, nao em um separado: sozinha ela nao compila para nada util.
