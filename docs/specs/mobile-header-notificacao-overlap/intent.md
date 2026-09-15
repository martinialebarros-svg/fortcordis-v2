# Intent - mobile-header-notificacao-overlap

Data: 2026-08-28
Responsavel: Martiniano + Claude
Status: done

## 1) Problema atual

No celular, ao abrir o sino de alertas (`AlertasInternosBell`) o painel dropdown
("Alertas") aparece por baixo do banner de destaque das paginas de dashboard
(ex.: banner "Relatorios & Controle" em `frontend/app/relatorios/page.tsx`,
classe `.fc-reports-header`). O usuario nao consegue ler nem interagir com os
itens do topo da lista de alertas, pois o banner cobre visualmente o painel.

Causa raiz: `.fc-mobile-header` usa `backdrop-blur`, o que cria um stacking
context proprio, mas o elemento continua `position: static` e sem
`z-index` explicito. Por isso, todo o cabecalho mobile (incluindo o dropdown
do sino, que estoura visualmente para baixo do header) e pintado no nivel
"auto" do stacking context raiz, na ordem do DOM. Como `.fc-reports-header`
vem depois no DOM e tambem esta no nivel "auto", ele e pintado por cima do
cabecalho mobile e do dropdown.

## 2) Objetivo

Garantir que o dropdown de notificacoes internas sempre apareca acima de
qualquer conteudo de pagina no mobile (banners, cards, etc.), sem alterar o
comportamento em telas `lg+` (onde o header vira `display: contents` e o
sino usa posicionamento `fixed`).

## 3) Nao objetivos

- Nao mexe no layout/z-index do modal de agendamento (`z-index: 100/80/120`
  usados em outro componente, sem relacao com este bug).
- Nao introduz uma escala global de z-index para o projeto.
- Nao altera o conteudo ou copy do banner de relatorios.

## 4) Contexto e restricoes

- Restricoes tecnicas: fix deve ser so CSS (Tailwind `@apply` em
  `frontend/app/globals.css`), sem mudanca de estrutura DOM.
- Restricoes de prazo: fix pontual, sem dependencia de outras features.
- Restricoes regulatorio/operacional: nenhuma.

## 5) Impacto esperado

- Usuarios impactados: todos os usuarios do dashboard mobile (`< lg`).
- Modulos impactados: layout global (`fc-mobile-header`), qualquer pagina
  com banner/hero no topo do conteudo (ex.: `/relatorios`).
- Risco de regressao: baixo. O ajuste so adiciona `position: relative` e
  `z-index` ao cabecalho mobile, que ja fica oculto (`lg:contents`) em telas
  grandes.

## 6) Riscos iniciais

- Risco 1: aumentar o z-index do header mobile poderia cobrir algum modal
  com z-index menor que 70 — mitigado verificando que os modais existentes
  usam z-index >= 80.
- Risco 2: nenhum outro elemento do app dependia do header mobile ficar
  "atras" de conteudo da pagina.

## 7) Perguntas abertas

- Nenhuma.

## 8) Definition of Ready (gate para spec)

- [x] Problema e objetivo estao claros.
- [x] Escopo e nao escopo estao explicitos.
- [x] Restricoes estao registradas.
- [x] Riscos iniciais estao mapeados.
