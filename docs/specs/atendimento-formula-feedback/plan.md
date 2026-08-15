# Plan - atendimento-formula-feedback

Data: 2026-08-11
Responsavel: Claude (pareado com Martiniano)
Status: em andamento

## 1) Sequencia de fases

- Fase 1 (frontend): `duplicarMedicamentoManipulado` passa a trocar de
  aba e mostrar toast (`page.tsx`, 1 funcao, 3 linhas alteradas).
- Fase 2 (verificacao): `tsc`/`build`, verificacao visual via preview
  local, revisao adversarial leve, `verify.md`.

## 2) Tarefas por fase

### Fase 1

- [x] T1.1 `page.tsx`, `duplicarMedicamentoManipulado`: adicionar
  `setWorkspacePainel("bibliotecas")`; trocar `setSucesso("")` por
  `setSucesso("Formula pronta para revisao em Bibliotecas clinicas.")`.
- Criterio de conclusao: `tsc --noEmit` limpo, `npm run build` verde.
- Risco: muito baixo - 1 funcao, unico call site conhecido, sem
  mudanca de contrato/API, reaproveita mecanismos existentes
  (`setWorkspacePainel`, `setSucesso`).
- Rollback: reverter o commit.

### Fase 2

- [x] T2.1 `npx tsc --noEmit` e `npm run build` no worktree - ambos
  limpos.
- [x] T2.2 Verificacao visual: preview local (backend+frontend do
  proprio worktree, `fortcordis.db`/`.env` copiados so para o teste e
  removidos depois), login como admin, paciente real ("marinete")
  selecionado, aba Prescricao, item manual criado com medicamento da
  biblioteca ("Furosemida"):
  - Antes do clique: aba ativa = "Prescricao".
  - Clique em "Salvar formula na biblioteca" (via `computer` real
    click): aba ativa passa a "Bibliotecas clinicas" (nenhuma das 4
    tabs `fc-care-tab` fica marcada como ativa, pois "Bibliotecas" e
    um botao separado do tablist principal - comportamento esperado,
    confirmado por leitura do codigo de `workspaceCards`/
    `isBibliotecasWorkspace`); formulario "Novo medicamento" visivel
    com campo "Nome" pre-preenchido `"Furosemida - formula
    manipulada"` - confirmado via DOM (`input.value`).
  - Toast (`sucessoPopup`, texto "Formula pronta para revisao em
    Bibliotecas clinicas.") confirmado por leitura de codigo
    (mecanismo `setSucesso`/`sucessoPopup` com timer de 5000ms,
    identico ao usado em toda outra acao do componente) - captura
    visual direta do toast nao teve sucesso nas tentativas devido a
    latencia de round-trip do Browser tool (>5s entre o clique e a
    checagem, o toast ja tinha se auto-dissipado); nao e um mecanismo
    novo introduzido por este pacote, e sim o mesmo padrao ja usado
    e comprovado em ~30 outras chamadas `setSucesso` no arquivo.
- [x] T2.3 Revisao por 1 agente ceptico (escopo minimo, 1 funcao, 3
  linhas, sem mudanca de backend/contrato).
- [x] T2.4 `verify.md`.
- Criterio de conclusao: revisao sem achados bloqueantes.

## 3) Plano de testes

- Frontend: sem suite automatizada de UI no projeto para esta pagina;
  verificacao via `tsc`/`build` + inspecao de DOM no preview local
  (troca de aba + pre-preenchimento do formulario, confirmados via
  clique real) + leitura de codigo para o toast (mecanismo
  pre-existente, nao novo).
- Sem mudanca de backend, sem teste de backend necessario -
  `duplicarMedicamentoManipulado` e 100% client-side.

## 4) Rollback

Reverter o commit deste pacote - mudanca de frontend, 3 linhas, sem
migration, sem dado persistido novo, sem mudanca de contrato de API.
