# Spec - data-05-testes-migracao-ci-for26

Data: 2026-05-14  
Responsavel: Codex  
Status: done

## Escopo

Implementar validação contínua de migrações no pipeline para reduzir risco de falhas em deploy.

## Requisitos funcionais

- RF-001: pipeline deve executar testes de migração em `push` para `stage/main`.
- RF-002: pipeline deve executar os mesmos testes em `pull_request` para `stage/main`.
- RF-003: suíte deve validar ciclo `up/down/up` das migrações em banco efêmero.
- RF-004: suíte deve validar constraints/índices críticos cobertos pelos testes de migração existentes.

## Requisitos tecnicos

- RT-001: workflow deve instalar dependências do backend a partir de `backend/requirements.txt`.
- RT-002: testes devem usar SQLite temporário para isolamento e repetibilidade.
- RT-003: workflow deve ser idempotente e não depender de estado prévio do runner.

## Criterios de aceitacao

- CA-001: novo workflow `Migration CI` é acionado para `push` e `pull_request` em `stage/main`.
- CA-002: teste de ciclo de migrações (`up/down/up`) executa com sucesso.
- CA-003: testes de constraints/índices de migração executam no pipeline sem regressão.
