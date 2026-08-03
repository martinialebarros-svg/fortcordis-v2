# Plan - atendimento-header-acoes-layout

Data: 2026-08-02
Responsavel: Claude (pareado com Martiniano)
Status: done

## 1) Sequencia de fases

- Fase 1 (DB/migracoes): nao se aplica.
- Fase 2 (backend/API): nao se aplica - mudanca so em `globals.css`.
- Fase 3 (frontend): remover `lg:max-w-xl` de `.fc-care-header-actions`.
- Fase 4 (integracao/observabilidade): build, verificacao visual antes/depois
  em stage autenticado (desktop e mobile).

## 2) Tarefas por fase

### Fase 3

- [x] T3.1 Remover `lg:max-w-xl` de `.fc-care-header-actions` em
  `frontend/app/globals.css`, com comentario explicando a causa raiz.
- Criterio de conclusao: `npm run build` aprovado.
- Risco: nenhum - reducao de restricao, nao adiciona comportamento.
- Rollback: reverter o commit.

### Fase 4

- [x] T4.1 `npm run build` aprovado.
- [x] T4.2 Verificacao visual em stage (sessao ja autenticada): screenshot
  antes (3 linhas) e depois (menos linhas) em 1440x900, e confirmacao de que
  o mobile (375px) nao mudou.
- Criterio de conclusao: `verify.md` com evidencia visual.
- Risco: nenhum residual conhecido.
- Rollback: reverter o commit.

## 3) Plano de testes

- Sem teste automatizado (mudanca puramente visual/CSS, sem logica).
- Verificacao visual manual via Browser tool contra o stage real, reaproveitando
  a sessao ja autenticada da revisao anterior.

## 4) Dependencias e bloqueios

- Nenhum.

## 5) Checklist para iniciar execucao

- [x] `intent.md` aprovado.
- [x] `spec.md` aprovado.
- [x] Fases e rollback revisados.
