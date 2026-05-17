# Especificacao

## Requisitos funcionais
- RF-01: remover `webhook_events` com `received_at` anterior a `retention_days`.
- RF-02: executar cleanup automatico em intervalos configuraveis.
- RF-03: registrar cada run em `webhook_event_cleanup_runs` com status, duracao e linhas removidas.
- RF-04: expor estado runtime do cleanup no endpoint `/health`.

## Requisitos nao funcionais
- RNF-01: configuracao deve ter defaults seguros e limites min/max.
- RNF-02: rotina deve evitar execucoes concorrentes locais (single-process lock).
