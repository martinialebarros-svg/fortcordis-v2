# WhatsApp Incident Runbook (Stage/Prod)

Runbook operacional para resposta rapida a incidentes no modulo WhatsApp.

## Escopo

Cobertura para:

- indisponibilidade da API WhatsApp backend (`/health` falhando);
- erro de autenticacao/autorizacao (`401/403`) em `/agents` e `/conversations`;
- erro de webhook (assinatura/validacao Meta);
- backlog de eventos e anomalia no worker de cleanup.

## Matriz de ambiente

- Stage:
  - app dir: `/var/www/fortcordis-stage`
  - WhatsApp backend: `http://127.0.0.1:3010`
  - core backend: `http://127.0.0.1:8001`
  - service: `fortcordis-stage-whatsapp-backend`
- Producao:
  - app dir: `/var/www/fortcordis-v2`
  - WhatsApp backend: `http://127.0.0.1:3010` (quando instalado no host prod)
  - core backend: `http://127.0.0.1:8000`
  - service: descobrir via `systemctl list-units 'fortcordis*whatsapp*'`

## Variaveis uteis para execucao

Defina no shell antes de rodar comandos:

```bash
APP_DIR="${APP_DIR:-/var/www/fortcordis-stage}"
WA_SERVICE="${WA_SERVICE:-fortcordis-stage-whatsapp-backend}"
WA_URL="${WA_URL:-http://127.0.0.1:3010}"
```

Em producao, ajuste `APP_DIR` e `WA_SERVICE` conforme o host.

## Checklist inicial (5 minutos)

1. Registrar horario e impacto observado (ex.: envio parado, inbox sem atualizar).
2. Confirmar ambiente afetado (`stage` ou `prod`).
3. Capturar status rapido:

```bash
date
hostname
ss -lntp | egrep ':3010|:8001|:8000|:3001|:3000' || true
```

4. Coletar health:

```bash
curl -sS "${WA_URL}/health"
```

5. Coletar logs recentes:

```bash
sudo journalctl -u "${WA_SERVICE}" -n 200 --no-pager
```

## Cenario A - API WhatsApp indisponivel

Sinais:
- `curl ${WA_URL}/health` falha.
- frontend `/whatsapp` com erro de carregamento.

Resposta:

```bash
sudo systemctl status "${WA_SERVICE}" --no-pager
sudo systemctl restart "${WA_SERVICE}"
sleep 3
curl -sS "${WA_URL}/health"
```

Se persistir:

```bash
cd "${APP_DIR}/whatsapp-stage-backend"
npm run build
sudo journalctl -u "${WA_SERVICE}" -n 300 --no-pager
```

Escalada:
- Se nao recuperar em ate 10 minutos, abrir incidente de deploy/runtime e considerar rollback do ultimo commit.

## Cenario B - 401/403 em rotas protegidas

Sinais:
- `GET /agents` retorna `401` mesmo com token interno.
- usuarios autenticados nao conseguem abrir inbox WhatsApp.

Validacao rapida:

```bash
cd "${APP_DIR}"
bash scripts/whatsapp_stage_preflight.sh
```

Checks criticos no `.env` do WhatsApp:

- `WHATSAPP_API_AUTH_ENABLED=true`
- `WHATSAPP_INTERNAL_API_TOKEN` preenchido (sem placeholder)
- `API_BACKEND_URL` apontando para backend correto do ambiente
- `WHATSAPP_ALLOWED_PAPEIS` e `WHATSAPP_WRITE_ALLOWED_PAPEIS` coerentes com papeis reais

Teste com token interno:

```bash
TOKEN="$(grep -E '^WHATSAPP_INTERNAL_API_TOKEN=' "${APP_DIR}/whatsapp-stage-backend/.env" | tail -n1 | cut -d= -f2-)"
curl -i -H "X-WhatsApp-Internal-Token: ${TOKEN}" "${WA_URL}/agents"
```

Acao:
- corrigir `.env`;
- reiniciar service;
- repetir preflight.

## Cenario C - Webhook rejeitado (assinatura/validacao)

Sinais:
- logs com `401` em `POST /webhook`;
- queda de eventos inbound sem queda geral da API.
- health `200`, mas nenhuma mensagem real nova aparece somente em stage.

Validacoes:

1. `WEBHOOK_ALLOW_UNSIGNED=false` (modo seguro).
2. `WHATSAPP_APP_SECRET` correto no `.env`.
3. endpoint de verificacao responde:

```bash
VERIFY_TOKEN="$(grep -E '^WHATSAPP_VERIFY_TOKEN=' "${APP_DIR}/whatsapp-stage-backend/.env" | tail -n1 | cut -d= -f2-)"
curl -i "${WA_URL}/webhook?hub.mode=subscribe&hub.verify_token=${VERIFY_TOKEN}&hub.challenge=ok"
```

4. No painel Meta, confirmar a URL de callback do app correspondente ao
   ambiente. Se o app estiver apontando para producao, stage nao recebera os
   eventos desse app.

Acao:
- se segredo/token estiver divergente do Meta App, alinhar valores;
- reiniciar service;
- validar chegada de novo evento.
- nunca trocar o callback do app de producao para stage como correcao de
  incidente; stage deve usar app, WABA e numero de teste exclusivos.

## Cenario D - Backlog de webhook_events / cleanup degradado

Sinais:
- crescimento acelerado de `webhook_events`;
- health mostra `observability.webhookEventsCleanup.enabled=true` com `workerRunning=false`;
- latencia alta para processar eventos.

Consultas uteis (Postgres WhatsApp):

```sql
SELECT processing_status, COUNT(*) 
FROM webhook_events
GROUP BY processing_status
ORDER BY 2 DESC;

SELECT COUNT(*) AS older_than_retention
FROM webhook_events
WHERE received_at < now() - interval '30 days';

SELECT status, deleted_rows, duration_ms, started_at, finished_at
FROM webhook_event_cleanup_runs
ORDER BY created_at DESC
LIMIT 20;
```

Acao:
- confirmar variaveis:
  - `WHATSAPP_WEBHOOK_EVENTS_CLEANUP_ENABLED=true`
  - `WHATSAPP_WEBHOOK_EVENTS_RETENTION_DAYS`
  - `WHATSAPP_WEBHOOK_EVENTS_CLEANUP_INTERVAL_MINUTES`
  - `WHATSAPP_WEBHOOK_EVENTS_CLEANUP_BATCH_SIZE`
- reiniciar service para restabelecer worker.
- acompanhar `lastRun` em `/health` por 2 ciclos.

## Pos-incidente

1. Registrar causa raiz (config/deploy/dados externos Meta).
2. Registrar janela do impacto (inicio/fim).
3. Anexar evidencias:
- output de `/health`
- 20-30 linhas relevantes de `journalctl`
- acao aplicada e resultado
4. Abrir item de prevencao (hardening/alerta/automacao) no Linear.
