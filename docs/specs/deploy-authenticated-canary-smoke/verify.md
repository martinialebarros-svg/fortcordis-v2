# Verify - deploy-authenticated-canary-smoke

Data: 2026-04-05  
Responsavel: Equipe FortCordis  
Status: done

## 1) Matriz de rastreabilidade

| ID | Tipo | Evidencia | Status |
| --- | --- | --- | --- |
| CA-001 | aceitacao | `scripts/deploy_prod_vps.sh` executa `scripts/deploy_authenticated_canary.py` na fase `auth_canary` apos `runtime_gate` | ok |
| CA-002 | aceitacao | `scripts/deploy_authenticated_canary.py` valida `runtime.ready=true` no endpoint admin e falha em divergencia | ok |
| CA-003 | aceitacao | canary valida `/api/v1/agenda` e `/api/v1/atendimentos/upload-metrics/dedupe/cleanup/status` e falha em erro/estrutura invalida | ok |
| CA-004 | aceitacao | falha no canary retorna exit code != 0 no deploy, acionando fluxo de rollback ja existente | ok |

## 2) Validacoes executadas

Comandos:

```bash
bash -n scripts/deploy_prod_vps.sh
bash -n scripts/deploy_stage_vps.sh
python -m py_compile scripts/deploy_authenticated_canary.py
python -m unittest backend.tests.test_deploy_authenticated_canary -v
```

Resumo:
- Sintaxe dos scripts de deploy valida apos integracao do canary.
- Script canary compila sem erro.
- Testes unitarios de validacao do canary aprovados (4 testes).

## 3) Riscos residuais

- Risco residual 1: canary depende de disponibilidade de usuario admin ativo para fallback de token interno no VPS.
- Risco residual 2: endpoint de agenda pode variar no tempo de resposta; timeout pode precisar ajuste em ambiente degradado.

## 4) Decisao de release

- [x] Aprovado para stage.
- [x] Aprovado para producao.
- [ ] Nao aprovado (descrever motivo).
