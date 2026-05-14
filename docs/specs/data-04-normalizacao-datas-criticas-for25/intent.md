# Intent - data-04-normalizacao-datas-criticas-for25

Data: 2026-05-14  
Responsavel: Codex  
Status: done

## Problema

Tabelas legadas de pessoas (`pacientes` e `tutores`) ainda persistem `created_at/updated_at` em formato textual, o que aumenta risco de inconsistência e dificulta evolução de filtros/ordenação temporal confiáveis.

## Objetivo

Executar a normalização inicial das datas críticas de pessoas para tipo datetime, com backfill seguro e compatível com PostgreSQL/SQLite.
