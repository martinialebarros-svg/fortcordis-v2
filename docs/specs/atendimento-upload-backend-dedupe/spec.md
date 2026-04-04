# Spec - atendimento-upload-backend-dedupe

Data: 2026-04-04  
Responsavel: Equipe FortCordis  
Status: approved

## 1) Escopo funcional

Introduzir deduplicacao no backend para upload de anexos por hash de conteudo, com escopo por atendimento e exame. Em caso de duplicado equivalente, o backend deve retornar o anexo existente sem gravar novo arquivo nem novo registro.

## 2) Requisitos funcionais (RF)

- RF-001: calcular hash SHA-256 do conteudo no fluxo de upload.
- RF-002: persistir hash do arquivo em `anexos_atendimentos` para anexos de origem `upload`.
- RF-003: antes de gravar arquivo, verificar existencia de anexo com mesmo `atendimento_id`, `exame_id`, `arquivo_hash` e `origem='upload'`.
- RF-004: quando duplicado, retornar item existente com `deduplicado=true` sem criar novo registro/arquivo.
- RF-005: upload nao duplicado segue fluxo atual com resposta de criacao.
- RF-006: manter validacoes de tipo/tamanho existentes sem regressao.

## 3) Requisitos nao funcionais (NFR)

- NFR-001 (confiabilidade): dedupe deve ser deterministico e idempotente para mesma carga.
- NFR-002 (performance): calculo de hash nao deve introduzir degradacao perceptivel no fluxo atual.
- NFR-003 (observabilidade): log explicito quando dedupe evitar nova persistencia.

## 4) Contratos tecnicos

### API

- Endpoint: `POST /api/v1/atendimentos/{atendimento_id}/anexos/upload`
- Metodo: `POST` multipart/form-data
- Payload: sem alteracao
- Resposta:
- novo upload: manter payload de anexo atual + `deduplicado=false`.
- upload duplicado: status `200` com anexo existente + `deduplicado=true`.

### Banco/migracoes

- Tabelas/colunas afetadas: `anexos_atendimentos`.
- Alteracoes:
- nova coluna `arquivo_hash` (`String(64)`, nullable inicialmente).
- indice composto recomendado: `(atendimento_id, exame_id, arquivo_hash, origem)`.
- Migracao necessaria: sim (nova versao em `backend/migrations/versions`).

### Frontend

- Telas afetadas: `frontend/app/atendimento/page.tsx` (consumo do novo campo opcional `deduplicado`).
- Estados de UI: manter fluxo atual; opcionalmente mostrar mensagem contextual para dedupe.
- Regras de exibicao/erro: dedupe nao deve aparecer como erro.

## 5) Compatibilidade e rollout

- Backward compatibility: endpoint e payload de request inalterados.
- Feature flag (se houver): nao.
- Estrategia de rollback: revert da migracao (mantendo coluna nullable) e do ajuste de endpoint; fallback para comportamento atual.

## 6) Criterios de aceitacao (CA)

- CA-001: upload duplicado no mesmo atendimento/exame retorna `200` com `deduplicado=true` e mesmo `id` do anexo existente.
- CA-002: upload de conteudo diferente continua retornando criacao normal.
- CA-003: upload do mesmo arquivo em atendimento diferente nao e deduplicado.
- CA-004: nenhum arquivo extra e criado em disco para caso deduplicado.
- CA-005: testes `test_atendimento_upload_service.py` e `test_atendimento_upload_endpoint.py` atualizados e aprovados.

## 7) Casos de borda

- CB-001: `exame_id` nulo vs `exame_id` preenchido para mesmo arquivo.
- CB-002: arquivo igual com nome diferente (dedupe deve ocorrer pelo hash).
- CB-003: concorrencia de dois uploads identicos quase simultaneos.

## 8) Fora de escopo

- Deduplicacao global cross-atendimento.
- Reprocessamento retroativo para anexos antigos sem hash.
