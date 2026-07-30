# Plano

1. Acrescentar ao contrato de edição uma confirmação específica para troca de serviço em agendamento de hoje.
2. Validar no backend o papel `admin` e rejeitar chamadas sem confirmação.
3. Preservar início e fim quando o atendimento já tiver iniciado e o horário não estiver sendo remarcado.
4. Solicitar confirmação humana no modal antes de enviar a alteração.
5. Registrar a decisão na auditoria.
6. Cobrir confirmação ausente, perfil não-admin e troca confirmada com preservação do intervalo.
7. Validar lint, TypeScript, build, testes de backend e guardrail SDD antes da publicação.
