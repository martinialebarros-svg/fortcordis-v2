# Plan - agenda-excecao-manual-preserva-data

Data: 2026-09-09  
Responsavel: Martiniano Barros  
Status: done

## 1) Sequencia de fases

- Fase 1 (DB/migracoes): nao se aplica.
- Fase 2 (backend/API): nao se aplica.
- Fase 3 (frontend): helper puro + uso em `NovoAgendamentoModal`.
- Fase 4 (integracao/observabilidade): testes e verificacao manual em stage.

## 2) Tarefas por fase

### Fase 1

- [x] Confirmado que nao ha impacto em banco.
- Criterio de conclusao: nenhuma migracao necessaria.
- Risco: nenhum.
- Rollback: n/a.

### Fase 2

- [x] Confirmado que o payload de `POST /agenda` nao muda.
- Criterio de conclusao: `excecao_operacional_concedida` e
  `motivo_excecao_operacional` continuam derivados dos mesmos estados.
- Risco: nenhum.
- Rollback: n/a.

### Fase 3

- [x] T3.1 criar `frontend/lib/agenda-assistente-excecao.ts` com
  `excecaoManualEstaLiberada` e `deveResetarAssistentePorTrocaDeData`.
- [x] T3.2 derivar `estadoExcecaoManual` / `excecaoManualAtiva` no modal e
  reaproveitar em `excecaoManualLiberada`.
- [x] T3.3 em `handleDataChange`, resetar apenas quando o helper mandar; caso
  contrario chamar `invalidarPanoramaMantendoExcecao()`.
- [x] T3.4 suprimir o popup de proximidade enquanto a excecao esta ativa,
  mantendo a mensagem informativa.
- Criterio de conclusao: `npx tsc --noEmit` e `npm run lint` limpos.
- Risco: afrouxar o bloqueio guiado alem da excecao.
- Rollback: reverter o commit.

### Fase 4

- [x] T4.1 testes unitarios do helper.
- [x] T4.2 teste de componente cobrindo bloqueio, liberacao, troca de data e
  revogacao.
- [x] T4.3 confirmar que o teste falha sem a correcao.
- Criterio de conclusao: suite do frontend verde.
- Risco: teste de componente fragil por depender do DOM do modal.
- Rollback: reverter o commit.

## 3) Plano de testes

- Testes unitarios: `frontend/lib/agenda-assistente-excecao.test.ts`.
- Testes de integracao: `frontend/app/agenda/NovoAgendamentoModal.excecao-manual.test.tsx`
  (render do modal com axios/fortinho mockados).
- Testes manuais: fluxo completo de excecao em stage, conforme `verify.md`.

## 4) Dependencias e bloqueios

- Dependencia 1: nenhuma.
- Dependencia 2: nenhuma.

## 5) Checklist para iniciar execucao

- [x] `intent.md` aprovado.
- [x] `spec.md` aprovado.
- [x] Fases e rollback revisados.
- [x] Ambiente de teste definido (local/stage).
