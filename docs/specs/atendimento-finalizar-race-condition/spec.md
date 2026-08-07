# Spec - atendimento-finalizar-race-condition

Data: 2026-08-07
Responsavel: Claude (Sonnet 5)
Status: done

## 1) Escopo funcional

`finalizarAtendimento` passa a mesclar a resposta do `/finalizar` com o
form atual (em vez de substituir incondicionalmente), reusando
`mergeAutoSavedFormState`. Essa funcao e suas dependencias privadas
(`mergeAutoSavedItems`, `buildPrescriptionMergeKey`) e sua dependencia
publica (`buildExamMergeKey`, usada tambem em `resolveExamIdForUpload`)
sao extraidas de `page.tsx` para `lib/atendimento-form-merge.ts`. Os 3
tipos que essa logica usa (`AtendimentoForm`, `ExameSolicitacao`,
`PrescricaoItem`) passam a ser exportados (como tipo) do `page.tsx`.

## 2) Requisitos funcionais (RF)

- RF-001: apos `POST /atendimentos/{id}/finalizar` responder,
  `finalizarAtendimento` chama
  `setForm((current) => mergeAutoSavedFormState({...current, exames: ...}, hydrated))`
  - mesmo padrao literal do achado #18 em `executarSaveAtendimento`
  (incluindo o filtro de `_destroy` e o fallback `[emptyExam()]`).
- RF-002: `lastPersistedSnapshotRef.current` continua sendo
  `serializeAtendimentoSnapshot(hydrated)` (snapshot do SERVIDOR, nao do
  merge) - inalterado em relacao ao codigo anterior.
- RF-003: a atribuicao direta `formRef.current = hydrated` e removida (o
  `useEffect` existente em `page.tsx` que sincroniza
  `formRef.current = form` a cada mudanca de `form` ja cobre isso; manter
  a atribuicao direta reintroduziria uma janela onde `formRef.current`
  (=`hydrated`) e `form` (=merged) divergem).
- RF-004: `lib/atendimento-form-merge.ts` exporta `mergeAutoSavedFormState`
  e `buildExamMergeKey`; `mergeAutoSavedItems` e `buildPrescriptionMergeKey`
  permanecem privados ao modulo (sem uso externo).
- RF-005: `page.tsx` importa ambas as funcoes de
  `@/lib/atendimento-form-merge` em vez de defini-las localmente; o
  unico outro call site de `buildExamMergeKey`
  (`resolveExamIdForUpload`) passa a usar a versao importada, sem mudanca
  de comportamento.

## 3) Requisitos nao funcionais (NFR)

- NFR-001 (sem mudanca de comportamento na extracao): o corpo das 4
  funcoes movidas e byte-a-byte identico ao que existia em `page.tsx`
  antes da extracao, exceto pelas palavras-chave `export`.
- NFR-002 (sem export de valor em `page.tsx`): nenhuma funcao/const de
  valor nova e exportada do `page.tsx` (restricao do Next.js App Router)
  - apenas os 3 tipos (`export type`), que nao tem representacao em
  runtime.
- NFR-003 (teste real, nao script de prova): a verificacao desta feature
  usa Vitest importando `mergeAutoSavedFormState` de
  `lib/atendimento-form-merge.ts` (codigo de producao real), nao um
  script `.mjs` que reimplementa a logica.

## 4) Contratos tecnicos

### API

Sem mudanca - o contrato de `/atendimentos/{id}/finalizar` e o mesmo; a
mudanca e inteiramente sobre como o CLIENTE aplica a resposta.

### Banco/migracoes

Nao aplicavel.

### Frontend

- Arquivo novo: `frontend/lib/atendimento-form-merge.ts` (logica pura,
  sem hooks, sem `"use client"`).
- Arquivo novo: `frontend/lib/atendimento-form-merge.test.ts`.
- `frontend/app/atendimento/page.tsx`: 3 tipos passam a `export type`;
  import novo de `@/lib/atendimento-form-merge`; bloco de ~85 linhas
  removido (movido); `finalizarAtendimento` corrigido.

## 5) Compatibilidade e rollout

- Backward compatibility: total - nenhum contrato de API ou payload
  muda; o unico comportamento de runtime alterado e que edicoes feitas
  durante o round-trip do `/finalizar` deixam de ser apagadas.
- Feature flag: nenhuma.
- Estrategia de rollback: reverter o commit restaura o comportamento
  anterior (substituicao incondicional) e a definicao local das funcoes
  em `page.tsx`.

## 6) Criterios de aceitacao (CA)

- CA-001: merge de uma edicao em campo de texto simples (`queixa_principal`)
  feita entre o save manual e a resposta do `/finalizar` preserva a
  edicao.
- CA-002: quando o form local ainda nao tem `id`, o merge adota o `id`
  devolvido pelo servidor.
- CA-003: um exame existente (mesmo `id`) com edicao local de `resultado`
  preserva a edicao local ao mesclar com a versao persistida.
- CA-004: um exame presente no form local mas ausente no snapshot
  persistido (adicionado depois do payload enviado) permanece no
  resultado do merge.
- CA-005: `npx tsc --noEmit`, `npm run lint`, `npm run build` e a suite
  completa do backend permanecem verdes apos a extracao.

## 7) Casos de borda

- CB-001: `resolveExamIdForUpload` (outro call site de
  `buildExamMergeKey`, fora do escopo do bug mas na mesma cadeia de
  extracao) continua funcionando identicamente - garantido por ser a
  MESMA implementacao, so importada de outro arquivo.
- CB-002: `import type` de `page.tsx` dentro de
  `lib/atendimento-form-merge.ts`, combinado com `import` de valor de
  `lib/atendimento-form-merge.ts` dentro de `page.tsx`, não gera
  dependência circular em runtime (tipos são apagados na compilação) -
  confirmado por `npm run build` completar sem erro.

## 8) Fora de escopo

- Confirmacao visual real no navegador.
- Extrair outras funcoes puras de `page.tsx` alem das estritamente
  necessarias para este bug (ex.: `emptyForm`/`emptyExam`/`hydrateFormFromDetail`
  permanecem locais ao `page.tsx`).
- Testar `finalizarAtendimento` via render do componente completo.
