# Plan - atendimento-finalizar-race-condition

Data: 2026-08-07
Responsavel: Claude (Sonnet 5)
Status: done

## 1) Sequencia de fases

- Fase 1/2 (DB/backend): nao aplicavel - feature 100% frontend.
- Fase 3 (frontend): extracao da logica de merge + fix de
  `finalizarAtendimento`.
- Fase 4 (integracao/observabilidade): teste Vitest real + validacao
  completa (tsc/lint/build/backend).

## 2) Tarefas por fase

### Fase 3

- [x] T3.1 - Tentativa direta de `export const mergeAutoSavedFormState`
  em `page.tsx` - revertida apos `tsc` reportar `TS2344` (restricao do
  Next.js App Router sobre exports de rota).
- [x] T3.2 - Confirmar empiricamente que `export type` nao aciona a
  mesma restricao (teste isolado com `AtendimentoForm` antes de
  prosseguir).
- [x] T3.3 - Exportar `AtendimentoForm`, `ExameSolicitacao`,
  `PrescricaoItem` como tipo em `page.tsx`.
- [x] T3.4 - Criar `lib/atendimento-form-merge.ts` com
  `mergeAutoSavedFormState` + `buildExamMergeKey` (exportados) e
  `mergeAutoSavedItems` + `buildPrescriptionMergeKey` (privados),
  importando os tipos de `page.tsx` via `import type`.
- [x] T3.5 - Remover o bloco original de `page.tsx`, adicionar import de
  `@/lib/atendimento-form-merge`.
- [x] T3.6 - Corrigir `finalizarAtendimento`: `setForm(hydrated)` ->
  `setForm((current) => mergeAutoSavedFormState(..., hydrated))`; remover
  `formRef.current = hydrated` (redundante com o `useEffect` de sync).
- [x] T3.7 - Descobrir e corrigir o segundo call site de
  `buildExamMergeKey` (`resolveExamIdForUpload`) que a primeira tentativa
  de extracao quebrou.
- Criterio de conclusao: `npx tsc --noEmit` limpo.
- Risco: restricao de export do Next.js App Router (ja mapeada em T3.1-2).
- Rollback: reverter o commit.

### Fase 4

- [x] T4.1 - `lib/atendimento-form-merge.test.ts`: 4 casos reais
  (import de codigo de producao, nao script de prova).
- [x] T4.2 - `npx vitest run`: confirmar os 4 novos + os 18 anteriores
  (22 total).
- [x] T4.3 - `npm test` (Vitest + node:test), `npx tsc --noEmit`, `npm
  run lint`, `npm run build`.
- [x] T4.4 - Suite completa do backend (isolamento).
- Criterio de conclusao: todos os comandos de T4.3/T4.4 verdes.
- Risco: nenhum identificado apos T3 completo.
- Rollback: reverter o commit.

## 3) Plano de testes

- Testes unitarios: os 4 casos de
  `lib/atendimento-form-merge.test.ts`, importando a funcao de merge
  REAL (nao uma reimplementacao em script externo, ao contrario dos
  pacotes anteriores desta sessao sobre o mesmo tema).
- Testes de integracao: `npx tsc --noEmit` + `npm run lint` + `npm run
  build` + suite completa do backend (isolamento).
- Testes manuais: nao executados - mesma limitacao de ambiente de
  automacao de navegador ja documentada; fora de escopo deste pacote
  (ver intent.md).

## 4) Dependencias e bloqueios

- Dependencia 1: `mergeAutoSavedFormState` ja usada e verificada em
  produção pelo pacote `atendimento-condicoes-corrida-frontend` (achado
  #18) - este pacote reusa a MESMA funcao, so muda de onde ela e
  importada.

## 5) Checklist para iniciar execucao

- [x] `intent.md` aprovado.
- [x] `spec.md` aprovado.
- [x] Fases e rollback revisados.
- [x] Ambiente de teste definido (Vitest local + tsc + lint + build +
  suite backend).
