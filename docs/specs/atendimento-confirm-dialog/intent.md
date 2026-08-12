# Intent - atendimento-confirm-dialog

Data: 2026-08-12
Responsavel: Claude (pareado com Martiniano)
Status: done

## 1) Problema atual

**Origem:** `docs/AUDITORIA-ATENDIMENTO-UX-FLUXO-2026-08-09.md` - achado #32
(dimensao: Feedback/Acessibilidade), rastreado como issue #51.

O modulo Atendimento usa o dialogo nativo do navegador (`window.confirm()`/
`confirm()`) para confirmar acoes heterogeneas: substituicao de rascunho,
heranca de dados de atendimento anterior, exclusao de exame/anexo/documento/
painel/atendimento, revogacao de liberacao no portal e conclusao com
pendencias. O dialogo nativo nao tem estilo consistente com o resto do app,
nao usa icone de alerta e nao distingue visualmente uma acao reversivel de
uma irreversivel - uma exclusao definitiva de anexo aparenta ser tao "leve"
quanto um aviso informativo sobre heranca de dados.

**Nota de contagem:** o achado original (escrito em 2026-08-09) fala em "dez
confirmacoes". Neste pacote, o codigo atual tem **12** chamadas de
`confirm()`/`window.confirm()` - as 2 adicionais (avisos de "variavel nao
reconhecida" e "documento ja emitido" ao gerar PDF) foram introduzidas por
pacotes posteriores deste mesmo ciclo de auditoria (`atendimento-variaveis-
template-aviso` #42 e o fluxo de emissao de documento, ja com o campo
`status` de `atendimento-documento-emitido-aviso` #43). Como o objetivo do
achado e um padrao **consistente** para toda confirmacao do modulo, as 12
chamadas atuais entram no escopo, nao apenas as 10 originais.

## 2) Objetivo

Criar um componente `ConfirmDialog` compartilhado, estilizado, com variante
visual distinta para exclusoes irreversiveis, e substituir as 12 chamadas de
`confirm()`/`window.confirm()` em `page.tsx` por ele - sem mudar a logica de
_quando_ cada confirmacao aparece (condicoes inalteradas), apenas o
mecanismo de apresentacao.

## 3) Nao objetivos

- Retrofitar acessibilidade nos modais customizados **ja existentes**
  (`AttachmentPreviewModal`, `PainelExamesModal`, `NovoAgendamentoModal`,
  etc.). Isso e o escopo do achado #55 ("Modais sem padrao de
  acessibilidade"), uma issue separada. Este pacote so cobre o componente
  **novo** que ele mesmo introduz.
- Mudar a condicao lógica de quando cada confirmacao dispara (ex.: os
  guards `!selecionadoRef.current`, `acao === "revogar"`, etc. permanecem
  identicos). Qualquer ajuste nessas condicoes seria escopo de outro achado.
- Adicionar um sistema de toast/notificacao para substituir confirmacoes -
  o achado pede confirmacao estilizada, nao remocao da confirmacao.
- Migrar chamadas de `confirm()` em outras paginas do sistema (agenda,
  financeiro, etc.) - o achado #51 e especifico do modulo Atendimento
  (`frontend/app/atendimento/page.tsx`).

## 4) Contexto e restricoes

- Todas as 12 chamadas ficam dentro de funcoes que ja sao `async`, exceto
  `removerExame` (unica sincrona) - promovida a `async` neste pacote, sem
  impacto nos chamadores (`onClick={() => removerExame(index)}` ignora o
  Promise retornado, como o React permite).
- **Decisao de engenharia (API do componente):** em vez de um componente
  controlado por estado boolean simples (`open`/`onConfirm` fixos), o
  dialogo e exposto via uma funcao `confirmarAcao(opcoes): Promise<boolean>`
  que abre o dialogo e resolve quando o usuario decide. Isso permite
  substituir cada `if (!window.confirm(...)) return;` por
  `if (!(await confirmarAcao({...}))) return;` - troca mecanica, preserva
  exatamente o mesmo fluxo de controle (short-circuit, early return) de
  cada call site, sem reescrever a logica ao redor.
- **Decisao de engenharia (variantes e criterio de classificacao):** o
  achado pede para "priorizar primeiro as exclusoes (exame, anexo,
  documento, painel, atendimento)" com variante distinta. Essas 5 acoes -
  todas efetivamente destrutivas/irreversiveis (dado apagado do backend, ou
  marcado para exclusao no proximo salvamento) - recebem `variante:
  "destructive"` (icone e botao vermelhos). As outras 7 (substituicao de
  rascunho local x2, heranca de dados, revogacao de portal, conclusao com
  pendencias, e os 2 avisos de PDF) sao informativas/reversiveis e recebem
  `variante: "default"` (icone e botao neutros/ambar).
- **Decisao de engenharia (foco inicial por variante):** para dialogos
  `destructive`, o foco inicial vai para o botao **Cancelar** - previne que
  um Enter reflexivo confirme uma exclusao definitiva por engano. Para
  `default`, o foco vai para o botao **Confirmar**, replicando o
  comportamento do `window.confirm()` nativo (Enter = OK), onde nao ha
  risco de perda de dados.
- O componente novo usa `role="alertdialog"`, `aria-modal`, `aria-
  labelledby`/`aria-describedby`, e Escape-para-cancelar - um nivel de
  acessibilidade que os modais existentes do modulo nao tem (ver Nao
  objetivos), mas razoavel como padrao para um componente novo.
- Import dinamico (`dynamic(() => import(...), { ssr: false })`), mesmo
  padrao ja usado por `AttachmentPreviewModal` e `PainelExamesModal` no
  mesmo arquivo.

## 5) Impacto esperado

- Usuarios impactados: veterinarios, em qualquer acao que hoje dispara um
  dialogo nativo do navegador dentro do modulo Atendimento.
- Modulos impactados: Atendimento (frontend). Nenhuma mudanca de backend,
  banco ou contrato de API.
- Risco de regressao: baixo a medio - sao 12 pontos de chamada alterados,
  mas cada um e uma troca mecanica e isolada (mesma condicao, mesmo corpo
  apos o guard). O maior risco e uma condicao mal copiada durante a
  migracao (ver Riscos).

## 6) Riscos iniciais

- Risco 1: divergir a mensagem, o guard, ou a acao apos a confirmacao ao
  migrar algum dos 12 call sites. Mitigado revisando cada um individualmente
  contra o codigo original antes da troca, e testando pelo menos um fluxo
  destrutivo e um informativo ponta a ponta em preview local.
- Risco 2: `removerExame` deixar de ser chamado corretamente ao se tornar
  `async` (efeitos colaterais fora de ordem). Mitigado preservando a ordem
  exata das operacoes existentes (`clearExamUploadDraft`/
  `clearExamDropState` antes do guard, exatamente como no original).
- Risco 3: o dialogo generico (`aberto`, `titulo`, `descricao`, `variante`,
  `confirmLabel`, `cancelLabel`, `onConfirm`, `onCancel`) ser reaberto por
  um segundo clique antes do primeiro resolver, deixando a Promise anterior
  pendente para sempre. Mitigado pelo proprio dialogo bloquear a interacao
  com o resto da tela via overlay (`fixed inset-0`) enquanto aberto - nao
  ha como disparar um segundo `confirmarAcao` sem primeiro resolver o atual
  (fechar o dialogo).

## 7) Definition of Ready (gate para spec)

- [x] Problema e objetivo estao claros.
- [x] Escopo e nao escopo estao explicitos.
- [x] Restricoes estao registradas.
- [x] Riscos iniciais estao mapeados.
