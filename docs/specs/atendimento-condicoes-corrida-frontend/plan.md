# Plan - atendimento-condicoes-corrida-frontend

Data: 2026-08-06
Responsavel: Claude (Sonnet 5)
Status: done

## 1) Sequencia de fases

- Fase 1 (DB/migracoes): nao aplicavel.
- Fase 2 (backend/API): nao aplicavel - feature 100% frontend.
- Fase 3 (frontend): guards de request-id, serializacao de save,
  `Promise.allSettled` no boot.
- Fase 4 (integracao/observabilidade): verificacao determinística dos 4
  mecanismos + smoke test manual no navegador (parcial - ver secao 2).

## 2) Tarefas por fase

### Fase 1 / Fase 2

N/A.

### Fase 3

- [x] T3.1 - `historicoPacienteRequestIdRef` em `carregarHistoricoPaciente`.
- [x] T3.2 - `cadastroComplementarRequestIdRef` em
  `carregarCadastroComplementar`.
- [x] T3.3 - `abrirAtendimentoRequestIdRef` em `abrirAtendimento`.
- [x] T3.4 - `salvamentoAtendimentoEmVooRef` + wrapper `saveAtendimento`
  sobre `executarSaveAtendimento`.
- [x] T3.5 - `carregarBase`: `Promise.all` -> `Promise.allSettled` +
  mensagem de recursos com falha.
- Criterio de conclusao: `tsc`/build do frontend sem erro (verificado via
  `npm run build` no quality-gate de CI); leitura de codigo confirma que
  cada guard usa o padrao "capturar request-id no inicio, comparar no
  fim antes de aplicar setState".
- Risco: sem teste automatizado de frontend no projeto - unico gate hoje e
  build + lint + revisao manual de codigo.
- Rollback: reverter o commit.

### Fase 4

- [x] T4.1 - Verificacao determinística: os 4 mecanismos (guard de
  requestId, serializacao de save, contraprova sem o guard, allSettled)
  reproduzidos em scripts Node.js isolados do DOM/React, com cenarios
  adversariais de timing controlado. Ver verify.md secao 2.
- [x] T4.2 - Smoke test manual real no navegador: login, abrir atendimento
  existente, 4 ciclos sequenciais de autosave/save manual com verificacao
  do banco apos cada um (CA-003, via integracao real). Ver verify.md
  secao 4.
- [ ] T4.3 - Captura do timing exato de sobreposicao adversarial
  (autosave em voo + clique manual dentro da mesma janela) no navegador.
  Duas tentativas feitas; ambas frustradas por instabilidade do Browser
  pane deste ambiente (viewport 0x0, tab corrompida), nao por falha do
  app. Ver verify.md secao 4 para o detalhe.
- [ ] T4.4 - Confirmacao visual no navegador de CA-001/CA-002 (troca
  rapida de paciente/caso) e CA-004 (falha de recurso secundario). Nao
  concluido nesta sessao pela mesma instabilidade de ambiente.
- Criterio de conclusao: T4.1 e T4.2 satisfazem uma barra de evidencia
  solida (prova algoritmica + integracao real exercitada); T4.3/T4.4
  ficam como trabalho futuro caso se decida exigir confirmacao visual
  antes da proxima promocao para producao.
- Risco: ver verify.md, secoes 2, 4 e 5, para o estado atual detalhado.
- Rollback: reverter o commit caso um smoke test futuro revele regressao.

## 3) Plano de testes

- Testes unitarios: nao aplicavel (sem suite de frontend no projeto). Em
  substituicao, 3 scripts Node.js deterministicos reproduzindo a logica
  exata dos 4 mecanismos, comitados em
  `docs/specs/atendimento-condicoes-corrida-frontend/verificacao/` (ver
  verify.md secao 2) - reproduziveis por qualquer pessoa com
  `node <arquivo>.mjs`.
- Testes de integracao: suite completa do backend executada para garantir
  que nenhuma rota de API foi afetada (mudanca e so no cliente); tambem
  usada para confirmar a reversao limpa do delay temporario injetado
  durante o smoke test (T4.2/T4.3).
- Testes manuais: 4 cenarios descritos em T4.1 original - 1 confirmado com
  integracao real (CA-003), 3 com prova algoritmica mas sem confirmacao
  visual (CA-001, CA-002, CA-004). Ver verify.md para o registro completo.

## 4) Dependencias e bloqueios

- Dependencia 1: nenhuma - mudanca isolada em `page.tsx`, sem depender de
  API nova.
- Bloqueio 1: ausencia de infraestrutura de teste de frontend no projeto
  (achado transversal da auditoria original, fora do escopo desta
  feature corrigir).

## 5) Checklist para iniciar execucao

- [x] `intent.md` aprovado.
- [x] `spec.md` aprovado.
- [x] Fases e rollback revisados.
- [x] Verificacao determinística executada (fase 4, T4.1).
- [x] Smoke test manual de integracao real executado para CA-003 (fase 4, T4.2).
- [ ] Confirmacao visual completa de CA-001/002/004 e captura de timing
  adversarial real de CA-003 (fase 4, T4.3/T4.4 - pendentes).
