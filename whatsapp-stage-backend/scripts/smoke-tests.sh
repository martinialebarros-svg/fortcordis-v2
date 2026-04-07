#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"

if [[ -z "${WHATSAPP_VERIFY_TOKEN:-}" ]]; then
  echo "Set WHATSAPP_VERIFY_TOKEN before running smoke tests."
  exit 1
fi

echo "1) Webhook verification GET"
curl -sS -X GET "${BASE_URL}/webhook?hub.mode=subscribe&hub.verify_token=${WHATSAPP_VERIFY_TOKEN}&hub.challenge=hello"
echo
echo

BODY='{"object":"whatsapp_business_account","entry":[{"id":"WHATSAPP_BUSINESS_ACCOUNT_ID","changes":[{"value":{"contacts":[{"wa_id":"5511999999999","profile":{"name":"Smoke Test User"}}],"messages":[{"from":"5511999999999","id":"wamid.HBgM.SMOKE.TEST","timestamp":"1660000000","text":{"body":"Ola"},"type":"text"}]},"field":"messages"}]}]}'

if [[ "${WEBHOOK_ALLOW_UNSIGNED:-false}" == "true" ]]; then
  echo "2) Webhook message POST without signature (debug mode only)"
  curl -sS -X POST "${BASE_URL}/webhook" \
    -H "Content-Type: application/json" \
    -d "$BODY"
  echo
  echo
fi

echo "2) Webhook message POST with signature"
if [[ -z "${WHATSAPP_APP_SECRET:-}" ]]; then
  echo "Set WHATSAPP_APP_SECRET before running signed webhook test."
  exit 1
fi

SIG=$(printf '%s' "$BODY" | openssl dgst -sha256 -hmac "$WHATSAPP_APP_SECRET" -binary | xxd -p -c 256)
HDR="sha256=${SIG}"

curl -sS -X POST "${BASE_URL}/webhook" \
  -H "Content-Type: application/json" \
  -H "X-Hub-Signature-256: ${HDR}" \
  -d "$BODY"
echo
echo

echo "3) Create an agent"
AGENT_RESPONSE=$(curl -sS -X POST "${BASE_URL}/agents" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"Agent Smoke\",\"email\":\"agent.smoke.$(date +%s)@example.com\",\"role\":\"agent\"}")
echo "$AGENT_RESPONSE"
AGENT_ID=$(printf "%s" "$AGENT_RESPONSE" | node -e "const fs=require('fs');const raw=fs.readFileSync(0,'utf8').trim();if(!raw){process.exit(0);}const d=JSON.parse(raw);process.stdout.write(String(d.id ?? ''));")
echo
echo

echo "4) List conversations"
curl -sS -X GET "${BASE_URL}/conversations?limit=10&page=1"
echo
echo

if [[ -n "${AGENT_ID}" ]]; then
  echo "5) Claim conversation 1 with agent ${AGENT_ID}"
  curl -sS -X POST "${BASE_URL}/conversations/1/claim" \
    -H "Content-Type: application/json" \
    -d "{\"agent_id\":${AGENT_ID}}"
  echo
  echo

  echo "6) Unclaim conversation 1 with agent ${AGENT_ID}"
  curl -sS -X POST "${BASE_URL}/conversations/1/unclaim" \
    -H "Content-Type: application/json" \
    -d "{\"agent_id\":${AGENT_ID}}"
  echo
  echo
fi

if [[ -n "${WHATSAPP_ACCESS_TOKEN:-}" && "${WHATSAPP_ACCESS_TOKEN}" != "<your_token_here>" ]]; then
  echo "7) Send message via conversation endpoint (adjust ID if needed)"
  curl -sS -X POST "${BASE_URL}/conversations/1/messages" \
    -H "Content-Type: application/json" \
    -d '{"body":"Resposta de teste","type":"text"}'
  echo
  echo
else
  echo "7) Skipping Graph API send test because WHATSAPP_ACCESS_TOKEN is not set."
fi

echo "Smoke tests finished."
