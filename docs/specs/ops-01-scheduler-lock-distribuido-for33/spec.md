# Especificacao

## Requisitos funcionais
- RF-01: `run_push_scheduler_due_once` deve tentar adquirir lock distribuido quando `WEB_PUSH_SCHEDULER_DISTRIBUTED_LOCK_ENABLED=true` e banco for Postgres.
- RF-02: se o lock distribuido estiver ocupado, o ciclo deve encerrar sem processar itens.
- RF-03: o consumo de pendentes deve usar `SKIP LOCKED` no Postgres para evitar que duas instancias travem a mesma linha.
- RF-04: o processamento deve ocorrer item a item, com commit por item, para reduzir janela de lock e evitar perda de progresso.

## Requisitos nao funcionais
- RNF-01: nao quebrar ambientes SQLite/dev.
- RNF-02: manter contrato de retorno do scheduler (`processed/sent/cancelled/errors`).
