# Plan - frontend-typecheck-fila-agendamento

Data: 2026-09-10
Responsavel: Martiniano Barros
Status: done

## 1) Sequencia de fases

- Fase 1 (DB/migracoes): nao se aplica.
- Fase 2 (backend/API): nao se aplica.
- Fase 3 (frontend): exportar `Item` e anotar a fixture do teste.
- Fase 4 (integracao/observabilidade): verificar tsc, lint e vitest; registrar a
  lacuna de CI como proposta.

## 2) Tarefas por fase

### Fase 3

- [x] T3.1 Reproduzir os tres TS2322 em `origin/stage` e confirmar a causa:
  `historico: []` inferido como `never[]`, propagado ao parametro `itens` de
  `response()` pelo tipo do default.
- [x] T3.2 Trocar `type Item` por `export type Item` em
  `app/whatsapp-stage/AppointmentQueue.tsx`, seguindo o idioma ja usado em
  `app/atendimento/page.tsx:339`.
- [x] T3.3 Importar o tipo no teste como
  `import AppointmentQueue, { type Item } from "./AppointmentQueue";`,
  espelhando `components/fortinho/FortinhoOverlay.tsx:3`.
- [x] T3.4 Anotar `const item: Item` e `response = (itens: Item[] = [item])`.
- Criterio de conclusao: `tsc --noEmit` sai 0 sem asserção de escape.
- Risco: anotar a fixture revelar campo obrigatorio faltando. Nao ocorreu.
- Rollback: reverter os dois arquivos; nao ha dependencia externa.

### Fase 4

- [x] T4.1 Rodar `npx tsc --noEmit -p tsconfig.json`, `npm run lint` e
  `npx vitest run`; registrar saidas em `verify.md`.
- [x] T4.2 Auditar os 12 workflows e confirmar quais disparam em
  `pull_request`; registrar a lacuna de frontend e propor `frontend-ci.yml`.
- Criterio de conclusao: tres comandos verdes e proposta descrita.
- Risco: nenhum; passos somente de leitura e verificacao.
- Rollback: nao se aplica.

## 3) Plano de testes

- Testes unitarios: suite vitest completa do frontend, com atencao aos sete
  casos de `AppointmentQueue.test.tsx`.
- Testes de integracao: nao se aplica; sem backend, banco ou rede.
- Testes manuais: nenhum. A mudanca nao altera runtime, entao a suite mais o
  typecheck cobrem integralmente o risco.

## 4) Dependencias e bloqueios

- Dependencia 1: nenhuma. A correcao e local ao frontend.
- Dependencia 2: a proposta de `frontend-ci.yml` depende de decisao do
  responsavel e nao bloqueia esta entrega.

## 5) Checklist para iniciar execucao

- [x] `intent.md` aprovado.
- [x] `spec.md` aprovado.
- [x] Fases e rollback revisados.
- [x] Ambiente de teste definido (local, worktree baseada em `origin/stage`).
