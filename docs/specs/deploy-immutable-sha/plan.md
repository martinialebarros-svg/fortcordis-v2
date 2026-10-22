# Plan — deploy-immutable-sha

1. Auditar workflows, wrapper stage e reset/rollback compartilhado; verificar
   que os arquivos alvo não têm alterações de outra tarefa.
2. Acrescentar validação e resolução imutável ao instalador, mantendo suporte
   explícito ao uso operacional legado.
3. Fixar checkout, fetch/archive e contexto dos dois workflows ao SHA do run.
4. Exercitar funções e wrappers reais com Git/SSH simulados, incluindo avanço
   remoto, recusas e assertiva de instalação; executar regressões de isolamento
   stage e ativação controlada de lembretes, sintaxe e guardrail SDD.
5. Entregar diff e evidências locais. A publicação em stage é realizada pela
   tarefa principal, com terminal do workflow, SHA instalada e smoke. Não
   publicar produção nesta autorização.

## Reversão e risco

O rollback continua usando o `PRE_DEPLOY_HASH` capturado antes do reset.
Reverter esta mudança reintroduz a corrida de ponta móvel; não é estratégia de
retomada de um run antigo. Migrar schema, alterar catálogo/Auth ou reexecutar
workflows anteriores não faz parte deste trabalho. O servidor precisa permitir
fetch de commit alcançável; falha nesse fetch deve abortar, sem substituí-lo
pela ponta atual da branch.
