# Plan - atendimento-integridade-prontuario

Data: 2026-07-31
Responsavel: Claude (pareado com Martiniano)
Status: approved

## 1) Sequencia de fases

- Fase 1 (DB/migracoes): **nao se aplica**. A decisao de manter hard delete com
  guards, em vez de soft-delete, elimina a migration. Registrado aqui para o
  gate do SDD nao ficar ambiguo.
- Fase 2 (backend/API): schema `_destroy`, exclusao com guards, derivacao de
  status com preservacao da liberacao, guarda de regressao no upload, endpoint
  de revogacao, guards da finalizacao contra o vinculo atual e confirmacao de
  desvinculo com auditoria.
- Fase 3 (frontend): payload sem exclusao por omissao, `agendamento_id`
  omitido quando vazio, acao explicita de excluir exame, acoes de liberar e
  revogar no Portal, chip de estado.
- Fase 4 (integracao/observabilidade): regressao automatizada dos 6 cenarios
  obrigatorios mais os de borda, lint, TypeScript, build, roteiro manual e
  `verify.md`.

## 2) Tarefas por fase

### Fase 1

- [x] T1.1 Confirmar que `exames` nao possui coluna de exclusao logica
  (`backend/app/models/laudo.py:45-85`) e registrar a decisao de nao migrar.
- Criterio de conclusao: nenhuma migration criada; `20260730_59` segue sendo a
  ultima do modulo.
- Risco: nulo.
- Rollback: nao aplicavel.

### Fase 2

- [x] T2.1 `ExameSolicitacaoPayload`: campo `destroy` com alias `_destroy`,
  `populate_by_name`, e `tipo_exame` obrigatorio somente quando nao ha
  `_destroy` (validado com pydantic 2.5).
- [x] T2.2 `AtendimentoUpdatePayload`: campo
  `confirmar_desvinculo_agendamento`.
- [x] T2.3 `_sync_exames`: remover o delete por omissao; excluir apenas itens
  marcados; agregar a contagem de anexos por exame em uma consulta.
- [x] T2.4 `_motivo_bloqueio_exclusao_exame`: guards de `laudo_id`, anexo e
  liberacao no Portal, com `409` e mensagem acionavel.
- [x] T2.5 `_derivar_status_exame`: preserva liberacao, senao deriva de
  `resultado` e da contagem de anexos em banco; substituir
  `exame.status = (payload.status or ...)`.
- [x] T2.6 Upload de anexo: nao rebaixar status liberado
  (`_status_exame_regressao_bloqueada`).
- [x] T2.7 `POST /atendimentos/exames/{exame_id}/portal/revogar` com auditoria;
  auditar tambem a liberacao existente.
- [x] T2.8 `atualizar_atendimento`: guards `409` contra o vinculo atual mais o
  destino; desvinculo confirmado, bloqueado para concluido, e auditado.
- Criterio de conclusao: os 6 cenarios obrigatorios do `verify.md` cobertos por
  teste e a suite do modulo verde.
- Risco: derivacao de status sobrescrever estado legitimo de outro modulo.
- Rollback: reverter o commit; sem estado migrado.

### Fase 3

- [x] T3.1 `buildAtendimentoPayload`: deixar passar itens marcados com
  `_destroy`, parar de recalcular `status`, e omitir `agendamento_id` quando
  vazio. O filtro por `tipo_exame` vazio **permanece** de proposito: com a
  exclusao por omissao removida do backend, omitir um exame virou no-op, entao
  um campo em branco durante a digitacao nem apaga o exame nem invalida o save
  com `422`.
- [x] T3.2 Estado local de exclusao pendente e acao explicita de excluir exame
  com confirmacao no card.
- [x] T3.3 "Remover vazios" passa a marcar `_destroy` nos exames persistidos.
- [x] T3.4 Acoes "Liberar no portal" e "Revogar liberacao" no card, com estado
  de carregamento e recarga do exame apos a resposta.
- [x] T3.5 Chip de liberacao no Portal e bloqueio da acao sem PDF anexado.
- [x] T3.6 Exibir a mensagem de `409` do backend sem descartar o formulario.
- Criterio de conclusao: ESLint, `tsc --noEmit` e `npm run build` aprovados; o
  roteiro manual do `verify.md` executado.
- Risco: exame marcado para exclusao reaparecer apos merge do detalhe.
- Rollback: reverter o commit.

### Fase 4

- [x] T4.1 `backend/tests/test_atendimento_exame_integridade.py` com os
  cenarios 1 a 4 e 8 do `verify.md`.
- [x] T4.2 `backend/tests/test_atendimento_vinculo_agendamento_guard.py` com os
  cenarios 5, 6 e o fluxo de desvinculo confirmado.
- [x] T4.3 Rodar `pytest tests/ -k atendimento` e comparar com o baseline de
  62 testes.
- [x] T4.4 Rodar a suite backend completa para detectar regressao fora do
  modulo.
- [x] T4.5 Lint, TypeScript e build do frontend.
- [x] T4.6 Preencher `verify.md` com numeros reais e riscos residuais.
- [x] T4.7 Revisao adversarial pos-implementacao (workflow com 6 dimensoes
  independentes + verificacao adversarial de cada achado): confirmou D1/D2
  fechados sem desvio de spec, e achou um gap real dentro do proprio escopo do
  D3 (RF-028/CA-014). Corrigido nesta mesma fase, com testes novos.
- [x] T4.8 Corrigir os 3 achados de severidade alta da revisao: o guard de
  RF-028, e dois testes que alegavam cobertura que nao tinham (auditoria de
  liberacao/revogacao sem asserção; exclusao com arquivo testando um cenario
  que o proprio guard de anexo torna inalcancavel pelo endpoint publico).
- Criterio de conclusao: `verify.md` com rastreabilidade CA a evidencia.
- Risco: regressao em testes de Portal ou Laudos que dependiam do status do
  exame vindo do cliente.
- Rollback: reverter o commit.

## 3) Plano de testes

- Testes unitarios: derivacao de status, guards de exclusao e validacao do
  schema com `_destroy`.
- Testes de integracao: `atualizar_atendimento` e o endpoint de upload sobre
  SQLite isolado com entidades reais, seguindo o padrao de
  `tests/test_atendimento_transactional_finalization.py` (tmpdir, `create_engine`
  por teste, `SimpleNamespace` como usuario, patch dos efeitos de auditoria).
- Testes manuais: sem runner no frontend, roteiro registrado no `verify.md`
  cobrindo limpar `tipo_exame` com exame anexado, excluir exame com laudo,
  liberar e revogar no Portal, e autosave com `agendamento_id` vazio.

## 4) Dependencias e bloqueios

- Dependencia 1: pacote `atendimento-agenda-transactional-finalization`
  commitado (`49c4076f`) - **atendida**.
- Dependencia 2: `backend/venv` disponivel; nao existe `python` no PATH.
- Bloqueio externo 1: `test_migration_ci_cycle.py` falha antes de chegar a
  qualquer migration deste modulo porque
  `backend/migrations/versions/20260730_58_portal_partner_auth.py:22` define
  `upgrade(connection)` e o runner chama `upgrade(connection, dialect_name)`
  (`backend/migrations/runner.py:150`). Pertence ao pacote Portal. Este pacote
  nao cria migration, portanto nao amplia o bloqueio, mas ele continua
  impedindo o ciclo real de migrations em CI.
- Bloqueio externo 2: a `20260730_59` aborta a esteira inteira quando ha
  duplicidade preexistente (`_assert_no_duplicates` levanta `RuntimeError` antes
  de criar os indices unicos parciais). Exige conciliacao de dados em stage e
  producao antes do deploy.

## 5) Checklist para iniciar execucao

- [x] `intent.md` aprovado.
- [x] `spec.md` aprovado.
- [x] Fases e rollback revisados.
- [x] Ambiente de teste definido: SQLite isolado por teste em `backend/venv`.
