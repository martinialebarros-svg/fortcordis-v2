# Intent - atendimento-loading-skeleton

Data: 2026-08-12
Responsavel: Claude (pareado com Martiniano)
Status: done

## 1) Problema atual

**Origem:** `docs/AUDITORIA-ATENDIMENTO-UX-FLUXO-2026-08-09.md` - achado #34
(dimensao: Feedback/Acessibilidade), rastreado como issue #53.

Quando `loading` e `true` (enquanto `carregarBase()` busca pacientes,
clinicas, banco de medicamentos, catalogo de exames e frases clinicas), todo
o modulo e substituido por uma `<div className="fc-care-loading">` com o
texto estatico "Carregando modulo de atendimento..." - sem `Loader2` (ja
usado em outros pontos do mesmo arquivo) e sem skeleton. Em conexao lenta, o
veterinario ve uma tela quase vazia por 1-2s ou mais, sem nenhum indicio de
progresso - parece que a aplicacao travou.

## 2) Objetivo

Substituir o texto plano por um skeleton simples, reaproveitando as classes
estruturais reais do modulo (`fc-care-page`, `fc-care-header`,
`fc-care-layout`, `fc-care-sidebar`, `fc-care-workspace`) com blocos
`animate-pulse`, para que o carregamento pareça uma pre-visualizacao do
layout que esta prestes a aparecer, em vez de uma tela vazia.

## 3) Nao objetivos

- Reusar `FortCordisStateShell` (o componente ja usado pelo `loading.tsx`
  de nivel de rota do Next.js, para transicoes de pagina completas, sem
  `DashboardLayout`). Esse componente renderiza uma tela cheia com imagem de
  fundo e logo, pensada para aparecer ANTES de qualquer chrome do dashboard
  estar montado. O loading deste achado acontece DEPOIS do `DashboardLayout`
  (sidebar/nav) ja estar montado - usar `FortCordisStateShell` aqui
  produziria uma tela de marca em tela cheia colada ao lado da barra
  lateral, incoerente com o restante do app.
- Buscar fidelidade pixel-perfeita ao layout final - o achado pede um
  "skeleton simples", nao uma replica exata de cada card/secao.
- Adicionar skeleton a outras paginas do sistema - escopo restrito ao
  modulo Atendimento (`frontend/app/atendimento/page.tsx`), unico arquivo
  citado no achado.

## 4) Contexto e restricoes

- **Decisao de engenharia (remover `.fc-care-loading`, nao so parar de
  usar):** apos a troca, nenhuma classe `.fc-care-loading` continuava sendo
  referenciada em nenhum JSX do projeto (`grep` confirmou). Como o proprio
  achado cita `frontend/app/globals.css` (`.fc-care-loading`) como arquivo
  afetado, a regra foi removida em vez de deixada morta. As 2 regras
  correspondentes (a compartilhada com `.fc-care-page` e a exclusiva) foram
  fundidas na definicao ja existente de `.fc-care-page` - refatoracao pura,
  sem mudanca de comportamento visual para `.fc-care-page` (mesmas
  propriedades, mesma especificidade, mesma ordem de origem).
- **Decisao de engenharia (acessibilidade preservada, nao regredida):** o
  texto original ("Carregando modulo de atendimento...") era lido por
  leitores de tela. Um skeleton puramente visual, sem nenhum texto,
  regrediria essa experiencia. O container do skeleton usa `role="status"`
  + `aria-live="polite"` com um `<span className="sr-only">` reproduzindo o
  texto original; os blocos visuais (`fc-care-header`, o grid) recebem
  `aria-hidden="true"` para nao serem lidos como conteudo (eles nao
  carregam nenhuma informacao real).
- Estrutura reaproveitada: cabecalho escuro (`fc-care-header`, mesmo
  gradiente real) com blocos `bg-white/10..20` pulsando (icone, kicker,
  titulo, descricao, 3 botoes); grid abaixo (`fc-care-layout xl:grid-cols-12`)
  com 2 blocos pulsando na coluna lateral (`fc-care-sidebar xl:col-span-3`)
  e 2 blocos maiores na coluna principal (`fc-care-workspace xl:col-span-9`)
  usando `bg-slate-100`/`border-slate-200`, consistente com a paleta clara
  do restante do modulo.

## 5) Impacto esperado

- Usuarios impactados: veterinarios, ao abrir o modulo Atendimento,
  especialmente em conexao lenta.
- Modulos impactados: Atendimento (frontend) - `page.tsx` e `globals.css`.
  Nenhuma mudanca de backend, banco ou contrato de API.
- Risco de regressao: baixo - a condicao `if (loading)` e o que ela
  substitui (quando `loading` volta a `false`) nao mudaram; so o JSX
  renderizado enquanto `loading` e `true` foi trocado.

## 6) Riscos iniciais

- Risco 1: a fusao das regras CSS de `.fc-care-page` alterar seu
  comportamento visual na tela real (pos-loading). Mitigado - confirmado
  via preview que a pagina real carrega com a mesma aparencia
  (max-width, gradiente de fundo, espacamento) antes e depois da fusao; a
  fusao e uma refatoracao sem mudanca de propriedades/especificidade.
- Risco 2: o skeleton quebrar em telas estreitas (mobile). Mitigado -
  reaproveita as mesmas classes responsivas (`grid-cols-1 xl:grid-cols-12`)
  ja usadas pelo layout real, que ja e responsivo.
- Risco 3: verificar visualmente o skeleton e dificil em rede local (a
  resposta chega rapido demais para observar o estado `loading=true`).
  Contornado forcando temporariamente a condicao (`if (loading || true)`)
  so para a verificacao visual em preview, revertido imediatamente antes de
  continuar - nunca commitado.

## 7) Definition of Ready (gate para spec)

- [x] Problema e objetivo estao claros.
- [x] Escopo e nao escopo estao explicitos.
- [x] Restricoes estao registradas.
- [x] Riscos iniciais estao mapeados.
