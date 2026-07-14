# Plan

1. Reconhecer `recepcao`, `secretaria` e variantes acentuadas na autorizacao do endpoint.
2. Criar nova migracao idempotente para corrigir a matriz, pois a versao `20260714_49` ja foi registrada em producao sem encontrar o papel real `recepcao`.
3. Cobrir atualizacao de linha existente, criacao de linha ausente e preservacao dos demais papeis em SQLite.
4. Executar a suite de testes e o gate SDD.
5. Publicar em `main` para acionar o deploy automatico e as migracoes da VPS.
