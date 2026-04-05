# Plan - deploy-auto-rollback-on-failure

Data: 2026-04-05  
Responsavel: Equipe FortCordis  
Status: done

## 1) Fases

- Fase 1: modelar fluxo de erro e rollback.
- Fase 2: implementar rollback no deploy script.
- Fase 3: validar sintaxe e fechar ciclo.

## 2) Tarefas

- [x] T1 Adicionar estados de fase do deploy (`DEPLOY_STAGE`).
- [x] T2 Capturar `PRE_DEPLOY_HASH` e flag de update (`CODE_UPDATED`).
- [x] T3 Implementar `rollback_deploy()` com restart/checks.
- [x] T4 Implementar handler de saida com rollback condicional.
- [x] T5 Validar script (`bash -n`) e registrar verify.
