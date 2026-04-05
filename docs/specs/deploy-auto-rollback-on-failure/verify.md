# Verify - deploy-auto-rollback-on-failure

Data: 2026-04-05  
Responsavel: Equipe FortCordis  
Status: done

## 1) Matriz de rastreabilidade

| ID | Tipo | Evidencia | Status |
| --- | --- | --- | --- |
| CA-001 | aceitacao | `PRE_DEPLOY_HASH` capturado e logado no inicio do deploy | ok |
| CA-002 | aceitacao | `on_exit` aciona rollback em falha com `CODE_UPDATED=1` | ok |
| CA-003 | aceitacao | `rollback_deploy()` executa restart/check de backend/frontend/public | ok |
| CA-004 | aceitacao | guardas para evitar rollback indevido/loop (`CODE_UPDATED`, `ROLLBACK_IN_PROGRESS`) | ok |

## 2) Validacoes executadas

Comandos:

```bash
bash -n scripts/deploy_prod_vps.sh
bash -n scripts/deploy_stage_vps.sh
```

Resumo:
- Scripts de deploy com sintaxe valida apos adicao do rollback automatico.

## 3) Riscos residuais

- Risco residual 1: rollback nao reverte schema de banco (migracoes seguem forward-only).
- Risco residual 2: rollback depende de saude da infraestrutura local (servicos/npm/pip).

## 4) Decisao de release

- [x] Aprovado para stage.
- [x] Aprovado para producao.
- [ ] Nao aprovado (descrever motivo).
