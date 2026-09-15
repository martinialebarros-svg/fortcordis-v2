# Plano — PERF-18: gate autenticado de latência

## Sequência

1. Adicionar medição de cinco leituras autenticadas e cálculo local de p50/p95.
2. Rejeitar status diferente de 200, contrato inválido, timeout e p95 acima do
   limite configurado.
3. Passar quantidade, limite e hash curto do release pelo script de deploy.
4. Cobrir regras de decisão com testes unitários e validar sintaxe/guardrail.
5. Publicar primeiro em stage; só promover o snapshot exato após canário e
   smoke autenticado aprovados.

## Parâmetros iniciais

- `AUTH_CANARY_AGENDA_LATENCY_SAMPLES=5`
- `AUTH_CANARY_AGENDA_MAX_P95_MS=1200`

Os valores podem ser endurecidos somente por alteração explícita do deploy;
não há retry automático nem mascaramento de falha.
