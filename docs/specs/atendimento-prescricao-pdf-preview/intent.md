# Intent - atendimento-prescricao-pdf-preview

Data: 2026-08-13
Responsavel: Claude (pareado com Martiniano)
Status: done

## 1) Problema atual

**Origem:** `docs/AUDITORIA-ATENDIMENTO-UX-FLUXO-2026-08-09.md` - achado #22
(dimensao: Fluxo de prescricao), rastreado como issue #41.

O preview da receita (`AtendimentoPrescricaoPreview.tsx`) e um `<iframe>`
com altura fixa (`height: 500px`) recebendo uma data URL base64 gerada por
`gerarPreviewPdf`. O unico controle de recuperacao e o botao "Tentar
novamente", exibido apenas quando ha erro de geracao - nao ha nenhum botao
para abrir o preview em uma nova aba a partir do proprio painel. Em telas
pequenas, os 500px fixos competem por espaco com o resto do formulario de
prescricao; se o navegador nao renderizar bem o `data:` URI dentro do
iframe, a unica saida e o botao "Baixar PDF", que fica na aside lateral -
fora da area visivel em telas menores.

## 2) Objetivo

Adicionar, no cabecalho do painel de preview, um botao "Abrir em nova aba"
que reaproveita o mesmo base64 ja gerado (sem nova chamada de rede), e
trocar a altura fixa do container por algo flexivel que se adapte a
telas com pouca altura de viewport, mantendo o mesmo maximo em telas
grandes.

## 3) Nao objetivos

- Mudar o mecanismo de geracao do preview (`gerarPreviewPdf`,
  `POST /atendimentos/prescricao/preview`) - permanece identico.
- Substituir ou remover o botao "Baixar PDF" da aside - ele continua
  existindo como fluxo separado (possivelmente reprocessando o PDF), o
  novo botao e um atalho complementar usando o preview ja renderizado.
- Adicionar zoom, paginacao ou qualquer outro controle de visualizacao de
  PDF dentro do iframe.

## 4) Contexto e restricoes

- **Decisao de engenharia (`window.open` com o mesmo data URL):** em vez de
  reprocessar o PDF ou fazer uma nova chamada de API, o botao usa
  diretamente `window.open(prescricaoPreviewPdf, "_blank",
  "noopener,noreferrer")` - o mesmo valor ja usado como `src` do
  `<iframe>`. Isso elimina qualquer chance de divergencia entre o que o
  usuario ve no preview e o que abre na nova aba, e evita uma chamada de
  rede desnecessaria.
- **Decisao de engenharia (`noopener,noreferrer`):** seguindo boa pratica
  de seguranca ao abrir conteudo (mesmo que gerado localmente) em uma nova
  aba via `window.open`, evitando que a nova aba tenha referencia de volta
  a janela original.
- **Decisao de engenharia (condicao de exibicao do botao):** o botao so
  aparece quando `prescricaoPreviewPdf` existe (truthy), independente de
  `prescricaoPreviewLoading`. Investigacao confirmou que
  `prescricaoPreviewPdf` NAO e limpo antes de uma regeracao bem-sucedida
  (so e limpo em caso de erro ou lista de itens vazia) - ou seja, durante
  uma regeracao, o preview ANTERIOR (ainda valido) continua visivel junto
  com o indicador "Gerando...". O botao deve continuar disponivel nesse
  cenario, pois abrir o PDF anterior (levemente desatualizado) e
  estritamente melhor que nao ter nenhuma saida.
- **Decisao de engenharia (altura via `min(60vh, 500px)`):** em vez de um
  breakpoint fixo (`sm:h-[500px]`), a altura usa a funcao CSS `min()`,
  dando uma resposta continua ao viewport em qualquer altura de tela -
  87% da altura da tela em viewports baixos, capado em 500px (identico ao
  comportamento anterior) em telas normais/grandes. Confirmado via preview:
  432px em viewport de 720px de altura (60vh), 500px em viewport de
  1200px de altura (cap).

## 5) Impacto esperado

- Usuarios impactados: veterinarios preenchendo a prescricao,
  especialmente em notebooks/telas com pouca altura ou quando o navegador
  renderiza mal o preview embutido.
- Modulos impactados: Atendimento (frontend) - somente
  `AtendimentoPrescricaoPreview.tsx`. Nenhuma mudanca de backend, banco ou
  contrato de API.
- Risco de regressao: muito baixo - o `<iframe>` em si nao foi tocado
  (mesmo elemento, mesmo `src`); apenas o container pai (altura) e o
  cabecalho (novo botao condicional) foram alterados.

## 6) Riscos iniciais

- Risco 1: o botao aparecer mesmo sem PDF valido (ex.: string vazia).
  Mitigado - condicao `prescricaoPreviewPdf ? (...) : null` (truthy-check),
  mesma logica ja usada pelo `<iframe>` condicional existente na linha de
  baixo.
- Risco 2: `min(60vh, 500px)` quebrar em navegadores muito antigos sem
  suporte a `min()` em CSS. Mitigado - `min()`/`max()` tem suporte amplo
  em todos os navegadores modernos (Chrome/Firefox/Safari/Edge ha varios
  anos); o projeto ja usa recursos CSS modernos (Tailwind v3, grid,
  `backdrop-filter` em outros pontos do app).
- Risco 3: `window.open` ser bloqueado por popup blocker. Mitigado - a
  chamada ocorre diretamente dentro do handler de clique (gesto do
  usuario), o padrao que os navegadores reconhecem como interacao legitima
  e nao bloqueiam.

## 7) Definition of Ready (gate para spec)

- [x] Problema e objetivo estao claros.
- [x] Escopo e nao escopo estao explicitos.
- [x] Restricoes estao registradas.
- [x] Riscos iniciais estao mapeados.
