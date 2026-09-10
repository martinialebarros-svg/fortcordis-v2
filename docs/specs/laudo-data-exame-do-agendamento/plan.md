# Plan - laudo-data-exame-do-agendamento

Data: 2026-09-10  
Responsavel: Martiniano Barros  
Status: done

## 1) Sequencia de fases

- Fase 1 (DB/migracoes): nao se aplica.
- Fase 2 (backend/API): nao se aplica.
- Fase 3 (frontend): ordem de preenchimento da data nas duas paginas de laudo.
- Fase 4 (testes/verificacao): teste de componente + verificacao manual.

## 2) Tarefas por fase

### Fase 1

- [x] Confirmado que nao ha impacto em banco.
- Criterio de conclusao: nenhuma migracao necessaria.
- Risco: nenhum.
- Rollback: n/a.

### Fase 2

- [x] Confirmado que `GET /agenda/{id}` ja devolve `data` e `inicio` e que o
  upload nao muda de contrato.
- Criterio de conclusao: nenhum arquivo em `backend/` alterado.
- Risco: nenhum.
- Rollback: n/a.

### Fase 3

- [x] T3.1 em `upload/page.tsx`, semear a data do dia no efeito de montagem
  apenas quando o contexto inicial nao tiver `agendamento_id`.
- [x] T3.2 no efeito do agendamento, preferir `item.data` a `item.inicio`
  (evita o deslocamento de dia que `calendarDateInput` aplica a datetime sem
  timezone).
- [x] T3.3 no ramo de erro do agendamento, semear a data do dia para o campo
  nao ficar vazio.
- [x] T3.4 em `novo/page.tsx`, normalizar com `calendarDateInput` e aceitar
  `inicio` como fallback.
- Criterio de conclusao: `npx tsc --noEmit` e `npm run lint` limpos.
- Risco: sobrescrever data ja digitada pelo usuario — mitigado por manter o
  padrao `setDataExame((current) => current || ...)`.
- Rollback: reverter o commit.

### Fase 4

- [x] T4.1 criar `frontend/app/laudos/eletrocardiograma/upload/page.test.tsx`
  cobrindo com agendamento, sem agendamento e com falha no agendamento.
- [x] T4.2 confirmar que o teste falha sem a correcao.
- [x] T4.3 rodar a suite completa do frontend.
- Criterio de conclusao: suite verde.
- Risco: teste dependente do DOM da pagina.
- Rollback: reverter o commit.

## 3) Plano de testes

- Testes unitarios: nao ha helper novo; `calendar-date` ja tem cobertura.
- Testes de integracao: `frontend/app/laudos/eletrocardiograma/upload/page.test.tsx`
  (render da pagina com axios, `next/navigation` e `@/lib/clinicas` mockados).
- Testes manuais: cenarios de `verify.md` em stage.

## 4) Ordem de entrega

PR de feature com base `stage`, conforme `docs/RUNBOOK-STAGE-PROD.md`.
Promocao para `main` so depois da verificacao manual em stage.
