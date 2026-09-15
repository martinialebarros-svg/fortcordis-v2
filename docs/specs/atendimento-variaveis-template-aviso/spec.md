# Spec - atendimento-variaveis-template-aviso

Data: 2026-08-11
Responsavel: Claude (pareado com Martiniano)
Status: em andamento

## 1) Comportamento esperado

### Backend

- Novo `identificar_variaveis_vazias(template_text, contexto) ->
  List[str]` (`document_context_service.py`): extrai as chaves
  `{{chave}}` presentes em `template_text` (regex compartilhada com
  `renderizar_template_documento`, `_VARIAVEL_TEMPLATE_PATTERN`) e
  retorna, ordenadas e sem duplicatas, as que existem em `contexto`
  mas cujo valor e vazio/so espaco.
- `POST /atendimentos/{id}/documentos` (`criar_documento_atendimento`):
  quando `template_id` e informado, calcula `variaveis_vazias` a
  partir de `titulo_padrao` + `corpo_template` do template e do
  `contexto` ja montado; se a lista nao for vazia, adiciona a chave
  `variaveis_vazias` (lista de strings) na resposta do endpoint. Sem
  `template_id` (documento livre), a chave nao aparece na resposta
  (comportamento aditivo, sem quebra de contrato para chamadores
  existentes que ignoram campos desconhecidos).

### Frontend

- `extrairVariaveisNaoResolvidas(texto)`: funcao pura de nivel de
  modulo que retorna a lista (unica, sem duplicatas) de todo
  `{{chave}}` remanescente em `texto`.
- `documentoVariaveisNaoResolvidas` (`useMemo` em `page.tsx`):
  recalculada a cada mudanca de `documentoClinicoForm.titulo`/`corpo`,
  usando `extrairVariaveisNaoResolvidas`.
- `AtendimentoDocumentosSection.tsx`: quando
  `documentoVariaveisNaoResolvidas.length > 0`, mostra um banner amber
  (mesmo estilo do banner de "documento emitido" ja existente) acima
  do editor, listando as chaves nao reconhecidas e o total.
- `criarDocumentoClinicoDeTemplate`: le `documento.variaveis_vazias`
  da resposta da API; se presente e nao vazio, o toast de sucesso
  passa a incluir "Atencao: `<chaves>` estava(m) vazio(s) no cadastro
  - revise o texto antes de gerar o PDF." em vez do texto generico.
- `baixarPdfDocumentoClinico`: antes do guard existente de "documento
  emitido", passa a calcular `variaveisNaoResolvidasPdf` a partir do
  `documentoParaPdf` que sera efetivamente convertido em PDF (nao do
  estado do editor, para cobrir corretamente o caso de gerar PDF de
  um item da LISTA que nao e o documento atualmente aberto no editor)
  e, se houver alguma, pede confirmacao via `window.confirm()` antes
  de prosseguir - cancelar interrompe a geracao do PDF sem side
  effect.

## 2) Casos de borda

- Chave que aparece 2x no mesmo template (`{{raca}} ... {{raca}}`) -
  reportada uma unica vez (`Set` de chaves, nao de ocorrencias).
- Chave que nao existe no contexto (typo no template, ou campo ainda
  nao suportado) - **nao** e reportada por `identificar_variaveis_
  vazias` (essa e uma categoria diferente, "nao resolvida"); permanece
  literal no corpo apos `renderizar_template_documento` e e capturada
  pelo scan live do frontend (`documentoVariaveisNaoResolvidas`).
- Documento criado sem template (`payload.titulo`/`payload.corpo`
  diretos) - `variaveis_vazias` nunca e calculado nem aparece na
  resposta (nao ha template para analisar contra).
- Gerar PDF a partir do item na LISTA de documentos (nao o que esta
  aberto no editor) - o guard usa `documentoParaPdf.titulo`/`.corpo`
  (o documento real que sera baixado), nao `documentoClinicoForm`
  (que pode ser outro documento sendo editado ao mesmo tempo).
- Vet edita o corpo depois de criar de template, removendo o
  `{{chave}}` ou preenchendo o espaco vazio a mao - o toast de criacao
  ja foi mostrado e some no timeout normal (5s); o scan live
  (`documentoVariaveisNaoResolvidas`) so reage a `{{...}}` literal
  remanescente, nao a "espacos vazios" (que se tornam apenas texto
  editado pelo vet, comportamento esperado e documentado em
  `intent.md`).

## 3) Fora de escopo

- Highlight inline dentro do textarea (impossivel tecnicamente).
- Bloqueio rigido de "Gerar PDF" (usa confirm, nao disable).
- Persistir `variaveis_vazias` como campo do documento.
- Alterar quais chaves existem no contexto ou como resolvem.
