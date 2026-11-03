# Plano

1. Inspecionar regras de primeira saida, overrides existentes, autorizacao e fluxo de edicao compartilhado. Criar worktree a partir de origin/stage.
2. Adicionar flag especifica ao schema de edicao. Validar admin e correcao retroativa antes de mutar o objeto; sinalizar confirmacao apenas ao admin elegivel. Dispensar somente primeira saida na requisicao confirmada e auditar sucesso.
3. Adicionar confirmacao no modal compartilhado com retry limitado, mantendo confirmacoes de reserva e rota.
4. Executar testes HTTP em SQLite temporario, testes UX e regressoes; documentar resultados em verify.md. Verificar diff, tipos e SDD.
5. Preparar entrega local revisavel, sem publicar PR, deploy ou merge sem autorizacao.

Rollback: reverter este diff em backend/frontend e os artefatos SDD; nao ha migracao nem alteracao de dados a desfazer. Codigos antigos ignoram a flag desconhecida, mantendo o bloqueio existente.
