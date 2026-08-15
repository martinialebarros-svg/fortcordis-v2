# Plan - atendimento-radar-alertas-todas-abas

Data: 2026-08-09
Responsavel: Claude (pareado com Martiniano)
Status: em andamento

## 1) Sequencia de fases

- Fase 1 (frontend): novo componente `AtendimentoAlertasCriticosCard`;
  `temAlertasCriticos`; ajuste de `workspaceGridClass` e da condicao de
  render da `<aside>` em `page.tsx`.
- Fase 2 (verificacao): `tsc`/`build`, verificacao visual manual via
  preview local (login, paciente com e sem alerta critico, abas
  Exames/Prescricao/Consulta), revisao adversarial leve (escopo pequeno,
  1 agente), `verify.md`.

## 2) Tarefas por fase

### Fase 1

- [x] T1.1 `AtendimentoAlertasCriticosCard.tsx`: filtro de gravidade,
  render condicional (`null` se vazio).
- [x] T1.2 `page.tsx`: `temAlertasCriticos` (derivado de `alertasAtivos`).
- [x] T1.3 `page.tsx`: `workspaceGridClass` para Exames passa a depender
  de `temAlertasCriticos` (2 colunas so quando ha alerta critico).
- [x] T1.4 `page.tsx`: condicao de render da `<aside>` inclui
  `isExamesWorkspace && temAlertasCriticos`; card compacto renderizado
  para Exames e Prescricao, antes do radar completo/aside de prescricao.
- Criterio de conclusao: `tsc --noEmit` limpo, `npm run build` verde.
- Risco: baixo - aditivo, um unico arquivo modificado (`page.tsx`) e um
  arquivo novo.
- Rollback: reverter o commit.

### Fase 2

- [x] T2.1 `npx tsc --noEmit` e `npm run build` no worktree.
- [x] T2.2 Verificacao visual manual: preview local (backend+frontend do
  proprio worktree, banco de dados local copiado so para teste, revertido
  depois), login como admin, paciente com alerta critico inserido
  manualmente para teste -> confirmado aside com card na aba Exames e
  grid 2 colunas; mesmo paciente sem alerta -> aba Exames 1 coluna, sem
  aside; aba Prescricao -> card + aside de prescricao juntos.
- [x] T2.3 Revisao por 1 agente ceptico (escopo pequeno e isolado, sem
  mudanca de contrato/backend - nao justifica workflow completo de N
  revisores).
- [x] T2.4 `verify.md`.
- Criterio de conclusao: revisao sem achados bloqueantes, texto do card
  ajustado apos a observacao nao bloqueante da revisao.

## 3) Plano de testes

- Frontend: sem suite automatizada de UI no projeto para esta pagina;
  verificacao via `tsc`/`build` + roteiro manual descrito acima (T2.2).
- Sem mudanca de backend, sem teste de backend necessario.

## 4) Rollback

Reverter o commit deste pacote - nenhuma migration, nenhum dado
persistido, nenhuma mudanca de contrato.
