# Spec - agenda-reserva-expirada-reabilitacao

## Contrato técnico

`POST /api/v1/agenda/{agendamento_id}/reabilitar-reserva`

Corpo (`ReabilitarReservaPayload`, todos opcionais):

| Campo | Tipo | Padrão | Observação |
|---|---|---|---|
| `prazo_confirmacao_horas` | float (0.5 a 72) | 3 | horas contadas de agora |
| `reserva_expira_em` | datetime | — | prazo exato; ignora `prazo_confirmacao_horas` |
| `confirmar_slot_reserva_expirada` | bool | false | confirma revisão do WhatsApp quando há outra reserva expirada sobreposta |
| `confirmar_conflito_deslocamento` | bool | false | exceção de conflito operacional (somente admin) |

Resposta 200: o agendamento serializado (`_serialize_agendamento`) mais
`mensagem` (texto pronto para o usuário, com o novo prazo) e
`prazo_encurtado` (bool).

## Requisitos funcionais

- RF-001: o endpoint só aceita agendamentos com status `Expirado`. Qualquer
  outro status responde `409` com "Somente reservas expiradas podem ser
  reabilitadas (status atual: ...)".
- RF-002: `_expirar_reservas_vencidas` roda no início do endpoint, então uma
  reserva cujo prazo acabou de vencer (status ainda `Reservado` no banco)
  também é reabilitável, sem depender de refresh da tela.
- RF-003: em caso de sucesso o agendamento fica `status = "Reservado"` e
  `reserva_expira_em` = novo prazo, sem exigir `paciente_id`/`tutor_id`
  (`_validar_paciente_tutor_para_status` já dispensa o status `Reservado`).
- RF-004: sem `prazo_confirmacao_horas` nem `reserva_expira_em`, o prazo é
  `agora + 3h` (`PRAZO_REABILITACAO_RESERVA_HORAS_PADRAO`), truncado no
  minuto.
- RF-005: quando o prazo calculado por horas cai depois de
  `inicio - 5 min` (`MARGEM_MINIMA_PRAZO_RESERVA_MIN`), ele é encurtado para
  exatamente `inicio - 5 min` e a resposta traz `prazo_encurtado: true`.
- RF-006: quando `inicio - 5 min` já passou (horário colado ou vencido), o
  endpoint responde `409` orientando a agendar direto ou escolher outro
  horário — nenhuma alteração é persistida.
- RF-007: `reserva_expira_em` explícito não é encurtado; segue para
  `_validar_prazo_reserva`, que recusa (`422`) prazo no passado ou
  posterior/igual ao início do atendimento.
- RF-008: antes de persistir, o endpoint reaplica
  `_validar_regras_origem_agendamento`, `_validar_prazo_reserva`,
  `_validar_agendamento_no_funcionamento`, `_validar_slot_disponivel` e
  `_validar_deslocamento_agendamento`. Slot ocupado por status que bloqueia
  horário responde `409` ("Horario indisponivel: ja existe atendimento neste
  slot ...") e nada é gravado.
- RF-009: quando existe **outra** reserva expirada sobreposta ao slot, o
  endpoint responde `409` com `codigo =
  "CONFIRMACAO_SLOT_RESERVA_EXPIRADA"`; repetir a chamada com
  `confirmar_slot_reserva_expirada: true` conclui a reabilitação.
- RF-010: `confirmar_conflito_deslocamento: true` exige papel admin
  (`403` caso contrário), igual ao `PUT /agenda/{id}`.
- RF-011: a operação registra auditoria
  `AGENDAMENTO_RESERVA_REABILITADA` (com `prazo_anterior`, `prazo_novo`,
  `prazo_encurtado_para_caber_antes_do_atendimento`, ids de reservas
  expiradas revisadas) e emite evento realtime `status_changed`
  (`Expirado → Reservado`).
- RF-012: a mensagem do guard `_exigir_confirmacao_reativacao_reserva_expirada`
  passa a citar o botão "Reabilitar reserva" além do caminho antigo (mudar
  para `Agendado`).
- RF-013: `frontend/lib/agenda-reabilitar-reserva.ts` expõe
  `podeReabilitarReserva` (true só para `Expirado`),
  `normalizarPrazoReabilitacaoHoras` (aceita `0.5`–`72`, aceita vírgula
  decimal, devolve `null` fora da faixa/não numérico),
  `parseDataHoraAgenda` (lê `"YYYY-MM-DD HH:MM:SS"` e ISO com `T` como
  horário local) e `calcularPrazoReabilitacao` (espelha RF-004/RF-005/RF-006
  para o preview).
- RF-014: o botão "Reabilitar reserva" aparece somente em agendamentos
  `Expirado`, tanto no card da lista (`/agenda`) quanto no painel do
  agendamento selecionado (`/agenda/fullcalendar`).
- RF-015: o modal mostra o campo de horas (padrão 3, passo 0,5) e o
  "Confirmar até" resultante; sinaliza quando o prazo será encurtado e
  desabilita o botão de salvar quando as horas são inválidas ou o horário
  está próximo demais.
- RF-016: recebendo `409 CONFIRMACAO_SLOT_RESERVA_EXPIRADA`, o frontend abre
  a confirmação do Fortinho (revisar WhatsApp) e só então repete a chamada
  com `confirmar_slot_reserva_expirada: true`; cancelar aborta sem alterar
  nada.

## Critérios de aceitação

- CA-001: reserva expirada sem paciente/tutor, com
  `prazo_confirmacao_horas: 6`, volta para `Reservado` com prazo ~6h à
  frente e `prazo_encurtado: false`.
- CA-002: sem informar horas, o novo prazo fica ~3h à frente.
- CA-003: slot ocupado por um agendamento `Agendado` sobreposto → `409`
  "Horario indisponivel"; a reserva continua efetivamente expirada e sem
  prazo novo.
- CA-004: outra reserva expirada sobreposta → `409`
  `CONFIRMACAO_SLOT_RESERVA_EXPIRADA` listando o id da outra reserva;
  repetindo com `confirmar_slot_reserva_expirada: true` a reabilitação
  conclui.
- CA-005: agendamento com status `Agendado` → `409` "Somente reservas
  expiradas podem ser reabilitadas".
- CA-006: atendimento que começa em 1h com pedido de 3h → prazo =
  `inicio - 5 min` e `encurtado = true`.
- CA-007: atendimento que começa em 2 min → `409` com "proximo demais".
- CA-008: `reserva_expira_em` posterior ao início do atendimento → `422`
  "anterior ao horario reservado".
- CA-009: `podeReabilitarReserva` é `true` só para `Expirado`.
- CA-010: `normalizarPrazoReabilitacaoHoras` aceita `"3"`, `"0,5"` e `72`;
  rejeita `""`, `"abc"`, `0.25` e `73`.
- CA-011: `calcularPrazoReabilitacao(3, inicio)` devolve
  `encurtado: false` quando cabe, `encurtado: true` com prazo em
  `inicio - 5 min` quando não cabe, e `indisponivel: true` quando o início
  está a menos de 5 minutos.
- CA-012: `parseDataHoraAgenda` interpreta `"2099-05-25 11:00:00"` como
  horário local e devolve `null` para formatos não suportados.
