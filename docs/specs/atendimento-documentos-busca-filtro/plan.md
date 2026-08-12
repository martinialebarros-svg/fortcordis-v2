# Plan - atendimento-documentos-busca-filtro

Data: 2026-08-12
Responsavel: Claude (pareado com Martiniano)
Status: done

## 1) Sequencia de fases

- Fase 1 (DB/migracoes): nao se aplica.
- Fase 2 (backend/API): nao se aplica.
- Fase 3 (frontend): estado de busca, filtragem, agrupamento por status,
  estados de vazio, extracao do card em funcao local.
- Fase 4 (integracao/observabilidade): tsc/build, seed de dados de teste e
  verificacao visual/DOM em preview local, revisao adversarial.

## 2) Tarefas por fase

### Fase 3

- [x] T3.1 Estado `buscaDocumento` (`useState("")`) e input controlado com
  icone de busca (`Search`, `lucide-react`), renderizado apenas quando
  `documentosAtendimento.length > 4`.
- [x] T3.2 Derivar `documentosFiltrados` (substring match case-insensitive
  por `titulo`) e, a partir dele, `documentosRascunho`/`documentosEmitidos`
  (particao por `status === "emitido"`).
- [x] T3.3 Extrair `renderDocumentoCard(documento)` a partir do JSX de card
  existente, sem alterar acoes (Editar/PDF/Remover) nem estilo.
- [x] T3.4 Tres estados de vazio: lista original vazia, lista com busca sem
  match, e render normal com cabecalhos "Rascunhos (N)"/"Emitidos (N)"
  condicionais a `N > 0`.
- Criterio de conclusao: `tsc --noEmit` e `npm run build` aprovados.
- Risco: nenhum - mudanca isolada a um componente, sem prop nova.
- Rollback: reverter o commit.

### Fase 4

- [x] T4.1 `npx tsc --noEmit` e `npm run build` no worktree isolado.
- [x] T4.2 Seed de 5 documentos de teste (3 rascunho, 2 emitido, titulos
  variados) em `atendimento_id` existente, no banco copiado do worktree
  (nunca committed).
- [x] T4.3 Preview local (backend + frontend do worktree, portas dedicadas),
  autenticacao via `fetch()`/`localStorage`, navegacao direta via
  `?atendimento_id=`.
- [x] T4.4 Verificacao via DOM/texto (nao screenshot, instavel nesta sessao):
  campo de busca presente com 5 documentos; filtro por termo parcial reduz
  corretamente os dois grupos e as contagens; termo sem match mostra a
  mensagem de "nenhum documento encontrado"; limpar a busca restaura
  "Rascunhos (3)"/"Emitidos (2)" originais.
- [x] T4.5 Revisao adversarial via agente, focada em: distincao
  emitido/rascunho para valores nulos/inesperados de `status`; tratamento de
  `titulo` vazio/nulo na busca; unicidade de `key` e ausencia de closure
  obsoleta na extracao de `renderDocumentoCard`.
- Criterio de conclusao: tsc/build limpos, comportamento confirmado em
  preview, sem achados nao tratados na revisao adversarial.
- Risco: nenhum residual conhecido apos a verificacao.
- Rollback: reverter o commit.

## 3) Plano de testes

- Testes automatizados: nao aplicavel (nao ha suite de testes de componente
  React no projeto para este modulo) - mesma limitacao dos pacotes
  frontend-only anteriores (`atendimento-header-fixo`,
  `atendimento-layout-mobile-prioridade`).
- Verificacao tipo/build: `tsc --noEmit`, `npm run build`.
- Verificacao funcional: preview local com dados seedados, inspecao via
  DOM/texto (busca, agrupamento, contagens, estados de vazio).
- Revisao adversarial: agente dedicado lendo o diff final.

## 4) Dependencias e bloqueios

- Dependencia: campo `status` em `documentos_atendimento`, introduzido pelo
  pacote `atendimento-documento-emitido-aviso` (#43) - **atendida**, ja em
  producao.
- Sem bloqueios de infraestrutura conhecidos (sem migration, sem mudanca de
  API).

## 5) Checklist para iniciar execucao

- [x] `intent.md` aprovado.
- [x] `spec.md` aprovado.
- [x] Fases e rollback revisados.
- [x] Ambiente de teste definido: worktree isolado + preview local com banco
  copiado (gitignored, removido ao final).
