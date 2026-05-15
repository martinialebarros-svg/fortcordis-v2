# Spec - api-05-quality-gate-deploy-for31

Data: 2026-05-14  
Responsavel: Codex  
Status: done

## Escopo

Adicionar quality gate obrigatório nos workflows de deploy para `stage` e `main`.

## Requisitos funcionais

- RF-001: deploy para `stage` só executa após quality gate + SDD guardrail aprovados.
- RF-002: deploy para `main` só executa após quality gate + SDD guardrail aprovados.
- RF-003: quality gate deve validar backend e frontend no mesmo workflow.

## Requisitos tecnicos

- RT-001: rodar suíte de testes backend no job `quality-gate`.
- RT-002: rodar `frontend` lint com `npm run lint`.
- RT-003: rodar build do frontend com `npm run build`.
- RT-004: manter `deploy-stage`/`deploy` dependentes de `needs: [quality-gate, sdd-guardrail]`.
- RT-005: corrigir falha de lint pré-existente em `frontend/public/sw.js` para viabilizar o gate.
- RT-006: garantir que testes de matriz de permissões executem em banco SQLite limpo no CI sem depender de schema pré-existente.

## Criterios de aceitacao

- CA-001: workflows `.github/workflows/deploy-stage.yml` e `.github/workflows/deploy.yml` possuem job `quality-gate`.
- CA-002: deploy fica bloqueado quando qualquer etapa de test/lint/build falhar.
- CA-003: validação local de test/lint/build executa com sucesso.
- CA-004: teste `test_permission_matrix_sync_supports_safe_logistica_dry_run` passa em ambiente CI com banco sem tabelas pré-criadas.
