# Plano

1. Partir do Stage atual em worktree isolado, preservando trabalhos paralelos.
2. Projetar somente as colunas necessárias nas leituras recorrentes de flags
   e modos do WhatsApp; preservar defaults, erros e desativação imediata.
3. Substituir listagens completas do catálogo por sondagens de existência das
   tabelas internas necessárias. Reutilizar a conexão da sessão em curso.
4. Validar SQL emitido e comportamento com SQLite isolado, incluindo mudanças
   de schema, migrações e pool de uma conexão. Não utilizar dados operacionais.
5. Executar regressões relacionadas e o guardrail SDD, revisar o diff e abrir
   PR exclusivamente para `stage`.
6. Aguardar os gates e o deploy terminal do SHA aprovado. Verificar o Stage
   e comparar contadores de consultas sem reiniciá-los ou ler os binários.

Não serão alterados limites de pool, plano Supabase, intervalos de execução,
flags de ativação, migrações ou configuração da produção. O consumo já servido
não é reduzido retroativamente por esta otimização.
