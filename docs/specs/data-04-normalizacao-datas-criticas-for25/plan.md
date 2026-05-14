# Plan - data-04-normalizacao-datas-criticas-for25

Data: 2026-05-14  
Responsavel: Codex  
Status: done

## Plano de execucao

1. Mapear colunas legadas de data em `pacientes` e `tutores` ainda persistidas como texto.
2. Criar migration incremental para normalizar `created_at/updated_at` com suporte a PostgreSQL e SQLite.
3. Atualizar modelos ORM para `DateTime` e ajustar pontos de escrita que ainda montavam timestamp manual em string.
4. Criar teste automatizado de migration com cenarios legados e validar idempotencia.
5. Executar regressao rapida de testes afetados e documentar evidencias em `verify.md`.
