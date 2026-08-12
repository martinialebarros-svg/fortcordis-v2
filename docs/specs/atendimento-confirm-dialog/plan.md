# Plan - atendimento-confirm-dialog

Data: 2026-08-12
Responsavel: Claude (pareado com Martiniano)
Status: done

## 1) Sequencia de fases

- Fase 1 (DB/migracoes): nao se aplica.
- Fase 2 (backend/API): nao se aplica.
- Fase 3 (frontend): componente `ConfirmDialog`, hook de estado
  (`confirmarAcao`/`resolverConfirmDialog`), migracao das 12 chamadas.
- Fase 4 (integracao/observabilidade): tsc/build, preview local (fluxo
  destrutivo e informativo, cancelar/confirmar/Esc), revisao adversarial.

## 2) Tarefas por fase

### Fase 3

- [x] T3.1 Mapear os 12 call sites de `confirm()`/`window.confirm()` em
  `page.tsx`: mensagem, funcao, variante (destructive/default).
- [x] T3.2 Criar `ConfirmDialog.tsx`: overlay, icone por variante
  (Trash2/AlertTriangle), titulo/descricao, botoes Cancelar/Acao, foco
  inicial condicional a variante, Esc-para-cancelar, `role="alertdialog"`.
- [x] T3.3 Adicionar tipos (`ConfirmDialogVariant`, `ConfirmDialogOptions`,
  `ConfirmDialogState`), estado (`confirmDialogState`) e funcoes
  (`confirmarAcao`, `resolverConfirmDialog`) em `page.tsx`.
- [x] T3.4 Substituir os 12 call sites, um a um, preservando a condicao de
  guard e a acao pos-confirmacao de cada um; promover `removerExame` a
  `async`.
- [x] T3.5 Renderizar `ConfirmDialog` (import dinamico, `ssr: false`) ao
  lado dos demais modais condicionais em `page.tsx`.
- Criterio de conclusao: `tsc --noEmit` e `npm run build` aprovados.
- Risco: divergencia de mensagem/condicao em algum dos 12 call sites.
- Rollback: reverter o commit.

### Fase 4

- [x] T4.1 `npx tsc --noEmit` e `npm run build` no worktree isolado.
- [x] T4.2 Preview local (backend + frontend do worktree, portas
  dedicadas), autenticacao via `fetch()`/`localStorage`.
- [x] T4.3 Fluxo destrutivo ponta a ponta: adicionar anexo (link externo),
  clicar Remover, confirmar variante vermelha (icone, botao, foco em
  Cancelar), clicar Cancelar (anexo permanece), clicar Remover de novo,
  clicar Excluir (anexo removido de fato via `DELETE`).
- [x] T4.4 Fluxo informativo ponta a ponta: documento com `{{variavel}}`
  nao reconhecida, clicar "Gerar PDF", confirmar variante ambar (icone,
  botao, foco em "Gerar assim mesmo").
- [x] T4.5 Confirmar que Esc fecha o dialogo (cancela).
- [x] T4.6 Revisao adversarial via agente, focada em: todos os 12 call
  sites migrados sem perda de condicao/mensagem/acao; nenhum `confirm()`
  nativo restante; comportamento de `removerExame` apos se tornar `async`;
  risco de dupla abertura/Promise pendente.
- Criterio de conclusao: tsc/build limpos, ambos os fluxos confirmados em
  preview, sem achados nao tratados na revisao adversarial.
- Risco: nenhum residual conhecido apos a verificacao.
- Rollback: reverter o commit.

## 3) Plano de testes

- Testes automatizados: nao aplicavel (sem suite de testes de componente
  React no projeto para este modulo).
- Verificacao tipo/build: `tsc --noEmit`, `npm run build`.
- Verificacao funcional: preview local, 1 fluxo destrutivo completo
  (cancelar + confirmar) e 1 fluxo informativo, via DOM/eventos reais
  (`dispatchEvent`, setter nativo de `value`) - nao apenas leitura visual.
- Revisao adversarial: agente dedicado lendo o diff final.

## 4) Dependencias e bloqueios

- Dependencia: campo `status` em documentos (`atendimento-documento-
  emitido-aviso` #43) e deteccao de variaveis nao resolvidas
  (`atendimento-variaveis-template-aviso` #42) - **atendidas**, ja em
  producao (os 2 confirms que elas introduziram fazem parte da migracao
  deste pacote).
- Sem bloqueios de infraestrutura conhecidos (sem migration, sem mudanca de
  API).

## 5) Checklist para iniciar execucao

- [x] `intent.md` aprovado.
- [x] `spec.md` aprovado.
- [x] Fases e rollback revisados.
- [x] Ambiente de teste definido: worktree isolado + preview local com banco
  copiado (gitignored, removido ao final).
