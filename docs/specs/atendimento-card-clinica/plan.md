# Plan - atendimento-card-clinica

Data: 2026-08-12
Responsavel: Claude (pareado com Martiniano)
Status: done

## 1) Sequencia de fases

- Fase 1 (DB/migracoes): nao se aplica.
- Fase 2 (backend/API): nao se aplica - `clinica_nome` ja e retornado.
- Fase 3 (frontend): badge condicional no bloco de chips do card da lista
  "Atendimentos recentes".
- Fase 4 (integracao/observabilidade): tsc/build, preview local (badge
  visivel com filtro "Todas as clinicas", ausente com clinica especifica e
  para atendimento sem clinica), revisao adversarial.

## 2) Tarefas por fase

### Fase 3

- [x] T3.1 Adicionar `<span>` condicional (`clinicaFiltro === "" &&
  item.clinica_nome`) como primeiro filho do `<div className="mt-3 flex
  flex-wrap gap-2 text-[11px] font-medium">`, com classe `rounded-full
  bg-slate-200 px-2.5 py-1 text-slate-700`.
- Criterio de conclusao: `tsc --noEmit` aprovado, JSX valido.
- Risco: quebrar a key/estrutura do `.map()` do card - mitigado por ser
  apenas um filho a mais dentro do mesmo container, sem tocar em `key` ou
  na estrutura do `button`/`div` externos.
- Rollback: reverter o commit.

### Fase 4

- [x] T4.1 `npx tsc --noEmit` e `npm run build` no worktree isolado.
- [x] T4.2 Preview local (backend + frontend do worktree, portas
  dedicadas `8129`/`3109`), autenticacao via `fetch()`/`localStorage`.
- [x] T4.3 Verificado via DOM (`read_page`) que o item com clinica
  ("vetworld") mostra o badge como primeiro chip, antes de "0 exame(s)" e
  "Receita salva", e que um item sem clinica (`clinica_nome` vazio) nao
  mostra nenhum badge.
- [x] T4.4 Alterado o filtro para uma clinica especifica (`vetworld`,
  id 9) e confirmado via DOM que o badge some do card, mesmo o
  atendimento pertencendo aquela clinica.
- [x] T4.5 Revertido o filtro para "Todas as clinicas"; confirmado via
  `getComputedStyle` que o badge usa exatamente as classes esperadas
  (`rounded-full bg-slate-200 px-2.5 py-1 text-slate-700`,
  `border-radius: 9999px`, cores slate-200/slate-700) e a ordem correta
  entre os irmaos (`vetworld` -> `0 exame(s)` -> `Receita salva`).
  Screenshot indisponivel nesta sessao (instabilidade conhecida da
  ferramenta - tela preta); verificacao via DOM/CSS computado foi
  suficiente e conclusiva.
- [x] T4.6 Revisao adversarial via agente, focada em: condicao dupla
  (`clinicaFiltro === "" && item.clinica_nome`) correta; nenhuma regressao
  nos demais chips; nenhuma mudanca de tipo/contrato.
- [x] T4.7 **Bug real encontrado pela revisao adversarial**: a condicao
  usava o valor ao vivo do `<select>` (`clinicaFiltro`), nao o filtro que
  de fato gerou a `lista` exibida - trocar o select sem clicar "Aplicar
  filtros" fazia o badge sumir antes da lista ser refeita. Corrigido
  adicionando `clinicaFiltroAplicado` (estado espelhando `clinicaAtual`
  dentro de `carregarLista`, atualizado no mesmo ponto que `setLista`) e
  trocando a condicao do badge para usa-lo em vez de `clinicaFiltro`.
- [x] T4.8 Reverificado apos a correcao: `tsc --noEmit` limpo; no preview,
  troquei o select para uma clinica especifica sem clicar "Aplicar
  filtros" e confirmei via DOM que o badge permanece visivel (lista ainda
  nao refeita, "2 atendimento(s) encontrado(s)"); cliquei "Aplicar
  filtros" e confirmei que a lista foi para "1 atendimento(s)
  encontrado(s)" e o badge correspondente desapareceu.
- Criterio de conclusao: tsc/build limpos, badge confirmado
  estruturalmente e via CSS computado, bug de staleness corrigido e
  reverificado, sem achados nao tratados na revisao adversarial.
- Risco: nenhum residual conhecido apos a verificacao.
- Rollback: reverter o commit.

## 3) Plano de testes

- Testes automatizados: nao aplicavel (sem suite de testes de componente
  React no projeto para este modulo).
- Verificacao tipo/build: `tsc --noEmit`, `npm run build`.
- Verificacao funcional: preview local; badge verificado via DOM/CSS
  computado (screenshot indisponivel por instabilidade da ferramenta
  nesta sessao, nao um problema do codigo).
- Revisao adversarial: agente dedicado lendo o diff final.

## 4) Dependencias e bloqueios

- Dependencia: campo `clinica_nome` ja retornado por `GET /atendimentos`
  - **atendida**, inalterada por este pacote.
- Sem bloqueios de infraestrutura conhecidos (sem migration, sem mudanca
  de API).
- Nota (nao-bloqueante): o preview local acusou 500 em
  `/api/v1/alertas-internos` (`no such table: alertas_internos`) - drift
  de schema no snapshot do banco copiado para o preview, sem relacao com
  este pacote (todas as chamadas `/atendimentos` retornaram 200 OK).

## 5) Checklist para iniciar execucao

- [x] `intent.md` aprovado.
- [x] `spec.md` aprovado.
- [x] Fases e rollback revisados.
- [x] Ambiente de teste definido: worktree isolado + preview local com
  banco copiado (gitignored, removido ao final).
