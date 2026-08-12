# Spec - atendimento-editor-revisao-consolidada

Data: 2026-08-12
Responsavel: Claude (pareado com Martiniano)
Status: done

## 1) Escopo funcional

`AtendimentoConsultaEditorSection` ganha um botao "Ver todos os
campos"/"Ver um por vez" que alterna entre o modo atual (um campo por vez)
e um modo consolidado com os 11 campos clinicos abertos e editaveis
simultaneamente, agrupados pelas 3 etapas existentes. Nenhuma mudanca de
backend, banco ou API.

## 2) Requisitos funcionais (RF)

- RF-001: novo estado `consultaVerTodosCampos` (`boolean`, inicial
  `false`), controlado por um botao que alterna o texto entre "Ver todos os
  campos" e "Ver um por vez".
- RF-002: quando `consultaVerTodosCampos` e `true`, a secao renderiza os 11
  `ClinicalFieldCard` (um por campo de `CLINICAL_FIELD_CONFIGS`), agrupados
  em 3 blocos com os mesmos titulos das etapas ("Anamnese e exame",
  "Diagnostico", "Plano e retorno"), em uma lista vertical rolavel - em vez
  do card unico do campo ativo.
- RF-003: quando `consultaVerTodosCampos` e `false` (padrao), o
  comportamento e identico ao anterior a este pacote: card unico do campo
  ativo, chips "Campos da etapa", navegacao Anterior/Proximo, atalhos de
  teclado.
- RF-004: no modo consolidado, os chips "Campos da etapa" e os controles
  Anterior/Proximo/contador ficam ocultos (nao aplicaveis - todos os campos
  ja estao visiveis); o texto de instrucao de atalhos tambem fica oculto.
- RF-005: cada `ClinicalFieldCard` do modo consolidado recebe os mesmos
  handlers (`onChange`, `onInsertPhrase`, `onInsertScaffold`, `onClear`,
  `textareaRef`) que a instancia unica do modo padrao, operando sobre o
  mesmo estado compartilhado (`getClinicalFieldValue`/`setClinicalFieldValue`)
  - uma edicao no modo consolidado e visivel imediatamente ao voltar ao
  modo padrao, e vice-versa.
- RF-006: no modo consolidado, os cards NAO recebem `onTextareaKeyDown`
  (Ctrl/Cmd+Enter nao navega, pois nao ha "campo ativo" a navegar).
- RF-007: os 2 efeitos que implementam atalhos do modo padrao (autofoco no
  campo ativo; Alt+Shift+esquerda/direita) nao executam quando
  `consultaVerTodosCampos` e `true`.

## 3) Requisitos nao funcionais (NFR)

- NFR-001 (sem regressao no modo padrao): com o toggle desligado (estado
  inicial), o comportamento e o markup do modo padrao sao idênticos aos
  anteriores a este pacote, exceto pela adicao do proprio botao de toggle.
- NFR-002 (sem duplicacao de logica de campo): `ClinicalFieldCard` e usado
  sem modificacao; nenhuma logica de valor/edicao/frases e duplicada entre
  os dois modos.
- NFR-003 (sem chamadas de API novas): toda a logica e client-side, sobre
  estado ja carregado (`clinicalFieldValues`, `clinicalFieldConfigs`).

## 4) Contratos tecnicos

### API

- Nenhuma mudanca.

### Banco/migracoes

- Nenhuma.

### Frontend

- `frontend/app/atendimento/page.tsx`:
  - Novo estado: `consultaVerTodosCampos`.
  - Novo memo: `consultaEditorGruposConsolidados` (as 3 etapas de
    `CONSULTA_EDITOR_ETAPAS`, cada uma com `configs` resolvidos a partir de
    `clinicalFieldConfigs`).
  - 2 efeitos existentes (autofoco; atalho Alt+Shift) passam a considerar
    `consultaVerTodosCampos` na condicao de guarda e no array de
    dependencias.
  - Novo import de tipo: `ClinicalFieldConfig` (de
    `@/lib/atendimento-clinical-notes`).
- `frontend/app/atendimento/components/AtendimentoConsultaEditorSection.tsx`:
  - Novos props consumidos: `consultaEditorGruposConsolidados`,
    `consultaVerTodosCampos`, `setConsultaVerTodosCampos`.
  - Novo botao de toggle (icone `ListChecks` de `lucide-react`).
  - Bloco condicional: lista de grupos com `ClinicalFieldCard` (modo
    consolidado) vs. card unico do campo ativo (modo padrao, inalterado).

## 5) Compatibilidade e rollout

- Backward compatibility: sim - `ClinicalFieldCard.tsx` e
  `atendimento-clinical-notes.ts` inalterados; o modo padrao (toggle
  desligado) e o comportamento por omissao.
- Estrategia de rollback: reverter o commit. Sem estado persistido no
  backend.

## 6) Criterios de aceitacao (CA)

- CA-001: clicar em "Ver todos os campos" substitui o card unico por uma
  lista com os 11 `ClinicalFieldCard`, agrupados em 3 blocos por etapa.
- CA-002: editar um campo no modo consolidado (ex.: Anamnese dirigida) e
  depois clicar em "Ver um por vez" mostra o mesmo conteudo editado no chip
  e no card daquele campo especifico - sem perda ou duplicacao de dados.
- CA-003: no modo consolidado, os chips "Campos da etapa" e os controles
  Anterior/Proximo/contador nao sao exibidos.
- CA-004: no modo padrao (toggle desligado), o comportamento - incluindo os
  atalhos de teclado - e idêntico ao anterior a este pacote.
- CA-005: `npx tsc --noEmit` e `npm run build` do frontend aprovados sem
  novos erros/warnings.

## 7) Casos de borda

- CB-001: campo sem `quickPhrases`/`scaffold` (ex.: alguns campos de
  diagnostico) renderiza corretamente no modo consolidado, ja que
  `ClinicalFieldCard` ja trata esses campos como opcionais.
- CB-002: os cards de progresso "Etapas do editor clinico" continuam
  clicaveis e informativos no modo consolidado (mostram % por etapa),
  mesmo nao controlando mais o que e exibido abaixo enquanto o modo
  consolidado estiver ativo.

## 8) Fora de escopo

- Persistencia do toggle entre sessoes.
- Scroll automatico para uma etapa ao clicar no card de progresso durante o
  modo consolidado.
- Mudanca na estrutura de etapas/campos do editor clinico.
