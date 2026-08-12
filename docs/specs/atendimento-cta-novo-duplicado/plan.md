# Plan - atendimento-cta-novo-duplicado

Data: 2026-08-12
Responsavel: Claude (pareado com Martiniano)
Status: em andamento

## 1) Sequencia de fases

- Fase 1 (frontend): envolver o botao do header em
  `{selecionado ? null : (...)}` (1 condicional, sem duplicar JSX).
- Fase 2 (verificacao): `tsc`/`build`, verificacao visual dos 3
  estados da matriz (`spec.md`), revisao adversarial, `verify.md`.

## 2) Tarefas por fase

### Fase 1

- [x] T1.1 `page.tsx`, botao do header (`.fc-care-button-secondary`,
  "Novo atendimento"/"Novo atendimento deste paciente"): envolver em
  `{selecionado ? null : (...)}`.
- Criterio de conclusao: `tsc --noEmit` limpo, `npm run build` verde.
- Risco: muito baixo - 1 condicional, reaproveita variavel
  `selecionado` ja existente, sem mudanca de handler/logica.

### Fase 2

- [x] T2.1 `npx tsc --noEmit` e `npm run build` no worktree - ambos
  limpos.
- [x] T2.2 Verificacao visual via preview local (login por `fetch()`
  autenticado + `localStorage`; navegacao direta via
  `?atendimento_id={id}`, suportado pela propria pagina):
  - Estado inicial (`selecionado` falso, `form.paciente_id` falso):
    1 botao "Novo atendimento" no header - confirmado via DOM.
  - Atendimento persistido real aberto via `?atendimento_id=1`
    (`selecionado` truthy): 0 botoes no header, exatamente 1 botao
    "Novo atendimento deste paciente" (confirmado via `className`
    `bg-amber-700`, pertencente ao banner ambar, nao ao header) -
    banner "Registro historico #1" confirmado visivel via
    `textContent` da secao pai do botao e via screenshot.
- [x] T2.3 Revisao por 1 agente ceptico (escopo minimo, 1 arquivo,
  1 condicional).
- [x] T2.4 `verify.md`.
- Criterio de conclusao: revisao sem achados bloqueantes.

## 3) Plano de testes

- Frontend: sem suite automatizada de UI no projeto para esta pagina;
  verificacao via `tsc`/`build` + inspecao de DOM no preview local
  (contagem de botoes + className/texto, descrita acima), usando 2
  atendimentos reais persistidos no banco local copiado (nao dados
  sinteticos).
- Sem mudanca de backend, sem teste de backend necessario - mudanca
  100% de condicional de render no frontend.

## 4) Rollback

Reverter o commit deste pacote - 1 condicional JSX, sem migration,
sem mudanca de contrato de API.
