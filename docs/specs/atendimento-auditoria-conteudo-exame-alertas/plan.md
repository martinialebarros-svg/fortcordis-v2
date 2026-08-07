# Plan - atendimento-auditoria-conteudo-exame-alertas

Data: 2026-08-06
Responsavel: Claude (Sonnet 5)
Status: done

## 1) Sequencia de fases

- Fase 1 (DB/migracoes): criar tabela `exame_ajustes` e o model `ExameAjuste`.
- Fase 2 (backend/API): auditoria de conteudo clinico, historico de exame,
  auditoria de alertas, reversao financeira na exclusao.
- Fase 3 (frontend): nao aplicavel nesta feature.
- Fase 4 (integracao/observabilidade): expor `historico_ajustes` no detalhe
  do atendimento.

## 2) Tarefas por fase

### Fase 1

- [x] T1.1 - Migration `20260805_64_exame_ajustes.py` (tabela + 2 indices).
- [x] T1.2 - Model `ExameAjuste` em `atendimento_clinico.py`.
- Criterio de conclusao: `test_exame_ajustes_migration.py` passa (cria
  tabela, permite insercao).
- Risco: baixo - tabela nova, sem alteracao de schema existente.
- Rollback: `DROP TABLE exame_ajustes` (nenhum outro objeto depende dela).

### Fase 2

- [x] T2.1 - `_snapshot_conteudo_clinico`/`_diff_conteudo_clinico`/
  `_auditar_conteudo_clinico_atualizado` em `atualizar_atendimento`.
- [x] T2.2 - `_registrar_ajuste_exame` chamado em `_sync_exames` para todo
  exame pre-existente, comparando 6 campos antes/depois.
- [x] T2.3 - Auditoria em `criar_alerta`/`atualizar_alerta` (com diff)/
  `desativar_alerta`.
- [x] T2.4 - `excluir_atendimento`: se a OS ativa vinculada estiver "Pago",
  chamar `desfazer_recebimento_ordem` antes de cancelar.
- Criterio de conclusao: suites `test_atendimento_conteudo_clinico_auditoria.py`,
  `test_atendimento_exame_historico_ajustes.py`,
  `test_atendimento_alerta_clinico_auditoria.py`,
  `test_atendimento_delete_guard.py` (novo teste de OS paga) passam.
- Risco: `_registrar_ajuste_exame` roda dentro do loop de sync de exames -
  se `current_user` nao tiver id/nome, a linha de auditoria fica com
  responsavel vazio (aceitavel, nao bloqueia o save).
- Rollback: reverter o commit; nenhuma migracao de dados a desfazer (colunas
  auditadas nao mudam de tipo).

### Fase 3

N/A - sem mudanca de frontend nesta feature.

### Fase 4

- [x] T4.1 - `_map_ajustes_por_exame` (query em lote) e inclusao de
  `historico_ajustes` em `_montar_detalhe_atendimento`.
- Criterio de conclusao: `GET /atendimentos/{id}` retorna `historico_ajustes`
  por exame sem N+1 (uma query para todos os exames do atendimento).
- Risco: nenhum - campo aditivo.
- Rollback: remover o campo do payload (nao afeta clientes que o ignoram).

## 3) Plano de testes

- Testes unitarios: `test_atendimento_conteudo_clinico_auditoria.py` (3),
  `test_atendimento_exame_historico_ajustes.py` (2),
  `test_atendimento_alerta_clinico_auditoria.py` (4),
  `test_exame_ajustes_migration.py` (2), mais o caso novo em
  `test_atendimento_delete_guard.py` (1) e ajuste de fixture em
  `test_atendimento_exame_integridade.py` e
  `test_atendimento_observacoes_portal_preservadas.py` (tabela
  `ExameAjuste` adicionada ao `create_all` de teste).
- Testes de integracao: suite completa do backend
  (`pytest tests/ -q`) para garantir que nenhuma rota existente quebrou.
- Testes manuais: nenhum necessario - mudanca e auditoria/historico interno,
  sem superficie de UI nova.

## 4) Dependencias e bloqueios

- Dependencia 1: reusa `registrar_auditoria` (ja existente,
  `app.services.auditoria_service`).
- Dependencia 2: reusa `desfazer_recebimento_ordem`
  (`app.api.v1.endpoints.ordens_servico`), ja usado no fluxo manual de
  desfazer recebimento.

## 5) Checklist para iniciar execucao

- [x] `intent.md` aprovado.
- [x] `spec.md` aprovado.
- [x] Fases e rollback revisados.
- [x] Ambiente de teste definido (local, SQLite via pytest).
