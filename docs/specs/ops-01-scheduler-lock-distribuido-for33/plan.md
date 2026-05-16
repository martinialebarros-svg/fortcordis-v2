# Plano

1. Adicionar configuracoes de lock distribuido do scheduler.
2. Implementar aquisicao/liberacao de advisory lock no Postgres.
3. Alterar loop de processamento para buscar e travar 1 linha por iteracao usando `FOR UPDATE SKIP LOCKED`.
4. Manter fallback seguro para ambientes nao-Postgres.
5. Cobrir comportamento com testes unitarios.
