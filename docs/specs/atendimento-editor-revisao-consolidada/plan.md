# Plan - atendimento-editor-revisao-consolidada

Data: 2026-08-12
Responsavel: Claude (pareado com Martiniano)
Status: done

## 1) Sequencia de fases

- Fase 1 (DB/migracoes): nao se aplica.
- Fase 2 (backend/API): nao se aplica.
- Fase 3 (frontend): estado/memo de grupos consolidados, guarda dos 2
  efeitos de atalho, UI do toggle e da lista consolidada.
- Fase 4 (integracao/observabilidade): tsc/build, preview local (toggle,
  edicao cruzada entre modos), revisao adversarial.

## 2) Tarefas por fase

### Fase 3

- [x] T3.1 Novo estado `consultaVerTodosCampos`; import do tipo
  `ClinicalFieldConfig`.
- [x] T3.2 Memo `consultaEditorGruposConsolidados` (as 3 etapas com
  `configs` resolvidos de `clinicalFieldConfigs`).
- [x] T3.3 Guarda de `consultaVerTodosCampos` nos 2 efeitos existentes
  (autofoco no campo ativo; atalho global Alt+Shift+esquerda/direita).
- [x] T3.4 Props novas passadas para `AtendimentoConsultaEditorSection`.
- [x] T3.5 UI: botao de toggle; bloco condicional com a lista consolidada
  (11 `ClinicalFieldCard` agrupados por etapa) vs. o card unico existente;
  ocultar chips/nav/atalhos quando consolidado.
- Criterio de conclusao: `tsc --noEmit` e `npm run build` aprovados.
- Risco: regressao no modo padrao.
- Rollback: reverter o commit.

### Fase 4

- [x] T4.1 `npx tsc --noEmit` e `npm run build` no worktree isolado.
- [x] T4.2 Preview local (backend + frontend do worktree, portas
  dedicadas), autenticacao via `fetch()`/`localStorage`.
- [x] T4.3 Clicar "Ver todos os campos": confirmado 11 textareas
  renderizados, agrupados nos 3 titulos de etapa esperados.
- [x] T4.4 Editar um campo (Anamnese dirigida) no modo consolidado, alternar
  para "Ver um por vez": confirmado o chip mostra "Concluido" e o card do
  campo mostra exatamente o texto editado - mesma fonte de verdade.
- [x] T4.5 Revisao adversarial via agente, focada em: nao ha divergencia de
  estado entre os dois modos; os 2 efeitos de atalho realmente desligam no
  modo consolidado; nenhuma regressao no modo padrao (chips, nav,
  atalhos); registro de refs dos 11 textareas simultaneos sem conflito.
- Criterio de conclusao: tsc/build limpos, comportamento confirmado em
  preview, sem achados nao tratados na revisao adversarial.
- Risco: nenhum residual conhecido apos a verificacao.
- Rollback: reverter o commit.

## 3) Plano de testes

- Testes automatizados: nao aplicavel (sem suite de testes de componente
  React no projeto para este modulo).
- Verificacao tipo/build: `tsc --noEmit`, `npm run build`.
- Verificacao funcional: preview local, toggle + edicao cruzada entre
  modos, via DOM/eventos reais (setter nativo de `value` + `dispatchEvent`).
- Revisao adversarial: agente dedicado lendo o diff final.

## 4) Dependencias e bloqueios

- Dependencia: `ClinicalFieldCard`, `CLINICAL_FIELD_CONFIGS`,
  `clinicalTextareaRefs` - **atendidas**, ja em producao, inalteradas por
  este pacote.
- Sem bloqueios de infraestrutura conhecidos (sem migration, sem mudanca de
  API).

## 5) Checklist para iniciar execucao

- [x] `intent.md` aprovado.
- [x] `spec.md` aprovado.
- [x] Fases e rollback revisados.
- [x] Ambiente de teste definido: worktree isolado + preview local com banco
  copiado (gitignored, removido ao final).
