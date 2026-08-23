# Plan - agenda-excecao-deslocamento-persistente

Data: 2026-08-23
Status: passos 1-6 concluidos; passo 7 (validacao em stage) pendente

## Passo 1 - Modelo e migracao

- `backend/app/models/agendamento.py`: cinco colunas `excecao_deslocamento_*`.
- `backend/migrations/versions/20260823_75_agendamento_excecao_deslocamento.py`:
  `ADD COLUMN` idempotente para PostgreSQL e SQLite.
- `_ensure_agendamento_workflow_columns`: colunas incluidas na rede de
  seguranca de runtime.

## Passo 2 - Helpers de excecao

Em `backend/app/api/v1/endpoints/agenda.py`, antes de
`_validar_deslocamento_agendamento`:

- `_fingerprint_escopo_deslocamento`, `_excecao_deslocamento_ativa`,
  `_conceder_excecao_deslocamento`, `_limpar_excecao_deslocamento`,
  `_descartar_excecao_deslocamento_obsoleta`,
  `_registrar_auditoria_excecao_deslocamento`.

## Passo 3 - Validacao de deslocamento

- Passa a considerar excecao persistida junto com a confirmacao da requisicao.
- Retorna qual origem liberou o bloqueio e em que ponto (5 pontos de bloqueio),
  para o chamador decidir entre persistir a concessao ou registrar o reuso.

## Passo 4 - Endpoints

- `POST /agenda` e `PUT /agenda/{id}`: capturam o retorno da validacao,
  persistem a concessao quando veio de confirmacao admin (motivo:
  `motivo_excecao_deslocamento`, com fallback para
  `motivo_excecao_operacional`) e registram auditoria apos o commit. Na edicao,
  concessao obsoleta e descartada.
- `PATCH /agenda/{id}/status`: novos parametros
  `confirmar_conflito_deslocamento` e `motivo_excecao_deslocamento`, gate de
  admin (403), repasse para a validacao, persistencia e auditoria. Resposta
  passa a devolver `excecao_deslocamento_ativa`.
- `POST /agenda/{id}/reabilitar-reserva`: payload ganha
  `motivo_excecao_deslocamento`; persistencia e auditoria no mesmo padrao.

## Passo 5 - Schemas e serializacao

- `motivo_excecao_deslocamento` em create/update (e excluido do `model_dump`
  que monta o registro).
- `AgendamentoResponse` e `_serialize_agendamento` expoem o estado da excecao.

## Passo 6 - Frontend e testes

- Tratamento do 409 `CONFLITO_DESLOCAMENTO` nas quatro handlers de agenda
  (`page.tsx` e `fullcalendar/page.tsx`, troca de status e reabilitacao), com
  laco de ate 3 tentativas e confirmacao restrita a admin.
- `backend/tests/test_agenda_excecao_deslocamento_persistente.py`: 9 casos
  cobrindo validacao isolada, `PATCH /status` e `reabilitar-reserva`.

## Passo 7 - Entrega

- PR com base `stage` (fluxo stage-first do projeto).
- Validar em stage o cenario reportado antes de promover para `main`.
