# Plan - agenda-fullcalendar-menu-laudar-mobile

Data: 2026-09-13  
Responsavel: Martiniano Barros  
Status: concluido; verificacao manual em stage pendente

## 1) Tarefas

- [x] T1 conferir se o defeito da lista se repete aqui - conferido que **nao**:
      `.fc-calendar-detail-card` nao usa `overflow-hidden`, entao nao ha
      recorte, so o menu abrindo fora da tela.
- [x] T2 conferir a cadeia de ancestrais da pagina FullCalendar quanto a
      `transform` / `filter` / `contain`, que quebrariam o `position: fixed`.
- [x] T3 criar `.fc-agenda-row-menu-panel-start`, posicionada antes do `@media`.
- [x] T4 aplicar as classes no menu de `app/agenda/fullcalendar/page.tsx`.
- [x] T5 verificar com o CSS compilado contra a marcacao real do card de
      detalhes, em 375x812 e 1200x800.
- [ ] T6 verificacao manual em stage, no celular.

## 2) Ordem e dependencias

T1 antes de tudo: sem ele a entrega descreveria um defeito que nao existe aqui.
T3 antes de T4. Todo o resto depende das classes de
`agenda-lista-menu-laudar-mobile`, entregues no mesmo PR.

## 3) Risco

Um ponto, verificado em T5: a ordem entre `.fc-agenda-row-menu-panel-start` e o
bloco `@media`. Empatam em especificidade, entao quem vem depois no arquivo
ganha. Se alguem mover a variante para baixo do `@media`, o `left: 0` volta a
valer no celular e a folha de rodape encosta no canto esquerdo com largura de
dropdown. Registrado tambem em `intent.md`, secao 4, e conferido no CSS
compilado (secao 3 do `verify.md`).

Rollback: reverter o commit. Nao ha migracao nem estado persistido.

## 4) Entrega

Entra no PR de `agenda-lista-menu-laudar-mobile` (base `stage`), por depender
das classes criadas la. Producao recebe depois, pelo PR de promocao.
