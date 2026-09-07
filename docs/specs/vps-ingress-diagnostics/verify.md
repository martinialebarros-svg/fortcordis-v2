# Verificacao - Diagnostico de entrada TCP/TLS da VPS

## Validacao local prevista

```bash
bash -n scripts/collect_vps_ingress_diagnostics.sh scripts/probe_public_https.sh scripts/monitor_vps_ingress_deltas.sh
bash scripts/tests/test_collect_vps_ingress_diagnostics.sh
bash scripts/tests/test_probe_public_https.sh
bash scripts/tests/test_monitor_vps_ingress_deltas.sh
bash scripts/tests/test_vps_ingress_diagnostics_stage_trigger.sh
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
- O monitor calcula deltas apenas para contadores numericos monotonicos,
  preserva picos de ocupacao e limita a janela; o teste usa snapshots e relogio
  simulados, sem acesso a rede ou VPS.
- O teste inclui queda do contador seguida de recuperacao acima do valor
  inicial, uma lacuna intermediaria, falha do coletor sem vazamento de stderr
  e execucao a partir de outro diretorio.
- O contrato SSH exige o SHA implantado e a execucao por arquivo (o modo
  `bash -s` nao permite localizar o coletor irmao). Os quatro testes fazem
  parte do quality-gate de stage.
- A validacao estatica recusa comandos de reinicio/reload, escrita destrutiva e
  uso de cookies ou credenciais nos probes.

## Evidencia anterior e rollout do monitor

O snapshot `1dd7680e` foi publicado em stage na execucao
[34137764261](https://github.com/martinialebarros-svg/fortcordis-v2/actions/runs/34137764261).
As 40 sondas tiveram HTTP 200; o snapshot mostrou `SYN_RECV=44`,
`ListenDrops=653` e `SyncookiesSent=418`. Esses contadores absolutos nao
demonstram quando os eventos ocorreram.

Validacao local do monitor em 2026-09-07: testes Bash, parse YAML, sintaxe e
diff-check aprovados. O guardrail SDD deve ser repetido no commit final.

Depois de publicacao explicitamente autorizada em stage, usar uma mensagem de
commit com `[vps-ingress-diagnostics]` e correlacionar os dois resumos de
probes com o snapshot da VPS. Nenhum achado deve ser tratado como causa sem
repeticao independente ou contador correspondente.

Para a segunda etapa, publicar somente mediante autorizacao explicita um commit
com `[vps-ingress-monitor]`, conferir a conclusao terminal da esteira e
correlacionar os deltas do periodo com o resumo externo de trinta probes.
