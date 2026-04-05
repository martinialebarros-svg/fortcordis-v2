# Plan - deploy-authenticated-canary-smoke

Data: 2026-04-05  
Responsavel: Equipe FortCordis  
Status: done

## 1) Fases

- Fase 1: implementar script canary autenticado.
- Fase 2: integrar canary no deploy script.
- Fase 3: validar com testes focados e finalizar ciclo.

## 2) Tarefas

- [x] T1 Criar `scripts/deploy_authenticated_canary.py`.
- [x] T2 Integrar no `scripts/deploy_prod_vps.sh`.
- [x] T3 Adicionar teste unitario de validacao de payload canary.
- [x] T4 Rodar testes focados.
- [x] T5 Registrar `verify.md` e concluir ciclo.
