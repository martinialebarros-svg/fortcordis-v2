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

## Critérios de aceitação

- CA-001: `obterProximosStatus("Reservado")` retorna `["Agendado",
  "Confirmado", "Cancelado"]`, nessa ordem.
- CA-002: os botões renderizados por `obterAcoesStatusPorFluxo("Reservado")`
  têm "Agendado" antes de "Confirmado".
- CA-003: enviar a reserva com sucesso dispara uma segunda chamada de
  API para o modelo `appointmentMissingData` com o mesmo destinatário.
- CA-004: falha no envio do aviso de dados pendentes não desfaz nem
  marca como erro o envio da reserva (que já tinha sucesso confirmado).
