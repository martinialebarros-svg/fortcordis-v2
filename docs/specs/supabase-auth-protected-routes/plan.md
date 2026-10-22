# Plano

1. Inspecionar login, cookies, CSRF, permissoes, WebSocket e rotas publicas existentes.
2. Trabalhar isoladamente sobre origin/main, preservando alteracoes locais do checkout original.
3. Integrar a API Auth oficial via httpx ja fixado no backend; manter o backend
   como fronteira de autenticacao para todos os consumidores existentes.
4. Exigir vinculo administrativo app_metadata.fortcordis_user_id e conta local
   ativa; nunca vincular por email ou user_metadata somente.
5. Implementar login, validacao remota, refresh e logout; manter modo legacy como
   rollback explicito, sem fallback de credenciais em modo supabase.
6. Validar rotas internas no middleware, preservando dominios institucionais,
   portais independentes e links com token.
7. Entregar importador idempotente em dry-run por padrao, configuracao e runbook.
8. Executar testes sinteticos backend/frontend, lint, typecheck, build e guardrail SDD.

9. Preparar publicacao de Auth isolada, backup consistente de contas/permissoes e
   configuracao privada, sem incluir funcionalidades de stage fora do escopo.
10. Adequar o canario permanente ao provedor Supabase com sessao efemera revogada;
    validar esse caminho com fixture real em stage antes da ativacao de producao.
