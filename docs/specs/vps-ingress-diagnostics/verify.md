# Verificacao - Diagnostico de entrada TCP/TLS da VPS

## Validacao local prevista

```bash
bash -n scripts/collect_vps_ingress_diagnostics.sh scripts/probe_public_https.sh
bash scripts/tests/test_collect_vps_ingress_diagnostics.sh
bash scripts/tests/test_probe_public_https.sh
backend/venv/bin/python - <<'PY'
import pathlib
import yaml

payload = yaml.safe_load(pathlib.Path('.github/workflows/deploy-stage.yml').read_text())
assert 'deploy-stage' in payload['jobs']
print('stage workflow YAML valid')
PY
git diff --check origin/stage...HEAD
python3 scripts/ci/check_sdd_guardrail.py --base-sha origin/stage --head-sha HEAD
```

## Casos cobertos

- O coletor registra filas e contadores agregados para a porta 443 usando
  binarios simulados, sem expor conexoes individuais.
- Indisponibilidade de coleta permanece sinalizada como `unavailable`, sem
  executar `sudo` ou alterar um servico.
- O probe contabiliza separadamente uma resposta HTTPS valida e uma falha de
  transporte, sem abortar a serie.
- A validacao estatica recusa comandos de reinicio/reload, escrita destrutiva e
  uso de cookies ou credenciais nos probes.

## Validacao de rollout pendente

Depois de publicacao explicitamente autorizada em stage, usar uma mensagem de
commit com `[vps-ingress-diagnostics]` e correlacionar os dois resumos de
probes com o snapshot da VPS. Nenhum achado deve ser tratado como causa sem
repeticao independente ou contador correspondente.
