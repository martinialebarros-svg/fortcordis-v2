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
- `META_APP_ID`
- `WHATSAPP_BUSINESS_ACCOUNT_ID`
- identidade de stage distinta do numero, app e WABA de producao
- relacionamento real na Graph API: token -> numero -> WABA -> app assinado
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

# Apenas para fixtures locais; nao usar como evidencia de stage funcional
SKIP_META_GRAPH_CHECKS=1 bash scripts/whatsapp_stage_preflight.sh

# Confere tambem a identidade esperada cadastrada no pipeline
EXPECTED_PHONE_NUMBER_ID=<id-stage> \
EXPECTED_META_APP_ID=<id-stage> \
EXPECTED_BUSINESS_ACCOUNT_ID=<id-stage> \
bash scripts/whatsapp_stage_preflight.sh
```

## Resultado esperado

- `Resultado: PASS (0 falha(s), X aviso(s))`

Se houver falha:

1. Corrigir os GitHub Secrets/Variables de stage; nao copiar valores de
   producao nem editar o callback de producao.
2. Reexecutar o workflow para atualizar o `.env` protegido de forma atomica.
3. Reexecutar `RUN_SMOKE=1 bash scripts/whatsapp_stage_preflight.sh`.

O pipeline usa os Secrets `WHATSAPP_ACCESS_TOKEN_STAGE`,
`WHATSAPP_APP_SECRET_STAGE`, `WHATSAPP_VERIFY_TOKEN_STAGE` e as Variables
`WHATSAPP_PHONE_NUMBER_ID_STAGE`, `WHATSAPP_META_APP_ID_STAGE`,
`WHATSAPP_BUSINESS_ACCOUNT_ID_STAGE`.

Para tratamento de incidente em producao/stage (API, auth, webhook, backlog), consultar:

- `docs/WHATSAPP-INCIDENT-RUNBOOK.md`
