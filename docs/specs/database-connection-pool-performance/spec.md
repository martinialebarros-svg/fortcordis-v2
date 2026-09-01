# Especificacao - PERF-14: pool de conexoes resiliente

## Escopo

Configurar o engine SQLAlchemy principal do backend para PostgreSQL com pool
finito, `pool_pre_ping`, reciclagem e timeouts de pool e conexao.

## Requisitos

- RF-001: PostgreSQL deve usar `pool_size=5` e `max_overflow=5` por processo,
  configuraveis por ambiente.
- RF-002: conexoes reutilizadas devem passar por `pool_pre_ping` por padrao.
- RF-003: a espera por conexao do pool deve terminar em 15 segundos por padrao.
- RF-004: o handshake de conexao deve terminar em 10 segundos por padrao.
- RF-005: conexoes devem ser recicladas apos 1800 segundos por padrao.
- RF-006: SQLite deve manter somente `check_same_thread=False`, sem opcoes de
  pool PostgreSQL.
- RF-007: valores invalidos de capacidade e timeout devem ser rejeitados na
  configuracao.

## Fora de escopo

- Alterar topologia de workers (PERF-15).
- HTTP/2 (PERF-16).
- Persistir p50/p95/p99, tempo de banco ou espera de pool (PERF-17).
