#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SCRIPT_UNDER_TEST="${REPO_ROOT}/scripts/ensure_nginx_http2.sh"
FIXTURE_ROOT="$(mktemp -d)"
trap 'rm -rf -- "${FIXTURE_ROOT}"' EXIT

stage_host="app.stage.fortcordis.com.br"
production_host="app.fortcordis.com.br"
expected_hosts="${stage_host},${production_host}"

fail() {
  echo "[test-nginx-http2] $*" >&2
  exit 1
}

make_fake_bin() {
  local fake_bin="$1"
  mkdir -p "${fake_bin}"

  cat > "${fake_bin}/sudo" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
if [[ "${1:-}" == "-n" ]]; then
  shift
fi
exec "$@"
EOF

  cat > "${fake_bin}/nginx" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
test "${FAKE_NGINX_TEST_FAIL:-0}" != "1"
EOF

  cat > "${fake_bin}/readlink" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
if [[ "${1:-}" == "-f" ]]; then
  shift
fi
exec /usr/bin/readlink "$@"
EOF

  cat > "${fake_bin}/systemctl" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
test "${1:-}" = "reload"
test "${2:-}" = "nginx"
EOF

  cat > "${fake_bin}/curl" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
printf '%s' "${FAKE_HTTP_VERSION:-2}"
EOF

  chmod +x "${fake_bin}/sudo" "${fake_bin}/nginx" "${fake_bin}/systemctl" "${fake_bin}/curl" "${fake_bin}/readlink"
}

write_site() {
  local site_root="$1"
  local enabled_root="$2"
  local name="$3"
  local host="$4"
  mkdir -p "${site_root}" "${enabled_root}"
  cat > "${site_root}/${name}" <<EOF
server {
    listen 443 ssl;
    listen [::]:443 ssl;
    server_name ${host};
}
EOF
  ln -s "${site_root}/${name}" "${enabled_root}/${name}"
}

run_script() {
  local site_root="$1"
  local enabled_root="$2"
  shift 2
  PATH="${FIXTURE_ROOT}/bin:${PATH}" \
    ENABLE_NGINX_HTTP2=1 \
    NGINX_HTTP2_SITE_ROOT="${site_root}" \
    NGINX_HTTP2_ENABLED_ROOT="${enabled_root}" \
    NGINX_HTTP2_EXPECTED_HOSTS="${expected_hosts}" \
    "$@" bash "${SCRIPT_UNDER_TEST}"
}

make_fake_bin "${FIXTURE_ROOT}/bin"

site_root="${FIXTURE_ROOT}/sites-success"
enabled_root="${FIXTURE_ROOT}/enabled-success"
write_site "${site_root}" "${enabled_root}" "fortcordis-stage" "${stage_host}"
write_site "${site_root}" "${enabled_root}" "fortcordis-app" "${production_host}"
run_script "${site_root}" "${enabled_root}" env

for site_file in "${site_root}/fortcordis-stage" "${site_root}/fortcordis-app"; do
  grep -Fqx '    listen 443 ssl http2;' "${site_file}" || fail "IPv4 HTTP/2 directive was not added to ${site_file}."
  grep -Fqx '    listen [::]:443 ssl http2;' "${site_file}" || fail "IPv6 HTTP/2 directive was not added to ${site_file}."
done

before_idempotency="$(sha256sum "${site_root}/fortcordis-stage" "${site_root}/fortcordis-app")"
run_script "${site_root}" "${enabled_root}" env
after_idempotency="$(sha256sum "${site_root}/fortcordis-stage" "${site_root}/fortcordis-app")"
test "${before_idempotency}" = "${after_idempotency}" || fail "Second execution changed an already-enabled vhost."

rollback_root="${FIXTURE_ROOT}/sites-rollback"
rollback_enabled_root="${FIXTURE_ROOT}/enabled-rollback"
write_site "${rollback_root}" "${rollback_enabled_root}" "fortcordis-stage" "${stage_host}"
write_site "${rollback_root}" "${rollback_enabled_root}" "fortcordis-app" "${production_host}"
if run_script "${rollback_root}" "${rollback_enabled_root}" env FAKE_NGINX_TEST_FAIL=1; then
  fail "Nginx validation failure was accepted."
fi
for site_file in "${rollback_root}/fortcordis-stage" "${rollback_root}/fortcordis-app"; do
  grep -Fqx '    listen 443 ssl;' "${site_file}" || fail "Rollback did not restore ${site_file}."
  if grep -Fq 'http2' "${site_file}"; then
    fail "Rollback left an HTTP/2 directive in ${site_file}."
  fi
done

protocol_rollback_root="${FIXTURE_ROOT}/sites-protocol-rollback"
protocol_rollback_enabled_root="${FIXTURE_ROOT}/enabled-protocol-rollback"
write_site "${protocol_rollback_root}" "${protocol_rollback_enabled_root}" "fortcordis-stage" "${stage_host}"
write_site "${protocol_rollback_root}" "${protocol_rollback_enabled_root}" "fortcordis-app" "${production_host}"
if run_script "${protocol_rollback_root}" "${protocol_rollback_enabled_root}" env FAKE_HTTP_VERSION=1; then
  fail "HTTP/1.1 negotiation was accepted."
fi
for site_file in "${protocol_rollback_root}/fortcordis-stage" "${protocol_rollback_root}/fortcordis-app"; do
  grep -Fqx '    listen 443 ssl;' "${site_file}" || fail "Protocol rollback did not restore ${site_file}."
  if grep -Fq 'http2' "${site_file}"; then
    fail "Protocol rollback left an HTTP/2 directive in ${site_file}."
  fi
done

ambiguous_root="${FIXTURE_ROOT}/sites-ambiguous"
ambiguous_enabled_root="${FIXTURE_ROOT}/enabled-ambiguous"
write_site "${ambiguous_root}" "${ambiguous_enabled_root}" "fortcordis-stage" "${stage_host}"
write_site "${ambiguous_root}" "${ambiguous_enabled_root}" "fortcordis-app" "${production_host}"
cp "${ambiguous_root}/fortcordis-stage" "${ambiguous_root}/fortcordis-stage-copy"
ln -s "${ambiguous_root}/fortcordis-stage-copy" "${ambiguous_enabled_root}/fortcordis-stage-copy"
if run_script "${ambiguous_root}" "${ambiguous_enabled_root}" env; then
  fail "Ambiguous vhost discovery was accepted."
fi
for site_file in "${ambiguous_root}/fortcordis-stage" "${ambiguous_root}/fortcordis-app"; do
  grep -Fqx '    listen 443 ssl;' "${site_file}" || fail "Ambiguous discovery changed ${site_file}."
done

echo "Nginx HTTP/2 enablement tests passed."
