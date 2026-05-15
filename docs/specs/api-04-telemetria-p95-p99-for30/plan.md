# Plan - api-04-telemetria-p95-p99-for30

Data: 2026-05-15  
Responsavel: Codex  
Status: done

## Fases

1. Evoluir `runtime_observability` com coleta de latência por endpoint prioritário.
2. Integrar captura no middleware HTTP central do backend.
3. Expor telemetria no runtime report/health.
4. Cobrir com testes unitários de percentis, filtro de endpoints e janela temporal.
5. Registrar evidências no verify.

## Checklist

- [x] Configurações adicionadas para janela, amostragem e endpoints prioritários.
- [x] Coleta de latência integrada ao middleware HTTP.
- [x] Cálculo de p95/p99 por endpoint implementado.
- [x] Runtime report atualizado com `http_latency_monitor`.
- [x] Testes automatizados executados com sucesso.
