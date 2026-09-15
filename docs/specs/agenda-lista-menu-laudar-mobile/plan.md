# Plan - agenda-lista-menu-laudar-mobile

Data: 2026-09-13  
Responsavel: Martiniano Barros  
Status: concluido e verificado em stage

## 1) Tarefas

- [x] T1 reproduzir o defeito isoladamente e medir o recorte, para separar
      "esta escondido" de "nao existe rolagem".
- [x] T2 tirar `overflow-hidden` de `.fc-agenda-list` e mover o arredondamento
      para as pontas do conteudo.
- [x] T3 criar `.fc-agenda-row-menu` / `.fc-agenda-row-menu-panel` com o
      comportamento atual de dropdown.
- [x] T4 adicionar a variante mobile: painel ancorado no rodape da viewport e
      backdrop pelo `::before` do `<summary>`.
- [x] T5 aplicar as classes no menu "Laudar" de `app/agenda/page.tsx`.
- [x] T6 verificar com o CSS compilado do `next build` contra a marcacao real
      da pagina, em 375x812 e em 1200x800.
- [x] T7 verificacao manual em stage, no celular - confirmada em 2026-09-13.

## 2) Ordem e dependencias

T2 sozinho ja resolve o recorte relatado, e e a correcao da causa. T3 e T4 sao
a parte de UX: sem eles, no celular o menu abriria para baixo e o vet teria de
rolar ate o fim da pagina para ver os itens. T5 depende de T3.

## 3) Risco

Dois pontos, ambos verificados em T6:

- Tirar `overflow-hidden` podia deixar o fundo de hover do primeiro e do ultimo
  card vazando para fora da borda arredondada. Coberto por RF-006.
- `position: fixed` so ancora na viewport enquanto nenhum ancestral do `<main>`
  criar bloco contentor (`transform`, `filter`, `contain`). Hoje nenhum cria.
  Se alguem adicionar um depois, o painel ancora no ancestral e o defeito
  volta com outra aparencia - anotado em `intent.md`, secao 4.

Rollback: reverter o commit. Nao ha migracao nem estado persistido.

## 4) Entrega

Defeito de apresentacao, sem perda de dado e com contorno (girar o celular ou
usar o desktop). Entra por `stage`, no fluxo normal, e chega em producao pelo
PR de promocao.
