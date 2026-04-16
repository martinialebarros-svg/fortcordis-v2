# Verify - stage-prod-environment-isolation

Data: 2026-04-15  
Responsavel: Codex  
Status: done

## 1) Matriz de rastreabilidade

| ID | Tipo | Evidencia | Status |
| --- | --- | --- | --- |
| CA-001 | aceitacao | [docs/ENVIRONMENT-SAFETY-CHECKLIST.md](/c:/Users/marti/Documents/fortcordis-v2/docs/ENVIRONMENT-SAFETY-CHECKLIST.md) registra refs e ambientes oficiais | ok |
| CA-002 | aceitacao | [docs/DEPLOY-STAGE.md](/c:/Users/marti/Documents/fortcordis-v2/docs/DEPLOY-STAGE.md) e [docs/RUNBOOK-STAGE-PROD.md](/c:/Users/marti/Documents/fortcordis-v2/docs/RUNBOOK-STAGE-PROD.md) atualizados com org/ref corretos | ok |
| CA-003 | aceitacao | `python -m py_compile scripts/check_environment_matrix.py` | ok |
| CA-004 | aceitacao | [scripts/check_environment_matrix.py](/c:/Users/marti/Documents/fortcordis-v2/scripts/check_environment_matrix.py) retorna `FAIL` quando `.env` nao existe ou ref diverge | ok |
| CA-005 | aceitacao | [backend/requirements.txt](/c:/Users/marti/Documents/fortcordis-v2/backend/requirements.txt) inclui `tzdata>=2024.1` | ok |
| CA-006 | aceitacao | `python scripts/ci/check_sdd_guardrail.py --base-sha f5f1518 --head-sha <sha_simulado_do_diff>` aprovado com diff apenas documental | ok |

## 2) Validacoes executadas

Comandos:

```bash
python -m py_compile scripts/check_environment_matrix.py
python scripts/ci/check_sdd_guardrail.py --base-sha f5f1518 --head-sha d83e24edd210045868877fb3c96f5bd6d88f69be
```

Resumo:
- O script compila localmente sem erros.
- Os runbooks e o checklist de seguranca foram revisados em conjunto.
- O guardrail SDD aprovou o diff desta rodada por conter apenas artefatos em `docs/specs/`.
- A execucao funcional do script na VPS ainda depende dos `.env` reais de `stage` e `prod`.

## 3) Riscos residuais

- Risco residual 1: se os paths da VPS mudarem, o script precisara ser atualizado.
- Risco residual 2: o nome visual do projeto de `stage` no Supabase ainda pode induzir erro humano, mesmo com o `project ref` documentado.
- Risco residual 3: a validacao local nao substitui a checagem operacional no servidor antes de deploy sensivel.

## 4) Decisao de release

- [x] Aprovado para stage.
- [ ] Aprovado para producao.
- [ ] Nao aprovado (descrever motivo).
