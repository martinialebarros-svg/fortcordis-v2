# Especificacao

## Requisitos funcionais
- RF-01: chaves sensiveis (`authorization`, `token`, `secret`, `signature`, `payload`, etc.) devem ser registradas como `[REDACTED]`.
- RF-02: strings longas e estruturas profundas devem ser truncadas para evitar dumps acidentais.
- RF-03: auditoria de `contact_update` deve persistir apenas identificadores essenciais.

## Requisitos nao funcionais
- RNF-01: sanitizacao deve ser aplicada em todos os niveis de log (`info/warn/error/debug`) via logger unico.
- RNF-02: comportamento deve ser deterministico e testavel em script automatizado.
