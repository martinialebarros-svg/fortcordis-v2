# Intent - atendimento-editor-revisao-consolidada

Data: 2026-08-12
Responsavel: Claude (pareado com Martiniano)
Status: done

## 1) Problema atual

**Origem:** `docs/AUDITORIA-ATENDIMENTO-UX-FLUXO-2026-08-09.md` - achado #7
(dimensao: Entrada de dados clinicos), rastreado como issue #26.

O editor clinico guiado (`AtendimentoConsultaEditorSection`) mostra
exatamente um `ClinicalFieldCard` por vez, navegado por botoes/atalhos. Os
"chips" dos 11 campos (organizados em 3 etapas: Anamnese e exame,
Diagnostico, Plano e retorno) so mostram titulo + badge "Concluido"/"Em
aberto", nunca o conteudo. O unico resumo automatico
(`buildClinicalQuickSummary`) e truncado e limitado a 4 dos 11 campos,
sempre somente leitura. Para revisar o prontuario inteiro antes de
salvar/concluir, o veterinario precisa navegar campo a campo - ate 11
cliques/atalhos - porque nao existe tela/toggle que mostre todos os campos
simultaneamente.

## 2) Objetivo

Adicionar um toggle "Ver todos os campos" que alterna entre o modo atual
(um `ClinicalFieldCard` por vez) e uma lista vertical com todos os campos
clinicos abertos e editaveis simultaneamente, reaproveitando o mesmo
componente `ClinicalFieldCard` sem duplicar logica de valor/edicao.

## 3) Nao objetivos

- Mudar a estrutura de etapas (3 grupos: Anamnese e exame, Diagnostico,
  Plano e retorno) ou os campos de cada uma - inalterados.
- Adicionar um novo modo de resumo somente-leitura - o pedido e edicao
  simultanea dos campos reais, nao mais um resumo truncado.
- Persistir a preferencia do toggle entre sessoes (localStorage, banco) -
  fica como estado de UI da sessao atual, resetado a cada carregamento da
  pagina (comportamento padrao de `useState` sem persistencia).
- Adicionar scroll-to-secao ao clicar nos cards de "Etapas do editor
  clinico" quando em modo consolidado - os cards de etapa continuam
  informativos (mostram % de preenchimento) e continuam clicaveis (mudam
  `consultaEditorEtapa`, usado para saber a que etapa retornar ao desligar
  o modo consolidado), mas nao fazem scroll automatico. Adicionar isso
  seria valioso, mas nao e necessario para resolver a fricção descrita e
  aumentaria o escopo de "Medio" para algo maior.

## 4) Contexto e restricoes

- **Decisao de engenharia (escopo do modo consolidado - TODOS os 11 campos,
  nao so os da etapa atual):** a sugestao literal do achado fala em "uma
  lista vertical com todos os ClinicalFieldCard **da etapa** abertos
  simultaneamente". Isso resolveria a fricção so parcialmente: o veterinario
  ainda precisaria trocar de etapa (3 cliques) para revisar os 11 campos
  completos. A descricao da fricção, porem, e explicita sobre querer
  revisar "o prontuario inteiro" evitando "ate 11 cliques" - ou seja, o
  problema real e nao ter uma visao dos 11 campos, nao apenas dos 3-4 de
  uma etapa. Por isso o modo consolidado implementado aqui mostra **os 11
  campos das 3 etapas**, agrupados visualmente por etapa (mesmos titulos
  "Anamnese e exame"/"Diagnostico"/"Plano e retorno" ja usados nos cards de
  progresso), em uma unica lista rolavel - resolvendo de fato a fricção
  descrita, nao apenas a leitura mais estrita da sugestao.
- **Decisao de engenharia (atalhos de teclado desligados no modo
  consolidado):** os atalhos Alt+Shift+esquerda/direita (navegar entre
  campos) e Ctrl/Cmd+Enter (avancar/voltar campo) dependem do conceito de
  "campo ativo" (`consultaCampoAtivo`), que nao tem representacao visual
  quando todos os campos estao abertos (nenhum card fica destacado como
  "ativo"). Ativa-los no modo consolidado mudaria `consultaCampoAtivo`
  silenciosamente, sem nenhum feedback visual, e essa mudanca so seria
  percebida se o vet desligasse o modo consolidado depois - confuso. Os 2
  efeitos que implementam esses atalhos (`useEffect` de autofoco e o
  listener global de teclado) passam a verificar `consultaVerTodosCampos`
  e nao fazem nada quando o modo consolidado esta ativo. A navegacao no
  modo consolidado e por scroll comum, como em qualquer formulario longo.
- **Decisao de engenharia (sem reset entre atendimentos):** ao contrario do
  estado de preview de protocolo (`atendimento-protocolo-previa`), o toggle
  `consultaVerTodosCampos` nao e zerado ao trocar de atendimento - e uma
  preferencia de visualizacao pura, sem risco de dado incorreto (nao
  depende do conteudo do atendimento, so decide COMO os mesmos 11 campos
  sao exibidos). Se o vet prefere revisar tudo de uma vez, essa preferencia
  se mantem ao navegar entre atendimentos na mesma sessao.
- `ClinicalFieldCard` e reaproveitado sem nenhuma alteracao - cada instancia
  no modo consolidado recebe exatamente os mesmos props (`value`,
  `onChange`, `onInsertPhrase`, `onInsertScaffold`, `onClear`, `textareaRef`)
  que a instancia unica do modo atual, so que uma por campo, com
  `registerClinicalTextarea(config.key)` guardando cada ref num mapa
  ja existente (`clinicalTextareaRefs.current`, chaveado por campo) - sem
  conflito entre os 11 textareas simultaneos.
- `onTextareaKeyDown` (Ctrl/Cmd+Enter) nao e passado aos cards do modo
  consolidado, pela mesma razao dos atalhos globais acima.

## 5) Impacto esperado

- Usuarios impactados: veterinarios, ao revisar o prontuario antes de
  salvar ou concluir um atendimento.
- Modulos impactados: Atendimento (frontend) -
  `AtendimentoConsultaEditorSection.tsx` e `page.tsx`. Nenhuma mudanca de
  backend, banco ou contrato de API. `ClinicalFieldCard.tsx` e
  `atendimento-clinical-notes.ts` nao foram alterados.
- Risco de regressao: baixo - o modo padrao (toggle desligado, estado
  inicial) e visualmente e funcionalmente identico ao comportamento
  anterior; a unica mudanca no modo padrao e a adicao do proprio botao de
  toggle.

## 6) Riscos iniciais

- Risco 1: os 11 textareas simultaneos conflitarem no registro de refs.
  Mitigado - `registerClinicalTextarea` ja usa um mapa chaveado por campo
  (`clinicalTextareaRefs.current[field]`), preexistente e usado sem
  alteracao.
- Risco 2: o toggle ligado silenciosamente quebrar os atalhos de teclado do
  modo padrao ao ser desligado novamente (efeitos nao re-inscritos
  corretamente). Mitigado - ambos os efeitos tem `consultaVerTodosCampos`
  no array de dependencias, garantindo re-avaliacao ao alternar o modo.
- Risco 3: performance ao renderizar 11 `ClinicalFieldCard` (com textareas e
  bancos de frases) simultaneamente. Aceito - 11 componentes de formulario
  simples nao representam custo de renderizacao relevante; sem sinal de
  problema na verificacao manual.

## 7) Definition of Ready (gate para spec)

- [x] Problema e objetivo estao claros.
- [x] Escopo e nao escopo estao explicitos.
- [x] Restricoes estao registradas.
- [x] Riscos iniciais estao mapeados.
