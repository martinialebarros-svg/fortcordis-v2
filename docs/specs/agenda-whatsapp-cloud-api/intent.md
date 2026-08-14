# Intent - agenda-whatsapp-cloud-api

Data: 2026-08-14
Responsavel: Martiniano + Codex
Status: approved

## Problema

A reserva da Agenda ja produz uma mensagem manual, mas a equipe precisa enviar o modelo aprovado
`reserva_de_agendamento` pelo numero oficial da Fort Cordis e transformar os botoes `Confirmar` e
`Solicitar alteracao` em acoes rastreaveis no proprio FortCordis.

No primeiro teste real, a Meta entregou o envio com o nono digito brasileiro e devolveu o clique
sem esse digito. As duas representacoes da mesma linha foram separadas em conversas diferentes e
o callback foi rejeitado pela comparacao textual do remetente.

## Resultado esperado

- envio explicito, iniciado pela secretaria depois de salvar a reserva;
- vinculo nao adivinhavel entre os botoes da Meta e um unico agendamento;
- confirmacao idempotente antes do prazo;
- alerta interno, sem mudanca automatica de horario, para pedido de alteracao;
- confirmacao tardia ou cadastro incompleto encaminhados para revisao humana;
- alternativa manual preservada caso a Meta ou o servico esteja indisponivel.
- equivalencia restrita do nono digito brasileiro, sem relaxar a rejeicao de remetentes distintos;
- uma unica identidade interna de conversa para as duas representacoes devolvidas pela Meta.
