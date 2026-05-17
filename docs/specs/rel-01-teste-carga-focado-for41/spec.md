# Especificacao

## Requisitos funcionais
- RF-01: executar bursts concorrentes de requisições GET para endpoints críticos configuráveis.
- RF-02: calcular por endpoint `error_rate`, `avg`, `p50`, `p95`, `p99`.
- RF-03: falhar execução quando ultrapassar `max_error_rate` ou `max_p95_ms`.
- RF-04: exportar resultado consolidado em JSON para comparação de baseline.

## Requisitos não funcionais
- RNF-01: sem dependências externas obrigatórias para execução básica (stdlib Python).
- RNF-02: comportamento determinístico das funções de percentil usadas no relatório.
