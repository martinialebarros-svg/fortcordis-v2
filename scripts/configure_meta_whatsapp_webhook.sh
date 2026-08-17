#!/usr/bin/env bash
set -euo pipefail

META_APP_ID="${META_APP_ID:-975334532125008}"
META_APP_SECRET="${META_APP_SECRET:-}"
WHATSAPP_VERIFY_TOKEN="${WHATSAPP_VERIFY_TOKEN:-}"
META_GRAPH_API_VERSION="${META_GRAPH_API_VERSION:-v26.0}"
META_WHATSAPP_CALLBACK_URL="${META_WHATSAPP_CALLBACK_URL:-}"
META_GRAPH_BASE_URL="${META_GRAPH_BASE_URL:-https://graph.facebook.com}"
CURL_BIN="${CURL_BIN:-curl}"

case "${META_WHATSAPP_CALLBACK_URL}" in
  https://app.fortcordis.com.br/whatsapp/webhook|https://app.stage.fortcordis.com.br/whatsapp/webhook)
    ;;
  *)
    echo "[ERROR] Callback URL is not in the FortCordis allowlist." >&2
    exit 1
    ;;
esac

if [[ ! "${META_APP_ID}" =~ ^[0-9]+$ ]]; then
  echo "[ERROR] META_APP_ID is invalid." >&2
  exit 1
fi
if [[ ! "${META_APP_SECRET}" =~ ^[[:xdigit:]]{32}$ ]]; then
  echo "[ERROR] META_APP_SECRET is missing or invalid." >&2
  exit 1
fi
if [[ -z "${WHATSAPP_VERIFY_TOKEN}" || ${#WHATSAPP_VERIFY_TOKEN} -lt 16 ]]; then
  echo "[ERROR] WHATSAPP_VERIFY_TOKEN is missing or invalid." >&2
  exit 1
fi
if [[ ! "${META_GRAPH_API_VERSION}" =~ ^v[0-9]+\.[0-9]+$ ]]; then
  echo "[ERROR] META_GRAPH_API_VERSION is invalid." >&2
  exit 1
fi

for required_command in "${CURL_BIN}" jq; do
  if ! command -v "${required_command}" >/dev/null 2>&1; then
    echo "[ERROR] Missing command: ${required_command}" >&2
    exit 1
  fi
done

umask 077
current_response="$(mktemp)"
update_response="$(mktemp)"
verified_response="$(mktemp)"
trap 'rm -f "${current_response}" "${update_response}" "${verified_response}"' EXIT

app_access_token="${META_APP_ID}|${META_APP_SECRET}"
subscriptions_url="${META_GRAPH_BASE_URL}/${META_GRAPH_API_VERSION}/${META_APP_ID}/subscriptions"

graph_get() {
  local output_file="$1"
  "${CURL_BIN}" --silent --show-error --output "${output_file}" --write-out '%{http_code}' \
    --get "${subscriptions_url}" \
    --data-urlencode "access_token=${app_access_token}"
}

http_status="$(graph_get "${current_response}")"
if [[ "${http_status}" != "200" ]]; then
  error_code="$(jq -r '.error.code // "unknown"' "${current_response}" 2>/dev/null || printf 'unknown')"
  echo "[ERROR] Meta subscription lookup failed (HTTP ${http_status}, code ${error_code})." >&2
  exit 1
fi

subscription_filter='.data[] | select(.object == "whatsapp_business_account")'
current_callback="$(jq -r "${subscription_filter} | .callback_url // empty" "${current_response}" | head -n 1)"
subscription_fields="$(
  jq -r "${subscription_filter} | .fields | map(if type == \"object\" then .name else . end) | map(select(type == \"string\" and length > 0)) | unique | join(\",\")" \
    "${current_response}" | head -n 1
)"
include_values="$(jq -r "${subscription_filter} | .include_values // false" "${current_response}" | head -n 1)"

if [[ -z "${subscription_fields}" ]]; then
  echo "[ERROR] Meta returned no subscribed WhatsApp webhook fields." >&2
  exit 1
fi
if [[ ",${subscription_fields}," != *",messages,"* ]]; then
  echo "[ERROR] The messages webhook field is not subscribed; callback was not changed." >&2
  exit 1
fi
if [[ "${include_values}" != "true" && "${include_values}" != "false" ]]; then
  echo "[ERROR] Meta returned an invalid include_values state." >&2
  exit 1
fi

if [[ "${current_callback}" != "${META_WHATSAPP_CALLBACK_URL}" ]]; then
  http_status="$(
    "${CURL_BIN}" --silent --show-error --output "${update_response}" --write-out '%{http_code}' \
      --request POST "${subscriptions_url}" \
      --data-urlencode "object=whatsapp_business_account" \
      --data-urlencode "callback_url=${META_WHATSAPP_CALLBACK_URL}" \
      --data-urlencode "verify_token=${WHATSAPP_VERIFY_TOKEN}" \
      --data-urlencode "fields=${subscription_fields}" \
      --data-urlencode "include_values=${include_values}" \
      --data-urlencode "access_token=${app_access_token}"
  )"
  if [[ "${http_status}" != "200" ]] || [[ "$(jq -r '.success // false' "${update_response}" 2>/dev/null)" != "true" ]]; then
    error_code="$(jq -r '.error.code // "unknown"' "${update_response}" 2>/dev/null || printf 'unknown')"
    echo "[ERROR] Meta callback update failed (HTTP ${http_status}, code ${error_code})." >&2
    exit 1
  fi
fi

http_status="$(graph_get "${verified_response}")"
if [[ "${http_status}" != "200" ]]; then
  echo "[ERROR] Meta callback verification lookup failed (HTTP ${http_status})." >&2
  exit 1
fi

verified_callback="$(jq -r "${subscription_filter} | .callback_url // empty" "${verified_response}" | head -n 1)"
verified_fields="$(
  jq -r "${subscription_filter} | .fields | map(if type == \"object\" then .name else . end) | map(select(type == \"string\" and length > 0)) | unique | join(\",\")" \
    "${verified_response}" | head -n 1
)"

if [[ "${verified_callback}" != "${META_WHATSAPP_CALLBACK_URL}" ]]; then
  echo "[ERROR] Meta did not persist the expected callback URL." >&2
  exit 1
fi
if [[ ",${verified_fields}," != *",messages,"* ]]; then
  echo "[ERROR] The messages field is not subscribed after callback update." >&2
  exit 1
fi

field_count="$(awk -F',' '{print NF}' <<< "${verified_fields}")"
echo "Meta WhatsApp callback verified: ${verified_callback} (fields preserved: ${field_count}, messages subscribed)."
