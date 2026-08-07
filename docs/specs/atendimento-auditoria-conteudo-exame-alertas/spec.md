# Spec - atendimento-auditoria-conteudo-exame-alertas

Data: 2026-08-06
Responsavel: Claude (Sonnet 5)
Status: done

## 1) Escopo funcional

`PUT /atendimentos/{id}` passa a auditar o diff de conteudo clinico quando
ha alteracao real. Edicao de campos de um exame existente (via `_sync_exames`)
passa a gravar historico em `exame_ajustes`, exposto no detalhe do
atendimento. CRUD de `AlertaClinico` passa a auditar criacao, edicao (com
diff) e desativacao. `DELETE /atendimentos/{id}` de um atendimento concluido
com OS "Pago" desfaz o recebimento financeiro antes de cancelar a OS.

## 2) Requisitos funcionais (RF)

- RF-001: ao atualizar um atendimento (`PUT /atendimentos/{id}`), se algum
  dos campos de `_CAMPOS_CONTEUDO_CLINICO_AUDITAVEIS` (status, triagem,
  queixa, anamnese, exame fisico, diagnostico, plano terapeutico, retorno,
  observacoes) mudar de valor, registrar auditoria
  `ATENDIMENTO_CONTEUDO_CLINICO_ATUALIZADO` com o diff campo a campo
  (antes/depois).
- RF-002: se nenhum campo clinico mudar, nao registrar auditoria de
  conteudo clinico (evita ruido em saves que so tocam metadados).
- RF-003: ao sincronizar exames (`_sync_exames`), para cada exame JA
  EXISTENTE (nao para exame novo), comparar valores anteriores e novos de
  resultado, valor_referencia, unidade, prioridade, status e observacoes;
  para cada campo que mudou, gravar uma linha em `exame_ajustes` com
  campo, valor_anterior, valor_novo, responsavel e motivo.
- RF-004: `GET /atendimentos/{id}` deve incluir, para cada exame,
  `historico_ajustes`: lista de ajustes ordenada por data decrescente,
  mesmo formato usado pelo historico de ajuste de item de prescricao.
- RF-005: `POST /paciente/{id}/alertas` deve registrar auditoria
  `ALERTA_CLINICO_CRIADO` com tipo, titulo e gravidade.
- RF-006: `PUT /alertas/{id}` deve registrar auditoria
  `ALERTA_CLINICO_ATUALIZADO` apenas quando houver diff real entre valores
  anteriores e novos (tipo, titulo, descricao, gravidade), com o diff
  incluido nos detalhes.
- RF-007: `DELETE /alertas/{id}` deve registrar auditoria
  `ALERTA_CLINICO_DESATIVADO` com o conteudo do alerta desativado.
- RF-008: `DELETE /atendimentos/{id}` de um atendimento vinculado a uma OS
  ativa com `status == "Pago"` deve chamar `desfazer_recebimento_ordem`
  antes de marcar a OS como "Cancelado", revertendo a Transacao associada
  para "Cancelado" e limpando `data_pagamento`.

## 3) Requisitos nao funcionais (NFR)

- NFR-001 (performance): a comparacao de diff usa apenas os valores ja
  carregados na Session (nenhuma query extra por campo); a leitura de
  historico de exame usa uma unica query em lote (`_map_ajustes_por_exame`),
  nao uma por exame.
- NFR-002 (seguranca/permissoes): auditoria registra `current_user`
  (id + nome) em toda acao; nenhuma rota de alerta clinico mais descarta o
  usuario autenticado com `_ = current_user`.
- NFR-003 (observabilidade): toda entrada de auditoria usa
  `registrar_auditoria` (modulo `atendimento`), consistente com o padrao
  ja usado por `_emitir_efeitos_finalizacao`.

## 4) Contratos tecnicos

### API

- `PUT /atendimentos/{id}`: sem mudanca de contrato de request; response
  inalterada (auditoria e efeito colateral interno).
- `GET /atendimentos/{id}`: novo campo `historico_ajustes` (array) dentro de
  cada item de `exames`.
- `POST/PUT/DELETE /paciente/{id}/alertas` e `/alertas/{id}`: sem mudanca de
  contrato; `request: Request` passa a ser parametro obrigatorio dos
  handlers (ja e injetado pelo FastAPI em toda chamada HTTP real).

### Banco/migracoes

- Tabelas/colunas afetadas: nova tabela `exame_ajustes` (id, exame_id,
  atendimento_id, campo, valor_anterior, valor_novo, motivo, responsavel_id,
  responsavel_nome, created_at) - espelha `prescricao_item_ajustes`.
- Indices/constraints: `ix_exame_ajustes_exame_id`,
  `ix_exame_ajustes_atendimento_id`. Sem FK (padrao do modulo).
- Migracao necessaria: sim - `backend/migrations/versions/20260805_64_exame_ajustes.py`.

### Frontend

- Telas afetadas: nenhuma nesta feature (o frontend ainda nao consome
  `historico_ajustes` do exame; fica registrado como trabalho futuro, assim
  como `apoio_clinico` da prescricao ja identificado na auditoria).
- Estados de UI: N/A.
- Regras de exibicao/erro: N/A.

## 5) Compatibilidade e rollout

- Backward compatibility: aditivo - nenhum campo removido ou renomeado;
  clientes que ignoram `historico_ajustes` continuam funcionando.
- Feature flag: nenhuma - auditoria e historico sao sempre ativos.
- Estrategia de rollback: reverter o commit; a tabela `exame_ajustes` pode
  permanecer vazia sem efeito colateral caso a migracao ja tenha rodado.

## 6) Criterios de aceitacao (CA)

- CA-001: alterar diagnostico via PUT gera auditoria com antes/depois.
- CA-002: alterar apenas clinica (sem tocar conteudo clinico) NAO gera
  auditoria de conteudo clinico.
- CA-003: alterar triagem gera auditoria.
- CA-004: editar resultado de exame existente gera historico em
  `exame_ajustes`.
- CA-005: resave sem mudanca no exame nao gera historico.
- CA-006: criar/atualizar (com mudanca)/desativar alerta clinico gera
  auditoria; atualizar sem mudanca nao gera.
- CA-007: excluir atendimento concluido com OS "Pago" desfaz o recebimento
  (Transacao volta a "Cancelado", `data_pagamento` e limpo) antes de
  cancelar a OS.

## 7) Casos de borda

- CB-001: exame novo (sem `payload.id` previo) nao gera historico de ajuste
  (nao ha "valor anterior" - so registra ajuste para exame que ja existia).
- CB-002: excluir atendimento com OS ativa em status diferente de "Pago"
  (ex.: "Pendente") apenas cancela a OS, sem desfazer recebimento (nao ha
  recebimento a desfazer).

## 8) Fora de escopo

- UI para exibir a trilha de auditoria de conteudo clinico e de alertas.
- Auditoria de outras entidades do modulo (documentos clinicos, evolucoes)
  - achados #21 e correlatos da mesma auditoria, nao inclusos aqui.
