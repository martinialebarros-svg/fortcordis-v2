# Plan — retornos programados do WhatsApp

1. Partir de origin/stage `3ab6e804` em worktree isolado, preservando pacientes.
2. Acrescentar tabela versionada com um retorno por conversa, responsável e nota.
3. Implementar leitura/gravação autenticadas, filtros e contadores no servidor.
4. Integrar inbound novo à atenção do retorno sob a mesma trava da conversa.
5. Adicionar painel, atalhos de horário, fila pessoal/compartilhada e badges.
6. Validar migração, concorrência, duplicação, ACL, filtros e interface; incluir
   contratos nos quality gates e atualizar os quatro artefatos SDD.

## Retorno operacional

Migração aditiva/idempotente em `init.sql`, executada na transação já existente.
O código anterior ignora a tabela: rollback mantém dados, mas deixa de atualizar
retornos durante inbound; não remover a tabela para reverter o código. Antes de
reaplicar a versão nova após rollback prolongado, revisar retornos pendentes com
mensagens recebidas no intervalo. Nenhum worker ou segredo novo é necessário.
