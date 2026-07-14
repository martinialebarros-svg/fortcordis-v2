# Plan

1. Criar migracao idempotente para a matriz de permissoes.
2. Cobrir atualizacao de linha existente e criacao de linha ausente em SQLite.
3. Executar a suite de testes e o gate SDD.
4. Publicar em `main` para acionar o deploy automatico e as migracoes da VPS.
