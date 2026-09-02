# Verificacao — PERF-15

## Local

- [x] Testes de ciclo de vida confirmam que todos os jobs sao iniciados e
  encerrados pelo processo dedicado.
- [x] Testes de papel confirmam que a API no papel `api` nao inicia workers.
- [x] `python -m compileall` e `bash -n scripts/deploy_prod_vps.sh` passam.
- [x] Suite backend, lint, TypeScript/build do frontend e guardrail SDD passam.
- [x] O runtime gate e o canario aceitam uma API sem thread local somente quando
  `background_workers_managed_externally=true`; no modo integrado, a mesma
  ausencia continua bloqueando o deploy.

## Stage

- [x] A API respondeu `/health` com `process_role=api` e
  `background_workers_managed_externally=true` no primeiro deploy de stage.
- [x] `fortcordis-stage-backend-worker` esteve `active` no log de deploy.
- [ ] O primeiro deploy fez rollback automaticamente porque o gate ainda
  exigia a thread local; a correcao do gate sera reenviada para stage.
- [ ] Smoke de rotas publicas, API protegida esperada e fluxo autenticado
  afetado passam sem regressao.

## Producao

- [ ] A promocao usa exatamente o SHA validado em stage.
- [ ] A API e o worker de producao ficam ativos apos o deploy.
- [ ] Os smokes publicos e autenticados registram ausencia de regressao.
