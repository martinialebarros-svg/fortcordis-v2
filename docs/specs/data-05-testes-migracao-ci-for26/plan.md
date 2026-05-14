# Plan - data-05-testes-migracao-ci-for26

Data: 2026-05-14  
Responsavel: Codex  
Status: done

## Plano de execucao

1. Criar teste de ciclo de migrações no backend para validar `up/down/up` em SQLite temporário.
2. Consolidar suíte focada em migrações/constraints já existente.
3. Criar workflow de CI dedicado para executar essa suíte em `push`/`pull_request` de `stage` e `main`.
4. Registrar evidências de execução em artefatos SDD da feature.
