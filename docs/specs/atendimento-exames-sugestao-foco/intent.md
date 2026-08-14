# Intent - atendimento-exames-sugestao-foco

Data: 2026-08-13
Responsavel: Claude (pareado com Martiniano)
Status: done

## 1) Problema atual

**Origem:** `docs/AUDITORIA-ATENDIMENTO-UX-FLUXO-2026-08-09.md` - achado #15
(dimensao: Fluxo de exames), rastreado como issue #34.

O calculo do top-8 exames padrao do catalogo ja existe no codigo
(`examesCatalogoFiltrados`, `page.tsx:2222-2239`: quando `exameBusca` esta
vazio, retorna `catalogoExames.slice(0, 8)`), mas a condicao de render do
dropdown em `AtendimentoExamesSection.tsx` exigia texto digitado
(`exameBusca.trim() && ...`) - a lista padrao nunca chegava a ser exibida
na pratica. Mesmo para o exame mais solicitado da clinica, o veterinario
precisava digitar ao menos uma letra antes de qualquer sugestao aparecer.

## 2) Objetivo

Exibir as sugestoes padrao (mesma lista ja computada) ao focar o campo de
busca de exame vazio, nao so apos digitar.

## 3) Nao objetivos (decisao de escopo, ver riscos)

- **Ordenar por frequencia de uso recente da clinica.** A sugestao original
  do achado pede isso como "idealmente" (enhancement, nao requisito duro).
  Investigacao confirmou: `listar_catalogo_exames`
  (`backend/app/services/exam_catalog_service.py:244`) ordena o catalogo
  por `categoria.asc(), nome.asc()` - puramente alfabetico, sem nenhum
  sinal de frequencia de uso armazenado em lugar nenhum do sistema.
  Implementar ordenacao por uso real exigiria uma tabela/coluna nova de
  contagem de uso e uma mudanca de query no backend - fora do escopo
  "Pequeno" deste pacote. Por isso, o rotulo escolhido foi "Sugestoes"
  (honesto sobre o que a lista realmente e - os primeiros 8 itens do
  catalogo, ja filtrados por especialidade cardiologica no seed) em vez
  de "Mais usados" (que seria enganoso, ja que a ordem nao reflete uso
  real).
- Unificar este padrao "sugestao ao focar" com o padrao diferente ja usado
  no fluxo de medicamentos da prescricao (`prescricaoEntradaModo`, um botao
  de "modo de entrada" explicito) - sao dois mecanismos de UI distintos
  para dois fluxos distintos; nao ha necessidade de reconcilia-los neste
  pacote, e o achado #34 e especifico sobre o campo de EXAMES.

## 4) Contexto e restricoes

- **Decisao de engenharia (estado local, nao lifted para page.tsx):** o
  novo estado `exameBuscaFoco` (boolean) foi declarado localmente dentro
  de `AtendimentoExamesSection.tsx` via `useState`, seguindo o mesmo
  precedente ja usado por `buscaDocumento` em
  `AtendimentoDocumentosSection.tsx` - e um estado puramente de UI/
  apresentacao, sem necessidade de ser compartilhado com `page.tsx` ou
  outros componentes.
- **Decisao de engenharia (mousedown + preventDefault para evitar race de
  blur):** clicar num botao normalmente dispara `mousedown` (que moveria o
  foco do input para o botao, disparando `onBlur` do input ANTES do
  `onClick` do botao registrar) seguido de `click`. Para garantir que o
  clique na sugestao sempre registre mesmo com `onBlur` fechando o
  dropdown, cada botao de sugestao recebeu
  `onMouseDown={(e) => e.preventDefault()}` - um padrao estabelecido para
  esse problema (o mousedown normal e cancelado, o foco permanece no
  input durante o mousedown, e o `click` subsequente ainda dispara
  normalmente). Verificado no preview: clicar numa sugestao adiciona o
  exame corretamente e limpa a busca; clicar fora (sem selecionar) fecha o
  dropdown normalmente.
- **Decisao de engenharia (rotulo "Sugestoes" em vez de "Mais usados"):**
  ver secao 3 (nao objetivos) - documentado aqui tambem porque e uma
  divergencia deliberada do texto literal da sugestao do achado.

## 5) Impacto esperado

- Usuarios impactados: veterinarios solicitando exames, especialmente ao
  adicionar o exame mais comum da clinica (ex.: Ecocardiograma,
  Eletrocardiograma) logo no inicio do atendimento.
- Modulos impactados: Atendimento (frontend) - somente
  `AtendimentoExamesSection.tsx`. Nenhuma mudanca de backend, banco ou
  contrato de API (a computacao `examesCatalogoFiltrados` em `page.tsx`
  ja existia e nao foi alterada).
- Risco de regressao: baixo - a mudanca so afeta a condicao de
  visibilidade do dropdown e adiciona um rotulo condicional; a logica de
  busca/filtragem e adicao de exame permanecem intactas.

## 6) Riscos iniciais

- Risco 1: dropdown ficar preso aberto apos o usuario clicar fora sem
  selecionar nada. Mitigado - `onBlur` limpa `exameBuscaFoco`; verificado
  no preview que clicar num botao neutro da pagina fecha o dropdown
  corretamente.
- Risco 2: clique numa sugestao nao registrar por causa do blur do input
  disparando antes do click do botao. Mitigado - `onMouseDown`
  `preventDefault()` no botao; verificado no preview que clicar em
  "Holter 24h" adiciona corretamente o exame e limpa a busca.
- Risco 3: rotulo "Mais usados" ser enganoso dado que a ordem real e
  alfabetica, nao por frequencia. Mitigado - rotulo trocado para
  "Sugestoes" (ver secao 3).
- **Risco 4 (encontrado pela revisao adversarial, corrigido):** como o
  `onMouseDown` `preventDefault()` do Risco 2 mantem o input focado
  durante o clique (confirmado no preview: `isFocused: true` logo apos
  selecionar um item), `exameBuscaFoco` permanecia `true` apos a selecao.
  Como `adicionarExameDoCatalogo` so limpa `exameBusca` (nao
  `exameBuscaFoco`), a condicao `(exameBusca.trim() || exameBuscaFoco)`
  continuava satisfeita so pelo foco, e o dropdown REABRIA mostrando a
  lista padrao ("Sugestoes") em vez de fechar apos uma selecao vinda de
  busca real digitada - contradizendo o comportamento pretendido (e o que
  o `spec.md` originalmente afirmava). **Corrigido** adicionando
  `setExameBuscaFoco(false)` explicitamente no `onClick` do botao de
  sugestao, antes de `adicionarExameDoCatalogo(item)` - fecha o dropdown
  de forma deterministica, independente de qualquer sutileza de timing de
  foco/blur do navegador. Reverificado no preview: apos clicar numa
  sugestao vinda de busca digitada, `isFocused` continua `true` mas o
  dropdown corretamente NAO reabre (`dropdownPresentAfterSelection:
  false`); focar novamente o campo (agora vazio) mostra "Sugestoes"
  normalmente.

## 7) Definition of Ready (gate para spec)

- [x] Problema e objetivo estao claros.
- [x] Escopo e nao escopo estao explicitos.
- [x] Restricoes estao registradas.
- [x] Riscos iniciais estao mapeados.
