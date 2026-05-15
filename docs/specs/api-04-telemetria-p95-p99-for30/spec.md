# Spec - api-04-telemetria-p95-p99-for30

Data: 2026-05-15  
Responsavel: Codex  
Status: done

## Escopo

Implementar telemetria operacional de latência (p95/p99) por endpoint prioritário da API e disponibilizar a leitura no relatório de runtime.

## Requisitos funcionais

- RF-001: monitorar latência dos 5 endpoints prioritários.
- RF-002: calcular e retornar `avg_ms`, `p95_ms` e `p99_ms` por endpoint.
- RF-003: contabilizar volume de requisições e erros 5xx por endpoint monitorado.
- RF-004: integrar dados de latência no bloco de observabilidade do runtime report.

## Requisitos técnicos

- RT-001: registrar telemetria no middleware HTTP para respostas normais e exceções.
- RT-002: suportar configuração via settings:
  - `RUNTIME_HTTP_LATENCY_WINDOW_MINUTES`
  - `RUNTIME_HTTP_LATENCY_MAX_SAMPLES_PER_ENDPOINT`
  - `RUNTIME_HTTP_LATENCY_PRIORITY_ENDPOINTS`
- RT-003: aplicar janela temporal e limite de amostras por endpoint para evitar crescimento descontrolado de memória.
- RT-004: manter compatibilidade com monitor existente de 5xx.

## Critérios de aceitação

- CA-001: p95/p99 refletem as amostras registradas para endpoint monitorado.
- CA-002: rotas fora da lista prioritária não entram no monitor de latência.
- CA-003: amostras antigas são descartadas conforme janela configurada.
- CA-004: `build_runtime_report()` inclui `observability.http_latency_monitor`.
