# Intent - atendimento-historico-loading

Data: 2026-08-12
Responsavel: Claude (pareado com Martiniano)
Status: done

## 1) Problema atual

**Origem:** `docs/AUDITORIA-ATENDIMENTO-UX-FLUXO-2026-08-09.md` - achado #35
(dimensao: Feedback/Acessibilidade), rastreado como issue #54.

`abrirAtendimento` faz uma chamada assincrona (`GET /atendimentos/{id}`) ao
abrir um atendimento do historico, mas nao ha nenhum estado de loading
associado nem desabilitacao do item clicado - diferente de outras acoes do
mesmo arquivo (salvar, finalizar, gerar PDF) que ja usam `Loader2`. Em rede
mais lenta da clinica, nada muda na tela ao clicar num item da lista de
"Atendimentos recentes"; e comum o usuario clicar de novo ou em outro item,
gerando confusao.

## 2) Objetivo

Adicionar um estado de loading por item (id do atendimento sendo aberto),
mostrando `Loader2` sobre o item clicado e desabilitando cliques nos demais
itens (e no proprio item, contra reenvio) enquanto a requisicao de
`abrirAtendimento` esta em andamento.

## 3) Nao objetivos

- Mudar o mecanismo de invalidacao de corrida ja existente
  (`abrirAtendimentoRequestIdRef`), que garante que so a resposta do
  clique mais recente aplica dados ao formulario - o novo estado de loading
  visual se apoia nesse mesmo ref, sem substitui-lo.
- Adicionar loading a `AtendimentoDocumentosSection.tsx`, que tambem chama
  `abrirAtendimento` (para re-buscar o proprio atendimento selecionado apos
  registrar uma evolucao) - esse call site nao e um clique numa lista de
  atendimentos diferentes, e o botao "Registrar Evolucao" ja tem seu proprio
  `disabled` baseado no formulario, nao no id do atendimento clicado. O
  loading compartilhado (`abrindoAtendimentoId`) ainda se aplica
  organicamente a esse call site (ver secao 4), sem precisar de mudanca
  nesse arquivo.
- Adicionar loading ao botao "Usar em novo atendimento"
  (`herdarAtendimentoAnterior`), que e uma funcao diferente com seu proprio
  guard de confirmacao - fora do escopo deste achado, que e especificamente
  sobre `abrirAtendimento`.

## 4) Contexto e restricoes

- **Decisao de engenharia (estado compartilhado, nao por-componente):** o
  novo estado `abrindoAtendimentoId` (`number | null`) vive em `page.tsx`,
  onde `abrirAtendimento` ja e definida, e e passado como prop para os
  componentes que renderizam listas clicaveis. Isso significa que QUALQUER
  chamada a `abrirAtendimento` - inclusive a de
  `AtendimentoDocumentosSection.tsx` (recarregar o atendimento atual apos
  registrar evolucao) - também aciona o mesmo loading compartilhado. Esse
  efeito colateral é desejável, não incidental: enquanto uma evolução está
  sendo salva e o atendimento recarregado, a lista de "Atendimentos
  recentes" mostra o item atual como carregando e bloqueia a troca para
  outro atendimento no meio da operação - reforça a mesma garantia de nao
  trocar de contexto com uma escrita em andamento, sem nenhum codigo extra.
- **Decisao de engenharia (guarda de limpeza do loading pareada com o ref
  de corrida existente):** `abrindoAtendimentoId` so e limpo (`null`) no
  `finally` quando `requestId === abrirAtendimentoRequestIdRef.current` -
  exatamente a mesma condicao já usada nos dois pontos de retorno
  antecipado dentro do `try`/`catch`. Sem essa guarda, se o clique A for
  superado pelo clique B antes de A responder, a resposta tardia de A
  entraria no `finally` e apagaria o loading de B, que ainda esta em voo -
  o item errado pareceria ter terminado de carregar.
- Dois locais de UI são afetados: a lista principal "Atendimentos
  recentes"/"Casos recentes" (em `page.tsx`, dentro do painel de casos) e a
  lista "Historico terapeutico preservado" em
  `AtendimentoPrescricaoHistorySection.tsx` (botao "Abrir original") - ambos
  chamam `abrirAtendimento` a partir de um clique numa lista de
  atendimentos diferentes do atual, o padrao exato que o achado descreve.
- `Loader2` ja estava importado em `page.tsx`; foi adicionado o import em
  `AtendimentoPrescricaoHistorySection.tsx`.

## 5) Impacto esperado

- Usuarios impactados: veterinarios, ao navegar entre atendimentos do
  historico em rede lenta.
- Modulos impactados: Atendimento (frontend) - `page.tsx` e
  `AtendimentoPrescricaoHistorySection.tsx`. Nenhuma mudanca de backend,
  banco ou contrato de API.
- Risco de regressao: baixo - a logica de negocio de `abrirAtendimento`
  (guard de rascunho, recuperacao de backup local, hidratacao do form) nao
  foi alterada; apenas um `setAbrindoAtendimentoId` no inicio e um
  `finally` guardado no fim foram adicionados.

## 6) Riscos iniciais

- Risco 1: o loading nao ser limpo em caso de erro de rede. Mitigado - o
  `finally` roda independentemente de sucesso ou excecao, e a guarda de
  `requestId` garante que e sempre a chamada certa quem limpa.
- Risco 2: dois cliques rapidos (no mesmo item ou em itens diferentes)
  deixarem o estado de loading "preso" apontando para um item errado.
  Mitigado e verificado manualmente em preview (via XHR com atraso
  artificial): o segundo clique atualiza `abrindoAtendimentoId` para o novo
  id imediatamente; quando a resposta do primeiro clique chega (superada),
  o `finally` dele nao limpa o estado, que continua correto ate a segunda
  resposta chegar.
- Risco 3: o card do item que esta sendo aberto tambem ficar
  "desabilitado", impedindo reenviar o mesmo clique - comportamento
  intencional (evita reentrancia), nao um bug.

## 7) Definition of Ready (gate para spec)

- [x] Problema e objetivo estao claros.
- [x] Escopo e nao escopo estao explicitos.
- [x] Restricoes estao registradas.
- [x] Riscos iniciais estao mapeados.
