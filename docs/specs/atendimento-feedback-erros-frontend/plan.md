# Plan - atendimento-feedback-erros-frontend

Data: 2026-08-07
Responsavel: Claude (Sonnet 5)
Status: done

## 1) Sequencia de fases

- Fase 1/2 (DB/backend): nao aplicavel - feature 100% frontend.
- Fase 3 (frontend): as 4 correcoes de tratamento de erro.
- Fase 4 (integracao/observabilidade): prova determinística da aritmetica
  de #29 + type-check + lint.

## 2) Tarefas por fase

### Fase 3

- [x] T3.1 (#26) - `carregarCadastroComplementar`: `catch (e: any)` com
  `setErro` guardado por `requestId`.
- [x] T3.2 (#27) - `carregarFrasesClinicas`: `try/catch` + `setErro`,
  espelhando `carregarMedicamentosBanco`.
- [x] T3.3 (#28) - `abrirAnexo`: `extractApiErrorMessageSync` ->
  `await extractApiErrorMessage`.
- [x] T3.4 (#29) - `uploadArquivosResultadoExame`: contador `enviados` +
  nota agregada de arquivos nao tentados.
- Criterio de conclusao: `npx tsc --noEmit` e `npm run lint` limpos.
- Risco: nenhum identificado.
- Rollback: reverter o commit.

### Fase 4

- [x] T4.1 - Prova determinística da aritmetica de #29 (4 casos de borda:
  meio do lote, 1 arquivo falha, todos enviados, 1o de 2 falha) em
  `verificacao/verifica_guard_documento_e_contagem_upload.mjs`
  (compartilhado com o pacote `atendimento-race-conditions-save-documento`,
  que prova o guard de #19 no mesmo arquivo).
- [x] T4.2 - `npx tsc --noEmit -p tsconfig.json`: sem erros.
- [x] T4.3 - `npm run lint`: sem erros/warnings.
- Criterio de conclusao: ambos os comandos retornam limpo.
- Risco: nenhum.
- Rollback: reverter o commit.

## 3) Plano de testes

- Testes unitarios: nao aplicavel para #26/#27/#28 (mudancas mecanicas de
  tratamento de erro, sem logica nova a provar - a "prova" e a leitura do
  diff lado a lado com o padrao ja usado por funcoes irmas). #29 tem
  aritmetica testada deterministicamente (4 casos).
- Testes de integracao: `npx tsc --noEmit` + `npm run lint` (gates do
  `quality-gate` do CI) + suite completa do backend (garantia de
  isolamento).
- Testes manuais: nao executados nesta sessao (mesma limitacao de
  ambiente de automacao de navegador). Risco residual baixo para as 4 -
  nenhuma e uma mudanca de logica de negocio, todas seguem padrao
  ja em uso real em outras chamadas do mesmo arquivo.

## 4) Dependencias e bloqueios

- Dependencia 1: `extractApiErrorMessage`/`extractApiErrorMessageSync`
  (ja existentes e importados).

## 5) Checklist para iniciar execucao

- [x] `intent.md` aprovado.
- [x] `spec.md` aprovado.
- [x] Fases e rollback revisados.
- [x] Ambiente de teste definido (tsc + eslint locais; suite backend para
  isolamento; script Node para a aritmetica de #29).
