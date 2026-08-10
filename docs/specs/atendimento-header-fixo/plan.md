# Plan - atendimento-header-fixo

Data: 2026-08-10
Responsavel: Claude (pareado com Martiniano)
Status: em andamento

## 1) Sequencia de fases

- Fase 1 (frontend): adicionar `xl:sticky xl:top-0 xl:z-20` a
  `.fc-care-header` em `globals.css`.
- Fase 2 (verificacao inicial + revisao adversarial): `tsc`/`build`,
  verificacao visual manual via preview local, revisao adversarial leve
  (1 agente).
- Fase 3 (correcao do achado da revisao): a revisao identificou que o
  painel lateral e a aside ja sticky da mesma pagina ficariam cobertos
  pelo header fixo (offsets `top-6`/`top-3` muito menores que a altura
  real do header) - offsets e `max-height` ajustados; re-verificacao de
  `tsc`/`build` e da margem de seguranca medida ao vivo.
- Fase 4 (`verify.md`).

## 2) Tarefas por fase

### Fase 1

- [x] T1.1 `globals.css`: `.fc-care-header` ganha `xl:sticky xl:top-0
  xl:z-20`.
- Criterio de conclusao: `tsc --noEmit` limpo, `npm run build` verde.
- Risco: baixo - 1 linha de CSS, nenhuma mudanca de JSX/logica.
- Rollback: reverter o commit.

### Fase 2

- [x] T2.1 `npx tsc --noEmit` e `npm run build` no worktree.
- [x] T2.2 Verificacao visual manual inicial: preview local, login como
  admin, aba Atendimento, scroll em viewport 1440px (xl) -> confirmado
  via `getBoundingClientRect()`/`getComputedStyle()` que o header fica
  com `top:0`, `position:sticky`, `z-index:20` apos rolar, botao
  "Salvar atendimento" continua clicavel. Em viewport 1024px (abaixo de
  xl), header confirmado com `position: relative` (inalterado).
- [x] T2.3 Revisao por 1 agente ceptico - identificou que
  `.fc-care-sidebar`/`.fc-care-aside` (ja `xl:sticky` antes deste
  pacote, com `top-6`/`top-3`) ficariam cobertos pelo header fixo
  (`z-20`, `top-0`, altura real ~280-320px) sempre que ambos
  estivessem presos simultaneamente - inclusive a aside de alertas
  criticos (issue #47).

### Fase 3

- [x] T3.1 Medir a altura real do header no cenario mais alto
  observavel ao vivo (atendimento selecionado, rotulo "Novo atendimento
  deste paciente" mais longo -> quebra de linha na fileira de acoes):
  320.5px, em viewport 1440px.
- [x] T3.2 `page.tsx`: offset do painel lateral (`.fc-care-sidebar >
  div`) alterado de `xl:top-6` para `xl:top-[420px]`; offsets da aside
  alterados de `xl:top-6`/`xl:top-3` para `xl:top-[420px]`/
  `xl:top-[408px]`; `max-height` da aside recalculado de
  `calc(100vh-2rem)` para `calc(100vh-436px)`.
- [x] T3.3 Re-rodar `tsc --noEmit`/`npm run build`; re-verificar ao vivo
  (HMR) que a margem entre a altura real do header (320.5px) e o novo
  offset (420px) e >= 80px (99.5px medido).
- [x] T3.4 Segunda rodada de revisao adversarial (confirmatoria) aponta
  que a medicao de T3.1 foi feita em viewport 1440px, mais largo que o
  minimo em que `xl:sticky` ja ativa (1280px), e sem confirmar a
  combinacao com o bloco condicional "Horario da OS" (aparece quando
  ha agendamento vinculado). Pior caso teorico estimado pela revisao:
  ~416.5px (320.5px medido + 2 fileiras extras de botoes quebrando
  linha, ~48px cada). Em vez de reproduzir essa combinacao especifica
  no preview (ambiente local com instabilidade recorrente nesta
  sessao), os offsets foram aumentados para 500px/488px e o
  `max-height` para `calc(100vh-516px)` - ~84px de folga sobre o pior
  caso teorico, e `tsc`/`build` re-confirmados limpos.
- Criterio de conclusao: folga confirmada acima do pior caso teorico
  estimado, nao apenas do cenario unico medido ao vivo.
- Risco: medio - offset fixo em pixels e uma aproximacao (nao usa
  medicao dinamica via JS/ResizeObserver); documentado como risco
  residual aceito no `verify.md`.
- Rollback: reverter o commit.

### Fase 4

- [x] T4.1 `verify.md`.
- Criterio de conclusao: revisao sem achados bloqueantes remanescentes.

## 3) Plano de testes

- Frontend: sem suite automatizada de CSS/layout no projeto;
  verificacao via `tsc`/`build` + inspecao de
  `getBoundingClientRect()`/`getComputedStyle()` no preview local
  (descrita acima).
- Sem mudanca de backend, sem teste de backend necessario.

## 4) Rollback

Reverter o commit deste pacote - mudanca de CSS/classes Tailwind, sem
migration, sem dado persistido.
