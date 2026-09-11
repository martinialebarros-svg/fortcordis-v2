# Plan - atendimento-continuidade-pos-alta

Data: 2026-09-10  
Responsavel: Martiniano Barros  
Status: fases 1 a 3 concluidas; verificacao em stage pendente

## 1) Sequencia de fases

- Fase 1 (DB/migracoes): colunas novas em `prescricoes_clinicas`,
  `evolucoes_clinicas` e `anexos_atendimentos`.
- Fase 2 (backend/API): receita multipla, adendo, guard de receita emitida,
  serializacao.
- Fase 3 (frontend): banner de concluido, secao de adendos, seletor de
  receitas.
- Fase 4 (testes/verificacao): suite backend e frontend + verificacao manual
  em stage.

As fases 2 e 3 sao grandes o bastante para virarem dois PRs contra `stage`. A
fase 2 e entregavel sozinha (API utilizavel, frontend inalterado por
compatibilidade), o que reduz o tamanho da revisao.

## 2) Tarefas por fase

### Fase 1

- [x] T1.1 criar
  `backend/migrations/versions/20260910_83_atendimento_continuidade_pos_alta.py`,
  aditiva e idempotente, com guarda de existencia de tabela e de coluna no
  padrao de `20260909_82`.
- [x] T1.2 indice unico `ux_prescricoes_clinicas_atendimento_sequencia` em
  `(atendimento_id, sequencia)`, criado com `IF NOT EXISTS`.
- [x] T1.3 refletir as colunas nos modelos em
  `backend/app/models/atendimento_clinico.py`.
- Criterio de conclusao: migracao roda duas vezes seguidas sem erro em SQLite
  e em Postgres; registros existentes ficam com `sequencia = 1`.
- Risco: o drift conhecido do SQLite local pode mascarar um erro que so
  aparece em Postgres - rodar a migracao tambem contra uma copia de stage.
- Rollback: as colunas sao aditivas e nullable ou com default; reverter o
  codigo nao exige derrubar coluna.

### Fase 2

- [x] T2.1 parametrizar `_sync_prescricao` por `prescricao_id`, mantendo o
  comportamento atual quando o alvo e a receita de `sequencia = 1`.
- [x] T2.2 guard de receita emitida: 409
  `CONFIRMACAO_EDICAO_RECEITA_EMITIDA`, no mesmo formato de
  `CONFIRMACAO_CONCLUSAO_PENDENCIAS`, com auditoria
  `EDITAR_RECEITA_EMITIDA` apos confirmacao.
- [x] T2.3 `POST /atendimentos/{id}/prescricoes` com copia opcional de itens
  (registros novos, sem reutilizar ids).
- [x] T2.4 `PUT /atendimentos/{id}/prescricoes/{prescricao_id}`.
- [x] T2.5 `GET /atendimentos/{id}/prescricoes/{prescricao_id}/pdf` gravando
  `emitida_em` na primeira geracao; mesma gravacao no endpoint legado.
- [x] T2.6 `POST /atendimentos/{id}/adendos` com derivacao de `pos_conclusao`
  no backend e auditoria `CRIAR_ADENDO_POS_CONCLUSAO`.
- [x] T2.7 `evolucao_id` opcional nos dois endpoints de anexo, validando que o
  adendo pertence ao atendimento.
- [x] T2.8 serializar `adendos` e `prescricoes` em
  `_montar_detalhe_atendimento` com consultas agregadas.
- [x] T2.9 incluir o tipo do adendo em `_montar_timeline_paciente`.
- Criterio de conclusao: suite backend verde, incluindo o teste de NFR-002.
- Risco: `_sync_prescricao` e chamado pelo caminho legado do
  `PUT /atendimentos/{id}`; um erro de parametrizacao quebra o salvamento
  normal da consulta. Mitigado pelos testes existentes de prescricao.
- Rollback: reverter o PR; as colunas ficam sem uso.

### Fase 3

- [x] T3.1 banner de atendimento concluido em `page.tsx`, com data de
  conclusao e acao "Adicionar adendo".
- [x] T3.2 componente `AtendimentoAdendosSection.tsx` com lista, criacao e
  upload de anexo por adendo.
- [x] T3.3 seletor de receitas com badge rascunho/emitida no workspace de
  prescricao, seguindo o visual de documento emitido.
- [x] T3.4 acao "Nova receita complementar" com pre-preenchimento.
- [x] T3.5 dialogo de confirmacao para editar receita emitida, consumindo o
  texto do 409.
- [x] T3.6 atalho "anexar resultado" em exame sem arquivo de atendimento
  concluido, criando o adendo e enviando o anexo na mesma acao.
- Criterio de conclusao: `npx tsc --noEmit` e `npm run lint` limpos, suite
  `vitest` verde.
- Risco: `page.tsx` tem mais de 8.000 linhas e ja acumula condicoes de corrida
  de autosave conhecidas; o estado das receitas nao pode entrar no snapshot de
  autosave do formulario, sob pena de reintroduzir sobrescrita.
- Rollback: reverter o PR; a API continua utilizavel.

### Fase 4

- [x] T4.1 testes backend novos em
  `backend/tests/test_atendimento_continuidade_pos_alta.py`.
- [x] T4.2 teste de regressao negativa: sem o guard, CA-002 falha.
- [x] T4.3 suite completa backend e frontend.
- [ ] T4.4 verificacao manual em stage com o cenario real (exame recebido dias
  depois + receita complementar).
- Criterio de conclusao: matriz de `verify.md` preenchida.
- Risco: nenhum.
- Rollback: n/a.

## 3) Plano de testes

- Unitarios: copia de itens de receita (sem reutilizar ids), derivacao de
  `pos_conclusao`, resolucao de `sequencia = max + 1`.
- Integracao (backend): fluxo completo do cenario - finalizar atendimento,
  criar adendo, anexar exame, criar receita 2, reimprimir receita 1; guard de
  receita emitida; invariante de OS (NFR-002); compatibilidade do endpoint
  legado de PDF (CA-008).
- Integracao (frontend): render do banner em atendimento concluido, seletor de
  receitas, confirmacao de edicao de receita emitida.
- Manuais: cenarios de `verify.md` em stage.

## 4) Ordem de entrega

Dois PRs de feature com base `stage`, conforme `docs/RUNBOOK-STAGE-PROD.md`:
fases 1+2 no primeiro, fase 3 no segundo. Promocao para `main` apenas depois
da verificacao manual em stage, por PR de promocao dedicado.
