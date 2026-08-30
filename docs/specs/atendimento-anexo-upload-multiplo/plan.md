# Plan - atendimento-anexo-upload-multiplo

Data: 2026-08-30
Responsavel: Equipe FortCordis
Status: concluido

## 1) Sequencia de fases

- Fase 1 (spec/contrato): fechar regras de selecao multipla e envio em lote.
- Fase 2 (frontend core): trocar estado `anexoArquivo` por `anexoArquivos` e criar `uploadArquivosAnexoGeral`.
- Fase 3 (frontend UX): `multiple` no input, chips com remocao, rotulo do botao no plural.
- Fase 4 (qualidade): tsc, lint, testes automatizados e checklist manual.

## 2) Tarefas por fase

### Fase 1

- [x] T1.1 Confirmar que o backend continua recebendo um arquivo por requisicao (sem mudanca de contrato).
- [x] T1.2 Definir que o lote usa o mesmo tipo/descricao do formulario para todos os arquivos.
- Criterio de conclusao: `intent.md` e `spec.md` aprovados.
- Risco: ambiguidade sobre parar ou continuar o lote apos falha.
- Rollback: alinhar regra antes da implementacao (decidido: parar, igual ao padrao de exames).

### Fase 2

- [x] T2.1 Renomear `anexoArquivo`/`setAnexoArquivo` para `anexoArquivos`/`setAnexoArquivos` (`page.tsx`, `AtendimentoDocumentosSection.tsx`).
- [x] T2.2 Adicionar `skipReset?: boolean` em `uploadAnexoArquivo` para nao limpar a selecao apos cada arquivo do lote.
- [x] T2.3 Criar `uploadArquivosAnexoGeral(files: File[])` reaproveitando `uploadAnexoArquivo` em loop sequencial com parada em falha.
- Criterio de conclusao: upload em lote funcional via nova funcao, sem duplicar logica de validacao/dedupe.
- Risco: limpar `anexoArquivos` no meio do lote e esconder os pendentes.
- Rollback: reverter para `anexoArquivo` singular.

### Fase 3

- [x] T3.1 Adicionar `multiple` ao `<input type="file">` do bloco "Novo anexo".
- [x] T3.2 Renderizar um chip por arquivo selecionado, com botao de remocao individual.
- [x] T3.3 Atualizar rotulo do botao de envio para singular/plural conforme quantidade selecionada.
- Criterio de conclusao: UX de selecao/remocao/envio em lote funcional.
- Risco: poluicao visual com muitos chips.
- Rollback: manter chip unico e desabilitar `multiple` no input.

### Fase 4

- [x] T4.1 Rodar `tsc --noEmit` no frontend.
- [x] T4.2 Rodar lint focado nos arquivos alterados.
- [x] T4.3 Criar teste de componente (`AtendimentoDocumentosSection.test.tsx`) cobrindo selecao multipla, chips, envio em lote e remocao de item.
- [x] T4.4 Rodar suite `vitest` completa do frontend.
- [ ] T4.5 Checklist manual em stage (upload real de 2+ PDFs em um atendimento).
- Criterio de conclusao: CA-001..CA-005 em `ok` (exceto validacao manual em stage, que fica pendente para o ciclo de deploy).
- Risco: ambiente local sem acesso de login impediu teste manual end-to-end (ver `verify.md`).
- Rollback: segurar promocao ate validar em stage.

## 3) Plano de testes

- Testes automatizados: `AtendimentoDocumentosSection.test.tsx` (novo) + suite `vitest` completa do frontend.
- Testes de integracao: nao aplicavel (endpoint de backend inalterado).
- Testes manuais (pendente, ver `verify.md`):
- selecionar 3 PDFs no bloco "Novo anexo" e enviar em lote;
- remover 1 arquivo antes de enviar;
- forcar falha no meio do lote (arquivo maior que 25MB) e conferir mensagem de arquivos nao tentados.

## 4) Dependencias e bloqueios

- Dependencia 1: `uploadAnexoArquivo` e o padrao ja existente de `uploadArquivosResultadoExame` (reaproveitados, nao recriados).
- Bloqueio conhecido: ambiente de desenvolvimento local nao permitiu login para teste manual via navegador nesta sessao (ver `verify.md`).

## 5) Checklist para iniciar execucao

- [x] `intent.md` aprovado.
- [x] `spec.md` aprovado.
- [x] Fases e rollback revisados.
- [x] Ambiente de teste definido (automatizado local; manual pendente em stage).
