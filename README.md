# FortCordis v2

Projeto com `backend` (FastAPI) e `frontend` (Next.js) para operacao clinica veterinaria.

## Primeiros documentos para IA

Antes de mudancas grandes, leia:

1. `PROJECT_CONTEXT.md`
2. `ARCHITECTURE_DECISIONS.md`
3. `CURRENT_TASK.md`
4. `KNOWN_BUGS.md`
5. `NEXT_STEPS.md`
6. `docs/SDD-WORKFLOW.md`
7. `docs/specs/README.md`

## Sistema de contexto compartilhado (handoff entre IAs)

- O projeto usa memoria operacional em Markdown para continuidade entre sessoes e modelos.
- Atualize `CURRENT_TASK.md` no inicio e no fim de tarefas relevantes.
- Registre novas decisoes em `ARCHITECTURE_DECISIONS.md`.
- Registre bugs/riscos em `KNOWN_BUGS.md`.
- Mantenha `NEXT_STEPS.md` curto, priorizado e acionavel.

## Operacao de deploy

Para orientacoes de deploy e runbook:

- `README-DEPLOY.md`
- `docs/RUNBOOK-STAGE-PROD.md`
- `docs/WHATSAPP-STAGE-PREFLIGHT.md`
- `docs/WHATSAPP-INCIDENT-RUNBOOK.md`

## Fluxo SDD (Spec Driven Development)

- Use `docs/SDD-WORKFLOW.md` como regra operacional.
- Crie specs de feature em `docs/specs/<feature-slug>/`.
- Inicie por `intent.md`, evolua para `spec.md`, planeje em `plan.md` e valide em `verify.md`.
- PRs devem preencher o template com links para os artefatos SDD.
