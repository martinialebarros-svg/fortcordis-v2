# Plano

1. Criar contrato de confirmação e metadados de escopo, com testes sintéticos.
2. Integrar POST/PUT, validação de slots e serialização; preservar status/reabilitação pela concessão persistida.
3. Adicionar coluna nullable e adaptar exclusão PostgreSQL, invalidando escopo reaproveitado por trigger. Usar runner Python existente do projeto; não gerar migração SQL paralela de Supabase.
4. Integrar confirmação no modal e testar autorização/cancelamento.
5. Executar testes focados, regressão de Agenda, lint/tipos/build e guardrail SDD; registrar limitações.

Rollback: reverter aplicação mantém bloqueio de novas sobreposições. Não remover coluna/trilha; recriar exclusão anterior apenas após resolver sobreposições autorizadas existentes. Falha transacional da migração preserva restrição anterior. Sem alterações remotas neste pedido.
