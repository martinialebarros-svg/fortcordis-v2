# Spec - critical-composite-indexes-for24

Data: 2026-05-13  
Responsavel: Codex  
Status: done

## Escopo

Implementar estrategia de indices compostos para os caminhos criticos de leitura em agenda/atendimento/relatorios.

## Requisitos funcionais

- RF-001: migration deve criar indices compostos em `agendamentos` para filtros de agenda e relatorios.
- RF-002: migration deve criar indices compostos em `atendimentos_clinicos` para listagens com filtros combinados.
- RF-003: migration deve criar indices compostos em `ordens_servico` para agregacoes/listagens financeiras e relatorios.

## Requisitos tecnicos

- RT-001: operacao idempotente com `CREATE INDEX IF NOT EXISTS`.
- RT-002: compatibilidade com dialetos usados no projeto (PostgreSQL/SQLite).
- RT-003: modelos devem refletir indices compostos para novas bases criadas do zero.

## Criterios de aceitacao

- CA-001: indices compostos de `agendamentos` existem apos migration.
- CA-002: indices compostos de `atendimentos_clinicos` existem apos migration.
- CA-003: indices compostos de `ordens_servico` existem apos migration.
- CA-004: suite de testes focada executa com sucesso sem regressao.
