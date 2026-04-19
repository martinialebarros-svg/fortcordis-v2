# WhatsApp Stage Preflight

Checklist operacional rapido para validar a stack WhatsApp em stage antes (ou logo apos) deploy.

## Quando usar

- Antes de liberar testes de homologacao no `stage`.
- Depois de qualquer alteracao em:
- `scripts/deploy_stage_vps.sh`
- `scripts/deploy_prod_vps.sh`
- `whatsapp-stage-backend/.env`
- autenticacao/ACL do backend WhatsApp.

## Comando padrao (VPS stage)

```bash
cd /var/www/fortcordis-stage
bash scripts/whatsapp_stage_preflight.sh
```

## Com smoke funcional completo

```bash
cd /var/www/fortcordis-stage
RUN_SMOKE=1 bash scripts/whatsapp_stage_preflight.sh
```

## O que o preflight valida

- `.env` do WhatsApp stage existe.
- Variaveis obrigatorias existem e nao estao em placeholder:
- `WHATSAPP_ACCESS_TOKEN`
- `PHONE_NUMBER_ID`
- `WHATSAPP_VERIFY_TOKEN`
- `WHATSAPP_APP_SECRET`
- `WHATSAPP_INTERNAL_API_TOKEN`
- Modo seguro:
- `WHATSAPP_API_AUTH_ENABLED=true`
- `WEBHOOK_ALLOW_UNSIGNED=false`
- `NODE_ENV=production`
- ACL:
- `WHATSAPP_ALLOWED_PAPEIS`
- `WHATSAPP_WRITE_ALLOWED_PAPEIS`
- Services ativos (quando `systemctl` disponivel):
- `fortcordis-stage-backend`
- `fortcordis-stage-frontend`
- `fortcordis-stage-whatsapp-backend`
- Health/rewrite:
- `http://127.0.0.1:8001/health`
- `http://127.0.0.1:3010/health`
- `http://127.0.0.1:3001/whatsapp`
- Auth gate:
- sem token interno em `/agents` retorna `401`
- com `X-WhatsApp-Internal-Token` em `/agents` retorna `2xx`
- Smoke end-to-end opcional (`RUN_SMOKE=1`).

## Flags uteis

```bash
# Pula checagens de service
SKIP_SERVICE_CHECKS=1 bash scripts/whatsapp_stage_preflight.sh

# Pula checagens HTTP
SKIP_HTTP_CHECKS=1 bash scripts/whatsapp_stage_preflight.sh
```

## Resultado esperado

- `Resultado: PASS (0 falha(s), X aviso(s))`

Se houver falha:

1. Corrigir env em `/var/www/fortcordis-stage/whatsapp-stage-backend/.env`.
2. Reiniciar service `fortcordis-stage-whatsapp-backend`.
3. Reexecutar `RUN_SMOKE=1 bash scripts/whatsapp_stage_preflight.sh`.
