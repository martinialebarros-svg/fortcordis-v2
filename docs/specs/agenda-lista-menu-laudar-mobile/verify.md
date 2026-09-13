# Verify - agenda-lista-menu-laudar-mobile

Data: 2026-09-13  
Responsavel: Martiniano Barros  
Status: verificado em repro com o CSS compilado; verificacao manual em stage pendente

## 1) Matriz de rastreabilidade

| ID | Tipo | Evidencia | Status |
| --- | --- | --- | --- |
| RF-001 / CA-004 | aceitacao | 1200x800: painel `bottom` 375 contra lista `bottom` 252 - passa da lista sem recorte; `position` volta a `absolute` | ok |
| RF-002 / CA-001 | aceitacao | 375x812: painel em `top` 664 / `bottom` 800, viewport 812; os tres itens medidos dentro da viewport | ok |
| RF-003 / CA-003 | aceitacao | clique em (187, 400), fora do painel: `details.open === false` | ok |
| RF-004 / CA-002 | aceitacao | `elementFromPoint` no centro de cada item devolve o proprio item nos tres | ok |
| RF-005 | funcional | acima de 639px o painel computa `position: absolute` e a variante mobile nao se aplica | ok |
| RF-006 | visual | captura em 375x812 e 1200x800: cantos do primeiro e do ultimo card acompanham a borda da lista | ok |
| RT-001..RT-005 | tecnico | CSS compilado em `.next/static/css/`: `.fc-agenda-list` sem `overflow`, e a variante dentro de `@media (max-width:639px)` com `z-index` 40/50 | ok |
| CA-005 | tecnico | secao 2 | ok |
| RF-002 em aparelho real | aceitacao | stage, no celular | pendente |

## 2) Testes executados

```bash
cd frontend && npx vitest run && npm run build && npx tsc --noEmit
```

- **287 testes em 41 arquivos**, todos passando (mesmo numero de antes - a
  mudanca e de apresentacao e nao tem teste unitario proprio).
- `next build` concluido.
- `tsc --noEmit`: limpo fora dos tres erros de
  `app/whatsapp-stage/AppointmentQueue.test.tsx`, que ja estavam quebrados
  antes desta entrega (ver `verify.md` de `atendimento-status-apos-finalizar`,
  secao 2).

## 3) Metodo de verificacao

Nao ha teste automatizado: o defeito e de layout e so aparece com CSS aplicado
e viewport real - `jsdom` nao calcula recorte nem posicao.

Em vez disso, o CSS compilado pelo `next build`
(`.next/static/css/c8251591fba48d21.css`) foi servido junto com a marcacao real
da lista - `.fc-app-shell` > `<main>` > `.fc-service-page` > `.fc-agenda-list`
> `.divide-y` > `.fc-agenda-list-row`, com o `<details>` do menu copiado de
`app/agenda/page.tsx`. As medidas da matriz vieram de
`getBoundingClientRect()` e `elementFromPoint` nessa pagina.

## 4) Teste negativo

O mesmo repro com o CSS anterior (`.fc-agenda-list { overflow: hidden }`),
375x812, menu do ultimo card aberto:

```
painel:  top 244, bottom 370   (altura 126)
lista:   bottom 258            -> ~14px dos 126px visiveis
document.scrollHeight: 812 == innerHeight  -> sem rolagem para alcancar
```

Reproduz o relato exato: os itens ficam ocultos e a barra de rolagem nao os
exibe. Com a correcao, os mesmos numeros viram `top` 664 / `bottom` 800 dentro
de uma viewport de 812.

## 5) Pendente

- Stage, no celular: Agenda em modo lista, rolar ate o ultimo card do dia e
  tocar em "Laudar". Esperado: folha com os tres tipos de laudo colada no
  rodape, legivel inteira, e tocar fora fecha.
- Conferir de passagem que o dropdown no desktop nao mudou de lugar.

## 6) Observacao fora de escopo - resolvida

`app/agenda/fullcalendar/page.tsx:2654` tem o mesmo menu "Laudar" com a mesma
marcacao (`<details class="relative">` + painel `absolute`). La ele nao esta
dentro de `.fc-agenda-list`, entao nao sofre o recorte deste relato - mas
tambem abre sempre para baixo e pode cair fora da tela no celular.

Ficou de fora desta spec por nao ter sido relatado, e foi pedido logo em
seguida. Tratado em `docs/specs/agenda-fullcalendar-menu-laudar-mobile/`, que
reaproveita as classes criadas aqui e entra no mesmo PR - sozinha ela dependeria
de CSS que ainda nao existe em `stage`.
