# Plan - atendimento-exame-excluir-isolado

Data: 2026-08-10
Responsavel: Claude (pareado com Martiniano)
Status: em andamento

## 1) Sequencia de fases

- Fase 1 (frontend): envolver o botao de exclusao do exame em um
  wrapper com divisor + espacamento em
  `AtendimentoExamesSection.tsx`.
- Fase 2 (verificacao): `tsc`/`build`, verificacao visual manual via
  preview local, revisao adversarial leve (1 agente), `verify.md`.

## 2) Tarefas por fase

### Fase 1

- [x] T1.1 `AtendimentoExamesSection.tsx`: botao "Excluir"/"Remover"
  envolvido por `<div className="ml-1 flex items-center self-start
  border-l border-slate-200 pl-3">`.
- Criterio de conclusao: `tsc --noEmit` limpo, `npm run build` verde.
- Risco: baixo - mudanca puramente estrutural/CSS em 1 componente.
- Rollback: reverter o commit.

### Fase 2

- [x] T2.1 `npx tsc --noEmit` e `npm run build` no worktree.
- [x] T2.2 Verificacao visual manual: preview local (backend+frontend
  do proprio worktree, banco de dados local copiado so para login,
  revertido depois), login como admin, atendimento com exame nao
  salvo (estado padrao "Remover este exame da solicitacao") -> via DOM
  confirmado: (a) o wrapper com `border-l`/`pl-3`/`ml-1` esta aplicado
  ao botao correto; (b) gap medido entre "Laudar" e "Excluir" = 25px
  (vs `gap-2`=8px padrao entre os demais botoes do grupo); (c) o botao
  "Excluir" continua clicavel (`elementFromPoint` no centro do
  retangulo retorna o icone/filho do proprio botao); (d) o botao
  "Laudar" no mesmo card tambem continua clicavel, posicao inalterada.
- [x] T2.3 Revisao por 1 agente ceptico (escopo pequeno e isolado, 1
  arquivo, mudanca estrutural simples).
- [x] T2.4 `verify.md`.
- Criterio de conclusao: revisao sem achados bloqueantes.

## 3) Plano de testes

- Frontend: sem suite automatizada de UI no projeto para esta pagina;
  verificacao via `tsc`/`build` + inspecao de DOM/`getBoundingClientRect`
  no preview local (descrita acima).
- Sem mudanca de backend, sem teste de backend necessario.

## 4) Rollback

Reverter o commit deste pacote - mudanca de JSX/CSS, sem migration,
sem dado persistido.
