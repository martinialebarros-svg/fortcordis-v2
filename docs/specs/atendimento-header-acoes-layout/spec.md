# Spec - atendimento-header-acoes-layout

Data: 2026-08-02
Responsavel: Claude (pareado com Martiniano)
Status: done

## 1) Escopo funcional

Remover o teto de largura artificial (`lg:max-w-xl`) da classe
`.fc-care-header-actions` em `frontend/app/globals.css`, deixando o
`flex-wrap` existente e a largura real do `.fc-care-header` decidirem quantas
linhas a barra de acoes ocupa.

## 2) Requisitos funcionais (RF)

- RF-001: `.fc-care-header-actions` mantem `flex flex-col gap-2 sm:flex-row
  sm:flex-wrap sm:items-center lg:justify-end`, sem `lg:max-w-xl`.
- RF-002: o comportamento mobile (`max-width: 639px`, cada acao com `w-full`)
  nao muda.

## 3) Requisitos nao funcionais (NFR)

- NFR-001 (regressao visual): nenhuma mudanca de cor, espacamento interno de
  botao (`fc-care-button-*`) ou texto - so a largura maxima do container.

## 4) Contratos tecnicos

Puramente CSS (Tailwind `@apply`), sem contrato de API, sem migration.

## 5) Compatibilidade e rollout

- Backward compatibility: sim, mudanca so afeta layout.
- Rollback: reverter o commit.

## 6) Criterios de aceitacao (CA)

- CA-001: em viewport 1440x900 (desktop), com um paciente selecionado (todos
  os botoes visiveis, incluindo o bloco Horario da OS + Finalizar quando
  `agendamento_id` esta presente), a barra de acoes ocupa menos linhas que
  antes, comparado visualmente (screenshot antes/depois no `verify.md`).
- CA-002: em viewport mobile (375px), o empilhamento em coluna unica continua
  identico ao anterior.
- CA-003: `npm run build` do frontend continua aprovado.

## 7) Casos de borda

- CB-001: viewport muito estreito, logo acima do breakpoint `sm` (640px) -
  comportamento inalterado (`flex-col` ate `sm`, sem relacao com o teto
  removido que so agia a partir de `lg`, 1024px).

## 8) Fora de escopo

- Qualquer outro ajuste visual da tela de Atendimento.
