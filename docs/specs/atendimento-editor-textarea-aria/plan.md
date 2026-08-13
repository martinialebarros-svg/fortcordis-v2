# Plan - atendimento-editor-textarea-aria

Data: 2026-08-13
Responsavel: Claude (pareado com Martiniano)
Status: done

## 1) Sequencia de fases

- Fase 1 (DB/migracoes): nao se aplica.
- Fase 2 (backend/API): nao se aplica.
- Fase 3 (frontend): `id`/`aria-labelledby` em `ClinicalFieldCard.tsx`;
  regiao `aria-live` condicional em `AtendimentoConsultaEditorSection.tsx`.
- Fase 4 (integracao/observabilidade): tsc/build, preview local (modo "um
  campo por vez" e modo consolidado), revisao adversarial.

## 2) Tarefas por fase

### Fase 3

- [x] T3.1 `ClinicalFieldCard.tsx`: computar `titleId` a partir de
  `config.key`; aplicar `id={titleId}` no `<h3>` e `aria-labelledby={titleId}`
  no `<textarea>`.
- [x] T3.2 `AtendimentoConsultaEditorSection.tsx`: adicionar
  `<p className="sr-only" aria-live="polite">Campo ativo: {titulo}</p>`
  dentro do bloco `!consultaVerTodosCampos`, junto ao texto de atalhos
  existente.
- Criterio de conclusao: `tsc --noEmit` aprovado, JSX valido.
- Risco: colisao de `id` no modo consolidado - mitigado por `id` derivado
  de `config.key` (unico por campo).
- Rollback: reverter o commit.

### Fase 4

- [x] T4.1 `npx tsc --noEmit` e `npm run build` no worktree isolado.
- [x] T4.2 Preview local (backend + frontend do worktree, portas
  dedicadas `8130`/`3110`), autenticacao via `fetch()`/`localStorage`.
- [x] T4.3 Modo "um campo por vez": confirmado via JS que o `<textarea>`
  de "Queixa principal" tem `aria-labelledby="clinical-field-title-queixa_principal"`
  apontando para um `<h3>` com texto "Queixa principal"
  (`accessibleNameMatchesTitle: true`).
- [x] T4.4 Clicado "Proximo campo": confirmado que a regiao `aria-live`
  atualizou de "Campo ativo: Queixa principal" para "Campo ativo: Anamnese
  dirigida", e que o novo `<textarea>` visivel tem `aria-labelledby`
  apontando para o `<h3>` correto ("Anamnese dirigida").
- [x] T4.5 Clicado "Ver todos os campos" (modo consolidado): confirmado via
  JS que os 11 `<textarea>` renderizados tem 11 `aria-labelledby` unicos
  (`noCollision: true`), cada um com o texto do proprio campo, e que a
  regiao `aria-live` do modo anterior nao esta mais presente
  (`liveRegionPresent: false`).
- [x] T4.6 Checado console/rede: unico erro e o pre-existente
  `/api/v1/alertas-internos` (drift de schema no snapshot do banco
  copiado, ja documentado no pacote anterior #50), sem relacao com esta
  mudanca.
- [x] T4.7 Revisao adversarial via agente, focada em: corretude do
  `aria-labelledby`/`id`; ausencia de colisao no modo consolidado;
  corretude da condicao do `aria-live`; nenhuma regressao visual/estrutural.
- Criterio de conclusao: tsc/build limpos, acessibilidade confirmada
  estruturalmente nos dois modos, sem achados nao tratados na revisao
  adversarial.
- Risco: nenhum residual conhecido apos a verificacao.
- Rollback: reverter o commit.

## 3) Plano de testes

- Testes automatizados: nao aplicavel (sem suite de testes de componente
  React no projeto para este modulo).
- Verificacao tipo/build: `tsc --noEmit`, `npm run build`.
- Verificacao funcional: preview local; `aria-labelledby`/`aria-live`
  verificados via DOM/JS (screenshot indisponivel por instabilidade
  conhecida da ferramenta nesta sessao - tela preta - substituida por
  verificacao via DOM, que e conclusiva).
- Revisao adversarial: agente dedicado lendo o diff final.

## 4) Dependencias e bloqueios

- Dependencia: `config.key` (`ClinicalFieldKey`) ser estavel e unico por
  campo - **atendida**, ja usado como `key` do `.map()` em ambos os modos.
- Sem bloqueios de infraestrutura conhecidos (sem migration, sem mudanca
  de API).
- Nota (nao-bloqueante): o preview local acusou 500 em
  `/api/v1/alertas-internos` (drift de schema pre-existente no snapshot
  do banco), sem relacao com este pacote.

## 5) Checklist para iniciar execucao

- [x] `intent.md` aprovado.
- [x] `spec.md` aprovado.
- [x] Fases e rollback revisados.
- [x] Ambiente de teste definido: worktree isolado + preview local com
  banco copiado (gitignored, removido ao final).
