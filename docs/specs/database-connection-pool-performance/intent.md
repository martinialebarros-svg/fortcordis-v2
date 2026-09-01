# Intencao - PERF-14: pool de conexoes resiliente

## Problema

O backend criava o `Engine` SQLAlchemy sem limites explicitos de pool, teste de
conexao reutilizada, reciclagem ou timeouts de conexao. Um socket degradado ou
pressao no pooler PostgreSQL podia prolongar o carregamento de paginas ate o
timeout externo.

## Resultado esperado

Cada processo da API usa capacidade previsivel no PostgreSQL, valida conexoes
reutilizadas antes de empresta-las e falha em tempo limitado quando o banco ou
o pool estiverem indisponiveis. SQLite local continua compativel com testes.

## Restricoes

- Nenhuma credencial nem URL de banco e registrada no codigo ou nos testes.
- Os limites sao por processo: `5` conexoes persistentes e no maximo `5`
  temporarias.
- Esta entrega nao persiste metricas de espera do pool; isto pertence a PERF-17.
