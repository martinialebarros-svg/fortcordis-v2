# Verificação — PERF-17: telemetria persistente de latência

## Automatizada

- [x] Amostras priorizadas calculam p50/p95/p99 e preservam o monitor em memória.
- [x] Instrumentação de SQL/pool é acumulada somente dentro de uma requisição monitorada.
- [x] Migração cria a tabela e índices de forma idempotente em SQLite.
- [x] Persistência e limpeza respeitam a retenção e não propagam falhas ao request, inclusive no primeiro ciclo após reinício.
- [x] Endpoint administrativo exige `admin` e não devolve campos sensíveis.
- [x] Frontend compila e mostra estados de carregamento, vazio e erro.
- [x] O bloco SSH do workflow de produção é sintaticamente válido e preserva o
  status de saída do script de deploy.

## Stage e produção

- [x] A migração foi aplicada e a API de administração responde autenticada em stage.
- [x] Há amostras para ao menos uma rota prioritária e o release corresponde ao deploy.
- [x] Smoke de rotas públicas e protegidas passou em stage.
- [x] A promoção para produção usou o mesmo commit validado em stage.
- [x] Smoke equivalente em produção passou após a promoção (release `4f94683`, 2026-09-06).
