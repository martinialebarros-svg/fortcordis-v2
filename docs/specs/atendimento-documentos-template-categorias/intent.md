# Intent - atendimento-documentos-template-categorias

Data: 2026-08-13
Responsavel: Claude (pareado com Martiniano)
Status: done

## 1) Problema atual

**Origem:** `docs/AUDITORIA-ATENDIMENTO-UX-FLUXO-2026-08-09.md` — achado #25
(dimensao: Documentos clinicos), rastreado como issue #44.

O `<select>` de escolha de template (`AtendimentoDocumentosSection.tsx`)
lista todos os templates ativos em uma lista plana, so pelo `nome` — sem
tipo, categoria ou trecho do corpo. Com templates de nomes parecidos (ex.:
dois modelos de "Atestado"), o atendente precisa adivinhar pelo nome qual
e o certo.

## 2) Objetivo

Agrupar as opcoes do select de template por `tipo` usando `<optgroup>`,
reaproveitando o campo `tipo` que `DocumentoAtendimentoTemplate` ja possui
(preenchido livremente pelo usuario ao criar/editar um template, ex.:
"parecer", "atestado", "declaracao").

## 3) Nao objetivos (decisao de escopo, ver riscos)

- **Preview do corpo do template antes de clicar "Criar"** — a segunda
  parte da sugestao do achado original. Explicitamente deixada fora do
  escopo deste pacote: o proprio issue #44 ja alertava que "preview fiel
  pode exigir logica de render adicional ou endpoint dedicado, ja que nao
  existe endpoint de preview para documentos hoje" — confirmado pela
  investigacao (nenhum endpoint de preview de documento existe; o unico
  fluxo de renderizacao e o de criacao real, que ja persiste o documento
  no banco). Fazer isso agora extrapolaria o esforco "Pequeno" original
  do achado. Decisao tomada em conjunto com o usuario ao escolher este
  item: implementar so a categorizacao agora (mantendo o escopo
  genuinamente pequeno) e deixar o preview do corpo como um item futuro
  separado, com esforco proprio a ser avaliado.
- Normalizacao/capitalizacao do valor de `tipo` (ex.: transformar
  "atestado" em "Atestado") - o campo e texto livre e ja e exibido em
  outros pontos do mesmo arquivo (linha ~332, lista de gerenciamento de
  templates) sem nenhuma normalizacao; manter consistencia com o padrao
  existente em vez de introduzir uma regra de formatacao nova.
- Mudar o formulario de criacao/edicao de template (o campo "Tipo" segue
  sendo um `<input>` de texto livre, sem virar um select com opcoes
  fixas) - fora do escopo do achado, que fala apenas do select de
  *escolha* de template.

## 4) Contexto e restricoes

- **Decisao de engenharia (agrupamento sem `useMemo`):** o componente ja
  computa `templatesAtivos` (a lista filtrada) de forma inline, sem
  memoizacao, a cada render — mesmo padrao usado por `documentosFiltrados`
  logo abaixo. O novo `templatesPorTipo` segue o mesmo estilo (um
  `reduce()` simples, sem `useMemo`), consistente com o restante do
  arquivo e sem introduzir uma dependencia nova (`useMemo` nao esta
  importado no arquivo).
- **Decisao de engenharia (chave de agrupamento):** `template.tipo ||
  "Outros"` - caso um template tenha `tipo` vazio (nao deveria acontecer,
  ja que o campo e obrigatorio no formulario, mas e uma salvaguarda
  barata), ele cai num grupo "Outros" em vez de quebrar o agrupamento ou
  desaparecer da lista.
- **Decisao de engenharia (ordem preservada):** `Object.entries()` sobre
  um objeto construido via `reduce()` preserva a ordem de primeira
  aparicao das chaves (chaves string, nao-numericas) - ou seja, a ordem
  dos grupos segue a ordem em que os `tipo`s aparecem em
  `templatesAtivos`, que por sua vez ja vem ordenada pelo backend (campo
  `ordem`). Nenhuma ordenacao adicional (ex.: alfabetica) foi introduzida.

## 5) Impacto esperado

- Usuarios impactados: veterinarios/atendentes criando documentos
  clinicos a partir de templates, especialmente clinicas com varios
  templates do mesmo tipo (ex.: multiplos modelos de atestado).
- Modulos impactados: Atendimento (frontend) — somente
  `AtendimentoDocumentosSection.tsx`. Nenhuma mudanca de backend, banco ou
  contrato de API (o campo `tipo` ja e retornado pela API existente).
- Risco de regressao: muito baixo — o valor selecionado
  (`documentoTemplateSelecionado`) e o `value` de cada `<option>`
  continuam sendo o `id` do template, inalterados; apenas a estrutura de
  agrupamento visual ao redor das mesmas `<option>` mudou.

## 6) Riscos iniciais

- Risco 1: `<optgroup>` quebrar a selecao/valor do `<select>` (ex.: por
  algum comportamento de navegador antigo). Mitigado — `<optgroup>` e um
  elemento HTML padrao, suportado universalmente, que nao interfere no
  `value`/`onChange` do `<select>` pai; confirmado no preview que
  selecionar uma opcao dentro de um grupo atualiza corretamente
  `documentoTemplateSelecionado`.
- Risco 2: multiplos templates do mesmo `tipo` nao aparecerem agrupados
  corretamente. Mitigado — testado no preview inserindo um segundo
  template com `tipo: "atestado"` (alem do existente "Atestado de
  saude"); confirmado via DOM que ambos aparecem dentro do mesmo
  `<optgroup label="atestado">`.
- Risco 3: escopo crescer para incluir o preview do corpo (tentacao
  natural, ja que esta na mesma sugestao do achado). Mitigado —
  documentado explicitamente como fora de escopo nesta secao e na secao
  3, com o motivo tecnico (falta de endpoint de preview) registrado.

## 7) Definition of Ready (gate para spec)

- [x] Problema e objetivo estao claros.
- [x] Escopo e nao escopo estao explicitos.
- [x] Restricoes estao registradas.
- [x] Riscos iniciais estao mapeados.
