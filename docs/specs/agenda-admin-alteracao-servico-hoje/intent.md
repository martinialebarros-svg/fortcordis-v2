# Intenção

## Problema

Ao trocar o serviço de um agendamento, o sistema recalcula a duração e revalida o registro como uma remarcação. Em atendimentos já iniciados, isso pode bloquear uma correção administrativa legítima por conflito de horário. A trava original verificava apenas se a data do agendamento era hoje, o que bloqueava também correções feitas por perfis com permissão de editar (ex.: secretária) antes de o atendimento sequer começar — impedindo, por exemplo, a correção de um serviço registrado errado (ecocardiograma em vez de eletrocardiograma) em um agendamento futuro do próprio dia.

## Resultado esperado

Perfis com permissão geral de editar agendamento podem trocar o serviço livremente enquanto o atendimento ainda não começou. Uma vez que o atendimento já tenha iniciado, somente administradores podem confirmar explicitamente a troca do serviço. A API continua sendo a fonte de autorização e preserva o intervalo original quando o atendimento já começou, mantendo as validações operacionais para horários futuros.

A cobertura automatizada deve representar um agendamento iniciado do dia corrente também nas duas primeiras horas após a meia-noite, sem transformar acidentalmente a massa em um registro de ontem.

## Fora de escopo

- Liberar a troca de serviço de um atendimento já iniciado para perfis não administradores.
- Ignorar conflitos de slot ou deslocamento em atendimentos ainda não iniciados.
- Alterar automaticamente ordens de serviço ou registros clínicos já finalizados.
