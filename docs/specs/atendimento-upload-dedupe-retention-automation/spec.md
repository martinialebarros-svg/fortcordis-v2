# Spec - atendimento-upload-dedupe-retention-automation

Data: 2026-04-04  
Responsavel: Equipe FortCordis  
Status: draft

## 1) Escopo funcional

Automatizar a execucao do cleanup de metricas de dedupe para reduzir dependencia manual. A rotina deve rodar em cadence de 24h, respeitar a retencao configurada e registrar resultado de cada execucao. Alem do endpoint manual existente, a API deve expor status do ultimo cleanup para suporte operacional.

## 2) Requisitos funcionais (RF)

- RF-001: adicionar configuracao `UPLOAD_DEDUPE_METRICS_AUTOCLEAN_ENABLED` (padrao `true`).
- RF-002: adicionar configuracao `UPLOAD_DEDUPE_METRICS_AUTOCLEAN_INTERVAL_HOURS` (padrao `24`, minimo `1`).
- RF-003: executar cleanup automatico no startup apenas quando intervalo minimo desde ultimo sucesso for atingido.
- RF-004: registrar cada execucao (manual/automatica) com resultado (`success`/`error`), `deleted_rows`, `cutoff_date` e timestamps.
- RF-005: manter endpoint manual `POST /api/v1/atendimentos/upload-metrics/dedupe/cleanup` funcionando.
- RF-006: adicionar endpoint tecnico `GET /api/v1/atendimentos/upload-metrics/dedupe/cleanup/status` com ultimo resultado conhecido.

## 3) Requisitos nao funcionais (NFR)

- NFR-001 (performance): automacao nao deve bloquear startup por tempo excessivo; execucao deve ser curta e baseada em indice por `created_at`.
- NFR-002 (confiabilidade): falha no cleanup automatico nao deve derrubar aplicacao.
- NFR-003 (concorrencia): evitar execucoes automaticas duplicadas na mesma janela de tempo.
- NFR-004 (observabilidade): logs devem distinguir executor `manual` vs `automatic`.

## 4) Contratos tecnicos

### API

- Endpoint existente: `POST /api/v1/atendimentos/upload-metrics/dedupe/cleanup`
- Ajuste de resposta (proposto): incluir `executor` e `status`.
- Novo endpoint: `GET /api/v1/atendimentos/upload-metrics/dedupe/cleanup/status`
- Resposta status:
- `last_run_at`, `last_success_at`, `last_status`, `last_deleted_rows`, `last_cutoff_date`, `last_error`.

### Banco/migracoes

- Nova tabela: `upload_dedupe_cleanup_runs`
- Colunas minimas: `id`, `executor`, `status`, `retention_days`, `cutoff_date`, `deleted_rows`, `error_message`, `started_at`, `finished_at`, `created_at`.
- Indices: `created_at`, `status`, `executor`.
- Migracao necessaria: sim.

### Frontend

- Nao obrigatorio neste ciclo.

## 5) Compatibilidade e rollout

- Backward compatibility: manter contrato atual do cleanup manual sem quebra.
- Feature flag: usar `UPLOAD_DEDUPE_METRICS_AUTOCLEAN_ENABLED` para ativar/desativar automacao.
- Estrategia de rollback: desativar flag de automacao e manter somente cleanup manual.

## 6) Criterios de aceitacao (CA)

- CA-001: cleanup automatico roda no startup quando intervalo de 24h esta vencido.
- CA-002: cleanup automatico nao roda novamente dentro da mesma janela.
- CA-003: endpoint de status retorna ultimo resultado de forma consistente.
- CA-004: falhas no automatic cleanup ficam registradas sem indisponibilizar API.
- CA-005: fluxo manual existente segue funcional apos automacao.

## 7) Casos de borda

- CB-001: tabela de metricas vazia (`deleted_rows = 0`).
- CB-002: `UPLOAD_DEDUPE_METRICS_AUTOCLEAN_INTERVAL_HOURS` invalido no ambiente.
- CB-003: duas instancias iniciando quase ao mesmo tempo.

## 8) Fora de escopo

- Dashboard grafico de historico de cleanup.
- Agendamento externo por cron/systemd timer.
