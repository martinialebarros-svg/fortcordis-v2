# Especificacao

## Requisitos funcionais
- RF-01: para `laudo_pdf_jobs`, deve existir no maximo 1 job ativo por `(laudo_id, requested_by_id, cache_key)`.
- RF-02: para `xml_import_jobs`, deve existir no maximo 1 job ativo por `(requested_by_id, conteudo_hash)`.
- RF-03: criacao concorrente deve retornar job existente em vez de gerar duplicado.
- RF-04: migration deve marcar duplicados ativos legados como `failed` antes da aplicacao dos indices.

## Requisitos nao funcionais
- RNF-01: operacao deve ser idempotente em SQLite e Postgres.
- RNF-02: manter compatibilidade do payload publico dos endpoints de job.
