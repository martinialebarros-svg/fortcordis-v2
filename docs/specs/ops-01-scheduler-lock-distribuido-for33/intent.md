# FOR-33 OPS-01 Scheduler com lock distribuido/SKIP LOCKED

## Problema
Em ambiente com multiplas instancias da API, o worker de push agendado pode disputar os mesmos registros pendentes e causar processamento duplicado.

## Objetivo
Garantir consumo seguro de `push_scheduled_notifications` em cenarios multi-instancia usando lock distribuido no Postgres e selecao de linhas com `SKIP LOCKED`.

## Resultado esperado
- Cada ciclo de scheduler deve rodar em apenas uma instancia por vez (quando Postgres).
- Cada item pendente deve ser processado no maximo uma vez por ciclo, sem disputa entre workers.
