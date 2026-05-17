# Verificacao

## Validacao tecnica
- `npm run build` no `whatsapp-stage-backend`
- smoke de runtime: `/health` deve incluir `observability.webhookEventsCleanup`

## Critérios
1. worker inicia com app (quando habilitado) e roda cleanup automatico.
2. eventos antigos sao removidos em lotes configurados.
3. tabela `webhook_event_cleanup_runs` recebe registros de sucesso/erro.
