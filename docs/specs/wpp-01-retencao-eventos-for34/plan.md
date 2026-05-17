# Plano

1. Criar estrutura de metricas (`webhook_event_cleanup_runs`) via migration SQL idempotente.
2. Implementar servico de cleanup com configuracao por ambiente.
3. Adicionar worker automatico no ciclo de vida da aplicacao.
4. Expor estado/ultima execucao no `/health`.
5. Atualizar documentacao operacional.
