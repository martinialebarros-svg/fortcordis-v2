# Verify - sdd-guardrail-ci

## Recuperacao de acionamento em 22/10/2026

As PRs #424 e #426 foram integradas a stage (`41b234c1`, `8a7ebe98`),
com todos os gates das PRs verdes, mas sem workflow de push ou check-run nos
SHAs de merge. O checkout instalado continuava em `ec956a0f`. Tanto o merge
pelo conector quanto pela CLI apresentaram o mesmo resultado; portanto o
diagnostico inicial exclusivo do conector nao foi confirmado. O GitHub
registrava incidente de Issues/Pull Requests/search no mesmo periodo, sem
evidencia suficiente para atribuir toda a causa ao incidente.

Adicionado apenas `workflow_dispatch` a `deploy-stage.yml`. O caminho manual
executa os mesmos jobs, `needs`, gates, scripts e concorrencia compartilhada;
nao ha commit vazio, bypass ou alteracao de workflow de producao. Verificacao
estrutural local confirma que o bloco `on` e a unica diferenca no YAML. A prova
de execucao manual e o SHA instalado serao registrados apos a conclusao.

Data: 2026-04-12  
Responsavel: Equipe FortCordis  
Status: done

## 1) Matriz de rastreabilidade

| ID | Tipo | Evidencia | Status |
| --- | --- | --- | --- |
| CA-001 | aceitacao | `scripts/ci/check_sdd_guardrail.py` falha em codigo sem `spec.md` + `verify.md` | ok |
| CA-002 | aceitacao | `deploy-stage.yml` e `deploy.yml` usam `needs: sdd-guardrail` antes do deploy | ok |
| CA-003 | aceitacao | regra libera quando nao ha mudanca de codigo | ok |
| CA-004 | aceitacao | `backend/tests/test_sdd_guardrail.py` validando cenarios de sucesso/falha | ok |

## 2) Validacoes executadas

Comandos:

```bash
python -m py_compile scripts/ci/check_sdd_guardrail.py
python -m unittest backend.tests.test_sdd_guardrail -v
python scripts/ci/check_sdd_guardrail.py --base-sha HEAD --head-sha HEAD
```

Resumo:
- Script compila e executa normalmente.
- Testes unitarios do guardrail aprovados.
- Validacao por diff local executada com saida esperada.

## 3) Riscos residuais

- Risco residual 1: mudancas criticas fora dos prefixos monitorados podem escapar da obrigatoriedade SDD.
- Risco residual 2: bypass manual ainda e possivel se branch sem protecao de status check.

## 4) Decisao de release

- [x] Aprovado para stage.
- [x] Aprovado para producao.
- [ ] Nao aprovado (descrever motivo).
