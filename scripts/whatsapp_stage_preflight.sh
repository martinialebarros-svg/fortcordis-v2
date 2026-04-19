#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/fortcordis-stage}"
WHATSAPP_ENV_FILE="${WHATSAPP_ENV_FILE:-${APP_DIR}/whatsapp-stage-backend/.env}"
WHATSAPP_BACKEND_DIR="${WHATSAPP_BACKEND_DIR:-${APP_DIR}/whatsapp-stage-backend}"
WHATSAPP_BACKEND_PORT="${WHATSAPP_BACKEND_PORT:-3010}"
CORE_BACKEND_PORT="${CORE_BACKEND_PORT:-8001}"
FRONTEND_PORT="${FRONTEND_PORT:-3001}"
WHATSAPP_SERVICE="${WHATSAPP_SERVICE:-fortcordis-stage-whatsapp-backend}"
CORE_SERVICE="${CORE_SERVICE:-fortcordis-stage-backend}"
FRONTEND_SERVICE="${FRONTEND_SERVICE:-fortcordis-stage-frontend}"
RUN_SMOKE="${RUN_SMOKE:-0}"
SKIP_SERVICE_CHECKS="${SKIP_SERVICE_CHECKS:-0}"
SKIP_HTTP_CHECKS="${SKIP_HTTP_CHECKS:-0}"
RECOMMENDED_ALLOWED_ROLES="${RECOMMENDED_ALLOWED_ROLES:-admin,recepcao,veterinario,cardiologista}"
RECOMMENDED_WRITE_ROLES="${RECOMMENDED_WRITE_ROLES:-${RECOMMENDED_ALLOWED_ROLES}}"

FAILURES=0
WARNINGS=0

ok() {
  printf '[OK] %s\n' "$1"
}

warn() {
  WARNINGS=$((WARNINGS + 1))
  printf '[WARN] %s\n' "$1"
}

fail() {
  FAILURES=$((FAILURES + 1))
  printf '[FAIL] %s\n' "$1"
}

read_env_file_value() {
  local env_file="$1"
  local key="$2"
  local default_value="${3:-}"

  if [[ ! -f "$env_file" ]]; then
    printf '%s' "$default_value"
    return 0
  fi

  local line
  line="$(grep -E "^${key}=" "$env_file" | tail -n 1 || true)"
  if [[ -z "$line" ]]; then
    printf '%s' "$default_value"
    return 0
  fi

  local value
  value="${line#*=}"
  value="$(printf '%s' "$value" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')"
  value="$(printf '%s' "$value" | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//")"
  printf '%s' "$value"
}

is_placeholder_value() {
  local value="$1"
  local normalized
  normalized="$(printf '%s' "$value" | tr '[:upper:]' '[:lower:]')"

  if [[ -z "$normalized" ]]; then
    return 0
  fi

  case "$normalized" in
    "<"*">")
      return 0
      ;;
    *placeholder*)
      return 0
      ;;
    stage_access_token_placeholder|stage_phone_number_id|stage_verify_token|stage_app_secret)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

assert_required_key_present() {
  local key="$1"
  local value
  value="$(read_env_file_value "$WHATSAPP_ENV_FILE" "$key" "")"

  if [[ -z "$value" ]]; then
    fail "Variavel obrigatoria ausente ou vazia em ${WHATSAPP_ENV_FILE}: ${key}"
    return
  fi

  ok "Variavel presente: ${key}"
}

assert_required_key_non_placeholder() {
  local key="$1"
  local value
  value="$(read_env_file_value "$WHATSAPP_ENV_FILE" "$key" "")"

  if [[ -z "$value" ]]; then
    fail "Variavel obrigatoria ausente ou vazia em ${WHATSAPP_ENV_FILE}: ${key}"
    return
  fi

  if is_placeholder_value "$value"; then
    fail "Variavel ${key} ainda esta com placeholder"
    return
  fi

  ok "Variavel configurada com valor real: ${key}"
}

assert_env_equals() {
  local key="$1"
  local expected="$2"
  local value
  value="$(read_env_file_value "$WHATSAPP_ENV_FILE" "$key" "")"

  if [[ "$value" != "$expected" ]]; then
    fail "Variavel ${key} esperada '${expected}', atual '${value:-<vazio>}'"
    return
  fi

  ok "Variavel ${key} = ${expected}"
}

assert_roles_value() {
  local key="$1"
  local expected="$2"
  local value
  value="$(read_env_file_value "$WHATSAPP_ENV_FILE" "$key" "")"

  if [[ -z "$value" ]]; then
    fail "Variavel ${key} vazia; defina papeis permitidos"
    return
  fi

  ok "Variavel ${key} preenchida"

  if [[ "$value" != "$expected" ]]; then
    warn "${key} diferente da recomendacao (${expected}). Atual: ${value}"
  else
    ok "${key} segue recomendacao atual"
  fi
}

check_service_active() {
  local service="$1"
  local status
  status="$(systemctl is-active "$service" 2>/dev/null || true)"
  if [[ "$status" == "active" ]]; then
    ok "Service ativo: ${service}"
    return
  fi

  fail "Service inativo (${status:-unknown}): ${service}"
}

check_http_ok() {
  local url="$1"
  if curl -fsS "$url" >/dev/null 2>&1; then
    ok "HTTP OK: ${url}"
    return
  fi

  fail "HTTP falhou: ${url}"
}

check_http_status_in_range() {
  local url="$1"
  local label="$2"
  local regex="$3"
  local status
  status="$(curl -sS -o /dev/null -w "%{http_code}" "$url" || true)"

  if [[ "$status" =~ $regex ]]; then
    ok "${label}: HTTP ${status}"
    return
  fi

  fail "${label}: HTTP ${status} (fora do esperado)"
}

printf 'WhatsApp Stage Preflight\n'
printf '========================\n'
printf 'APP_DIR: %s\n' "$APP_DIR"
printf 'WHATSAPP_ENV_FILE: %s\n' "$WHATSAPP_ENV_FILE"
printf '\n'

if [[ ! -f "$WHATSAPP_ENV_FILE" ]]; then
  fail "Arquivo .env do WhatsApp stage nao encontrado: ${WHATSAPP_ENV_FILE}"
  printf '\nResultado: FAIL (%s falha(s), %s aviso(s))\n' "$FAILURES" "$WARNINGS"
  exit 1
fi
ok "Arquivo .env encontrado"

assert_required_key_non_placeholder "WHATSAPP_ACCESS_TOKEN"
assert_required_key_non_placeholder "PHONE_NUMBER_ID"
assert_required_key_non_placeholder "WHATSAPP_VERIFY_TOKEN"
assert_required_key_non_placeholder "WHATSAPP_APP_SECRET"

assert_required_key_present "API_BACKEND_URL"
assert_env_equals "WHATSAPP_API_AUTH_ENABLED" "true"
assert_env_equals "WEBHOOK_ALLOW_UNSIGNED" "false"
assert_env_equals "NODE_ENV" "production"

assert_roles_value "WHATSAPP_ALLOWED_PAPEIS" "$RECOMMENDED_ALLOWED_ROLES"
assert_roles_value "WHATSAPP_WRITE_ALLOWED_PAPEIS" "$RECOMMENDED_WRITE_ROLES"
assert_required_key_non_placeholder "WHATSAPP_INTERNAL_API_TOKEN"

WHATSAPP_VERIFY_TOKEN_VALUE="$(read_env_file_value "$WHATSAPP_ENV_FILE" "WHATSAPP_VERIFY_TOKEN" "")"
WHATSAPP_APP_SECRET_VALUE="$(read_env_file_value "$WHATSAPP_ENV_FILE" "WHATSAPP_APP_SECRET" "")"
WHATSAPP_INTERNAL_API_TOKEN_VALUE="$(read_env_file_value "$WHATSAPP_ENV_FILE" "WHATSAPP_INTERNAL_API_TOKEN" "")"

if [[ "$SKIP_SERVICE_CHECKS" != "1" ]]; then
  if command -v systemctl >/dev/null 2>&1; then
    check_service_active "$CORE_SERVICE"
    check_service_active "$FRONTEND_SERVICE"
    check_service_active "$WHATSAPP_SERVICE"
  else
    warn "systemctl nao encontrado; pulando checagem de services"
  fi
else
  warn "SKIP_SERVICE_CHECKS=1; checagem de services foi pulada"
fi

if [[ "$SKIP_HTTP_CHECKS" != "1" ]]; then
  check_http_ok "http://127.0.0.1:${CORE_BACKEND_PORT}/health"
  check_http_ok "http://127.0.0.1:${WHATSAPP_BACKEND_PORT}/health"
  check_http_status_in_range "http://127.0.0.1:${FRONTEND_PORT}/whatsapp" "Rewrite local /whatsapp" '^[23][0-9][0-9]$'

  if [[ "$(read_env_file_value "$WHATSAPP_ENV_FILE" "WHATSAPP_API_AUTH_ENABLED" "false")" == "true" ]]; then
    local_unauth_status="$(curl -sS -o /dev/null -w "%{http_code}" "http://127.0.0.1:${WHATSAPP_BACKEND_PORT}/agents" || true)"
    if [[ "$local_unauth_status" == "401" ]]; then
      ok "Auth gate sem token: HTTP 401 em /agents"
    else
      fail "Auth gate sem token esperado HTTP 401 em /agents, recebido ${local_unauth_status}"
    fi

    local_internal_status="$(
      curl -sS -o /dev/null -w "%{http_code}" \
        -H "X-WhatsApp-Internal-Token: ${WHATSAPP_INTERNAL_API_TOKEN_VALUE}" \
        "http://127.0.0.1:${WHATSAPP_BACKEND_PORT}/agents" || true
    )"
    if [[ "$local_internal_status" =~ ^2[0-9][0-9]$ ]]; then
      ok "Auth gate com token interno: HTTP ${local_internal_status} em /agents"
    else
      fail "Auth gate com token interno retornou HTTP ${local_internal_status} em /agents (esperado 2xx)"
    fi
  fi
else
  warn "SKIP_HTTP_CHECKS=1; checagem HTTP foi pulada"
fi

if [[ "$RUN_SMOKE" == "1" ]]; then
  if [[ ! -d "$WHATSAPP_BACKEND_DIR" ]]; then
    fail "Diretorio WhatsApp backend nao encontrado: ${WHATSAPP_BACKEND_DIR}"
  elif [[ ! -f "${WHATSAPP_BACKEND_DIR}/scripts/smoke-tests.sh" ]]; then
    fail "Script de smoke nao encontrado: ${WHATSAPP_BACKEND_DIR}/scripts/smoke-tests.sh"
  else
    ok "Executando smoke autenticado do WhatsApp stage"
    if (
      cd "$WHATSAPP_BACKEND_DIR"
      BASE_URL="http://127.0.0.1:${WHATSAPP_BACKEND_PORT}" \
        WHATSAPP_VERIFY_TOKEN="${WHATSAPP_VERIFY_TOKEN_VALUE}" \
        WHATSAPP_APP_SECRET="${WHATSAPP_APP_SECRET_VALUE}" \
        WHATSAPP_INTERNAL_API_TOKEN="${WHATSAPP_INTERNAL_API_TOKEN_VALUE}" \
        bash scripts/smoke-tests.sh
    ); then
      ok "Smoke autenticado concluido"
    else
      fail "Smoke autenticado falhou"
    fi
  fi
else
  warn "RUN_SMOKE=0; smoke funcional nao executado"
fi

printf '\nResultado: %s (%s falha(s), %s aviso(s))\n' \
  "$([[ "$FAILURES" -eq 0 ]] && echo "PASS" || echo "FAIL")" \
  "$FAILURES" "$WARNINGS"

if [[ "$FAILURES" -ne 0 ]]; then
  exit 1
fi
