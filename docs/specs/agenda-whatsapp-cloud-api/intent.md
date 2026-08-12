# Intent - agenda-whatsapp-cloud-api

Data: 2026-08-11
Responsavel: Martiniano + Codex
Status: approved

## Problema

A reserva da Agenda ja produz uma mensagem manual, mas a equipe precisa enviar o modelo aprovado
`reserva_de_agendamento` pelo numero oficial da Fort Cordis e transformar os botoes `Confirmar` e
`Solicitar alteracao` em acoes rastreaveis no proprio FortCordis.

## Resultado esperado

- envio explicito, iniciado pela secretaria depois de salvar a reserva;
- vinculo nao adivinhavel entre os botoes da Meta e um unico agendamento;
- confirmacao idempotente antes do prazo;
- alerta interno, sem mudanca automatica de horario, para pedido de alteracao;
- confirmacao tardia ou cadastro incompleto encaminhados para revisao humana;
- alternativa manual preservada caso a Meta ou o servico esteja indisponivel.
