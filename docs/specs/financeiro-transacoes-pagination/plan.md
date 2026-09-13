# Plan — Paginação de Transações

1. Acrescentar busca textual opcional à API existente, antes da contagem e paginação.
2. Ordenar por data e ID descendentes para desempate determinístico.
3. Consumir `total`, `limit=100`, `skip` e `search` na aba Transações.
4. Debounce de 300 ms, reset de página nos filtros, cancelamento e recuperação de falhas.
5. Validar API em SQLite sintético e componente com respostas simuladas; lint, tipos, build e SDD.
6. Publicação e medições autenticadas comparativas em stage dependem de autorização posterior.

Não alterar banco, permissões, pagamentos ou APIs de resumo. Rollback por reversão
de código, sem migração. Publicar backend antes ou junto do frontend: a busca
remota depende do novo parâmetro.
