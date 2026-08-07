# Verify - atendimento-finalizar-race-condition

Data: 2026-08-07
Responsavel: Claude (Sonnet 5)
Status: done

## 1) Matriz de rastreabilidade

| ID | Tipo | Evidencia | Status |
| --- | --- | --- | --- |
| RF-001 | requisito | diff de `finalizarAtendimento`: `setForm(hydrated)` substituido por `setForm((current) => mergeAutoSavedFormState(...))`, mesmo padrao (filtro `_destroy` + fallback `[emptyExam()]`) de `executarSaveAtendimento` | ok |
| RF-002 | requisito | diff: linha `lastPersistedSnapshotRef.current = serializeAtendimentoSnapshot(hydrated)` inalterada | ok |
| RF-003 | requisito | diff: `formRef.current = hydrated` removida; `useEffect` de sync em page.tsx (`formRef.current = form`, dependencia `[form]`) preexistente e inalterado | ok |
| RF-004 | requisito | `lib/atendimento-form-merge.ts`: `mergeAutoSavedFormState`/`buildExamMergeKey` com `export`; `mergeAutoSavedItems`/`buildPrescriptionMergeKey` sem `export` | ok |
| RF-005 | requisito | `page.tsx` importa as 2 funcoes de `@/lib/atendimento-form-merge`; `resolveExamIdForUpload` (unico outro call site) usa a mesma importacao | ok |
| NFR-001 | nao regressao | corpo das 4 funcoes movidas comparado linha a linha com a versao anterior (git diff) - identico exceto `export` | ok |
| NFR-002 | restricao Next.js | `npx tsc --noEmit` limpo com os 3 tipos como `export type` e ZERO export de valor novo em `page.tsx` | ok |
| NFR-003 | teste real | `lib/atendimento-form-merge.test.ts` importa `mergeAutoSavedFormState` de `./atendimento-form-merge` (codigo de producao), nao reimplementa a logica | ok |
| CA-001 | aceitacao | `atendimento-form-merge.test.ts::preserva edicao de campo de texto...` | ok |
| CA-002 | aceitacao | `atendimento-form-merge.test.ts::adota o id retornado pelo servidor...` | ok |
| CA-003 | aceitacao | `atendimento-form-merge.test.ts::mescla exame existente por id...` | ok |
| CA-004 | aceitacao | `atendimento-form-merge.test.ts::mantem exame sem correspondencia...` | ok |
| CA-005 | aceitacao | secao 2 (tsc/lint/build/backend, todos verdes) | ok |
| CB-001 | caso de borda | `resolveExamIdForUpload` nao foi alterado em comportamento - so a origem do import de `buildExamMergeKey` mudou; confirmado por `tsc`/`build` sem erro apos a correcao do TS2304 inicial | ok |
| CB-002 | caso de borda | `npm run build` completo sem erro - nenhuma dependencia circular em runtime entre `lib/atendimento-form-merge.ts` (`import type` de page.tsx) e `page.tsx` (`import` de valor de lib) | ok |

## 2) Testes automatizados executados

Comandos (sequencia completa, na ordem em que foram corridos):

```bash
cd frontend
rm -rf .next/types && npx tsc --noEmit -p tsconfig.json
npm run lint
npx vitest run
npm test
npm run build

cd ../backend
./venv/bin/python -m pytest tests/ -q --no-header
```

Resultados:
- `tsc --noEmit`: sem erro (apos a extracao completa - a primeira
  tentativa, exportando a funcao diretamente do `page.tsx`, FALHOU com
  `TS2344` e foi corrigida via extracao, ver secao 3).
- `npm run lint`: sem erro/warning.
- `npx vitest run`: `Test Files 3 passed (3)`, `Tests 22 passed (22)`
  (18 de `frontend-infraestrutura-testes` + 4 novos de
  `atendimento-form-merge.test.ts`).
- `npm test`: Vitest 22/22 + `node --test` 9/9 (arquivo
  `vivid-iq-dicom.test.mjs`, inalterado).
- `npm run build`: completo, todas as rotas listadas normalmente
  (incluindo `/atendimento`, sem aumento anormal de tamanho de bundle -
  a extracao move codigo, nao adiciona).
- Backend (suite completa, isolamento): 673 passed, 0 failed - identico
  ao baseline (nenhum arquivo de `backend/` tocado).

## 3) Erros encontrados e corrigidos durante a implementacao

- Tentativa 1: `export const mergeAutoSavedFormState` direto em
  `page.tsx` - `tsc --noEmit` reportou `TS2344` via
  `.next/types/app/atendimento/page.ts` (gerado automaticamente pelo
  Next.js App Router para validar que `page.tsx` só exporta os nomes
  reservados de rota). Corrigido revertendo o export direto e migrando
  para a extracao em `lib/`.
- Antes de migrar, confirmado empiricamente (mudanca isolada, so
  `export type AtendimentoForm`) que exports de TIPO nao acionam a mesma
  restricao - `tsc --noEmit` limpo quanto a essa mudanca especifica
  (o unico erro relatado naquele momento foi no proprio arquivo de teste,
  por uma importacao que seria removida no passo seguinte).
- Apos mover as 4 funcoes para `lib/atendimento-form-merge.ts` e
  remove-las de `page.tsx`, `tsc --noEmit` reportou `TS2304: Cannot find
  name 'buildExamMergeKey'` em `resolveExamIdForUpload` (linhas ~4422 e
  4433) - um segundo call site da funcao, nao relacionado ao bug de
  `finalizarAtendimento`, que a extracao inicial nao previu. Corrigido
  exportando `buildExamMergeKey` tambem do novo modulo e importando-o em
  `page.tsx`.

## 4) Testes manuais

Nao executados - mesma limitacao de ambiente de automacao de navegador
documentada em pacotes anteriores desta sessao. Risco residual: a
correcao segue EXATAMENTE o padrao ja em produção do achado #18 (mesma
funcao de merge, mesmo call site de `setForm`), o que reduz o risco de
uma regressao especifica a esta mudanca, mas nao substitui confirmacao
visual real.

## 5) Regressao e riscos residuais

- Risco residual 1 (preexistente, nao introduzido aqui): nenhuma
  confirmacao visual real no navegador desta correcao especifica -
  mesma lacuna de outros pacotes desta sessao.
- Risco residual 2: `lib/atendimento-form-merge.ts` agora depende via
  `import type` de `app/atendimento/page.tsx` para seus tipos - se
  `page.tsx` for um dia dividido/refatorado de forma mais ampla, esses
  tipos precisarao ser realocados junto (nao e um problema hoje, mas e
  uma dependencia a manter em mente).
- Risco residual 3 (positivo): a extracao estabelece o primeiro
  precedente de mover logica pura de `page.tsx` para `lib/` mantendo
  compatibilidade com a restricao de exports do Next.js App Router -
  reutilizavel para futuras extracoes incrementais do mesmo arquivo.

## 6) Itens fora de escopo entregues

Nenhum.

## 7) Decisao de release

- [x] Aprovado para stage.
- [x] Aprovado para producao.
- [ ] Nao aprovado (descrever motivo).
