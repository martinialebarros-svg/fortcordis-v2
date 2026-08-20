# Intent - agenda-reserva-expirada-reabilitacao

## Problema

Fluxo real relatado pelo usuário:

1. Um horário é reservado para uma clínica (status `Reservado`, com prazo de
   confirmação em `reserva_expira_em`).
2. O prazo vence sem os dados do paciente/tutor e o worker de expiração
   (`_expirar_reservas_vencidas`) move o agendamento para `Expirado`.
3. **Depois** do vencimento a clínica volta a querer aquele mesmo horário.
4. O horário continua livre (ninguém ocupou o slot), então a reserva
   deveria poder voltar a valer — por mais um período, até a clínica
   finalmente enviar os dados do paciente.

O que existia antes desta feature cobria só o passo "a clínica confirmou
tarde e já mandou os dados": `_exigir_confirmacao_reativacao_reserva_expirada`
permite `Expirado → Agendado` (com confirmação), e o próprio frontend
bloqueia esse caminho quando `paciente_id`/`tutor_id` estão vazios
("Antes de confirmar tardiamente, abra a reserva e preencha os dados do
tutor e do pet"). Qualquer outra transição a partir de `Expirado` era
recusada com 409 ("altere primeiro o status para Agendado").

Ou seja: para o caso em que a clínica quer o horário mas **ainda não tem**
os dados do paciente, não havia saída — nem reabilitar a reserva, nem
agendar. A recepção precisava criar um agendamento novo por cima do
slot expirado (o que exige confirmar o aviso `CONFIRMACAO_SLOT_RESERVA_EXPIRADA`)
ou preencher dados que ainda não existem.

## Escopo desta implementação

- Botão **"Reabilitar reserva"**, visível apenas em agendamentos com status
  `Expirado`, nas duas telas de agenda (lista em `/agenda` e painel do
  agendamento selecionado em `/agenda/fullcalendar`).
- Modal que pergunta o novo prazo em horas (padrão 3h, o mesmo padrão da
  reserva original) e mostra o "confirmar até" resultante antes de salvar.
- Endpoint dedicado `POST /agenda/{id}/reabilitar-reserva`, que devolve o
  agendamento para `Reservado` com um novo `reserva_expira_em` — sem exigir
  paciente/tutor, porque a reserva existe exatamente para o intervalo em que
  esses dados ainda não chegaram.
- Antes de reservar de novo, o endpoint reaplica as mesmas validações de
  disponibilidade usadas na criação/edição: slot livre (sem sobreposição com
  status que bloqueiam o horário), bloqueios administrativos, janela de
  funcionamento e folga de deslocamento entre atendimentos.

## Decisões

- **Endpoint próprio em vez de `PATCH /status`**: a reabilitação carrega um
  dado que o `PATCH /{id}/status` não tem como transportar (o novo prazo) e
  precisa de uma auditoria distinta (`AGENDAMENTO_RESERVA_REABILITADA`).
  O guard de `Expirado → *` continua valendo para os outros caminhos; só a
  mensagem passou a citar o botão novo.
- **Prazo encurtado em vez de erro**: se o período pedido passar do horário
  reservado (ex.: pedir 3h para um atendimento que começa em 1h), o prazo é
  encurtado para 5 minutos antes do início em vez de recusar a operação —
  `_validar_prazo_reserva` já exige prazo anterior ao atendimento, e recusar
  seria pior para quem só quer segurar o horário. A resposta sinaliza
  `prazo_encurtado: true` e o modal antecipa isso no preview.
- **Sem exigir revisão de WhatsApp para a própria reserva**: a confirmação
  `CONFIRMACAO_SLOT_RESERVA_EXPIRADA` (revisar mensagens antes de reutilizar
  um slot que teve reserva expirada) continua valendo para reservas
  expiradas **de outros** agendamentos sobrepostos, não para a que está
  sendo reabilitada — é o mesmo cliente pedindo o mesmo horário, e a
  reabilitação é justamente a resposta ao "a clínica voltou a querer".
- **Reserva só sai de `Expirado`**: reabilitar uma reserva ainda válida
  (status `Reservado`) não passa por aqui — para prorrogar antes do
  vencimento já dá para editar `reserva_expira_em` no modal do agendamento.

## Riscos

- Um horário muito próximo (menos de 5 minutos até o início) não tem prazo
  possível; nesse caso o endpoint responde 409 e o modal desabilita o botão
  com a orientação de agendar direto ou escolher outro horário.
- A reabilitação devolve o slot para a clínica que reservou primeiro. Quando
  há outra reserva expirada sobreposta (outra clínica no mesmo horário), o
  usuário precisa confirmar o aviso de revisão do WhatsApp — o mesmo
  comportamento já usado ao reaproveitar slots com reserva expirada.
- O aviso do novo prazo para a clínica continua manual (WhatsApp pelo modal
  do agendamento); esta feature não dispara mensagem automática.
