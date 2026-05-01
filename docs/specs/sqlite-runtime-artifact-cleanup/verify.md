# Verify - sqlite-runtime-artifact-cleanup

Data: 2026-04-30  
Responsavel: Equipe FortCordis  
Status: in-progress

## 1) Matriz de rastreabilidade

| ID | Tipo | Evidencia | Status |
| --- | --- | --- | --- |
| CA-001 | aceitacao | commit remove `backend/fortcordis.db` do indice Git | ok |
| CA-002 | aceitacao | `.gitignore` inclui `*.db`, `backend/*.db`, uploads, runtime backups e `.pem` | ok |
| CA-003 | aceitacao | `.gitignore` passa a cobrir `backend/uploads/` e `backend/data/runtime_backups/` | ok |
| CA-004 | aceitacao | scripts de deploy preservam/restauram `backend/fortcordis.db` runtime | ok |

## 2) Testes automatizados executados

Comandos:

```bash
rg -n "backup_runtime_file|restore_runtime_file|fortcordis\\.db" scripts/deploy_stage_vps.sh scripts/deploy_prod_vps.sh
```

Resumo dos resultados:
- `deploy_stage_vps.sh` delega para `deploy_prod_vps.sh`.
- `deploy_prod_vps.sh` preserva e restaura `backend/fortcordis.db`.

## 3) Testes manuais

- Comparacao do SQLite local mostrou volume muito menor que producao real, confirmando que nao e fonte de verdade de prod.
- Confirmado que o arquivo local e SQLite e possui dados operacionais/teste.

## 4) Regressao e riscos residuais

- Risco residual 1: ambientes sem `DATABASE_URL` e sem copia runtime SQLite podem falhar.
- Risco residual 2: ainda e desejavel criar seed local explicito no futuro.

## 5) Itens fora de escopo entregues

- Nenhum.

## 6) Decisao de release

- [x] Aprovado para stage.
- [ ] Aprovado para producao.
- [ ] Nao aprovado.
