# Verify - deploy-runtime-observability-gate

Data: 2026-04-05  
Responsavel: Equipe FortCordis  
Status: done

## 1) Matriz de rastreabilidade

| ID | Tipo | Evidencia | Status |
| --- | --- | --- | --- |
| CA-001 | aceitacao | gate valida `/ready` com HTTP 200 e `readiness=ready` via `scripts/runtime_observability_gate.py` | ok |
| CA-002 | aceitacao | gate falha quando `http_5xx_monitor.alert_active=true` | ok |
| CA-003 | aceitacao | gate falha quando worker habilitado nao estiver `running/thread_alive` | ok |
| CA-004 | aceitacao | `scripts/deploy_prod_vps.sh` executa gate e aborta deploy em falha | ok |

## 2) Validacoes executadas

Comandos:

```bash
bash -n scripts/deploy_prod_vps.sh
bash -n scripts/deploy_stage_vps.sh
python - <<'PY'
from scripts import runtime_observability_gate as g
ok = {
  "readiness": "ready",
  "checks": {"observability": {
    "http_5xx_monitor": {"alert_active": False},
    "upload_dedupe_cleanup_worker": {"enabled": True, "status": "running", "thread_alive": True},
  }},
}
bad = {
  "readiness": "ready",
  "checks": {"observability": {
    "http_5xx_monitor": {"alert_active": True},
    "upload_dedupe_cleanup_worker": {"enabled": True, "status": "stopped", "thread_alive": False},
  }},
}
assert not g._validate_health_payload(ok)
assert g._validate_health_payload(bad)
print("gate_validation_logic_ok")
PY
```

Resumo:
- Sintaxe dos scripts de deploy valida.
- Logica de bloqueio do gate validada para cenario verde e cenario de falha.

## 3) Riscos residuais

- Risco residual 1: monitor de 5xx e por processo/instancia; em multi-instancia o gate avalia a instancia local do backend no VPS.

## 4) Decisao de release

- [x] Aprovado para stage.
- [x] Aprovado para producao.
- [ ] Nao aprovado (descrever motivo).
