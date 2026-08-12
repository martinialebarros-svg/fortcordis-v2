# Intent - atendimento-documentos-busca-filtro

Data: 2026-08-12
Responsavel: Claude (pareado com Martiniano)
Status: done

## 1) Problema atual

**Origem:** `docs/AUDITORIA-ATENDIMENTO-UX-FLUXO-2026-08-09.md` - achado #27
(dimensao: Documentos clinicos), rastreado como issue #46.

`AtendimentoDocumentosSection` renderiza a lista de documentos clinicos do
atendimento (pareceres, atestados, declaracoes) como uma sequencia plana de
cards, mostrando so titulo/status/data. Nao ha busca, filtro nem agrupamento
visual por status - o spec ja "done" de filtros/paginacao (`atendimento-
pendencias-filtro`, `atendimento-lista-filtros-paginacao`) cobre a lista de
*atendimentos*, nao a lista de *documentos dentro de um atendimento*.

Em atendimentos longos (retorno com multiplos atestados/laudos ao longo de
semanas), encontrar um documento especifico entre varios de titulos
semelhantes exige abrir um por um.

## 2) Objetivo

Adicionar busca por titulo, visivel apenas quando ha documentos suficientes
para justificar o custo de tela, e separar visualmente "Rascunhos" de
"Emitidos" reaproveitando o campo `status` ja disponivel em cada documento -
sem tocar em backend, migracao ou contrato de API.

## 3) Nao objetivos

- Filtro por tipo/template do documento (ex.: "Atestado" vs "Parecer"). O
  achado sugere "titulo/tipo", mas nao ha campo de tipo estruturado no
  modelo hoje (so `titulo` livre) - criar um exigiria migracao, fora do
  esforco "Pequeno" do achado. Busca por titulo cobre o caso pratico (titulos
  costumam conter o tipo, ex. "Atestado de repouso").
- Paginacao da lista de documentos. Volume tipico por atendimento e baixo
  (unidades); busca + agrupamento resolvem a fricção descrita sem precisar
  de paginacao.
- Ordenacao configuravel (por data, por titulo). Mantem a ordem atual
  (a que a API devolve) dentro de cada grupo.
- Persistir o termo de busca entre sessoes ou abas. Estado local do
  componente, some ao trocar de atendimento ou recarregar a pagina.

## 4) Contexto e restricoes

- `AtendimentoDocumentosSection` recebe `documentosAtendimento` via props
  (`LooseAtendimentoComponentProps[]`, ja carregado pelo componente pai) -
  este pacote e 100% frontend, um unico arquivo.
- O campo `status` de cada documento distingue apenas `"emitido"` vs.
  qualquer outro valor (tratado como rascunho) - mesma semantica ja usada
  no pacote `atendimento-documento-emitido-aviso` (#43), que introduziu esse
  campo. Nao existe hoje um terceiro valor em uso (ex. "arquivado");
  documentos sem `status` definido (`null`/`undefined`) caem em "Rascunhos"
  por seguranca (evita marcar como "Emitido" algo que nao foi).
- **Decisao de engenharia (threshold):** o achado pede a busca "quando houver
  mais de N documentos" sem definir N. Escolhido `N = 4` (busca aparece a
  partir de 5 documentos) - abaixo disso, rolar visualmente a lista e mais
  rapido que interagir com um campo de busca; softwares com listas curtas
  tipicamente escondem busca abaixo de ~5 itens. Nao ha telemetria de volume
  real de documentos por atendimento para calibrar com dados; se a pratica
  mostrar que o limiar esta errado, e uma constante isolada e trivial de
  ajustar.
- Segue a mesma convencao de transparencia de decisoes de engenharia dos
  pacotes anteriores (ex.: offsets do `atendimento-header-fixo`, mapeamento
  de estados do `atendimento-seguranca-perda-dado`).

## 5) Impacto esperado

- Usuarios impactados: veterinarios, ao revisar documentos de um atendimento
  com varios registros (retornos, casos cronicos).
- Modulos impactados: Atendimento (frontend), aba Documentos. Nenhuma
  mudanca de backend, banco ou contrato de API.
- Risco de regressao: baixo - a renderizacao de cada card e extraida para
  uma funcao local (`renderDocumentoCard`) sem mudar o JSX de cada card;
  com 4 documentos ou menos (a maioria dos atendimentos hoje), o unico
  efeito visivel e o agrupamento em "Rascunhos"/"Emitidos" no lugar da lista
  unica.

## 6) Riscos iniciais

- Risco 1: agrupar por status pode deixar uma das duas secoes vazia e
  confusa (ex.: atendimento so com rascunhos). Mitigado renderizando cada
  secao ("Rascunhos (N)"/"Emitidos (N)") somente quando `N > 0`.
- Risco 2: busca sem resultados pode parecer que a lista sumiu. Mitigado com
  mensagem explicita ("Nenhum documento encontrado para \"...\"") distinta
  da mensagem de "nenhum documento salvo neste atendimento" (lista
  originalmente vazia).

## 7) Definition of Ready (gate para spec)

- [x] Problema e objetivo estao claros.
- [x] Escopo e nao escopo estao explicitos.
- [x] Restricoes estao registradas.
- [x] Riscos iniciais estao mapeados.
