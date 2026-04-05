# Plan - deploy-backup-restore-drill

Data: 2026-04-05  
Responsavel: Equipe FortCordis  
Status: done

## 1) Fases

- Fase 1: especificar e implementar script de drill.
- Fase 2: integrar no fluxo de deploy com feature flag.
- Fase 3: validar testes focados e fechar ciclo.

## 2) Tarefas

- [x] T1 Criar `scripts/deploy_backup_restore_drill.py`.
- [x] T2 Integrar no `scripts/deploy_prod_vps.sh` (etapa `backup_restore_drill`).
- [x] T3 Adicionar teste unitario para validacao de manifest/hash.
- [x] T4 Rodar validacoes focadas (`py_compile`, `unittest`, `bash -n`).
- [x] T5 Registrar `verify.md` e marcar ciclo como `done`.
