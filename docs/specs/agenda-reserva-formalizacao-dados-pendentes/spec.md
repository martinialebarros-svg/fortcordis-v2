# Spec - agenda-reserva-formalizacao-dados-pendentes

## Requisitos funcionais

- RF-001: `PROXIMOS_STATUS.Reservado` em `frontend/lib/agenda-shared-actions.ts`
  lista `["Agendado", "Confirmado", "Cancelado"]` (antes:
  `["Confirmado", "Agendado", "Cancelado"]`) — "Agendado" aparece antes
  de "Confirmado" tanto na lista de status quanto nos botões renderizados
  a partir dela.
- RF-002: ao enviar a mensagem de reserva pelo botão "Enviar pelo
  FortCordis" (`modeloAgendaSelecionado === "reservation"`) com sucesso,
  o frontend dispara automaticamente uma segunda chamada a `POST
  /agenda/{agendamentoId}/whatsapp/modelo` com `template_key:
  "appointmentMissingData"`, mesmo `destination`/`recipient_type`, e uma
  `idempotency_key` própria (não reaproveita a da reserva).
- RF-003: se o envio da reserva falhar, o aviso de dados pendentes NÃO é
  disparado (só ocorre após sucesso confirmado da reserva).
- RF-004: se o aviso de dados pendentes falhar (mas a reserva já tiver
  sido enviada com sucesso), o feedback ao usuário reflete que a reserva
  foi enviada mas o aviso extra não, sem marcar a operação inteira como
  erro.
- RF-005: `build_reservation_template` (`whatsapp_agenda_service.py`)
  não exige mais `agendamento.paciente_id`/`tutor_id` preenchidos — usa
  o placeholder `"seu pet"` no lugar do nome do paciente quando ausente.
  Só exige que o **tutor** exista quando `recipient_type == "tutor"`
  (não há como enviar para um destinatário cuja identidade é
  desconhecida); para `recipient_type == "clinica"`, nem tutor nem
  paciente precisam existir.
- RF-006: `build_agenda_utility_template` aplica a mesma relaxação
  **somente** quando `template_key == "appointmentMissingData"`; os
  demais modelos (`appointmentReminder`, `appointmentChange`,
  `appointmentCancellation`) continuam exigindo paciente e tutor
  vinculados e consistentes entre si.
- RF-007: se `paciente_id`/`tutor_id` apontam para um registro que não
  existe (referência órfã) ou paciente/tutor vinculados são
  inconsistentes entre si (`paciente.tutor_id != tutor.id`), ainda é um
  erro `409` — a relaxação vale só para "ainda não vinculado" (`NULL`),
  nunca para dado corrompido.
- RF-008: o preview da mensagem no modal (`obterMensagemAgendaAtual`,
  usado por "Abrir WhatsApp"/"Copiar mensagem") usa o mesmo placeholder
  `"seu pet"` quando o modelo selecionado é `reservation` ou
  `appointmentMissingData` e não há paciente selecionado — para o texto
  mostrado ao usuário bater com o que será realmente enviado pelo envio
  automático.

## Critérios de aceitação

- CA-001: `obterProximosStatus("Reservado")` retorna `["Agendado",
  "Confirmado", "Cancelado"]`, nessa ordem.
- CA-002: os botões renderizados por `obterAcoesStatusPorFluxo("Reservado")`
  têm "Agendado" antes de "Confirmado".
- CA-003: enviar a reserva com sucesso dispara uma segunda chamada de
  API para o modelo `appointmentMissingData` com o mesmo destinatário.
- CA-004: falha no envio do aviso de dados pendentes não desfaz nem
  marca como erro o envio da reserva (que já tinha sucesso confirmado).
- CA-005: `build_reservation_template` com `recipient_type="clinica"` e
  `paciente_id`/`tutor_id` nulos retorna com sucesso, `pet_name = "seu
  pet"`.
- CA-006: `build_reservation_template` com `recipient_type="tutor"` e
  `tutor_id` nulo levanta `409`.
- CA-007: `build_agenda_utility_template` com `template_key =
  "appointmentMissingData"` e `paciente_id`/`tutor_id` nulos retorna com
  sucesso, `parameters[1] = "seu pet"`.
- CA-008: `build_agenda_utility_template` com qualquer outro
  `template_key` e `paciente_id`/`tutor_id` nulos continua levantando
  `409` (comportamento antigo preservado).
