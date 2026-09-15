# Plan - atendimento-exames-sugestao-foco

Data: 2026-08-13
Responsavel: Claude (pareado com Martiniano)
Status: done

## 1) Sequencia de fases

- Fase 1 (DB/migracoes): nao se aplica.
- Fase 2 (backend/API): nao se aplica.
- Fase 3 (frontend): estado de foco, condicao de visibilidade do
  dropdown, rotulo condicional, guarda de mousedown.
- Fase 4 (integracao/observabilidade): tsc/build, preview local (foco em
  campo vazio, digitacao, clique em sugestao, clique fora), revisao
  adversarial.

## 2) Tarefas por fase

### Fase 3

- [x] T3.1 Importar `useState` de "react" em `AtendimentoExamesSection.tsx`
  (nao estava importado antes).
- [x] T3.2 Declarar `const [exameBuscaFoco, setExameBuscaFoco] =
  useState(false);` apos a desestruturacao de props.
- [x] T3.3 Adicionar `onFocus`/`onBlur` no `<input>` de busca de exame.
- [x] T3.4 Atualizar a condicao de visibilidade do dropdown para incluir
  `exameBuscaFoco`.
- [x] T3.5 Adicionar rotulo "Sugestoes" condicional (`!exameBusca.trim()`)
  como primeiro filho do dropdown.
- [x] T3.6 Adicionar `onMouseDown={(e) => e.preventDefault()}` em cada
  botao de sugestao/resultado.
- [x] T3.7 **Bug real encontrado pela revisao adversarial**: o
  `onMouseDown preventDefault` do T3.6 mantem o input focado durante o
  clique - `exameBuscaFoco` continuava `true` apos selecionar um item de
  busca real, fazendo o dropdown reabrir mostrando "Sugestoes" em vez de
  fechar. Corrigido adicionando `setExameBuscaFoco(false)` no `onClick` do
  botao, antes de `adicionarExameDoCatalogo(item)`.
- Criterio de conclusao: `tsc --noEmit` aprovado, JSX valido.
- Risco: dropdown preso aberto ou clique perdido - mitigado pelos T3.3/
  T3.6/T3.7, verificado na Fase 4.
- Rollback: reverter o commit.

### Fase 4

- [x] T4.1 `npx tsc --noEmit` e `npm run build` no worktree isolado (2
  rodadas - a segunda apos remover um cast `(e: any)` desnecessario no
  handler de `onMouseDown`, confirmando que o TypeScript ja infere o tipo
  correto a partir do JSX).
- [x] T4.2 Preview local (backend + frontend do worktree, portas
  dedicadas `8133`/`3113`), autenticacao via `fetch()`/`localStorage`.
- [x] T4.3 Focado o campo de busca vazio: confirmado via JS que o
  dropdown aparece com rotulo "Sugestoes" e 8 itens (exames de
  cardiologia do seed: ECG + pressao + Holter, Ecocardiograma,
  Eletrocardiograma, Holter 24h, Mensuracao de pressao arterial,
  NT-proBNP, Troponina I, Radiografia toracica).
- [x] T4.4 Digitado "holter": confirmado que o dropdown atualizou para 2
  resultados reais de busca ("Holter 24h", "ECG + pressao + Holter") sem
  o rotulo "Sugestoes".
- [x] T4.5 Clicado na sugestao "Holter 24h" (via ref, nao coordenada bruta
  - ver nota abaixo): confirmado que o exame foi adicionado a solicitacao
  (`tipoValues: ["Holter 24h"]`), a busca foi limpa (`inputValue: ""`), e
  o dropdown fechou.
- [x] T4.6 Focado novamente o campo vazio (dropdown reaberto) e clicado
  num botao neutro da pagina ("Colapsar todos"): confirmado que o
  dropdown fechou sem adicionar nada.
- [x] T4.7 Checado console/rede: unico erro e o pre-existente
  `/api/v1/alertas-internos` (mesma causa documentada nos pacotes
  anteriores), sem relacao com este pacote.
- [x] T4.8 Revisao adversarial via agente, focada em: corretude da
  condicao de visibilidade; corretude do guard de mousedown; ausencia de
  regressao na busca real; ausencia de mudanca em `examesCatalogoFiltrados`
  (page.tsx).
- [x] T4.9 **Bug real encontrado pela revisao adversarial** (ver
  `intent.md`, risco 4): reproduzido no preview - apos digitar "holter" e
  clicar em "Holter 24h" (via ref), confirmado que o input permanecia
  focado (`isFocused: true`) e, antes da correcao, o dropdown reabria
  mostrando "Sugestoes". Corrigido com `setExameBuscaFoco(false)` no
  `onClick`.
- [x] T4.10 Reverificado apos a correcao: `tsc --noEmit` aprovado
  novamente; no preview, repetido o mesmo roteiro (digitar "holter",
  clicar em "Holter 24h") - confirmado que `isFocused` continua `true`
  mas `dropdownPresentAfterSelection` agora e `false`; focado novamente o
  campo (vazio) e confirmado que "Sugestoes" com 8 itens volta a aparecer
  normalmente (comportamento original intacto).
- Nota metodologica: a primeira tentativa de testar o clique numa
  sugestao usando coordenadas brutas calculadas via
  `getBoundingClientRect()` (espaco do viewport, 1280x720) falhou - o
  clique caiu fora do alvo porque a ferramenta de automacao espera
  coordenadas no espaco de pixels do screenshot mais recente (800x455),
  nao do viewport real. Corrigido usando cliques baseados em `ref`
  (resolvidos internamente pela ferramenta), que funcionaram
  corretamente.
- Criterio de conclusao: tsc/build limpos, os 4 comportamentos-chave
  (foco mostra sugestoes, digitar mostra busca real, clique em sugestao
  funciona, clique fora fecha) confirmados via preview, sem achados nao
  tratados na revisao adversarial.
- Risco: nenhum residual conhecido apos a verificacao.
- Rollback: reverter o commit.

## 3) Plano de testes

- Testes automatizados: nao aplicavel (sem suite de testes de componente
  React no projeto para este modulo).
- Verificacao tipo/build: `tsc --noEmit`, `npm run build`.
- Verificacao funcional: preview local cobrindo foco, digitacao, selecao
  via clique e fechamento por clique fora, usando cliques baseados em
  `ref` (nao coordenadas brutas, por causa da diferenca de escala
  viewport-vs-screenshot).
- Revisao adversarial: agente dedicado lendo o diff final.

## 4) Dependencias e bloqueios

- Dependencia: `examesCatalogoFiltrados` (`page.tsx`, ja retorna o top-8
  quando `exameBusca` vazio) - **atendida**, inalterada por este pacote.
- Sem bloqueios de infraestrutura conhecidos (sem migration, sem mudanca
  de API).
- Nota (nao-bloqueante): o preview local acusou 500 em
  `/api/v1/alertas-internos` (drift de schema pre-existente no snapshot
  do banco copiado), sem relacao com este pacote.

## 5) Checklist para iniciar execucao

- [x] `intent.md` aprovado.
- [x] `spec.md` aprovado.
- [x] Fases e rollback revisados.
- [x] Ambiente de teste definido: worktree isolado + preview local com
  banco copiado (gitignored, removido ao final).
