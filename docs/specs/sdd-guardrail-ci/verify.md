# Verify - sdd-guardrail-ci

### Prova da recuperacao

A PR #427 integrou o disparo manual e o workflow `39824925973` executou
`workflow_dispatch` sobre stage `5138dddc`. Quality, SDD, diagnosticos e
deploy-stage terminaram com sucesso; o checkout instalado correspondeu ao
SHA esperado. Migration CI `39824930828` passou. O gatilho manteve o pipeline
original, inclusive preservacao dos seis arquivos runtime, canario e
`Backup restore drill OK`.

O hotfix de producao da PR #425 nao levou a alteracao do workflow de stage.
O push de main voltou a disparar normalmente e o workflow `39834453171`
terminou com sucesso. O disparo manual duplicado de producao foi cancelado
ainda sem jobs. Nenhum commit vazio, excecao de promocao ou bypass de gate
foi usado para essa recuperacao.

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
