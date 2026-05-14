# Spec - data-04-normalizacao-datas-criticas-for25

Data: 2026-05-14  
Responsavel: Codex  
Status: done

## Escopo

Normalizar `created_at/updated_at` legados de `pacientes` e `tutores` para fluxo datetime consistente no backend.

## Requisitos funcionais

- RF-001: migration deve garantir presença de `created_at` e `updated_at` em `pacientes` e `tutores`.
- RF-002: migration deve normalizar valores textuais legados e preencher `created_at` ausente.
- RF-003: backend deve gravar novos timestamps de pessoas como `datetime`, não como string formatada manualmente.

## Requisitos tecnicos

- RT-001: suporte a PostgreSQL com conversão de tipo textual para timestamp.
- RT-002: suporte a SQLite com normalização textual compatível e idempotente.
- RT-003: manter compatibilidade de execução com bases antigas sem quebrar leitura/escrita.
- RT-004: migração em PostgreSQL deve remover defaults textuais legados antes de `ALTER COLUMN ... TYPE TIMESTAMP`.

## Criterios de aceitacao

- CA-001: migration executa sem erro em base legado SQLite.
- CA-002: valores legados com formato ISO textual são normalizados para formato datetime parseável.
- CA-003: `created_at` de pessoas fica preenchido após migration.
- CA-004: criação/atualização de `pacientes` e `tutores` passa a persistir `datetime` no ORM.
