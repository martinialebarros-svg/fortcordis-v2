# Plan - atendimento-cobertura-prontuario-real

Data: 2026-08-10
Responsavel: Claude (pareado com Martiniano)
Status: em andamento

## 1) Sequencia de fases

- Fase 1 (frontend): `ClinicalCoberturaMinima`, `GRUPOS_COBERTURA_MINIMA`,
  `buildCoberturaMinima`, wiring em `buildClinicalQuickSummary`; dois
  cards no editor clinico.
- Fase 2 (verificacao): `tsc`/`build`, verificacao visual manual via
  preview local, revisao adversarial leve (1 agente, foco em paridade
  exata com o backend), `verify.md`.

## 2) Tarefas por fase

### Fase 1

- [x] T1.1 `atendimento-clinical-notes.ts`: `ClinicalCoberturaMinima`,
  `GRUPOS_COBERTURA_MINIMA` (mesmos 3 grupos do backend), helper
  `buildCoberturaMinima`.
- [x] T1.2 `buildClinicalQuickSummary`: adicionar `coberturaMinima` ao
  retorno, sem alterar `pending`/`completeness`/`headline`/`highlights`.
- [x] T1.3 `AtendimentoConsultaEditorSection.tsx`: dois cards ("Pronto
  para concluir" + "Detalhamento") no lugar do card unico "Cobertura do
  prontuario"; bloco de Pendencias/sucesso inalterado.
- Criterio de conclusao: `tsc --noEmit` limpo, `npm run build` verde.
- Risco: baixo - aditivo, 1 arquivo novo campo + 1 componente com edicao
  pontual; `page.tsx` nao precisa de alteracao (clinicalSummary já é
  passado como objeto inteiro).
- Rollback: reverter o commit.

### Fase 2

- [x] T2.1 `npx tsc --noEmit` e `npm run build` no worktree.
- [x] T2.2 Verificacao visual manual: preview local (backend+frontend do
  proprio worktree, banco de dados local copiado so para teste,
  revertido depois), login como admin, atendimento existente com
  queixa_principal + exame_fisico preenchidos e diagnostico/plano vazios
  -> confirmado via inspecao do DOM (`innerText` do painel) "Pronto para
  concluir: 67%" e "Detalhamento: 18%" - dois numeros distintos e
  corretos (2/3 grupos vs 2/11 campos); badge da aba Consulta continua
  em 18% (inalterado).
- [x] T2.3 Revisao por 1 agente ceptico (escopo pequeno e isolado, foco
  em paridade exata com `_calcular_pendencias_documentacao`).
- [x] T2.4 `verify.md`.
- Criterio de conclusao: revisao sem achados bloqueantes.

## 3) Plano de testes

- Frontend: sem suite automatizada de UI no projeto para esta pagina;
  verificacao via `tsc`/`build` + inspecao de DOM no preview local
  (descrita acima).
- Sem mudanca de backend, sem teste de backend necessario - a paridade
  com `_calcular_pendencias_documentacao` foi verificada por leitura de
  codigo lado a lado (revisao adversarial).

## 4) Rollback

Reverter o commit deste pacote - nenhuma migration, nenhum dado
persistido, nenhuma mudanca de contrato.
