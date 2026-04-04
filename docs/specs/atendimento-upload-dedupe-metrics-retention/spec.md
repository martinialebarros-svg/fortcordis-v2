# Spec - atendimento-upload-dedupe-metrics-retention

Data: 2026-04-04  
Responsavel: Equipe FortCordis  
Status: approved

## 1) Escopo funcional

Implementar politica de retencao para `upload_dedupe_metricas`, removendo registros com mais de 90 dias e mantendo endpoint de consulta focado na janela operacional recente. A limpeza deve ser segura e mensuravel (quantidade removida).

## 2) Requisitos funcionais (RF)

- RF-001: definir `UPLOAD_DEDUPE_METRICS_RETENTION_DAYS=90` como padrao de retencao.
- RF-002: criar rotina de cleanup que remova registros anteriores ao cutoff.
- RF-003: retornar quantidade de linhas removidas na execucao de cleanup.
- RF-004: disponibilizar acao backend para executar cleanup manual (uso tecnico/admin).
- RF-005: registrar log do cleanup com cutoff e total removido.

## 3) Requisitos nao funcionais (NFR)

- NFR-001 (seguranca operacional): cleanup nao deve afetar tabela de anexos clinicos.
- NFR-002 (performance): cleanup deve usar filtro por data indexada.
- NFR-003 (confiabilidade): falha no cleanup nao deve interromper fluxo de upload.

## 4) Contratos tecnicos

### API

- Endpoints:
- manter `GET /api/v1/atendimentos/upload-metrics/dedupe`
- adicionar endpoint tecnico (proposto): `POST /api/v1/atendimentos/upload-metrics/dedupe/cleanup`
- Resposta cleanup:
- `retention_days`, `cutoff_date`, `deleted_rows`

### Banco/migracoes

- Tabelas afetadas: `upload_dedupe_metricas` (delete por `created_at`).
- Indices: reutilizar indice por `created_at` ja existente.
- Migracao necessaria: nao obrigatoria (so se houver ajuste de indice).

### Frontend

- Nao obrigatorio neste ciclo.

## 5) Compatibilidade e rollout

- Backward compatibility: sem impacto em contratos de upload/anexo.
- Feature flag (se houver): nao.
- Estrategia de rollback: desativar endpoint/rotina de cleanup.

## 6) Criterios de aceitacao (CA)

- CA-001: cleanup remove apenas registros anteriores ao cutoff (90 dias).
- CA-002: cleanup retorna total removido corretamente.
- CA-003: consultas de metrica seguem funcionais apos cleanup.
- CA-004: testes cobrem cenarios com e sem dados expirados.
- CA-005: nenhuma regressao nos testes atuais de upload/dedupe.

## 7) Casos de borda

- CB-001: tabela sem registros antigos (`deleted_rows = 0`).
- CB-002: registros exatamente no limite do cutoff (nao remover).
- CB-003: clock drift/timezone em comparacao de datas.

## 8) Fora de escopo

- Arquivamento historico em storage externo.
- Politica diferenciada por clinica.
