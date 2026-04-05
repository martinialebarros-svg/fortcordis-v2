# Spec - deploy-auto-rollback-on-failure

Data: 2026-04-05  
Responsavel: Equipe FortCordis  
Status: done

## 1) Escopo

Implementar rollback automatico em `scripts/deploy_prod_vps.sh` quando houver erro no deploy apos `git reset --hard origin/<branch>`.

## 2) Requisitos funcionais (RF)

- RF-001: capturar hash pre-deploy (`PRE_DEPLOY_HASH`) antes de atualizar codigo.
- RF-002: em falha, executar rollback para `PRE_DEPLOY_HASH`.
- RF-003: revalidar backend/frontend/public URL apos rollback.
- RF-004: evitar loop de rollback.
- RF-005: permitir desativar rollback por env (`AUTO_ROLLBACK_ON_FAILURE=0`).

## 3) Requisitos nao funcionais (NFR)

- NFR-001: sem quebra de compatibilidade para deploy de stage (reuso do script de prod).
- NFR-002: mensagens claras de diagnostico e fase de falha.
- NFR-003: comportamento deterministico em falhas.

## 4) Criterios de aceitacao (CA)

- CA-001: script registra `Pre-deploy HEAD`.
- CA-002: falha apos update de codigo aciona tentativa de rollback.
- CA-003: rollback restaura servicos e checks basicos.
- CA-004: falha antes de update de codigo nao dispara rollback desnecessario.
