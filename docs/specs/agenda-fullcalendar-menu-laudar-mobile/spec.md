# Spec - agenda-fullcalendar-menu-laudar-mobile

Data: 2026-09-13  
Responsavel: Martiniano Barros  
Status: implementado

## 1) Escopo

Frontend, apresentacao. O menu "Laudar" do card "Detalhes do evento
selecionado" em `frontend/app/agenda/fullcalendar/page.tsx`, mais uma classe
nova em `frontend/app/globals.css`. Nenhuma mudanca de comportamento, backend
ou contrato.

## 2) Requisitos funcionais

- RF-001: em telas ate 639px, o painel aberto fica inteiro dentro da viewport,
  sem depender de rolagem.
- RF-002: em telas ate 639px, tocar fora do painel fecha o menu.
- RF-003: os tres itens continuam clicaveis - nada do overlay fica por cima.
- RF-004: em telas a partir de 640px o menu continua sendo o dropdown ancorado
  pela **esquerda** do botao, como era antes.

## 3) Requisitos tecnicos

- RT-001: o `<details>` passa a usar `.fc-agenda-row-menu` e o painel
  `.fc-agenda-row-menu-panel`, reaproveitando o que
  `agenda-lista-menu-laudar-mobile` criou.
- RT-002: classe nova `.fc-agenda-row-menu-panel-start` (`left: 0;
  right: auto`) para o alinhamento pela esquerda, declarada **antes** do bloco
  `@media (max-width: 639px)` para que a folha de rodape continue ganhando no
  celular.
- RT-003: nenhuma regra nova no `@media`. O comportamento mobile e exatamente o
  mesmo da lista.

## 4) Criterios de aceitacao

- CA-001: viewport 375x812, menu aberto - `position` computa `fixed`, `left` e
  `right` valem `12px` (a variante `-start` nao vaza para o mobile), e os tres
  itens ficam dentro da viewport.
- CA-002: no mesmo estado, `elementFromPoint` no centro de cada item devolve o
  proprio item.
- CA-003: clicar fora deixa o `<details>` com `open === false`.
- CA-004: viewport 1200x800 - `position` volta a `absolute` e a borda esquerda
  do painel coincide com a borda esquerda do `<summary>`.
- CA-005: `npx vitest run`, `npm run build` e `npm run lint` seguem limpos.

## 5) Fora de escopo

- Demais telas que usam `<details>` como dropdown.

## 6) Mudanca cosmetica aceita

O painel da FullCalendar era `w-56` (14rem) e passa a `w-60` (15rem), largura da
classe compartilhada - 16px a mais, em um card que tem folga. A alternativa
seria um segundo modificador so para a largura, o que nao se paga.
