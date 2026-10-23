#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
FIXTURE_ROOT="$(mktemp -d)"
trap 'rm -rf -- "$FIXTURE_ROOT"' EXIT

mkdir -p "$FIXTURE_ROOT/scripts"
cp "$REPO_ROOT/scripts/deploy_stage_vps.sh" "$FIXTURE_ROOT/scripts/deploy_stage_vps.sh"

# The wrapper resolves a sibling installer. Replace it entirely: never execute
# the real installer, invoke providers, or inspect a live environment file.
cat > "$FIXTURE_ROOT/scripts/deploy_prod_vps.sh" <<'STUB'
#!/usr/bin/env bash
set -euo pipefail
[[ "$BRANCH" == stage ]]
[[ "$APP_DIR" == /var/www/fortcordis-stage ]]
[[ "$BACKEND_SERVICE" == fortcordis-stage-backend ]]
[[ "$ENABLE_WHATSAPP_STAGE_BACKEND" == 1 ]]
[[ "$DEPLOY_ACTIVATE_WHATSAPP_REMINDER_SERVICE" == 0 ]]
[[ "$ENABLE_NGINX_HTTP2" == 0 && "$RELOAD_NGINX_ON_DEPLOY" == 0 ]]
printf '%s\n' "$ENABLE_WHATSAPP_STAGE_SMOKE" > "$STUB_OUTPUT"
STUB

check_mode() {
  local supplied="$1" expected="$2" result="$FIXTURE_ROOT/result"
  if [[ "$supplied" == unset ]]; then
    env -i PATH="$PATH" HOME="$HOME" STUB_OUTPUT="$result" \
      bash "$FIXTURE_ROOT/scripts/deploy_stage_vps.sh"
  else
    env -i PATH="$PATH" HOME="$HOME" STUB_OUTPUT="$result" \
      ENABLE_WHATSAPP_STAGE_SMOKE="$supplied" \
      bash "$FIXTURE_ROOT/scripts/deploy_stage_vps.sh"
  fi
  [[ "$(cat "$result")" == "$expected" ]]
}

check_mode unset 0
check_mode 0 0
check_mode 1 1
printf 'PASS: Stage live smoke defaults off; explicit opt-in is preserved; installer fully stubbed.\n'
