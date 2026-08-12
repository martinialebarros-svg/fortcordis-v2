# Plan - atendimento-protocolo-previa

Data: 2026-08-12
Responsavel: Claude (pareado com Martiniano)
Status: done

## 1) Sequencia de fases

- Fase 1 (DB/migracoes): nao se aplica.
- Fase 2 (backend/API): nao se aplica.
- Fase 3 (frontend): estado/memos de previa, funcoes de selecao/aplicacao/
  descarte, UI da previa no workspace, resets ao trocar de contexto.
- Fase 4 (integracao/observabilidade): tsc/build, preview local (previa
  automatica, aplicar, descartar, selecao manual, nao-reabertura), revisao
  adversarial.

## 2) Tarefas por fase

### Fase 3

- [x] T3.1 Novo estado `protocoloPrescricaoDecididoPara`; memo
  `protocoloPrescricaoSelecionadoGatilho` (qual gatilho do protocolo
  selecionado casa com o diagnostico atual).
- [x] T3.2 Constante `protocoloPrescricaoSelecionadoItensPreview`, reusando
  `montarItemDeProtocoloPrescricao` sem duplicar logica de calculo de dose.
- [x] T3.3 Funcoes `fecharPreviaProtocoloPrescricao`, `selecionarProtocoloPrescricao`,
  `descartarProtocoloSelecionado`; `aplicarProtocoloSelecionado` (existente,
  antes morta) passa a fechar a previa apos aplicar.
- [x] T3.4 Efeito de auto-selecao atualizado para respeitar
  `protocoloPrescricaoDecididoPara`.
- [x] T3.5 UI: chip chama `selecionarProtocoloPrescricao`; novo card de
  previa inline com gatilho, itens, orientacoes, retorno, Aplicar/Descartar.
- [x] T3.6 Resets de `protocoloPrescricaoDecididoPara` nos 3 pontos onde
  `protocoloPrescricaoSelecionado` ja era zerado.
- Criterio de conclusao: `tsc --noEmit` e `npm run build` aprovados.
- Risco: divergencia entre previa e aplicacao real.
- Rollback: reverter o commit.

### Fase 4

- [x] T4.1 `npx tsc --noEmit` e `npm run build` no worktree isolado (2
  rodadas - a segunda apos adicionar os resets de T3.6).
- [x] T4.2 Preview local (backend + frontend do worktree, portas
  dedicadas), autenticacao via `fetch()`/`localStorage`.
- [x] T4.3 Fluxo completo: queixa com gatilho "icc" -> previa automatica do
  protocolo "ICC compensada" com gatilho e 3 itens (Furosemida, Pimobendan,
  Espironolactona) + orientacoes + retorno; "Descartar" fecha sem alterar o
  formulario e nao reabre; reselecionar o chip reabre a previa; "Aplicar
  protocolo" insere os itens (contagem de itens de 2 para 5) e fecha a
  previa.
- [x] T4.4 Selecao manual de um protocolo sem gatilho casando (Endocardiose
  B1) mostra a mensagem de selecao manual.
- [x] T4.5 Revisao adversarial via agente, focada em: fidelidade da previa
  ao que e de fato aplicado; toggle do chip; nao-reabertura apos descarte
  do protocolo recomendado; nao-supressao da recomendacao ao descartar um
  protocolo manual; resets ao trocar de atendimento.
- Criterio de conclusao: tsc/build limpos, comportamento confirmado em
  preview, sem achados nao tratados na revisao adversarial.
- Risco: nenhum residual conhecido apos a verificacao.
- Rollback: reverter o commit.

## 3) Plano de testes

- Testes automatizados: nao aplicavel (sem suite de testes de componente
  React no projeto para este modulo).
- Verificacao tipo/build: `tsc --noEmit`, `npm run build`.
- Verificacao funcional: preview local com dados reais do catalogo de
  protocolos, inspecao via DOM/eventos reais (nao apenas leitura visual).
- Revisao adversarial: agente dedicado lendo o diff final.

## 4) Dependencias e bloqueios

- Dependencia: catalogo `PROTOCOLOS_PRESCRICAO` e funcao
  `montarItemDeProtocoloPrescricao` - **atendidas**, ja em producao,
  inalteradas por este pacote.
- Sem bloqueios de infraestrutura conhecidos (sem migration, sem mudanca de
  API).

## 5) Checklist para iniciar execucao

- [x] `intent.md` aprovado.
- [x] `spec.md` aprovado.
- [x] Fases e rollback revisados.
- [x] Ambiente de teste definido: worktree isolado + preview local com banco
  copiado (gitignored, removido ao final).
