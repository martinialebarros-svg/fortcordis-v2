# Intenção

## Problema

Ao trocar o serviço de um agendamento do dia atual, o sistema recalcula a duração e revalida o registro como uma remarcação. Em atendimentos já iniciados, isso pode bloquear uma correção administrativa legítima por conflito de horário.

## Resultado esperado

Administradores podem confirmar explicitamente a troca do serviço. A API continua sendo a fonte de autorização e preserva o intervalo original quando o atendimento já começou, mantendo as validações operacionais para horários futuros.

A cobertura automatizada deve representar um agendamento iniciado do dia corrente também nas duas primeiras horas após a meia-noite, sem transformar acidentalmente a massa em um registro de ontem.

## Fora de escopo

- Liberar a ação para perfis não administradores.
- Ignorar conflitos de slot ou deslocamento em atendimentos ainda não iniciados.
- Alterar automaticamente ordens de serviço ou registros clínicos já finalizados.
