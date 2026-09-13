# Intent - agenda-lista-menu-laudar-mobile

Data: 2026-09-13  
Responsavel: Martiniano Barros  
Status: draft

## 1) Problema

Relatado no uso do sistema pelo celular. Na Agenda em modo lista, abrir o menu
"Laudar" de um card que esta no fim da pagina nao mostra as opcoes: os itens
ficam ocultos e nenhuma rolagem alcanca eles.

Causa: `.fc-agenda-list` (`frontend/app/globals.css`) usava `overflow-hidden`
para arredondar os cantos dos cards. O painel do menu e `position: absolute`
dentro do card, entao no ultimo card ele ultrapassa a borda inferior da lista e
e recortado. E `overflow: hidden` faz do container um scroll container que o
usuario nao pode rolar, por isso nao aparece barra de rolagem nem cresce a
altura do documento.

Medido em repro fiel (viewport 375x812, CSS e marcacao da pagina):

- painel do menu: `top` 244, `bottom` 370
- `.fc-agenda-list`: `bottom` 258 - sobram ~14px visiveis dos 126px do painel
- `document.scrollHeight` 812 == altura da viewport - sem rolagem para buscar

Vale para qualquer largura, mas so aparece no celular na pratica: no desktop a
lista raramente termina perto do rodape da tela.

## 2) Objetivo

No celular, abrir "Laudar" no ultimo card da lista mostra as tres opcoes
inteiras, sem precisar rolar nem adivinhar onde estao.

## 3) Nao objetivos

- Nao mexer no que o menu faz. Os tres destinos (`abrirFluxoLaudo`) ficam iguais.
- Nao trocar `<details>` por componente controlado com estado em React. O custo
  nao se justifica para este defeito, e o `<details>` nativo ja da teclado e
  acessibilidade.
- Nao mexer no menu "Laudar" da Agenda FullCalendar
  (`app/agenda/fullcalendar/page.tsx:2654`). E a mesma marcacao, mas mora em um
  painel de detalhe, fora de `.fc-agenda-list`, e nao foi relatado.

## 4) Contexto e restricoes

- `.fc-agenda-list-row` tem `hover:bg-ink-50`: tirar `overflow-hidden` sem
  compensar faz o fundo do primeiro e do ultimo card vazar para fora da borda
  arredondada da lista.
- O painel so pode virar `position: fixed` porque nenhum ancestral do `<main>`
  cria bloco contentor para fixed (sem `transform`, `filter` ou `contain`). O
  `aside` da sidebar tem `transition-transform`, mas e irmao do `<main>`, nao
  ancestral. Se isso mudar, o painel ancora no lugar errado.
- Sidebar mobile aberta usa `z-[60]`; o menu precisa ficar abaixo disso.
