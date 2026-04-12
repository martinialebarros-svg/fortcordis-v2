# Plan - sdd-guardrail-ci

Data: 2026-04-12  
Responsavel: Equipe FortCordis  
Status: done

## 1) Fases

- Fase 1: implementar script de validacao SDD.
- Fase 2: integrar guardrail em workflows (PR + deploy).
- Fase 3: validar via testes unitarios e fechar documentacao.

## 2) Tarefas

- [x] T1 Criar `scripts/ci/check_sdd_guardrail.py`.
- [x] T2 Criar workflow `.github/workflows/sdd-guardrail.yml`.
- [x] T3 Bloquear deploy em `deploy-stage.yml` e `deploy.yml` com job `sdd-guardrail`.
- [x] T4 Adicionar testes em `backend/tests/test_sdd_guardrail.py`.
- [x] T5 Atualizar `docs/specs/README.md` e template de PR.
- [x] T6 Registrar validacoes em `verify.md`.
