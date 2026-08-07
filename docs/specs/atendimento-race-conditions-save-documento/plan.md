# Plan - atendimento-race-conditions-save-documento

Data: 2026-08-07
Responsavel: Claude (Sonnet 5)
Status: done

## 1) Sequencia de fases

- Fase 1/2 (DB/backend): nao aplicavel - feature 100% frontend.
- Fase 3 (frontend): merge no save manual (#18) + guard sincrono de
  documento (#19).
- Fase 4 (integracao/observabilidade): verificacao determinística +
  type-check + lint.

## 2) Tarefas por fase

### Fase 3

- [x] T3.1 - `executarSaveAtendimento`, branch manual: troca
  `setForm(hydrated)` por `setForm((current) => mergeAutoSavedFormState(...))`,
  reaproveitando o mesmo pos-processamento de exames do branch de autosave.
- [x] T3.2 - Novo `documentoClinicoEmVooRef = useRef(false)`, declarado
  junto aos demais refs de guard (`criandoAtendimentoAutomaticoRef`,
  `salvamentoAtendimentoEmVooRef`).
- [x] T3.3 - `criarDocumentoClinicoDeTemplate`: guard + set do ref movidos
  para antes do `await obterAtendimentoIdParaDocumento()`; reset no
  `finally`.
- [x] T3.4 - `salvarDocumentoClinico`: mesmo padrao de T3.3.
- Criterio de conclusao: `npx tsc --noEmit` e `npm run lint` limpos.
- Risco: nenhum identificado alem do ja mapeado no intent.md.
- Rollback: reverter o commit.

### Fase 4

- [x] T4.1 - Prova determinística do guard de reentrancia (#19) em
  `docs/specs/atendimento-condicoes-corrida-frontend/verificacao/`
  (reutiliza o padrao ja provado ali para `salvamentoAtendimentoEmVooRef`;
  o guard de #19 e estruturalmente o mesmo, um boolean-ref checado e setado
  sincronamente antes de qualquer await).
- [x] T4.2 - `npx tsc --noEmit -p tsconfig.json`: sem erros.
- [x] T4.3 - `npm run lint` (`eslint . --max-warnings=0`): sem erros/warnings.
- Criterio de conclusao: ambos os comandos retornam limpo.
- Risco: nenhum.
- Rollback: reverter o commit.

## 3) Plano de testes

- Testes unitarios: nao aplicavel (sem suite de frontend no projeto).
- Testes de integracao: `npx tsc --noEmit` + `npm run lint` (os dois
  gates que o `quality-gate` do CI roda) + suite completa do backend
  (garantia de que nada de backend foi tocado por engano).
- Testes manuais: nao executados nesta sessao (mesma limitacao de ambiente
  de automacao de navegador documentada em
  `atendimento-condicoes-corrida-frontend/verify.md`). CA-001/CA-002 tem
  risco residual baixo por reusar `mergeAutoSavedFormState`, ja exercitada
  pelo autosave em uso real; CA-003 usa o MESMO padrao de guard ja provado
  deterministicamente para `salvamentoAtendimentoEmVooRef`.

## 4) Dependencias e bloqueios

- Dependencia 1: `mergeAutoSavedFormState` (ja existente).
- Dependencia 2: padrao de guard sincrono via `useRef` (ja estabelecido
  pelo pacote `atendimento-condicoes-corrida-frontend`).

## 5) Checklist para iniciar execucao

- [x] `intent.md` aprovado.
- [x] `spec.md` aprovado.
- [x] Fases e rollback revisados.
- [x] Ambiente de teste definido (tsc + eslint locais; suite backend para
  garantir isolamento).
