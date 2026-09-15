# Plan - atendimento-historico-loading

Data: 2026-08-12
Responsavel: Claude (pareado com Martiniano)
Status: done

## 1) Sequencia de fases

- Fase 1 (DB/migracoes): nao se aplica.
- Fase 2 (backend/API): nao se aplica.
- Fase 3 (frontend): estado de loading em `abrirAtendimento`, UI da lista
  principal, UI do historico de receitas.
- Fase 4 (integracao/observabilidade): tsc/build, preview local (loading
  mid-flight via atraso artificial de XHR, limpeza em sucesso, corrida
  entre 2 cliques), revisao adversarial.

## 2) Tarefas por fase

### Fase 3

- [x] T3.1 Novo estado `abrindoAtendimentoId` (`number | null`) em
  `page.tsx`, proximo ao ref `abrirAtendimentoRequestIdRef`.
- [x] T3.2 `abrirAtendimento`: `setAbrindoAtendimentoId(id)` apos
  incrementar o ref de corrida; `finally` guardado (so limpa se
  `requestId` ainda for o atual) cobrindo sucesso e erro.
- [x] T3.3 Lista "Atendimentos recentes": `Loader2` condicional no item
  clicado, `disabled` nos botoes de abrir/laudar/excluir, atenuacao visual
  (`pointer-events-none opacity-60`) dos demais itens.
- [x] T3.4 Prop `abrindoAtendimentoId` passada para
  `AtendimentoPrescricaoHistorySection`.
- [x] T3.5 Botao "Abrir original": icone `Loader2` condicional, `disabled`
  condicional.
- Criterio de conclusao: `tsc --noEmit` e `npm run build` aprovados.
- Risco: loading preso por corrida entre cliques.
- Rollback: reverter o commit.

### Fase 4

- [x] T4.1 `npx tsc --noEmit` e `npm run build` no worktree isolado.
- [x] T4.2 Preview local (backend + frontend do worktree, portas
  dedicadas), autenticacao via `fetch()`/`localStorage`.
- [x] T4.3 Atraso artificial injetado via patch de
  `XMLHttpRequest.prototype.open`/`send` (axios usa XHR, nao `fetch`) para
  a rota `GET /atendimentos/{id}`, permitindo observar o estado
  intermediario de loading antes da resposta chegar.
- [x] T4.4 Clicado um item diferente do atendimento atualmente aberto;
  confirmado, com a requisicao ainda pendente: `Loader2` presente no item
  clicado, botao desse item `disabled`, card do OUTRO item (o
  anteriormente aberto) com `pointer-events-none opacity-60` e botao
  tambem `disabled`.
- [x] T4.5 Aguardada a resposta (atraso de 1.5s): confirmado loading
  desaparece, botoes reabilitam, atendimento correto (o clicado) fica
  carregado no formulario.
- [x] T4.6 Revisao adversarial via agente, focada em: guarda de
  `requestId` na limpeza do loading (corrida entre 2 cliques rapidos);
  nenhuma regressao na logica de negocio de `abrirAtendimento`; corretude
  da passagem de prop para `AtendimentoPrescricaoHistorySection`.
- Criterio de conclusao: tsc/build limpos, comportamento confirmado em
  preview (inclusive o estado intermediario de loading), sem achados nao
  tratados na revisao adversarial.
- Risco: nenhum residual conhecido apos a verificacao.
- Rollback: reverter o commit.

## 3) Plano de testes

- Testes automatizados: nao aplicavel (sem suite de testes de componente
  React no projeto para este modulo).
- Verificacao tipo/build: `tsc --noEmit`, `npm run build`.
- Verificacao funcional: preview local com atraso de rede artificial via
  patch de XHR, para observar o estado de loading mid-flight (nao apenas o
  estado final, que seria indistinguivel em rede local rapida).
- Revisao adversarial: agente dedicado lendo o diff final.

## 4) Dependencias e bloqueios

- Dependencia: `abrirAtendimentoRequestIdRef` (mecanismo de invalidacao de
  corrida ja existente) - **atendida**, ja em producao, reusado sem
  alteracao.
- Sem bloqueios de infraestrutura conhecidos (sem migration, sem mudanca de
  API).

## 5) Checklist para iniciar execucao

- [x] `intent.md` aprovado.
- [x] `spec.md` aprovado.
- [x] Fases e rollback revisados.
- [x] Ambiente de teste definido: worktree isolado + preview local com banco
  copiado (gitignored, removido ao final) + atraso de rede artificial via
  patch de XHR.
