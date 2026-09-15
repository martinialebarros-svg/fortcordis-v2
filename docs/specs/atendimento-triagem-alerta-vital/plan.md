# Plan - atendimento-triagem-alerta-vital

Data: 2026-08-09
Responsavel: Claude (pareado com Martiniano)
Status: em andamento

## 1) Sequencia de fases

- Fase 1 (frontend): novo `vital-signs-reference.ts`; wiring de
  `especieExibicao` em `page.tsx` -> `AtendimentoTriagemSection`; estilo
  de alerta nos inputs e no resumo colapsado.
- Fase 2 (verificacao): `tsc`/`build`, verificacao visual manual via
  preview local, revisao adversarial leve (1 agente), `verify.md`.

## 2) Tarefas por fase

### Fase 1

- [x] T1.1 `vital-signs-reference.ts`: faixas canina/felina para
  temperatura/FC/FR; limiar unico de SpO2; `normalizarEspecie` tolerante
  a variacoes de capitalizacao/prefixo ("Canina"/"canino"/etc.).
- [x] T1.2 `page.tsx`: passar `especieExibicao` (ja calculado) para
  `AtendimentoTriagemSection`.
- [x] T1.3 `AtendimentoTriagemSection.tsx`: avaliar os 4 sinais, aplicar
  `CLASSE_INPUT_ALERTA`/badge nos inputs, trocar estilo do resumo
  colapsado quando `algumSinalVitalForaDaFaixa`.
- Criterio de conclusao: `tsc --noEmit` limpo, `npm run build` verde.
- Risco: baixo - aditivo, 1 arquivo novo + 2 arquivos com edicao pontual.
- Rollback: reverter o commit.

### Fase 2

- [x] T2.1 `npx tsc --noEmit` e `npm run build` no worktree.
- [x] T2.2 Verificacao visual manual: preview local (backend+frontend do
  proprio worktree, banco de dados local copiado so para teste,
  revertido depois), login como admin, atendimento existente (paciente
  canino) com FC=220/temperatura=38.5 setados manualmente no banco local
  de teste -> confirmado via inspecao do DOM (classes CSS e texto do
  badge) que o resumo colapsado muda para estilo de alerta e o input de
  FC expandido mostra o badge "ALTO"; temperatura (dentro da faixa) sem
  destaque.
- [x] T2.3 Revisao por 1 agente ceptico (escopo pequeno e isolado, sem
  mudanca de backend/contrato - nao justifica workflow completo).
- [x] T2.4 `verify.md`.
- Criterio de conclusao: revisao sem achados bloqueantes.

## 3) Plano de testes

- Frontend: sem suite automatizada de UI no projeto para esta pagina;
  verificacao via `tsc`/`build` + inspecao de DOM/classe CSS no preview
  local (descrita acima).
- Sem mudanca de backend, sem teste de backend necessario.

## 4) Rollback

Reverter o commit deste pacote - nenhuma migration, nenhum dado
persistido, nenhuma mudanca de contrato.
