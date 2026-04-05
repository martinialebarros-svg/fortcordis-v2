# Verify - deploy-backup-restore-drill

Data: 2026-04-05  
Responsavel: Equipe FortCordis  
Status: done

## 1) Matriz de rastreabilidade

| ID | Tipo | Evidencia | Status |
| --- | --- | --- | --- |
| CA-001 | aceitacao | `scripts/deploy_prod_vps.sh` executa fase `backup_restore_drill` apos `auth_canary` | ok |
| CA-002 | aceitacao | `scripts/deploy_backup_restore_drill.py` falha quando arquivo runtime esperado esta ausente (`_collect_runtime_files`) | ok |
| CA-003 | aceitacao | validacao de hashes detecta divergencia no restore (`_verify_restored_files`) | ok |
| CA-004 | aceitacao | drill valida SQLite restaurado com `PRAGMA integrity_check` | ok |
| CA-005 | aceitacao | deploy segue quando drill passa e etapa loga `Backup restore drill OK` | ok |

## 2) Validacoes executadas

Comandos:

```bash
python -m py_compile scripts/deploy_backup_restore_drill.py
python -m unittest backend.tests.test_deploy_backup_restore_drill -v
bash -n scripts/deploy_prod_vps.sh
bash -n scripts/deploy_stage_vps.sh
```

Resumo:
- Script de drill compilando corretamente.
- Testes unitarios focados aprovados (3 testes).
- Scripts de deploy com sintaxe valida apos integracao da nova etapa.

## 3) Riscos residuais

- Risco residual 1: drill valida integridade de artefatos runtime locais, mas nao substitui teste de restore em host alternativo.
- Risco residual 2: em cenarios com arquivos runtime muito grandes, o tempo da etapa pode aumentar.

## 4) Decisao de release

- [x] Aprovado para stage.
- [x] Aprovado para producao.
- [ ] Nao aprovado (descrever motivo).
