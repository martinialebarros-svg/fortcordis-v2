# Spec - deploy-backup-restore-drill

Data: 2026-04-05  
Responsavel: Equipe FortCordis  
Status: done

## 1) Escopo

Implementar drill pos-deploy para:
- criar snapshot compactado dos artefatos runtime criticos;
- gerar manifest de integridade (SHA-256 por arquivo);
- restaurar snapshot em diretorio temporario isolado;
- validar integridade pos-restore;
- validar consistencia do banco SQLite restaurado.

## 2) Requisitos funcionais (RF)

- RF-001: criar script `scripts/deploy_backup_restore_drill.py`.
- RF-002: script deve aceitar `--app-dir`, `--backup-dir` e lista de paths relativos.
- RF-003: script deve falhar quando arquivo esperado estiver ausente.
- RF-004: script deve falhar quando hash restaurado divergir do manifest.
- RF-005: script deve validar `PRAGMA integrity_check` no SQLite restaurado.
- RF-006: integrar execucao no `scripts/deploy_prod_vps.sh`.
- RF-007: permitir desativacao controlada por env (`ENABLE_BACKUP_RESTORE_DRILL=0`).

## 3) Requisitos nao funcionais (NFR)

- NFR-001: sem novas dependencias Python externas.
- NFR-002: logs objetivos para diagnostico operacional.
- NFR-003: limpeza automatica do diretorio temporario ao final (sucesso/falha).
- NFR-004: overhead maximo alvo <= 15s em ambiente nominal.

## 4) Criterios de aceitacao (CA)

- CA-001: etapa `backup_restore_drill` roda apos `auth_canary` no deploy.
- CA-002: deploy falha quando algum arquivo critico faltar no snapshot.
- CA-003: deploy falha quando restauracao apresentar divergencia de hash.
- CA-004: deploy falha quando `integrity_check` do SQLite restaurado retornar erro.
- CA-005: deploy conclui normalmente quando drill passa integralmente.
