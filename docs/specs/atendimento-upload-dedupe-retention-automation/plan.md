# Plan - atendimento-upload-dedupe-retention-automation

Data: 2026-04-04  
Responsavel: Equipe FortCordis  
Status: done

## 1) Sequencia de fases

- Fase 1 (DB/migracoes): criar estrutura de historico de execucoes de cleanup.
- Fase 2 (backend/API): implementar automacao no startup + loop periodico, lock e endpoint de status.
- Fase 3 (qualidade): testes automatizados e validacao local.
- Fase 4 (operacao): validar stage/producao e fechar verify.

## 2) Tarefas por fase

### Fase 1

- [x] T1.1 Criar migracao `upload_dedupe_cleanup_runs`.
- [x] T1.2 Garantir indices para consulta rapida de ultimos runs.
- [x] T1.3 Definir retencao de historico de runs (padrao 90 dias).
- Criterio de conclusao: persistencia de runs disponivel em SQLite e Postgres.
- Risco: diferenca de tipo data/hora entre dialetos.
- Rollback: ignorar tabela de runs e usar somente log temporariamente.

### Fase 2

- [x] T2.1 Implementar servico `run_upload_dedupe_cleanup(executor=...)`.
- [x] T2.2 Acoplar automacao ao startup e loop periodico com regra de intervalo (24h).
- [x] T2.3 Implementar lock de execucao (Postgres advisory lock + lock local best effort no SQLite).
- [x] T2.4 Restringir endpoints tecnicos de cleanup/status para admin.
- [x] T2.5 Criar endpoint `GET /upload-metrics/dedupe/cleanup/status`.
- [x] T2.6 Implementar timeout de execucao e jitter de startup configuraveis.
- [x] T2.7 Implementar cleanup em lotes com `batch_size` configuravel.
- [x] T2.8 Implementar contador de falhas consecutivas com alerta em log apos 3 falhas.
- Criterio de conclusao: automacao, lock e status operacionais com fallback seguro.
- Risco: corrida entre instancias no startup e durante loop periodico.
- Rollback: desativar automacao por flag e manter endpoint manual.

### Fase 3

- [x] T3.1 Adicionar testes de intervalo, erro e concorrencia basica.
- [x] T3.2 Reexecutar suites de upload/dedupe/metricas.
- [x] T3.3 Cobrir autorizacao admin (`403`) para endpoints tecnicos.
- [x] T3.4 Cobrir retencao da tabela `upload_dedupe_cleanup_runs`.
- [x] T3.5 Cobrir timeout, jitter e cleanup em lotes.
- [x] T3.6 Cobrir alerta por falhas consecutivas (>=3).
- [x] T3.7 Rodar lint frontend do atendimento (regressao basica).
- Criterio de conclusao: CA-001..CA-012 cobertos por testes e smoke local.
- Risco: testes flakey por dependencia de relogio.
- Rollback: congelar datas em fixtures deterministicas.

### Fase 4

- [x] T4.1 Validar em stage execucao automatica no startup.
- [x] T4.2 Validar em stage execucao periodica sem restart (intervalo reduzido de teste).
- [x] T4.3 Validar em stage endpoint de status e restricao admin (`403` para nao-admin).
- [x] T4.4 Validar timeout/jitter em stage com configuracao reduzida de teste.
- [x] T4.5 Validar que cleanup manual continua funcional.
- [x] T4.6 Executar smoke em producao apos promocao e fechar `verify.md`.
- Criterio de conclusao: ciclo aprovado em stage e producao.
- Risco: automacao rodar em horario de pico e gerar ruido operacional.
- Rollback: desligar flag e manter rotina manual.

## 3) Plano de testes

- Testes unitarios:
- selecao de janela de execucao (intervalo), lock, timeout, jitter e persistencia de run.
- Testes de integracao:
- endpoint de status e endpoint manual com historico atualizado, controle admin e falhas consecutivas.
- Testes manuais:
- confirmar run automatico no startup, run periodico sem restart, run manual sob demanda e comportamento em backlog alto.

## 4) Dependencias e bloqueios

- Dependencia 1: ciclo anterior de retention manual implantado.
- Dependencia 2: permissao de deploy em stage/producao para validar startup.
- Dependencia 3: ambiente com duas instancias (ou simulacao) para validar lock em concorrencia.

## 5) Checklist para iniciar execucao

- [x] `intent.md` aprovado.
- [x] `spec.md` aprovado.
- [x] Fases e rollback revisados.
- [x] Ambiente de teste definido (local/stage).
