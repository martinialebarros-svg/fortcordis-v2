# Verify - agenda-fullcalendar-menu-laudar-mobile

Data: 2026-09-13  
Responsavel: Martiniano Barros  
Status: verificado

## 1) Matriz de rastreabilidade

| ID | Tipo | Evidencia | Status |
| --- | --- | --- | --- |
| RF-001 / CA-001 | aceitacao | 375x812: `position: fixed`, `left` e `right` computados em `12px`, painel `top` 664 / `bottom` 800 em viewport de 812; os tres itens medidos dentro da viewport | ok |
| RF-003 / CA-002 | aceitacao | `elementFromPoint` no centro de cada item devolve o proprio item nos tres | ok |
| RF-002 / CA-003 | aceitacao | clique fora do painel: `details.open === false` | ok |
| RF-004 / CA-004 | aceitacao | 1200x800: `position: absolute`, painel `left` 837 == `summary` `left` 837, largura 240px | ok |
| RT-001 | tecnico | `<details>` e painel agora usam as classes compartilhadas; utilitarias soltas removidas do JSX | ok |
| RT-002 | tecnico | CSS compilado: `.fc-agenda-row-menu-panel-start{left:0;right:auto}` aparece **antes** do `@media (max-width:639px)`; comparacao de indices no arquivo confirma | ok |
| RT-003 | tecnico | o `@media` nao mudou nesta entrega - diff toca so a declaracao da variante | ok |
| CA-005 | tecnico | secao 2 | ok |
| RF-001 em aparelho real | aceitacao | stage, em celular do responsavel, 2026-09-13: menu aberto pelo card de detalhes, opcoes legiveis | ok |

## 2) Testes executados

```bash
cd frontend && npx vitest run && npm run build && npm run lint && npx tsc --noEmit
```

- **287 testes em 41 arquivos**, todos passando (mesmo numero - mudanca de
  apresentacao, sem teste unitario proprio).
- `next build` compilado.
- `eslint --max-warnings=0` limpo.
- `tsc --noEmit`: limpo fora dos tres erros de
  `app/whatsapp-stage/AppointmentQueue.test.tsx`, ja quebrados antes desta
  entrega.

## 3) Metodo de verificacao

Mesmo metodo da entrega anterior: `jsdom` nao calcula posicao nem recorte,
entao o CSS compilado pelo `next build` foi servido junto com a marcacao real
do card - `.fc-app-shell` > `<main>` > `.fc-agenda-page.fc-calendar-page` >
`.fc-calendar-detail-card`, com o `<details>` copiado de
`app/agenda/fullcalendar/page.tsx`. As medidas vieram de
`getBoundingClientRect()`, `getComputedStyle()` e `elementFromPoint`.

A ordem exigida por RT-002 foi conferida direto no bundle, comparando a posicao
de `.fc-agenda-row-menu-panel-start` com a do bloco `@media` no arquivo.

## 4) Sobre o "antes", com honestidade

Diferente da lista, **aqui nao havia recorte para reproduzir**. Conferido: o
painel nao e cortado por ancestral nenhum. O que a entrega melhora e o menu
abrir sempre para baixo em um card que e o ultimo bloco da pagina, abaixo do
calendario inteiro - no celular isso poe as opcoes fora da area visivel,
dependendo da altura do calendario e de onde a pagina esta rolada.

O repro usa um calendario de altura fixa (220px), bem menor que o real, entao
nao serve para medir um "antes" numerico fiel e nenhum numero de antes foi
registrado na matriz. O que a matriz afirma e so o estado depois: o painel cabe
na tela, os itens sao clicaveis e tocar fora fecha - o que torna a posicao de
rolagem irrelevante.

## 5) Verificacao em stage

Confirmada pelo responsavel em 2026-09-13, em celular proprio, sobre o commit
`afd78a40` em stage, junto com a tela de lista: o menu abre pelo card de
detalhes e as opcoes ficam legiveis. Aparelho e navegador nao foram
registrados.

O desktop no app real nao estava coberto, e RF-004 ficou apoiado na medicao do
repro. Fechado depois, em producao - secao 7.

## 6) Origem

Veio da observacao fora de escopo registrada na secao 6 do `verify.md` de
`agenda-lista-menu-laudar-mobile`, e fecha aquele item. O relato original do
usuario era so sobre o modo lista.

## 7) Conferencia em producao (2026-09-13)

Feita apos a promocao `24479dc3`, em `app.fortcordis.com.br`. Um evento foi
aberto no calendario de setembro/2026 (113 eventos no periodo) para materializar
o card "Detalhes do evento selecionado", e o menu foi aberto a partir dele.

Somente navegacao e leitura; **nenhum dos tres tipos de laudo foi clicado**.

| Verificacao | 375x812 (celular) | 1440x900 (desktop) |
| --- | --- | --- |
| `position` do painel | `fixed` | `absolute` |
| `left` / `right` computados | `12px` / `12px` | - |
| Painel na viewport | 664 a 800, viewport 812 - inteiro | - |
| Ancoragem | rodape da viewport | borda esquerda coincide com a do `<summary>` |
| Largura | - | 240px, o `w-60` compartilhado (secao 6 do `spec.md`) |
| Tres itens | dentro da tela e clicaveis | clicaveis |
| Tocar fora | fecha o `<details>` | - |
| `overflow` de `.fc-calendar-detail-card` | `visible` | `visible` |

A linha de `left`/`right` e a que mais importa aqui. O risco registrado em
`plan.md` secao 3 era a ordem entre `.fc-agenda-row-menu-panel-start` e o bloco
`@media`: se a variante viesse depois, o `left: 0` venceria no celular e a folha
de rodape encostaria no canto esquerdo com largura de dropdown. Os `12px` dos
dois lados confirmam, no ambiente publicado, que a ordem esta correta - ate aqui
isso so tinha sido conferido lendo o CSS compilado.

RF-004 passa a ter evidencia no app real.
