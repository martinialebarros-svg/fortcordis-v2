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

log "Updating code from origin/${BRANCH}"
git fetch origin
git checkout "$BRANCH"
git reset --hard "origin/${BRANCH}"
restore_runtime_file "backend/fortcordis.db"
restore_runtime_file "backend/data/frases.json"
restore_runtime_file "backend/data/patologias.json"
restore_runtime_file "backend/data/frases_ecocardiograma_estruturado_teste.json"
NEW_HASH="$(git rev-parse --short HEAD)"
log "Current HEAD: ${NEW_HASH}"
git log --oneline -n 1

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

restart_service "$BACKEND_SERVICE"
sleep 3
if ! wait_http_ok "http://127.0.0.1:${BACKEND_PORT}/health" 25 1; then
  echo "[ERROR] Backend health check failed." >&2
  print_service_diagnostics "$BACKEND_SERVICE"
  exit 1
fi
log "Backend health OK"

log "Frontend: clean build + restart"
cd "$FRONTEND_DIR"

rm -rf .next
npm ci
API_BACKEND_URL="$API_BACKEND_URL" npm run build

if [[ ! -f "${FRONTEND_DIR}/.next/BUILD_ID" ]]; then
  echo "[ERROR] Frontend build missing .next/BUILD_ID" >&2
  exit 1
fi

restart_service "$FRONTEND_SERVICE"
sleep 3
if ! wait_http_head_ok "http://127.0.0.1:${FRONTEND_PORT}" 25 1; then
  echo "[ERROR] Frontend local check failed." >&2
  print_service_diagnostics "$FRONTEND_SERVICE"
  exit 1
fi
log "Frontend local check OK"

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

log "Deploy finished successfully (HEAD=${NEW_HASH})"
