# Spec - sdd-guardrail-ci

Data: 2026-04-12  
Responsavel: Equipe FortCordis  
Status: done

## 1) Escopo

Implementar guardrail SDD no CI com:
- script de validacao por diff git (`base..head`);
- workflow dedicado para PRs em `stage/main`;
- bloqueio de deploy automatico (`stage` e `main`) quando regra SDD falhar;
- checklist de PR para reforco operacional do processo.

## 2) Requisitos funcionais (RF)

- RF-001: criar script `scripts/ci/check_sdd_guardrail.py`.
- RF-002: detectar mudancas de codigo em `backend/`, `frontend/` e `scripts/`.
- RF-003: falhar quando houver codigo alterado sem atualizacao SDD correspondente.
- RF-004: exigir no diff `spec.md` + `verify.md` em `docs/specs/<feature>/`.
- RF-005: validar existencia dos 4 arquivos obrigatorios (`intent/spec/plan/verify`) na feature.
- RF-006: executar guardrail em PR para `stage/main`.
- RF-007: executar guardrail antes dos deploys automaticos de `stage/main`.

## 3) Requisitos nao funcionais (NFR)

- NFR-001: sem bibliotecas adicionais.
- NFR-002: mensagens de erro claras para orientar correcoes.
- NFR-003: comportamento deterministico no CI.

## 4) Criterios de aceitacao (CA)

- CA-001: PR com mudanca de codigo sem spec/verify falha no workflow `SDD Guardrail`.
- CA-002: push em `stage` ou `main` com violacao SDD bloqueia job de deploy.
- CA-003: push/PR com mudanca apenas documental nao e bloqueado.
- CA-004: testes unitarios da regra de guardrail passam localmente.
