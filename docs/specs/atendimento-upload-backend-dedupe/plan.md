# Plan - atendimento-upload-backend-dedupe

Data: 2026-04-04  
Responsavel: Equipe FortCordis  
Status: in-progress

## 1) Sequencia de fases

- Fase 1 (DB/migracoes): adicionar coluna/hash e indice de suporte.
- Fase 2 (backend/API): aplicar logica de dedupe no endpoint/upload service.
- Fase 3 (frontend): consumir sinal de dedupe sem erro visual.
- Fase 4 (qualidade/rollout): testes automatizados + checklist local/stage.

## 2) Tarefas por fase

### Fase 1

- [ ] T1.1 Criar migracao com coluna `arquivo_hash` em `anexos_atendimentos`.
- [ ] T1.2 Criar indice composto para busca de dedupe.
- Criterio de conclusao: schema atualizado sem quebrar leitura/escrita atual.
- Risco: incompatibilidade de sintaxe entre SQLite e Postgres.
- Rollback: migracao com guardas por dialeto e revert logico.

### Fase 2

- [ ] T2.1 Calcular SHA-256 no fluxo de upload.
- [ ] T2.2 Consultar duplicado por `atendimento_id/exame_id/arquivo_hash/origem`.
- [ ] T2.3 Retornar anexo existente com `deduplicado=true` sem persistir novo arquivo.
- [ ] T2.4 Registrar logs de dedupe.
- Criterio de conclusao: dedupe backend funcional e idempotente.
- Risco: condicao de corrida em uploads simultaneos.
- Rollback: desligar dedupe e manter apenas fluxo atual de upload.

### Fase 3

- [ ] T3.1 Ajustar frontend para lidar com `deduplicado=true` sem erro.
- [ ] T3.2 Exibir mensagem amigavel opcional quando dedupe ocorrer.
- Criterio de conclusao: UX consistente para upload novo e deduplicado.
- Risco: confusao de mensagem com sucesso padrao.
- Rollback: ignorar flag no frontend e manter mensagem atual.

### Fase 4

- [ ] T4.1 Atualizar testes de service para hash/dedupe.
- [ ] T4.2 Atualizar testes de endpoint para status e payload deduplicado.
- [ ] T4.3 Executar checklist manual local/stage e preencher `verify.md`.
- Criterio de conclusao: CA-001..CA-005 em `ok`.
- Risco: cobertura insuficiente de concorrencia.
- Rollback: segurar promocao para main ate estabilizar.

## 3) Plano de testes

- Testes unitarios:
- `backend/tests/test_atendimento_upload_service.py` (hash, dedupe, sem escrita duplicada).
- Testes de integracao:
- `backend/tests/test_atendimento_upload_endpoint.py` (status/payload deduplicado).
- Testes manuais:
- subir mesmo arquivo duas vezes no mesmo atendimento/exame;
- subir mesmo arquivo em atendimento diferente;
- validar comportamento de UI em dedupe.

## 4) Dependencias e bloqueios

- Dependencia 1: migracao `backend/migrations/versions` executada em stage/producao.
- Dependencia 2: alinhamento do contrato de resposta (`200` + `deduplicado=true`).

## 5) Checklist para iniciar execucao

- [x] `intent.md` aprovado.
- [x] `spec.md` aprovado.
- [x] Fases e rollback revisados.
- [x] Ambiente de teste definido (local/stage).
