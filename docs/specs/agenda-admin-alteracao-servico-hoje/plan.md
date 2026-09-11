# Plano

1. Acrescentar ao contrato de edição uma confirmação específica para troca de serviço em atendimento já iniciado.
2. Validar no backend o papel `admin` e rejeitar chamadas sem confirmação, apenas quando o atendimento já começou.
3. Preservar início e fim quando o atendimento já tiver iniciado e o horário não estiver sendo remarcado.
4. Solicitar confirmação humana no modal antes de enviar a alteração, apenas quando o atendimento já começou.
5. Registrar a decisão na auditoria.
6. Cobrir confirmação ausente, perfil não-admin em atendimento já iniciado, troca confirmada com preservação do intervalo, e perfil não-admin trocando serviço de agendamento de hoje ainda não iniciado.
7. Validar lint, TypeScript, build, testes de backend e guardrail SDD antes da publicação.
8. Fixar a massa do teste no início do dia corrente quando `agora - 2 horas` atravessar a meia-noite.
9. Trocar o gatilho da restrição de "data do agendamento é hoje" para "horário de início já passou", liberando a secretária (e outros perfis com permissão de editar) para corrigir o serviço de agendamentos futuros do próprio dia.
