# Spec - prod-cost-baseline-collector

Data: 2026-06-09  
Responsavel: Martiniano + Codex  
Status: done

## 1) Escopo

Versionar um coletor operacional para baseline pos-deploy em producao, com saida local ignorada pelo Git.

## 2) Requisitos funcionais (RF)

- RF-001: disponibilizar script executavel para consultar endpoints autenticados de baseline em producao.
- RF-002: o script deve coletar resumo de Google Maps, custos/quotas de Google Maps e `hardening-readiness`.
- RF-003: o script deve aceitar token bearer direto, credenciais de login ou fallback de token interno local.
- RF-004: o script deve salvar artefatos JSON em pasta datada para comparacao posterior.
- RF-005: artefatos gerados localmente em `ops/baseline/prod/` nao devem entrar no versionamento do repositório.

## 3) Requisitos nao funcionais (NFR)

- NFR-001: o coletor nao deve depender de bibliotecas Python externas alem das ja disponiveis no ambiente.
- NFR-002: falhas de autenticacao e conectividade devem retornar mensagens objetivas para troubleshooting.
- NFR-003: o repositório deve manter apenas o script-fonte, sem snapshots operacionais de producao no historico Git.

## 4) Criterios de aceitacao (CA)

- CA-001: `scripts/prod_cost_baseline.py` fica versionado no repositório.
- CA-002: o script expoe CLI com `--base-url`, `--output-root`, opcoes de credencial e saida em `ops/baseline/prod`.
- CA-003: `ops/baseline/prod/` fica ignorado no Git para nao versionar artefatos gerados.
- CA-004: a mudanca passa pelo guardrail SDD com `spec.md` e `verify.md` no mesmo ciclo.
