# Plan - atendimento-badges-pendencia

Data: 2026-08-11
Responsavel: Claude (pareado com Martiniano)
Status: em andamento

## 1) Sequencia de fases

- Fase 1 (frontend): computar `examesPendentesCount`, adicionar
  `pendente` a `workspaceCards`, estilizar o badge (`page.tsx` +
  `globals.css`).
- Fase 2 (verificacao): `tsc`/`build`, verificacao visual via preview
  local (dados reais criados na UI, banco local copiado so para
  teste), revisao adversarial leve, `verify.md`.

## 2) Tarefas por fase

### Fase 1

- [x] T1.1 `page.tsx`: `examesPendentesCount = resumoExamesFluxo.
  aguardando_arquivo + resumoExamesFluxo.arquivo_anexado`; adicionar
  `pendente?: boolean` ao tipo de `workspaceCards`; setar `pendente`
  nos cards "exames" (`examesPendentesCount > 0`) e "prescricao"
  (`prescricaoErrosCount > 0`).
- [x] T1.2 `page.tsx` (render do tablist): badge ganha classe
  condicional `fc-care-tab-badge-alert` + `title` quando `pendente`.
- [x] T1.3 `globals.css`: `.fc-care-tab-badge-alert` (amber-500/branco),
  valido tanto para o estado ativo quanto inativo da aba.
- Criterio de conclusao: `tsc --noEmit` limpo, `npm run build` verde.
- Risco: baixo - aditivo, 2 arquivos, sem mudanca de contrato/API.
- Rollback: reverter o commit.

### Fase 2

- [x] T2.1 `npx tsc --noEmit` e `npm run build` no worktree - ambos
  limpos.
- [x] T2.2 Verificacao visual: preview local (backend+frontend do
  proprio worktree em portas dedicadas, `fortcordis.db`/`.env`
  copiados so para o teste e removidos depois), login como admin,
  paciente real (`marinete`) selecionado em atendimento novo:
  - Estado neutro (0 exames, 0 itens de prescricao): badges "Exames"/
    "Prescricao" com classe neutra (`fc-care-tab-badge `, sem
    `-alert`) - confirmado via `getComputedStyle`/`className` no DOM.
  - Exame adicionado so com nome (sem arquivo -> `aguardando_arquivo`):
    badge "Exames" passa a `fc-care-tab-badge fc-care-tab-badge-alert`,
    `background-color: rgb(245, 158, 11)` (amber-500), `title="Ha
    pendencia real nesta area"` - confirmado via DOM e screenshot.
  - Item de prescricao criado sem dose/frequencia/via, "Salvar
    atendimento" disparado (bloqueado pela validacao existente):
    badge "Prescricao" passa a `fc-care-tab-badge-alert` - confirmado
    via DOM apos navegar de volta para a aba Consulta (badge persiste
    fora da aba, nao e so um estado transitorio do erro).
  - Card "Consulta" (sem `pendente`) permanece sem a classe alert em
    todos os momentos acima - sem falso positivo.
- [x] T2.3 Revisao por 1 agente ceptico (escopo pequeno, 2 arquivos,
  sem mudanca de backend/contrato, sem novo estado).
- [x] T2.4 `verify.md`.
- Criterio de conclusao: revisao sem achados bloqueantes.

## 3) Plano de testes

- Frontend: sem suite automatizada de UI no projeto para esta pagina;
  verificacao via `tsc`/`build` + inspecao de DOM no preview local
  (descrita acima), usando dados criados via a propria UI (nao dados
  pre-existentes do snapshot local, que nao tinha exames vinculados a
  atendimentos).
- Sem mudanca de backend, sem teste de backend necessario -
  `resumoExamesFluxo` e `prescricaoErrosCount` sao valores derivados
  ja calculados e testados indiretamente pelo uso existente em outros
  pontos da UI.

## 4) Rollback

Reverter o commit deste pacote - mudanca de frontend, sem migration,
sem dado persistido novo, sem mudanca de contrato de API.
