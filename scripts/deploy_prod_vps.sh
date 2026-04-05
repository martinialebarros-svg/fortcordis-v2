#!/usr/bin/env bash
set -euo pipefail

# Production deploy script with guardrails:
# - hard reset to origin/main (avoids stash/pop conflicts)
# - backend deps + migrations + health check
# - frontend clean build (.next) + service checks
#
# Usage (on VPS):
#   bash scripts/deploy_prod_vps.sh
#
# Optional env overrides:
#   APP_DIR=/var/www/fortcordis-v2
#   BRANCH=main
#   BACKEND_SERVICE=fortcordis-backend
#   FRONTEND_SERVICE=fortcordis-frontend
#   BACKEND_PORT=8000
#   FRONTEND_PORT=3000
#   PUBLIC_URL=https://app.fortcordis.com.br
#   AUTO_ROLLBACK_ON_FAILURE=1
#   ENABLE_AUTH_CANARY=1
#   AUTH_CANARY_TIMEOUT_SECONDS=8
#   AUTH_CANARY_DISABLE_INTERNAL_TOKEN=0
#   CANARY_BEARER_TOKEN=<token-opcional>
#   CANARY_USERNAME=<usuario-opcional>
#   CANARY_PASSWORD=<senha-opcional>

APP_DIR="${APP_DIR:-/var/www/fortcordis-v2}"
BRANCH="${BRANCH:-main}"

BACKEND_DIR="${APP_DIR}/backend"
FRONTEND_DIR="${APP_DIR}/frontend"

BACKEND_SERVICE="${BACKEND_SERVICE:-fortcordis-backend}"
FRONTEND_SERVICE="${FRONTEND_SERVICE:-fortcordis-frontend}"

BACKEND_PORT="${BACKEND_PORT:-8000}"
FRONTEND_PORT="${FRONTEND_PORT:-3000}"
API_BACKEND_URL="${API_BACKEND_URL:-http://127.0.0.1:${BACKEND_PORT}}"
PUBLIC_URL="${PUBLIC_URL:-https://app.fortcordis.com.br}"

RUNTIME_BACKUP_DIR="${RUNTIME_BACKUP_DIR:-$HOME/fortcordis-runtime-backups}"
AUTO_ROLLBACK_ON_FAILURE="${AUTO_ROLLBACK_ON_FAILURE:-1}"
ENABLE_AUTH_CANARY="${ENABLE_AUTH_CANARY:-1}"
AUTH_CANARY_TIMEOUT_SECONDS="${AUTH_CANARY_TIMEOUT_SECONDS:-8}"
AUTH_CANARY_DISABLE_INTERNAL_TOKEN="${AUTH_CANARY_DISABLE_INTERNAL_TOKEN:-0}"
PRE_DEPLOY_HASH=""
NEW_HASH=""
CODE_UPDATED=0
DEPLOY_STAGE="bootstrap"
ROLLBACK_IN_PROGRESS=0

log() {
  printf '[%s] %s\n' "$(date +%H:%M:%S)" "$*"
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "[ERROR] Missing command: $1" >&2
    exit 1
  }
}

wait_http_ok() {
  local url="$1"
  local tries="${2:-20}"
  local delay="${3:-1}"
  for ((i = 1; i <= tries; i++)); do
    if curl -fsS "$url" >/dev/null 2>&1; then
      return 0
    fi
    sleep "$delay"
  done
  return 1
}

wait_http_head_ok() {
  local url="$1"
  local tries="${2:-20}"
  local delay="${3:-1}"
  for ((i = 1; i <= tries; i++)); do
    if curl -fsSI "$url" >/dev/null 2>&1; then
      return 0
    fi
    sleep "$delay"
  done
  return 1
}

resolve_systemctl_bin() {
  if [[ -n "${SYSTEMCTL_BIN:-}" && -x "${SYSTEMCTL_BIN}" ]]; then
    echo "${SYSTEMCTL_BIN}"
    return 0
  fi
  for candidate in /bin/systemctl /usr/bin/systemctl; do
    if [[ -x "$candidate" ]]; then
      echo "$candidate"
      return 0
    fi
  done
  command -v systemctl 2>/dev/null || true
}

restart_service() {
  local service="$1"
  if command -v sudo >/dev/null 2>&1; then
    if sudo -n "$SYSTEMCTL_BIN" restart "$service"; then
      return 0
    fi
  fi
  if "$SYSTEMCTL_BIN" restart "$service"; then
    return 0
  fi
  echo "[ERROR] Unable to restart service '${service}' automatically." >&2
  echo "[ERROR] Run manually: sudo ${SYSTEMCTL_BIN} restart ${service}" >&2
  return 1
}

print_service_diagnostics() {
  local service="$1"
  if command -v sudo >/dev/null 2>&1; then
    sudo -n "$SYSTEMCTL_BIN" status "$service" --no-pager -l || true
    sudo -n journalctl -u "$service" -n 120 --no-pager || true
    return 0
  fi
  "$SYSTEMCTL_BIN" status "$service" --no-pager -l || true
  journalctl -u "$service" -n 120 --no-pager || true
}

reload_nginx_if_possible() {
  local nginx_bin
  nginx_bin="$(command -v nginx 2>/dev/null || true)"
  if [[ -z "$nginx_bin" ]]; then
    log "Nginx binary not found; skipping nginx reload."
    return 0
  fi

  if command -v sudo >/dev/null 2>&1; then
    if sudo -n "$nginx_bin" -t && sudo -n "$SYSTEMCTL_BIN" reload nginx; then
      return 0
    fi
    log "Skipping nginx reload (non-interactive sudo not allowed for nginx)."
    return 0
  fi

  if "$nginx_bin" -t && "$SYSTEMCTL_BIN" reload nginx; then
    return 0
  fi
  log "Skipping nginx reload (insufficient permissions)."
  return 0
}

backup_runtime_file() {
  local rel_path="$1"
  local src="${APP_DIR}/${rel_path}"
  local dst="${RUNTIME_SNAPSHOT_DIR}/${rel_path}"
  if [[ -f "$src" ]]; then
    mkdir -p "$(dirname "$dst")"
    cp -f "$src" "$dst"
    log "Preserved runtime file: ${rel_path}"
  fi
}

restore_runtime_file() {
  local rel_path="$1"
  local src="${RUNTIME_SNAPSHOT_DIR}/${rel_path}"
  local dst="${APP_DIR}/${rel_path}"
  if [[ -f "$src" ]]; then
    mkdir -p "$(dirname "$dst")"
    cp -f "$src" "$dst"
    log "Restored runtime file: ${rel_path}"
  fi
}

restore_runtime_artifacts() {
  restore_runtime_file "backend/fortcordis.db"
  restore_runtime_file "backend/data/frases.json"
  restore_runtime_file "backend/data/patologias.json"
  restore_runtime_file "backend/data/frases_ecocardiograma_estruturado_teste.json"
}

rollback_deploy() {
  if [[ -z "${PRE_DEPLOY_HASH}" ]]; then
    echo "[ERROR] PRE_DEPLOY_HASH vazio; rollback automatico indisponivel." >&2
    return 1
  fi

  log "Starting automatic rollback to ${PRE_DEPLOY_HASH}"

  cd "$APP_DIR"
  git checkout "$BRANCH"
  git reset --hard "$PRE_DEPLOY_HASH"
  restore_runtime_artifacts
  local rollback_hash
  rollback_hash="$(git rev-parse --short HEAD)"
  log "Rollback HEAD: ${rollback_hash}"

  cd "$BACKEND_DIR"
  if [[ ! -x "${BACKEND_DIR}/venv/bin/python" ]]; then
    log "Creating backend venv for rollback"
    python3 -m venv "${BACKEND_DIR}/venv"
  fi
  "${BACKEND_DIR}/venv/bin/pip" install -r requirements.txt
  restart_service "$BACKEND_SERVICE"
  sleep 3
  if ! wait_http_ok "http://127.0.0.1:${BACKEND_PORT}/health" 25 1; then
    echo "[ERROR] Rollback backend health check failed." >&2
    print_service_diagnostics "$BACKEND_SERVICE"
    return 1
  fi

  cd "$FRONTEND_DIR"
  rm -rf .next
  npm ci
  API_BACKEND_URL="$API_BACKEND_URL" npm run build
  if [[ ! -f "${FRONTEND_DIR}/.next/BUILD_ID" ]]; then
    echo "[ERROR] Rollback frontend build missing .next/BUILD_ID" >&2
    return 1
  fi
  restart_service "$FRONTEND_SERVICE"
  sleep 3
  if ! wait_http_head_ok "http://127.0.0.1:${FRONTEND_PORT}" 25 1; then
    echo "[ERROR] Rollback frontend local check failed." >&2
    print_service_diagnostics "$FRONTEND_SERVICE"
    return 1
  fi

  reload_nginx_if_possible
  if ! wait_http_head_ok "$PUBLIC_URL" 15 1; then
    echo "[ERROR] Rollback public URL check failed: $PUBLIC_URL" >&2
    if command -v sudo >/dev/null 2>&1; then
      sudo -n journalctl -u nginx -n 120 --no-pager || true
    else
      journalctl -u nginx -n 120 --no-pager || true
    fi
    return 1
  fi

  log "Automatic rollback completed successfully (HEAD=${rollback_hash})"
  return 0
}

on_exit() {
  local exit_code="$1"
  trap - EXIT

  if [[ "$exit_code" -eq 0 ]]; then
    exit 0
  fi

  echo "[ERROR] Deploy failed at stage '${DEPLOY_STAGE}' (exit=${exit_code})." >&2
  if [[ "${AUTO_ROLLBACK_ON_FAILURE}" != "1" ]]; then
    echo "[ERROR] AUTO_ROLLBACK_ON_FAILURE=${AUTO_ROLLBACK_ON_FAILURE}; skipping rollback." >&2
    exit "$exit_code"
  fi
  if [[ "${CODE_UPDATED}" != "1" ]]; then
    echo "[ERROR] Deploy failed before code update; rollback not required." >&2
    exit "$exit_code"
  fi
  if [[ -z "${PRE_DEPLOY_HASH}" ]]; then
    echo "[ERROR] PRE_DEPLOY_HASH indisponivel; rollback nao pode ser executado." >&2
    exit "$exit_code"
  fi
  if [[ -n "${NEW_HASH}" && "${NEW_HASH}" == "${PRE_DEPLOY_HASH}" ]]; then
    echo "[ERROR] HEAD nao mudou; rollback nao necessario." >&2
    exit "$exit_code"
  fi
  if [[ "${ROLLBACK_IN_PROGRESS}" == "1" ]]; then
    echo "[ERROR] Rollback ja em execucao; abortando para evitar loop." >&2
    exit "$exit_code"
  fi

  ROLLBACK_IN_PROGRESS=1
  set +e
  rollback_deploy
  local rollback_code=$?
  if [[ "$rollback_code" -eq 0 ]]; then
    echo "[ERROR] Deploy rollback executado com sucesso." >&2
  else
    echo "[ERROR] Rollback automatico falhou (code=${rollback_code}). Intervencao manual necessaria." >&2
  fi
  exit "$exit_code"
}

trap 'on_exit $?' EXIT

require_cmd git
require_cmd curl
require_cmd npm
require_cmd python3

SYSTEMCTL_BIN="$(resolve_systemctl_bin)"
if [[ -z "$SYSTEMCTL_BIN" ]]; then
  echo "[ERROR] Missing command: systemctl" >&2
  exit 1
fi

log "Starting deploy in ${APP_DIR} (branch=${BRANCH})"
cd "$APP_DIR"
PRE_DEPLOY_HASH="$(git rev-parse HEAD 2>/dev/null || true)"
if [[ -n "${PRE_DEPLOY_HASH}" ]]; then
  log "Pre-deploy HEAD: $(git rev-parse --short "${PRE_DEPLOY_HASH}")"
fi

mkdir -p "$RUNTIME_BACKUP_DIR"
STAMP="$(date +%Y%m%d_%H%M%S)"
DEPLOY_BACKUP_MARKER="${RUNTIME_BACKUP_DIR}/${STAMP}__deploy-prod.marker"
touch "$DEPLOY_BACKUP_MARKER"
log "Deploy marker created: $DEPLOY_BACKUP_MARKER"
RUNTIME_SNAPSHOT_DIR="${RUNTIME_BACKUP_DIR}/${STAMP}__runtime"

backup_runtime_file "backend/fortcordis.db"
backup_runtime_file "backend/data/frases.json"
backup_runtime_file "backend/data/patologias.json"
backup_runtime_file "backend/data/frases_ecocardiograma_estruturado_teste.json"

DEPLOY_STAGE="update_code"
log "Updating code from origin/${BRANCH}"
git fetch origin
git checkout "$BRANCH"
git reset --hard "origin/${BRANCH}"
CODE_UPDATED=1
restore_runtime_artifacts
NEW_HASH="$(git rev-parse --short HEAD)"
log "Current HEAD: ${NEW_HASH}"
git log --oneline -n 1

DEPLOY_STAGE="backend_setup"
log "Backend: install deps + migrations"
cd "$BACKEND_DIR"

if [[ ! -x "${BACKEND_DIR}/venv/bin/python" ]]; then
  log "Creating backend venv"
  python3 -m venv "${BACKEND_DIR}/venv"
fi

"${BACKEND_DIR}/venv/bin/pip" install -r requirements.txt

if [[ -f "${BACKEND_DIR}/migrations/runner.py" ]]; then
  PYTHONPATH="$BACKEND_DIR" "${BACKEND_DIR}/venv/bin/python" - <<'PY'
from migrations.runner import run_migrations
run_migrations()
print("MIGRATIONS_OK")
PY
elif [[ -f "${BACKEND_DIR}/setup_database.py" ]]; then
  PYTHONPATH="$BACKEND_DIR" "${BACKEND_DIR}/venv/bin/python" setup_database.py
else
  log "No migration runner found; skipping migrations."
fi

DEPLOY_STAGE="backend_restart"
restart_service "$BACKEND_SERVICE"
sleep 3
if ! wait_http_ok "http://127.0.0.1:${BACKEND_PORT}/health" 25 1; then
  echo "[ERROR] Backend health check failed." >&2
  print_service_diagnostics "$BACKEND_SERVICE"
  exit 1
fi
log "Backend health OK"

DEPLOY_STAGE="frontend_build"
log "Frontend: clean build + restart"
cd "$FRONTEND_DIR"

rm -rf .next
npm ci
API_BACKEND_URL="$API_BACKEND_URL" npm run build

if [[ ! -f "${FRONTEND_DIR}/.next/BUILD_ID" ]]; then
  echo "[ERROR] Frontend build missing .next/BUILD_ID" >&2
  exit 1
fi

DEPLOY_STAGE="frontend_restart"
restart_service "$FRONTEND_SERVICE"
sleep 3
if ! wait_http_head_ok "http://127.0.0.1:${FRONTEND_PORT}" 25 1; then
  echo "[ERROR] Frontend local check failed." >&2
  print_service_diagnostics "$FRONTEND_SERVICE"
  exit 1
fi
log "Frontend local check OK"

DEPLOY_STAGE="public_check"
log "Nginx reload + public check"
reload_nginx_if_possible

if ! wait_http_head_ok "$PUBLIC_URL" 15 1; then
  echo "[ERROR] Public URL check failed: $PUBLIC_URL" >&2
  if command -v sudo >/dev/null 2>&1; then
    sudo -n journalctl -u nginx -n 120 --no-pager || true
  else
    journalctl -u nginx -n 120 --no-pager || true
  fi
  exit 1
fi

DEPLOY_STAGE="runtime_gate"
log "Runtime observability gate"
if ! python3 "${APP_DIR}/scripts/runtime_observability_gate.py" \
  --health-url "http://127.0.0.1:${BACKEND_PORT}/health" \
  --ready-url "http://127.0.0.1:${BACKEND_PORT}/ready" \
  --timeout-seconds 8; then
  echo "[ERROR] Runtime observability gate failed." >&2
  print_service_diagnostics "$BACKEND_SERVICE"
  exit 1
fi
log "Runtime observability gate OK"

DEPLOY_STAGE="auth_canary"
if [[ "${ENABLE_AUTH_CANARY}" == "1" ]]; then
  log "Authenticated canary smoke"
  CANARY_CMD=(
    "${BACKEND_DIR}/venv/bin/python"
    "${APP_DIR}/scripts/deploy_authenticated_canary.py"
    --base-url "http://127.0.0.1:${BACKEND_PORT}"
    --timeout-seconds "${AUTH_CANARY_TIMEOUT_SECONDS}"
    --backend-dir "${BACKEND_DIR}"
  )
  if [[ "${AUTH_CANARY_DISABLE_INTERNAL_TOKEN}" == "1" ]]; then
    CANARY_CMD+=(--disable-internal-token)
  fi

  if ! PYTHONPATH="$BACKEND_DIR" "${CANARY_CMD[@]}"; then
    echo "[ERROR] Authenticated canary smoke failed." >&2
    print_service_diagnostics "$BACKEND_SERVICE"
    exit 1
  fi
  log "Authenticated canary smoke OK"
else
  log "Authenticated canary disabled (ENABLE_AUTH_CANARY=${ENABLE_AUTH_CANARY}); skipping."
fi

DEPLOY_STAGE="completed"
log "Deploy finished successfully (HEAD=${NEW_HASH})"
