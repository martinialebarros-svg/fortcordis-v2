# Spec - atendimento-upload-dedupe-retention-automation

Data: 2026-04-04  
Responsavel: Equipe FortCordis  
Status: done

## 1) Escopo funcional

Automatizar a execucao do cleanup de metricas de dedupe para reduzir dependencia manual. A rotina deve ser disparada no startup e continuar em loop interno periodico (24h), respeitando a retencao configurada e registrando resultado de cada execucao. Alem do endpoint manual existente, a API deve expor status do ultimo cleanup para suporte operacional com acesso restrito a admin.

## 2) Requisitos funcionais (RF)

- RF-001: adicionar configuracao `UPLOAD_DEDUPE_METRICS_AUTOCLEAN_ENABLED` (padrao `true`).
- RF-002: adicionar configuracao `UPLOAD_DEDUPE_METRICS_AUTOCLEAN_INTERVAL_HOURS` (padrao `24`, minimo `1`).
- RF-003: executar cleanup automatico no startup e em loop interno periodico, respeitando intervalo minimo desde ultimo sucesso.
- RF-004: registrar cada execucao (manual/automatica) com resultado (`success`/`error`), `deleted_rows`, `cutoff_date` e timestamps.
- RF-005: manter endpoint manual `POST /api/v1/atendimentos/upload-metrics/dedupe/cleanup` funcionando.
- RF-006: adicionar endpoint tecnico `GET /api/v1/atendimentos/upload-metrics/dedupe/cleanup/status` com ultimo resultado conhecido.
- RF-007: restringir `POST /api/v1/atendimentos/upload-metrics/dedupe/cleanup` e `GET /api/v1/atendimentos/upload-metrics/dedupe/cleanup/status` para usuarios admin.
- RF-008: aplicar lock de execucao para evitar cleanup concorrente entre instancias.
- RF-009: aplicar retencao no historico de `upload_dedupe_cleanup_runs` (padrao 90 dias).
- RF-010: adicionar configuracao `UPLOAD_DEDUPE_METRICS_AUTOCLEAN_TIMEOUT_SECONDS` (padrao `120`, minimo `30`, maximo `600`).
- RF-011: adicionar configuracao `UPLOAD_DEDUPE_METRICS_AUTOCLEAN_STARTUP_JITTER_SECONDS` (padrao `120`, faixa `0..300`) para espalhar execucoes no boot.
- RF-012: adicionar configuracao `UPLOAD_DEDUPE_METRICS_CLEANUP_BATCH_SIZE` (padrao `5000`, minimo `100`) e executar cleanup em lotes.
- RF-013: rastrear falhas consecutivas de cleanup e sinalizar alerta operacional quando atingir 3 falhas seguidas.

## 3) Requisitos nao funcionais (NFR)

- NFR-001 (performance): automacao nao deve bloquear startup por tempo excessivo; execucao deve ser curta e baseada em indice por `created_at`.
- NFR-002 (confiabilidade): falha no cleanup automatico nao deve derrubar aplicacao.
- NFR-003 (concorrencia): evitar execucoes automaticas duplicadas na mesma janela de tempo usando lock distribuido.
- NFR-004 (observabilidade): logs devem distinguir executor `manual` vs `automatic`.
- NFR-005 (crescimento de dados): historico de cleanup nao pode crescer indefinidamente.
- NFR-006 (resiliencia): execucoes longas devem interromper por timeout sem impactar disponibilidade da API.
- NFR-007 (operabilidade): status deve permitir identificar degradacao por falhas consecutivas.

## 4) Contratos tecnicos

### API

- Endpoint existente: `POST /api/v1/atendimentos/upload-metrics/dedupe/cleanup`
- Permissao: admin.
- Ajuste de resposta (proposto): incluir `executor` e `status`.
- Novo endpoint: `GET /api/v1/atendimentos/upload-metrics/dedupe/cleanup/status`
- Permissao: admin.
- Resposta status:
- `last_run_at`, `last_success_at`, `last_status`, `last_deleted_rows`, `last_cutoff_date`, `last_error`, `consecutive_failures`, `last_duration_ms`.

### Banco/migracoes

- Nova tabela: `upload_dedupe_cleanup_runs`
- Colunas minimas: `id`, `executor`, `status`, `retention_days`, `cutoff_date`, `deleted_rows`, `error_message`, `duration_ms`, `started_at`, `finished_at`, `created_at`.
- Indices: `created_at`, `status`, `executor`.
- Lock de execucao:
- Postgres: `pg_try_advisory_lock` com chave fixa da rotina.
- SQLite/local: lock em memoria por processo (best effort).
- Retencao de historico: remover runs antigos de `upload_dedupe_cleanup_runs` (padrao 90 dias).
- Cleanup em lotes:
- Postgres: `DELETE ... WHERE id IN (SELECT id ... LIMIT :batch_size)` ou equivalente.
- SQLite: estrategia equivalente por lotes para evitar transacoes longas.
- Migracao necessaria: sim.

### Frontend

- Nao obrigatorio neste ciclo.

## 5) Compatibilidade e rollout

- Backward compatibility: manter contrato atual do cleanup manual sem quebra.
- Feature flag: usar `UPLOAD_DEDUPE_METRICS_AUTOCLEAN_ENABLED` para ativar/desativar automacao.
- Estrategia de rollback: desativar flag de automacao e manter somente cleanup manual.

## 6) Criterios de aceitacao (CA)

- CA-001: cleanup automatico roda no startup e volta a rodar sem restart quando o intervalo de 24h vence.
- CA-002: cleanup automatico nao roda novamente dentro da mesma janela.
- CA-003: endpoint de status retorna ultimo resultado de forma consistente.
- CA-004: falhas no automatic cleanup ficam registradas sem indisponibilizar API.
- CA-005: fluxo manual existente segue funcional apos automacao.
- CA-006: endpoints de cleanup/status retornam `403` para usuario autenticado nao-admin.
- CA-007: em cenario multi-instancia, lock impede limpeza concorrente no mesmo instante.
- CA-008: historico de runs aplica retencao e nao cresce indefinidamente.
- CA-009: quando cleanup ultrapassa timeout configurado, run finaliza com erro controlado e API continua saudavel.
- CA-010: startup aplica jitter configurado antes de tentar auto-cleanup.
- CA-011: apos 3 falhas consecutivas, status e logs indicam alerta operacional.
- CA-012: cleanup em lotes remove todo backlog expirado sem transacao monolitica.

## 7) Casos de borda

- CB-001: tabela de metricas vazia (`deleted_rows = 0`).
- CB-002: `UPLOAD_DEDUPE_METRICS_AUTOCLEAN_INTERVAL_HOURS` invalido no ambiente.
- CB-003: duas instancias iniciando quase ao mesmo tempo.
- CB-004: instancia reinicia durante cleanup (run precisa fechar com `error`).
- CB-005: usuario sem papel admin chamando endpoint tecnico.
- CB-006: backlog muito grande de metricas expiradas.
- CB-007: timeout muito baixo configurado por engano.

## 8) Fora de escopo

- Dashboard grafico de historico de cleanup.
- Agendamento externo por cron/systemd timer.
