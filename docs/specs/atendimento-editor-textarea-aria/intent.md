# Intent - atendimento-editor-textarea-aria

Data: 2026-08-13
Responsavel: Claude (pareado com Martiniano)
Status: done

## 1) Problema atual

**Origem:** `docs/AUDITORIA-ATENDIMENTO-UX-FLUXO-2026-08-09.md` - achado #11
(dimensao: Entrada de dados clinicos), rastreado como issue #30.

Em `ClinicalFieldCard.tsx` (usado tanto no modo "um campo por vez" quanto no
modo consolidado do editor clinico guiado), o titulo do campo e um `<h3>`
sem `id`, e o `<textarea>` correspondente nao tem `aria-label` nem
`aria-labelledby`. Um usuario de leitor de tela que entra no campo ouve
apenas "caixa de edicao", sem saber se esta em "Anamnese dirigida" ou
"Plano terapeutico". Alem disso, no modo "um campo por vez"
(`AtendimentoConsultaEditorSection.tsx`), a troca de campo ativo via atalho
de teclado (Alt+Shift+seta ou Ctrl/Cmd+Enter) move o foco para o novo
campo, mas nao ha nenhuma regiao `aria-live` confirmando por audio qual
campo passou a estar ativo.

## 2) Objetivo

Ligar `id`/`aria-labelledby` entre o `<h3>` do titulo e o `<textarea>` em
`ClinicalFieldCard.tsx` (nome acessivel correto sempre que o campo recebe
foco), e adicionar uma regiao `aria-live="polite"` (visualmente oculta,
`sr-only`) em `AtendimentoConsultaEditorSection.tsx` anunciando o titulo do
campo ativo, atualizada a cada troca no modo "um campo por vez".

## 3) Nao objetivos

- Mudar o comportamento de foco/navegacao por teclado em si (Alt+Shift+seta,
  Ctrl/Cmd+Enter) - ja funcional, fora do escopo deste achado.
- Adicionar `aria-live` no modo consolidado ("Ver todos os campos") - nesse
  modo todos os 11 campos ficam visiveis simultaneamente, sem conceito de
  "campo ativo" mudando; nao ha o que anunciar.
- Alterar `ClinicalFieldCard.tsx` para qualquer outro fim alem da
  acessibilidade do titulo/textarea (sem mudanca visual, sem mudanca de
  props alem do necessario).

## 4) Contexto e restricoes

- **Decisao de engenharia (aria-live no componente pai, nao no card):**
  `ClinicalFieldCard` e remontado inteiro (`key={consultaCampoAtivoConfig.key}`
  muda) a cada troca de campo no modo "um campo por vez" - um `aria-live`
  dentro do proprio card seria destruido e recriado a cada troca, o que
  pode nao disparar o anuncio de forma confiavel em todos os leitores de
  tela (a regiao precisa ser um no estavel que apenas tem seu texto
  alterado). Por isso a regiao `aria-live` foi colocada em
  `AtendimentoConsultaEditorSection.tsx`, fora do card, referenciando
  `consultaCampoAtivoConfig?.title` diretamente.
- **Decisao de engenharia (id derivado de `config.key`, nao de um contador):**
  `config.key` (`ClinicalFieldKey`) e um identificador estavel e unico por
  campo clinico (ex.: `queixa_principal`, `anamnese`, `exame_fisico` - 11
  chaves ao todo). Usar `id={\`clinical-field-title-${config.key}\`}`
  garante que, mesmo no modo consolidado onde os 11 `ClinicalFieldCard`
  sao renderizados simultaneamente, cada `id` e unico - confirmado via
  preview (11 textareas, 11 ids unicos, zero colisao).
- **Achado adicional na investigacao (nao e um bug, e um dado a mais para
  justificar o aria-live):** ha um `useEffect` pre-existente em `page.tsx`
  que tenta focar automaticamente o textarea do novo campo ativo via
  `requestAnimationFrame` sempre que `consultaCampoAtivoConfig` muda. No
  preview local (sem paciente/atendimento selecionado), esse foco
  automatico nao ocorreu ao clicar em "Proximo campo" (o foco permaneceu
  no botao clicado) - o que reforca que a regiao `aria-live` independente
  do foco e o mecanismo mais confiavel para anunciar a troca de campo,
  exatamente como o achado original pedia, em vez de depender so do
  movimento de foco.

## 5) Impacto esperado

- Usuarios impactados: veterinarios usando leitor de tela (ou outra
  tecnologia assistiva) ao preencher o editor clinico guiado.
- Modulos impactados: Atendimento (frontend) -
  `ClinicalFieldCard.tsx` e `AtendimentoConsultaEditorSection.tsx`. Nenhuma
  mudanca de backend, banco ou contrato de API.
- Risco de regressao: muito baixo - apenas atributos de acessibilidade
  (`id`, `aria-labelledby`) e um novo elemento visualmente oculto
  (`sr-only` + `aria-live`); nenhuma classe visual, prop obrigatoria ou
  logica de estado existente foi alterada.

## 6) Riscos iniciais

- Risco 1: colisao de `id` entre multiplos `ClinicalFieldCard` renderizados
  simultaneamente no modo consolidado. Mitigado - `id` derivado de
  `config.key`, unico por campo; confirmado via preview (11 ids unicos).
- Risco 2: a regiao `aria-live` announciar no modo consolidado, onde nao
  faz sentido (nao ha "campo ativo" mudando). Mitigado - a regiao esta
  dentro do bloco condicional `!consultaVerTodosCampos`, portanto nem
  renderiza nesse modo (confirmado: `liveRegionPresent: false` no preview
  em modo consolidado).
- Risco 3: `aria-labelledby` apontar para um `id` inexistente caso o
  `<h3>` mude de posicao/estrutura no futuro. Mitigado - `titleId` e
  computado uma unica vez no topo do componente e usado tanto no `<h3>`
  quanto no `<textarea>`, single source of truth dentro do mesmo arquivo.

## 7) Definition of Ready (gate para spec)

- [x] Problema e objetivo estao claros.
- [x] Escopo e nao escopo estao explicitos.
- [x] Restricoes estao registradas.
- [x] Riscos iniciais estao mapeados.
