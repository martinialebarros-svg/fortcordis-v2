# Intent - deploy-backup-restore-drill

Data: 2026-04-05  
Responsavel: Equipe FortCordis  
Status: done

## 1) Problema atual

O deploy ja possui backup de artefatos runtime e rollback automatico, mas nao existe prova automatizada de restauracao integra desses artefatos no proprio fluxo de release.

## 2) Objetivo

Adicionar um drill automatizado de backup + restore para verificar integridade dos artefatos runtime antes de concluir o deploy.

## 3) Nao objetivos

- Nao substituir plano completo de disaster recovery.
- Nao promover restauracao em producao ativa (drill deve ser isolado, em diretorio temporario).
- Nao ampliar escopo para backups remotos/offsite nesta iteracao.

## 4) Restricoes

- Execucao local no VPS (loopback/disco local), sem dependencias externas.
- Baixo overhead para nao degradar janela de deploy.
- Compatibilidade com fluxo atual de rollback automatico.

## 5) Definition of Ready

- [x] Escopo definido.
- [x] Criterios de bloqueio definidos.
