#!/usr/bin/env bash
set -euo pipefail

# Production deploy script with guardrails:
# - hard reset to origin/main (avoids stash/pop conflicts)
# - runtime backup/restore for frases.json
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
RUNTIME_FRASES="${APP_DIR}/backend/data/frases.json"

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

require_cmd git
require_cmd curl
require_cmd npm
require_cmd python3
require_cmd sudo

log "Starting deploy in ${APP_DIR} (branch=${BRANCH})"
cd "$APP_DIR"

mkdir -p "$RUNTIME_BACKUP_DIR"
STAMP="$(date +%Y%m%d_%H%M%S)"
FRASES_BACKUP="${RUNTIME_BACKUP_DIR}/${STAMP}__frases.json"

if [[ -f "$RUNTIME_FRASES" ]]; then
  cp "$RUNTIME_FRASES" "$FRASES_BACKUP"
  log "Runtime backup saved: $FRASES_BACKUP"
else
  log "Runtime frases.json not found (continuing)."
fi

log "Updating code from origin/${BRANCH}"
git fetch origin
git checkout "$BRANCH"
git reset --hard "origin/${BRANCH}"
NEW_HASH="$(git rev-parse --short HEAD)"
log "Current HEAD: ${NEW_HASH}"
git log --oneline -n 1

if [[ -f "$FRASES_BACKUP" ]]; then
  cp "$FRASES_BACKUP" "$RUNTIME_FRASES"
  log "Runtime frases.json restored from backup."
fi

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

sudo systemctl restart "$BACKEND_SERVICE"
sleep 3
if ! wait_http_ok "http://127.0.0.1:${BACKEND_PORT}/health" 25 1; then
  echo "[ERROR] Backend health check failed." >&2
  sudo systemctl status "$BACKEND_SERVICE" --no-pager -l || true
  sudo journalctl -u "$BACKEND_SERVICE" -n 120 --no-pager || true
  exit 1
fi
log "Backend health OK"

log "Frontend: clean build + restart"
cd "$FRONTEND_DIR"
sudo systemctl stop "$FRONTEND_SERVICE" || true
sudo systemctl reset-failed "$FRONTEND_SERVICE" || true

rm -rf .next
npm ci
API_BACKEND_URL="$API_BACKEND_URL" npm run build

if [[ ! -f "${FRONTEND_DIR}/.next/BUILD_ID" ]]; then
  echo "[ERROR] Frontend build missing .next/BUILD_ID" >&2
  exit 1
fi

sudo systemctl start "$FRONTEND_SERVICE"
sleep 3
if ! wait_http_head_ok "http://127.0.0.1:${FRONTEND_PORT}" 25 1; then
  echo "[ERROR] Frontend local check failed." >&2
  sudo systemctl status "$FRONTEND_SERVICE" --no-pager -l || true
  sudo journalctl -u "$FRONTEND_SERVICE" -n 120 --no-pager || true
  exit 1
fi
log "Frontend local check OK"

log "Nginx reload + public check"
sudo nginx -t
sudo systemctl reload nginx

if ! wait_http_head_ok "$PUBLIC_URL" 15 1; then
  echo "[ERROR] Public URL check failed: $PUBLIC_URL" >&2
  sudo journalctl -u nginx -n 120 --no-pager || true
  exit 1
fi

log "Deploy finished successfully (HEAD=${NEW_HASH})"
