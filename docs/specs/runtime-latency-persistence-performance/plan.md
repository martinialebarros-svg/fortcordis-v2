# Plano — PERF-17: telemetria persistente de latência

1. Medir no escopo da requisição o tempo HTTP total, o tempo acumulado de SQL e
   a espera pelo pool, somente para os prefixos priorizados.
2. Persistir amostras em tabela própria, com release, código HTTP e retenção
   configurável de 14 dias. Falhas de escrita devem ser isoladas da requisição.
3. Expor agregação administrativa por endpoint/release para 1 hora a 7 dias,
   incluindo p50/p95/p99 e as métricas de banco/pool.
4. Exibir o resumo a administradores na configuração do sistema.
5. Validar migração idempotente, autorização, privacidade, build/testes e os
   fluxos de stage antes de qualquer promoção.
