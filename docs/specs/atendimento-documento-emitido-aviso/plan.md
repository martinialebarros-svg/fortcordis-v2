# Plan - atendimento-documento-emitido-aviso

Data: 2026-08-11
Responsavel: Claude (pareado com Martiniano)
Status: em andamento

## 1) Sequencia de fases

- Fase 1 (frontend): badge na lista, banner no editor
  (`AtendimentoDocumentosSection.tsx`); confirm antes de gerar PDF
  de documento ja emitido (`page.tsx`).
- Fase 2 (verificacao): `tsc`/`build`, verificacao visual manual via
  preview local, revisao adversarial leve (1 agente), `verify.md`.

## 2) Tarefas por fase

### Fase 1

- [x] T1.1 `AtendimentoDocumentosSection.tsx`: import `AlertTriangle`;
  badge de status na lista (amber/slate); banner de aviso no editor
  quando `documentoClinicoForm.status === "emitido"`.
- [x] T1.2 `page.tsx`: `baixarPdfDocumentoClinico` passa a checar
  `documentoParaPdf.status === "emitido"` e pedir `window.confirm()`
  antes de prosseguir, retornando sem chamar a API se cancelado.
- Criterio de conclusao: `tsc --noEmit` limpo, `npm run build` verde.
- Risco: baixo - aditivo, 2 arquivos, sem mudanca de contrato.
- Rollback: reverter o commit.

### Fase 2

- [x] T2.1 `npx tsc --noEmit` e `npm run build` no worktree.
- [x] T2.2 Verificacao visual manual: preview local (backend+frontend
  do proprio worktree, banco de dados local copiado so para teste,
  revertido depois), login como admin, documento de teste inserido
  com `status="emitido"` no atendimento #1 (celine) -> confirmado via
  DOM: (a) badge "Emitido" (amber) na lista; (b) banner de aviso
  visivel no editor ao selecionar o documento; (c) `window.confirm()`
  mockado disparado com a mensagem esperada ao clicar "Gerar PDF",
  cancelamento interrompe a acao; (d) ao clicar "Novo" (documento sem
  `status="emitido"`), banner desaparece - sem falso positivo.
- [x] T2.3 Revisao por 1 agente ceptico (escopo pequeno, 2 arquivos,
  sem mudanca de backend/contrato).
- [x] T2.4 `verify.md`.
- Criterio de conclusao: revisao sem achados bloqueantes.

## 3) Plano de testes

- Frontend: sem suite automatizada de UI no projeto para esta pagina;
  verificacao via `tsc`/`build` + inspecao de DOM/mock de
  `window.confirm` no preview local (descrita acima).
- Sem mudanca de backend, sem teste de backend necessario - `status`/
  `emitido_at` ja sao persistidos por codigo existente, nao alterado
  neste pacote.

## 4) Rollback

Reverter o commit deste pacote - mudanca de frontend, sem migration,
sem dado persistido novo.
