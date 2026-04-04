# Plan - atendimento-upload-race-guard

Data: 2026-04-04  
Responsavel: Equipe FortCordis  
Status: in-progress

## 1) Sequencia de fases

- Fase 1 (DB/migracoes): adicionar `dedupe_key` e indice unico.
- Fase 2 (backend/API): gerar chave, tratar `IntegrityError` e responder idempotente.
- Fase 3 (frontend): validar UX atual para resposta deduplicada em corrida.
- Fase 4 (qualidade): ampliar testes e checklist manual.

## 2) Tarefas por fase

### Fase 1

- [ ] T1.1 Criar migracao para coluna `dedupe_key` em `anexos_atendimentos`.
- [ ] T1.2 Criar indice unico `(atendimento_id, origem, dedupe_key)`.
- Criterio de conclusao: schema apto a bloquear duplicidade concorrente.
- Risco: sintaxe de indice entre dialetos.
- Rollback: migracao corretiva removendo indice unico.

### Fase 2

- [ ] T2.1 Gerar `dedupe_key` no fluxo de upload (`scope_exame + arquivo_hash`).
- [ ] T2.2 Tratar `IntegrityError` na insercao para recuperar anexo existente.
- [ ] T2.3 Evitar lixo no storage quando houver colisao apos escrita.
- Criterio de conclusao: endpoint idempotente sob corrida.
- Risco: limpeza de arquivo fisico em caminho de erro.
- Rollback: fallback para consulta pre-insert sem constraint.

### Fase 3

- [ ] T3.1 Confirmar que frontend continua tratando `deduplicado=true` normalmente.
- [ ] T3.2 Ajustar mensagem apenas se necessario.
- Criterio de conclusao: sem regressao visual no upload.
- Risco: mensagem ambigua para usuario.
- Rollback: manter texto atual de dedupe.

### Fase 4

- [ ] T4.1 Adicionar teste simulando `IntegrityError` e recuperacao de anexo.
- [ ] T4.2 Rodar suites de upload backend + lint frontend.
- [ ] T4.3 Executar checklist manual em stage e atualizar `verify.md`.
- Criterio de conclusao: CA-001..CA-005 marcados `ok`.
- Risco: cobertura parcial de concorrencia real.
- Rollback: segurar promocao para `main`.

## 3) Plano de testes

- Testes unitarios:
- fluxo de `dedupe_key` e tratamento de colisao.
- Testes de integracao:
- endpoint retorna `200 deduplicado` apos `IntegrityError`.
- Testes manuais:
- disparar uploads identicos quase simultaneos no mesmo atendimento/exame.

## 4) Dependencias e bloqueios

- Dependencia 1: comportamento de transacao do banco em stage/producao.
- Dependencia 2: manutencao do contrato `deduplicado` no frontend.

## 5) Checklist para iniciar execucao

- [x] `intent.md` aprovado.
- [x] `spec.md` aprovado.
- [x] Fases e rollback revisados.
- [x] Ambiente de teste definido (local/stage).
