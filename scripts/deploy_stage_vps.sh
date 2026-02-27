#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

APP_DIR="/var/www/fortcordis-stage"
BRANCH="stage"
BACKEND_SERVICE="fortcordis-stage-backend"
FRONTEND_SERVICE="fortcordis-stage-frontend"
BACKEND_PORT="8001"
FRONTEND_PORT="3001"
API_BACKEND_URL="http://127.0.0.1:8001"
PUBLIC_URL="https://stage.fortcordis.com.br"

export APP_DIR BRANCH BACKEND_SERVICE FRONTEND_SERVICE BACKEND_PORT FRONTEND_PORT API_BACKEND_URL PUBLIC_URL

bash "${SCRIPT_DIR}/deploy_prod_vps.sh"
