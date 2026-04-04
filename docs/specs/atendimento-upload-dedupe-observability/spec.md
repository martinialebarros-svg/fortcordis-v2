# Spec - atendimento-upload-dedupe-observability

Data: 2026-04-04  
Responsavel: Equipe FortCordis  
Status: approved

## 1) Escopo funcional

Instrumentar o fluxo de upload deduplicado no backend com logs estruturados e metrica simples de eventos (upload novo, dedupe por consulta previa, dedupe por colisao de unicidade). Disponibilizar consulta basica por dia para acompanhamento operacional.

## 2) Requisitos funcionais (RF)

- RF-001: registrar evento de upload novo (`deduplicado=false`) com contexto minimo.
- RF-002: registrar evento de dedupe por match previo (`deduplicado=true`, fonte=`precheck`).
- RF-003: registrar evento de dedupe por corrida (`deduplicado=true`, fonte=`integrity_collision`).
- RF-004: persistir contador/evento com data para agregacao diaria.
- RF-005: oferecer consulta backend simples para total diario (global e opcional por clinica).

## 3) Requisitos nao funcionais (NFR)

- NFR-001 (observabilidade): logs com chave/valor consistente e sem dados sensiveis.
- NFR-002 (performance): overhead minimo no caminho de upload.
- NFR-003 (confiabilidade): falha na coleta de metrica nao deve quebrar upload.

## 4) Contratos tecnicos

### API

- Endpoints afetados:
- `POST /api/v1/atendimentos/{id}/anexos/upload` (somente instrumentacao, sem quebra de contrato)
- novo endpoint de consulta (proposto): `GET /api/v1/atendimentos/upload-metrics/dedupe`
- Resposta proposta do endpoint de metrica:
- `date`, `uploads_novos`, `dedupe_precheck`, `dedupe_collision`, `total_uploads`.

### Banco/migracoes

- Tabelas/colunas afetadas:
- nova tabela leve de eventos/contadores de upload dedupe (proposta: `upload_dedupe_metricas`).
- Migracao necessaria: sim.

### Frontend

- Tela afetada: nenhuma obrigatoria neste ciclo.
- Uso inicial: consulta tecnica/operacional (API/logs).

## 5) Compatibilidade e rollout

- Backward compatibility: sem alteracao de contrato de upload para cliente final.
- Feature flag (se houver): nao.
- Estrategia de rollback: desligar escrita de metrica e manter apenas logs.

## 6) Criterios de aceitacao (CA)

- CA-001: uploads novos incrementam contador diario de `uploads_novos`.
- CA-002: dedupe precheck incrementa contador diario de `dedupe_precheck`.
- CA-003: dedupe por colisao incrementa contador diario de `dedupe_collision`.
- CA-004: endpoint de consulta retorna agregados diarios coerentes.
- CA-005: falha de escrita de metrica nao interrompe upload.

## 7) Casos de borda

- CB-001: upload concluido sem dedupe em horario de virada de dia.
- CB-002: dedupe por colisao em alta concorrencia.
- CB-003: indisponibilidade temporaria de escrita da metrica.

## 8) Fora de escopo

- Dashboard web completo de observabilidade.
- Alertas automaticos por limiar.
