# Plan - fiscal-export-ready-clinics-history

Data: 2026-08-04
Responsavel: Codex
Status: done

## 1) Sequência de fases

- Fase 1 (DB/migrações): criar a persistência de emissões fiscais.
- Fase 2 (backend/API): expor completude das clínicas e registrar/listar emissões.
- Fase 3 (frontend): aplicar filtro seguro, totais dinâmicos e painel de histórico.
- Fase 4 (integração): executar testes focados, TypeScript e guardrail SDD.

## 2) Tarefas por fase

### Fase 1

- [x] T1.1 Criar modelo e migração idempotente para `relatorios_fiscais_emissoes`.
- [x] T1.2 Guardar escopo, valores, usuário, formato e data local da emissão.
- Critério de conclusão: tabela criada em SQLite e PostgreSQL sem apagar dados existentes.
- Risco: ambientes antigos sem a tabela.
- Rollback: reverter o deploy; a tabela adicional permanece sem interferir no fluxo anterior.

### Fase 2

- [x] T2.1 Centralizar a regra de campos fiscais obrigatórios e expô-la na lista de clínicas.
- [x] T2.2 Registrar somente exportações cujo arquivo foi gerado e disponibilizar histórico autenticado.
- Critério de conclusão: API rejeita lote incompleto e lista/restringe clínicas com a mesma regra.
- Risco: erro de persistência pode interromper o download para preservar a auditoria.
- Rollback: reverter endpoints e modelo; exportação existente continua disponível.

### Fase 3

- [x] T3.1 Iniciar multiclínica com o filtro de cadastros completos e impedir marcação dos incompletos.
- [x] T3.2 Exibir cartão de total por clínica e por OS selecionada.
- [x] T3.3 Permitir identificar o tipo de emissão e mostrar os últimos registros.
- Critério de conclusão: a tela permite os dois ritmos de emissão e apresenta o histórico após exportar.
- Risco: filtros de período podem limpar a seleção em andamento.
- Rollback: reverter o componente para o fluxo anterior.

### Fase 4

- [x] T4.1 Cobrir completude e persistência do histórico com testes backend.
- [x] T4.2 Executar lint, verificação TypeScript, guardrail SDD e `git diff --check`.
- Critério de conclusão: verificações relevantes aprovadas.
- Risco: dependências locais de frontend podem não estar instaladas.
- Rollback: não aplicável.

## 3) Plano de testes

- Testes unitários: elegibilidade de clínica, filtro, registro e listagem do histórico.
- Testes de integração: exportação multiclinica existente e contrato do histórico.
- Testes manuais: alternar o filtro, selecionar caixas e conferir o registro após download.

## 4) Dependências e bloqueios

- Dependência: migrações versionadas do backend.
- Dependência: permissão já existente do módulo fiscal.

## 5) Checklist para iniciar execução

- [x] `intent.md` aprovado.
- [x] `spec.md` aprovado.
- [x] Fases e rollback revisados.
- [x] Ambiente de teste definido (worktree local limpo).
