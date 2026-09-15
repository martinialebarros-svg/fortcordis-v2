# Spec - agenda-excecao-deslocamento-persistente

Data: 2026-08-23
Responsavel: Martiniano + Claude
Status: implementado (aguardando validacao em stage)

## 1) Escopo funcional

Persistir no agendamento a excecao de conflito de rota concedida por admin,
para que reabilitacao de reserva e troca de status posteriores respeitem a
concessao, invalidando-a quando a rota aprovada mudar.

## 2) Requisitos funcionais (RF)

- RF-001: quando um admin confirma o conflito de deslocamento
  (`confirmar_conflito_deslocamento=true`) e um bloqueio de rota e de fato
  ignorado, a concessao e persistida no agendamento (quem, quando, motivo e a
  assinatura da rota aprovada).
- RF-002: enquanto a excecao persistida for valida, `_validar_deslocamento_agendamento`
  nao bloqueia aquele agendamento, sem exigir nova confirmacao — inclusive em
  `POST /agenda/{id}/reabilitar-reserva` e `PATCH /agenda/{id}/status`.
- RF-003: a excecao e considerada invalida (validacao volta a bloquear) quando
  `inicio`, `fim`, `clinica_id`, `servico_id` ou `origem_atendimento` mudarem em
  relacao ao momento da concessao. Em atendimento domiciliar, `paciente_id` e
  `tutor_id` tambem contam, porque definem o endereco de destino; em clinica
  parceira eles ficam fora, para que o preenchimento tardio dos dados do
  pet/tutor (fluxo normal da reserva) nao derrube a excecao.
- RF-004: `PATCH /agenda/{agendamento_id}/status` aceita
  `confirmar_conflito_deslocamento` e `motivo_excecao_deslocamento`.
- RF-005: apenas admin pode confirmar conflito de deslocamento em qualquer
  endpoint (403 para os demais perfis), mantendo o gate ja existente.
- RF-006: conceder e reaplicar a excecao geram eventos de auditoria distintos
  (`AGENDA_EXCECAO_DESLOCAMENTO_CONCEDIDA` e `AGENDA_EXCECAO_DESLOCAMENTO_APLICADA`)
  com o bloqueio ignorado, o motivo e o contexto do agendamento.
- RF-007: ao editar o agendamento, uma concessao que nao corresponde mais a
  rota atual e apagada do registro (nao fica lixo apontando para rota antiga).
- RF-008: a serializacao do agendamento expoe `excecao_deslocamento_ativa`,
  `excecao_deslocamento_concedida_em`, `..._concedida_por_nome` e `..._motivo`.
- RF-009: no frontend, um 409 `CONFLITO_DESLOCAMENTO` na troca de status ou na
  reabilitacao de reserva abre confirmacao para admin e, se confirmada,
  reenvia a acao com a excecao; para nao-admin a mensagem do backend continua
  sendo exibida como erro.

## 3) Requisitos nao funcionais (NFR)

- NFR-001 (seguranca): o gate de admin fica no backend em todos os endpoints;
  o `isAdmin` do frontend apenas evita oferecer a confirmacao a quem nao pode.
- NFR-002 (auditabilidade): nenhuma aplicacao de excecao antiga e silenciosa —
  todo reuso gera evento de auditoria.
- NFR-003 (compatibilidade): colunas novas sao nullable; agendamentos antigos
  seguem sem excecao e com o comportamento anterior.
- NFR-004 (resiliencia de schema): as colunas entram tambem em
  `_ensure_agendamento_workflow_columns`, rede de seguranca ja usada pelo
  modulo para ambientes com schema atrasado.

## 4) Contratos tecnicos

### Banco

Tabela `agendamentos`, migracao `20260823_75_agendamento_excecao_deslocamento`:

| coluna | tipo | uso |
| --- | --- | --- |
| `excecao_deslocamento_concedida_em` | TIMESTAMP NULL | quando foi concedida |
| `excecao_deslocamento_concedida_por_id` | INTEGER NULL | usuario que concedeu |
| `excecao_deslocamento_concedida_por_nome` | VARCHAR(255) NULL | nome para exibicao/trilha |
| `excecao_deslocamento_motivo` | TEXT NULL | motivo informado (ou padrao) |
| `excecao_deslocamento_escopo` | VARCHAR(64) NULL | sha256 da rota aprovada |

### Backend (`backend/app/api/v1/endpoints/agenda.py`)

- `_fingerprint_escopo_deslocamento(agendamento)`: sha256 de
  `inicio|fim|clinica_id|servico_id|origem_atendimento` (datas normalizadas para
  hora local sem tz, precisao de minutos), acrescido de `paciente_id|tutor_id`
  somente quando a origem e `domiciliar`.
- `_excecao_deslocamento_ativa(agendamento)`: concedida e com escopo igual ao
  atual.
- `_conceder_excecao_deslocamento(agendamento, current_user, motivo)`.
- `_limpar_excecao_deslocamento` / `_descartar_excecao_deslocamento_obsoleta`.
- `_validar_deslocamento_agendamento(...) -> Optional[dict]`: retorna `None`
  quando nao havia bloqueio a ignorar; caso contrario
  `{"origem": "confirmacao_admin" | "excecao_persistida", "bloqueio": <ponto>}`,
  onde `<ponto>` e um de `limite_trecho_anterior`, `folga_anterior`,
  `limite_trecho_proximo`, `folga_proximo`, `desvio_insercao`.
- `_registrar_auditoria_excecao_deslocamento(...)`: chamada apos o commit em
  cada endpoint que ignorou um bloqueio.

Endpoints afetados: `POST /agenda`, `PUT /agenda/{id}`,
`PATCH /agenda/{id}/status`, `POST /agenda/{id}/reabilitar-reserva`.

### Schemas (`backend/app/schemas/agendamento.py`)

- `AgendamentoBase` e `AgendamentoUpdate`: `motivo_excecao_deslocamento`.
- `AgendamentoResponse`: `excecao_deslocamento_ativa` (bool) e os tres campos
  informativos da concessao.
- `ReabilitarReservaPayload`: `motivo_excecao_deslocamento`.

### Frontend

- `frontend/app/agenda/page.tsx`: `atualizarStatus` e
  `confirmarReabilitacaoReserva`.
- `frontend/app/agenda/fullcalendar/page.tsx`: `atualizarStatusAgendamento` e
  `confirmarReabilitacaoReserva`.
- Padrao: laco de ate 3 tentativas, porque uma reativacao tardia pode exigir
  duas confirmacoes em sequencia (reserva expirada e conflito de rota).

## 5) Compatibilidade e rollout

- Deploy combinado backend + frontend; a migracao roda no CI de migracao.
- Rollback: reverter o commit. As colunas ficam no banco sem uso (nullable),
  e o codigo antigo volta a ignorar a excecao persistida.

## 6) Criterios de aceitacao (CA)

- CA-001: agendamento com conflito de rota e sem excecao continua bloqueado com
  409 `CONFLITO_DESLOCAMENTO` na criacao, edicao, troca de status e reabilitacao.
- CA-002: admin confirmando o conflito na troca de status conclui a acao e as
  colunas `excecao_deslocamento_*` ficam preenchidas.
- CA-003: com excecao persistida valida, reabilitar a reserva e trocar o status
  passam sem nova confirmacao — inclusive para usuario nao-admin.
- CA-004: nao-admin enviando `confirmar_conflito_deslocamento=true` em
  `PATCH /agenda/{id}/status` recebe 403.
- CA-005: mudar horario ou clinica invalida a excecao e a validacao bloqueia de
  novo; voltar ao horario aprovado revalida a excecao original.
- CA-006: cada concessao e cada reuso aparecem em `auditoria_eventos` com acao
  propria.
- CA-007: no frontend, admin que recebe o 409 de rota ve a confirmacao e, ao
  aceitar, a acao e reenviada com a excecao; nao-admin ve a mensagem de erro.

## 7) Casos de borda

- CB-001: agendamento `Cancelado` nao valida deslocamento (comportamento
  anterior preservado, retorno `None`).
- CB-002: destino sem geolocalizacao confiavel continua liberando sem excecao.
- CB-003: motivo vazio na concessao usa o texto padrao
  ("Excecao de conflito de rota confirmada por admin.").
- CB-004: excecao persistida existente cujo escopo nao corresponde mais a rota
  atual e tratada como inexistente e descartada na proxima edicao.
- CB-005: conflito causado por um **vizinho novo** na mesma rota aprovada
  continua sendo liberado pela excecao (limitacao aceita e registrada em
  auditoria a cada reuso).
- CB-006: reserva de clinica parceira que recebe `paciente_id`/`tutor_id` depois
  da concessao mantem a excecao (o destino da rota nao mudou).

## 8) Fora de escopo

- UI para revogar a excecao concedida.
- Expiracao temporal da excecao.
- Badge visual da excecao na agenda (os campos ja sao expostos na API para uso
  futuro).
