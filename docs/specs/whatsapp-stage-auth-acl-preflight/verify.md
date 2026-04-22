# Verify - whatsapp-stage-auth-acl-preflight

## Evidencias de validacao

- `whatsapp-stage-backend`: `npm run build` -> OK.
- `whatsapp-stage-backend`: `npm run test:whatsapp-retry` -> OK.
- `frontend`: `npm run build` -> OK.
- `bash -n` em scripts alterados (`deploy_prod_vps.sh`, `deploy_stage_vps.sh`, `smoke-tests.sh`, `whatsapp_stage_preflight.sh`) -> OK.

## Validacao stage (remota)

- SSH no VPS stage estabelecido com sucesso.
- Smoke WhatsApp executado com sucesso usando:
  - `BASE_URL=http://127.0.0.1:3010 bash ./scripts/smoke-tests.sh`
- Observacao: tentativa de deploy manual via SSH local falhou em `systemctl restart` por falta de sudo nao interativo.
  - Impacto: deploy manual local nao finalizado.
  - Mitigacao: deploy oficial deve ocorrer pelo workflow GitHub Actions com secrets.
- Novo criterio operacional validado em codigo: `deploy_prod_vps.sh` agora trata placeholders legados como configuracao invalida e aplica defaults seguros automaticamente.
- Robustez adicional: `deploy_prod_vps.sh` agora auto-corrige placeholders legados exatos (`stage_access_token_placeholder`, `stage_phone_number_id`, `stage_verify_token`, `stage_app_secret`) antes da etapa generica de fallback.

## Status dos criterios de aceitacao

- CA-001: atendido em codigo (middleware retorna 401 sem token).
- CA-002: atendido em codigo (token interno suportado e validado).
- CA-003: atendido.
- CA-004: atendido.
- CA-005: atendido em script/documentacao; execucao completa depende de deploy do commit no stage.

## Pendencia operacional

- Acompanhar run do workflow `Deploy to Stage (VPS)` apos push final na branch `stage` para confirmar aplicacao do commit no servidor.
