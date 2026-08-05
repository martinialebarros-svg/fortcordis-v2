# Plan - atendimento-seguranca-perda-dado

Data: 2026-08-04
Responsavel: Claude (pareado com Martiniano)
Status: em andamento

## 1) Sequencia de fases

- Fase 1 (investigacao): concluida - auditoria multi-dimensao (7
  investigadores + verificacao adversarial), 5 itens selecionados com o
  usuario por prioridade (seguranca + perda de dado).
- Fase 2 (backend): itens A (SSRF), B (laudo_id), D (observacoes
  preservadas), E backend (guard de exclusao de anexo).
- Fase 3 (frontend): item C (merge seletivo do backup local), item E
  frontend (confirm antes de excluir anexo).
- Fase 4 (testes e verificacao): testes novos por item, suite completa,
  build de frontend, revisao adversarial focada.
- Fase 5 (documentacao e release): `verify.md`, commit, guardrail SDD,
  deploy mediante confirmacao do usuario.

## 2) Tarefas por fase

### Fase 2 - Backend

- [x] T2.1 (item A) `attachment_download_service.py`: `_is_public_address`,
  `_hostname_resolves_to_public_address`, `_normalize_remote_url` validando
  host publico; `_is_trusted_storage_host` + `_build_remote_headers(url)`
  so anexando o token para host confiavel; `follow_redirects=False` +
  tratamento explicito de 3xx. Nova config
  `PORTAL_REMOTE_STORAGE_TRUSTED_HOSTS`.
- [x] T2.2 (item B) `_sync_exames`: validar `payload.laudo_id` contra
  `Laudo.paciente_id` antes de aceitar um novo vinculo; preservar
  round-trip do valor ja gravado sem query extra.
- [x] T2.3 (item D) migration `20260804_63` (coluna
  `observacoes_pre_portal` em `exames`, aditiva); model `Exame` atualizado;
  `liberar_exame_no_portal`/`revogar_liberacao_exame_no_portal` gravando e
  restaurando o texto original.
- [x] T2.4 (item E, backend) `excluir_anexo`: bloqueio 409 quando o anexo
  for o unico PDF de um exame liberado no portal.
- Criterio de conclusao: testes novos passando + suite completa sem
  regressao.
- Risco: baixo - mudancas aditivas/validacao extra, sem alterar contratos
  existentes.
- Rollback: reverter o commit; migration aditiva, sem downgrade
  destrutivo necessario.

### Fase 3 - Frontend

- [x] T3.1 (item C) `abrirAtendimento`: destructuring do backup local
  excluindo `especie`/`evolucoes`/`anexos`/`documentos` antes do merge com
  `hydrated`.
- [x] T3.2 (item E, frontend) `excluirAnexo`: `window.confirm` antes do
  `api.delete`.
- Criterio de conclusao: `npm run build` aprovado.
- Risco: baixo - mudancas isoladas e pequenas.
- Rollback: reverter o commit.

### Fase 4 - Testes e verificacao

- [x] T4.1 Testes novos (21): SSRF (9), laudo_id (4), observacoes
  preservadas (2), migration da coluna (2), guard de exclusao de anexo (3),
  mais 1 teste existente ajustado (`test_portal_access_http_flow.py`,
  fixture `_FakeRemoteResponse` precisava de `is_redirect` + mock de DNS
  para o host ficticio do teste).
- [x] T4.2 `pytest tests/ -q --no-header`: 600 passed (baseline 579 + 21).
- [x] T4.3 `npm run build`: aprovado.
- [ ] T4.4 Revisao adversarial focada nos 5 itens.
- Criterio de conclusao: `verify.md` com evidencia de todos os CAs.
- Risco residual: itens C e E (frontend) sem cobertura automatizada - sem
  test runner de frontend no projeto; roteiro manual no `verify.md`.

### Fase 5 - Documentacao e release

- [ ] T5.1 `verify.md` com matriz de rastreabilidade completa.
- [ ] T5.2 Commit no worktree.
- [ ] T5.3 `python3 scripts/ci/check_sdd_guardrail.py`.
- [ ] T5.4 Perguntar ao usuario sobre deploy (stage -> producao).

## 3) Plano de testes

- Backend: 21 testes novos (unitarios, sem rede real - DNS mockado onde
  necessario) + suite completa (600 testes).
- Frontend: `npx tsc --noEmit` + `npm run build`; roteiro manual para os
  itens C e E (sem test runner de frontend).

## 4) Dependencias e bloqueios

- Depende dos pacotes anteriores (`atendimento-integridade-prontuario`,
  `atendimento-persistencia-e-fluidez`, `atendimento-herdar-dados-anteriores`),
  ja em producao.
- Nenhum bloqueio de infraestrutura identificado.

## 5) Checklist para iniciar execucao

- [x] `intent.md` aprovado.
- [x] `spec.md` aprovado.
- [x] Fases e rollback revisados.
