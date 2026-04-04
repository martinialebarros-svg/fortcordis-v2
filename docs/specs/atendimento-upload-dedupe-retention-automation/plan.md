# Plan - atendimento-upload-dedupe-retention-automation

Data: 2026-04-04  
Responsavel: Equipe FortCordis  
Status: draft

## 1) Sequencia de fases

- Fase 1 (DB/migracoes): criar estrutura de historico de execucoes de cleanup.
- Fase 2 (backend/API): implementar automacao no startup e endpoint de status.
- Fase 3 (qualidade): testes automatizados e validacao local.
- Fase 4 (operacao): validar stage/producao e fechar verify.

## 2) Tarefas por fase

### Fase 1

- [ ] T1.1 Criar migracao `upload_dedupe_cleanup_runs`.
- [ ] T1.2 Garantir indices para consulta rapida de ultimos runs.
- Criterio de conclusao: persistencia de runs disponivel em SQLite e Postgres.
- Risco: diferenca de tipo data/hora entre dialetos.
- Rollback: ignorar tabela de runs e usar somente log temporariamente.

### Fase 2

- [ ] T2.1 Implementar servico `run_upload_dedupe_cleanup(executor=...)`.
- [ ] T2.2 Acoplar automacao ao startup com regra de intervalo (24h).
- [ ] T2.3 Criar endpoint `GET /upload-metrics/dedupe/cleanup/status`.
- Criterio de conclusao: automacao e status operacionais com fallback seguro.
- Risco: corrida entre instancias no startup.
- Rollback: desativar automacao por flag e manter endpoint manual.

### Fase 3

- [ ] T3.1 Adicionar testes de intervalo, erro e concorrencia basica.
- [ ] T3.2 Reexecutar suites de upload/dedupe/metricas.
- [ ] T3.3 Rodar lint frontend do atendimento (regressao basica).
- Criterio de conclusao: CA-001..CA-005 cobertos por testes e smoke local.
- Risco: testes flakey por dependencia de relogio.
- Rollback: congelar datas em fixtures deterministicas.

### Fase 4

- [ ] T4.1 Validar em stage execucao automatica e endpoint de status.
- [ ] T4.2 Validar que cleanup manual continua funcional.
- [ ] T4.3 Executar smoke em producao apos promocao e fechar `verify.md`.
- Criterio de conclusao: ciclo aprovado em stage e producao.
- Risco: automacao rodar em horario de pico e gerar ruido operacional.
- Rollback: desligar flag e manter rotina manual.

## 3) Plano de testes

- Testes unitarios:
- selecao de janela de execucao (intervalo) e persistencia de run.
- Testes de integracao:
- endpoint de status e endpoint manual com historico atualizado.
- Testes manuais:
- confirmar run automatico no startup e run manual sob demanda.

## 4) Dependencias e bloqueios

- Dependencia 1: ciclo anterior de retention manual implantado.
- Dependencia 2: permissao de deploy em stage/producao para validar startup.

## 5) Checklist para iniciar execucao

- [ ] `intent.md` aprovado.
- [ ] `spec.md` aprovado.
- [ ] Fases e rollback revisados.
- [ ] Ambiente de teste definido (local/stage).
