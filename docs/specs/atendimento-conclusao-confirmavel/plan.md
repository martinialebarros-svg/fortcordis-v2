# Plan - atendimento-conclusao-confirmavel

Data: 2026-08-02
Responsavel: Claude (pareado com Martiniano)
Status: done

## 1) Sequencia de fases

- Fase 1 (DB/migracoes): nao se aplica, nenhuma coluna nova.
- Fase 2 (backend/API): guard confirmavel, campo novo nos tres payloads,
  auditoria da conclusao com pendencias.
- Fase 3 (frontend): confirmar e reenviar em `finalizarAtendimento`.
- Fase 4 (integracao/observabilidade): atualizar testes que assumiam o
  bloqueio incondicional, adicionar testes do caminho de confirmacao, rodar
  suite completa, lint/tsc/build do frontend.

## 2) Tarefas por fase

### Fase 2

- [x] T2.1 `_validar_primeira_conclusao_atendimento` ganha `confirmado: bool`
  e passa a devolver a lista de pendencias em vez de `None`; sem confirmacao
  e com pendencia, levanta `409` no formato `CONFIRMACAO_*` ja usado no
  pacote anterior.
- [x] T2.2 `_auditar_conclusao_com_pendencias` novo helper.
- [x] T2.3 Adicionar `confirmar_conclusao_pendencias` em
  `AtendimentoCreatePayload`, `AtendimentoUpdatePayload` e
  `AtendimentoFinalizarPayload`.
- [x] T2.4 Atualizar os tres call sites (`criar_atendimento`,
  `atualizar_atendimento`, `finalizar_atendimento`) para passar o flag e
  auditar quando ha pendencias.
- Criterio de conclusao: os tres pontos de entrada aceitam confirmacao e
  auditam.
- Risco: `criar_atendimento` nao tinha parametro `request`; adicionado como
  opcional para nao quebrar chamadas existentes.
- Rollback: reverter o commit.

### Fase 3

- [x] T3.1 `finalizarAtendimento` aceita `confirmarConclusaoPendencias`,
  envia no payload, e no catch detecta o `409` confirmavel especificamente
  (`codigo === "CONFIRMACAO_CONCLUSAO_PENDENCIAS"`) para abrir
  `window.confirm` e reenviar.
- Criterio de conclusao: ESLint, `tsc --noEmit` e `npm run build` aprovados.
- Risco: nenhum - mudanca isolada numa unica funcao.
- Rollback: reverter o commit.

### Fase 4

- [x] T4.1 Atualizar `test_atendimento_clinical_lifecycle.py` (2 testes que
  esperavam `422` incondicional) e `test_atendimento_transactional_
  finalization.py` (1 teste) para o novo contrato `409` confirmavel.
- [x] T4.2 Adicionar testes do caminho de confirmacao nos tres arquivos
  (criacao, atualizacao, finalizacao), incluindo asserção da auditoria.
- [x] T4.3 Ajustar `setUp` de `test_atendimento_clinical_lifecycle.py` para
  criar as tabelas `exames`, `anexos_atendimentos`, `prescricoes_clinicas` e
  `prescricoes_itens` - necessarias porque os novos testes de confirmacao
  chegam ao ponto do codigo onde essas tabelas sao consultadas (antes os
  testes paravam sempre no bloqueio 422/409, antes de qualquer query nelas).
- [x] T4.4 Rodar `pytest tests/ -k atendimento` e a suite completa.
- [x] T4.5 Lint, TypeScript e build do frontend.
- Criterio de conclusao: suite verde, `verify.md` com rastreabilidade.
- Risco: nenhum residual conhecido.
- Rollback: reverter o commit.

## 3) Plano de testes

- Testes unitarios/integracao: os 3 call sites, com e sem confirmacao, com e
  sem pendencia, com asserção de auditoria via mock de
  `_auditar_conclusao_com_pendencias`.
- Testes manuais: sem runner no frontend; roteiro no `verify.md`.

## 4) Dependencias e bloqueios

- Dependencia 1: pacote `atendimento-integridade-prontuario` (padrao de
  conflito confirmavel `{codigo, mensagem, confirmavel}` e a extensao de
  `readDetailFromObject` no frontend) - **atendida**, ja em producao.
- Sem bloqueios de infraestrutura conhecidos para este pacote especifico
  (nao cria migration).

## 5) Checklist para iniciar execucao

- [x] `intent.md` aprovado.
- [x] `spec.md` aprovado.
- [x] Fases e rollback revisados.
- [x] Ambiente de teste definido: SQLite isolado por teste em `backend/venv`.
