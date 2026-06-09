# Verify - prod-cost-baseline-collector

Data: 2026-06-09  
Responsavel: Martiniano + Codex  
Status: done

## 1) Matriz de rastreabilidade

| ID | Tipo | Evidencia | Status |
| --- | --- | --- | --- |
| CA-001 | aceitacao | `scripts/prod_cost_baseline.py` adicionado ao repositório | ok |
| CA-002 | aceitacao | CLI do script inclui `--base-url`, `--output-root`, credenciais e token bearer | ok |
| CA-003 | aceitacao | `.gitignore` ignora `ops/baseline/prod/` | ok |
| CA-004 | aceitacao | mudanca documental adicionada no mesmo ciclo do script operacional | ok |

## 2) Validacoes executadas

Comandos:

```bash
python3 -m py_compile scripts/prod_cost_baseline.py
git check-ignore -v ops/baseline/prod/20260602-005340-Tplus24h/_meta.json
git status --short --branch
```

Resumo:
- `python3 -m py_compile scripts/prod_cost_baseline.py`: ok
- `git check-ignore -v .../_meta.json`: confirmou regra `.gitignore` para `ops/baseline/prod/`
- `git status --short --branch`: mostrou apenas `.gitignore` e `scripts/prod_cost_baseline.py` como mudancas rastreaveis no ciclo antes do commit
- `gh run view 27200942068 --log`: falha identificada como `sdd-guardrail` por ausencia de `spec.md` + `verify.md` para o novo script; alinhamento aplicado neste commit

## 3) Riscos residuais

- O script pode coletar snapshots com dados operacionais sensiveis; por isso a pasta de saida permanece ignorada no Git.
- O fallback de token interno depende do backend local configurado; em ambientes sem backend local deve-se usar bearer token ou login explicito.
