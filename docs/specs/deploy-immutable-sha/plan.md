# Plan — deploy-immutable-sha

1. Auditar workflows, wrapper stage e reset/rollback compartilhado; verificar
   que os arquivos alvo não têm alterações de outra tarefa.
2. Exigir identidade imutável em todos os caminhos, inclusive manual, antes de
   entrar em handlers de limpeza/rollback; nunca resolver a ponta como fallback.
3. Fixar checkout, fetch/archive e contexto dos dois workflows ao SHA do run.
4. Exercitar funções e wrappers reais com Git/SSH simulados, incluindo avanço
   remoto, recusas e assertiva de instalação; executar regressões de isolamento
   stage e ativação controlada de lembretes, sintaxe e guardrail SDD.
5. Verificar o commit na VPS antes dos passos de configuração; transmitir as
   funções do instalador gateado por stdin, sem arquivo temporário no servidor.
6. Testar repositórios Git descartáveis e os blocos reais de preflight dos dois
   workflows, além dos dublês. Publicar somente em stage, aguardar terminal,
   verificar SHA instalada, preservar runtime e exercitar recusas sem mutação.
7. Apresentar resultados antes de qualquer promoção para produção.

## Reversão e risco

O rollback continua usando o `PRE_DEPLOY_HASH` capturado antes do reset.
Reverter esta mudança reintroduz a corrida de ponta móvel; não é estratégia de
retomada de um run antigo. Migrar schema, alterar catálogo/Auth ou reexecutar
workflows anteriores não faz parte deste trabalho. O servidor precisa permitir
fetch de commit alcançável; falha nesse fetch deve abortar, sem substituí-lo
pela ponta atual da branch.

## Publicação isolada autorizada (22/10/2026)

1. Partir de main `3553c461` e copiar somente nove caminhos de deploy, testes
   e deste SDD do stage homologado `d1e81bba`.
2. Usar a exceção documentada de hotfix para corrigir a seleção insegura de
   código em produção, sem promover os incrementos clínicos/regionais de stage.
3. Confirmar igualdade dos cinco arquivos executáveis/testes/workflows com
   stage e ausência de qualquer diferença de aplicação fora da allowlist.
4. Fazer backup privado de ambiente, runtime e banco; preparar rollback por SHA
   anterior e preservar configuração Maps, Auth, permissões e catálogos.
5. Cumprir todos os checks, publicar por PR e conferir o SHA exato, preflight
   antes de configuração, canário, arquivos runtime e restore drill.
6. Reintegrar imediatamente a história/documentação em stage, preservando seu
   código homologado e as demais entregas ainda não promovidas.
