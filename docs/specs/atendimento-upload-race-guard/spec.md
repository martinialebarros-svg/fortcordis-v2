# Spec - atendimento-upload-race-guard

Data: 2026-04-04  
Responsavel: Equipe FortCordis  
Status: approved

## 1) Escopo funcional

Fortalecer o dedupe backend com garantia de unicidade no banco para uploads de anexos de origem `upload`, evitando duplicacao em requests concorrentes. Em colisao de unicidade, o endpoint deve recuperar o anexo existente e responder de forma idempotente.

## 2) Requisitos funcionais (RF)

- RF-001: persistir uma chave canonica de dedupe (`dedupe_key`) para uploads.
- RF-002: `dedupe_key` deve codificar `exame_id` (com sentinel para `null`) + hash do arquivo.
- RF-003: criar constraint/index unico em `(atendimento_id, origem, dedupe_key)` para uploads.
- RF-004: em tentativa concorrente duplicada, tratar erro de unicidade recuperando o anexo existente.
- RF-005: resposta da tentativa concorrente deduplicada deve ser `200` com `deduplicado=true`.
- RF-006: uploads legitimos diferentes devem continuar sendo salvos normalmente.

## 3) Requisitos nao funcionais (NFR)

- NFR-001 (confiabilidade): garantia de idempotencia sob concorrencia.
- NFR-002 (portabilidade): comportamento consistente entre SQLite e Postgres.
- NFR-003 (observabilidade): logs claros para colisao de unicidade e recuperacao deduplicada.

## 4) Contratos tecnicos

### API

- Endpoint: `POST /api/v1/atendimentos/{atendimento_id}/anexos/upload`
- Metodo: `POST`
- Payload: sem alteracao
- Resposta: sem quebra de contrato; manter `deduplicado` booleano.

### Banco/migracoes

- Tabelas/colunas afetadas: `anexos_atendimentos`
- Alteracoes:
- nova coluna `dedupe_key` (`String(80)` ou equivalente textual)
- indice unico em `(atendimento_id, origem, dedupe_key)`
- Migracao necessaria: sim

### Frontend

- Tela afetada: `frontend/app/atendimento/page.tsx`
- Estados de UI: sem novos estados obrigatorios.
- Regras de exibicao/erro: manter mensagem atual de dedupe sem erro vermelho.

## 5) Compatibilidade e rollout

- Backward compatibility: manter endpoint e fluxo funcional existentes.
- Feature flag (se houver): nao.
- Estrategia de rollback: remover uso de `dedupe_key` no endpoint e desativar constraint em migracao de correção.

## 6) Criterios de aceitacao (CA)

- CA-001: duas requisicoes concorrentes identicas no mesmo escopo resultam em um unico registro.
- CA-002: a segunda requisicao concorrente retorna payload deduplicado sem erro 500.
- CA-003: uploads com `dedupe_key` diferentes continuam criando novos anexos.
- CA-004: testes de endpoint cobrem caminho de colisao de unicidade.
- CA-005: migracao aplica corretamente em SQLite e Postgres.

## 7) Casos de borda

- CB-001: `exame_id = null` em uploads concorrentes.
- CB-002: erro de unicidade disparado apos arquivo ja gravado no storage temporario.
- CB-003: upload deduplicado por corrida com frontend sem dedupe local.

## 8) Fora de escopo

- Lock distribuido cross-processo.
- Deduplicacao entre atendimentos diferentes.
