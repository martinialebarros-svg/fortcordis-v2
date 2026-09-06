# Especificação — PERF-18: gate autenticado de latência

## Requisitos funcionais

- RF-001: o canário deve executar cinco `GET /api/v1/agenda` autenticados por
  padrão, em série e por loopback.
- RF-002: cada amostra deve retornar HTTP 200 e `items` como lista; 401, 403,
  timeout ou JSON inválido falham o canário.
- RF-003: o p95 é calculado apenas com todas as amostras válidas; p95 acima de
  1200 ms falha o deploy por padrão.
- RF-004: o deploy passa limite, quantidade e hash curto do release ao canário.
- RF-005: falha retorna código não zero para que o rollback já existente atue.

## Requisitos não funcionais

- RNF-001: no máximo cinco leituras extras, sem mutação ou concorrência.
- RNF-002: logs contêm somente hash curto, contagem, p50, p95 e limite.
- RNF-003: nenhum segredo, payload, URL com parâmetros ou dado clínico pode
  ser impresso ou persistido pelo canário.

## Aceitação

- CA-001: 401 e 403 são rejeitados explicitamente.
- CA-002: amostra ausente ou contrato inválido reprova.
- CA-003: p95 acima de 1200 ms reprova.
- CA-004: parâmetros chegam ao processo canário pelo deploy.
