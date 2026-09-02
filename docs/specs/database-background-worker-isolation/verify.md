# Verificacao — PERF-15

## Local

- [ ] Testes de ciclo de vida confirmam que todos os jobs sao iniciados e
  encerrados pelo processo dedicado.
- [ ] Testes de papel confirmam que a API no papel `api` nao inicia workers.
- [ ] `python -m compileall` e `bash -n scripts/deploy_prod_vps.sh` passam.
- [ ] Suite backend, lint, TypeScript/build do frontend e guardrail SDD passam.

## Stage

- [ ] A API responde `/health` com `process_role=api` e
  `background_workers_managed_externally=true`.
- [ ] `fortcordis-stage-backend-worker` esta `active` no log de deploy.
- [ ] Smoke de rotas publicas, API protegida esperada e fluxo autenticado
  afetado passam sem regressao.

## Producao

- [ ] A promocao usa exatamente o SHA validado em stage.
- [ ] A API e o worker de producao ficam ativos apos o deploy.
- [ ] Os smokes publicos e autenticados registram ausencia de regressao.
