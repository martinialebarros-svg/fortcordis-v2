#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SCRIPT_UNDER_TEST="${REPO_ROOT}/scripts/ensure_nginx_http2.sh"
FIXTURE_ROOT="$(mktemp -d)"
trap 'rm -rf -- "${FIXTURE_ROOT}"' EXIT

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
if [[ "${FAKE_NGINX_TEST_FAIL:-0}" == "1" ]]; then
  exit 1
fi
exit 0
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
  local host="$3"
  mkdir -p "${site_root}"
  mkdir -p "${enabled_root}"
  cat > "${site_root}/fortcordis-app" <<EOF
server {
    listen 443 ssl;
    listen [::]:443 ssl;
    server_name ${host};
}
EOF
}

run_script() {
  local site_root="$1"
  local enabled_root="$2"
  local host="$3"
  shift 3
  PATH="${FIXTURE_ROOT}/bin:${PATH}" \
    ENABLE_NGINX_HTTP2=1 \
    NGINX_HTTP2_SITE_ROOT="${site_root}" \
    NGINX_HTTP2_ENABLED_ROOT="${enabled_root}" \
    NGINX_HTTP2_EXPECTED_HOST="${host}" \
    PUBLIC_URL="https://${host}" \
    "$@" bash "${SCRIPT_UNDER_TEST}"
}

make_fake_bin "${FIXTURE_ROOT}/bin"

site_root="${FIXTURE_ROOT}/sites-success"
enabled_root="${FIXTURE_ROOT}/enabled-success"
host="app.stage.fortcordis.com.br"
write_site "${site_root}" "${enabled_root}" "${host}"
ln -s "${site_root}/fortcordis-app" "${enabled_root}/fortcordis-app"
run_script "${site_root}" "${enabled_root}" "${host}" env

site_file="${site_root}/fortcordis-app"
grep -Fqx '    listen 443 ssl http2;' "${site_file}" || fail "IPv4 HTTP/2 directive was not added."
grep -Fqx '    listen [::]:443 ssl http2;' "${site_file}" || fail "IPv6 HTTP/2 directive was not added."

before_idempotency="$(sha256sum "${site_file}" | awk '{print $1}')"
run_script "${site_root}" "${enabled_root}" "${host}" env
after_idempotency="$(sha256sum "${site_file}" | awk '{print $1}')"
test "${before_idempotency}" = "${after_idempotency}" || fail "Second execution changed an already-enabled vhost."

rollback_root="${FIXTURE_ROOT}/sites-rollback"
rollback_enabled_root="${FIXTURE_ROOT}/enabled-rollback"
write_site "${rollback_root}" "${rollback_enabled_root}" "${host}"
ln -s "${rollback_root}/fortcordis-app" "${rollback_enabled_root}/fortcordis-app"
if run_script "${rollback_root}" "${rollback_enabled_root}" "${host}" env FAKE_NGINX_TEST_FAIL=1; then
  fail "Nginx validation failure was accepted."
fi
grep -Fqx '    listen 443 ssl;' "${rollback_root}/fortcordis-app" || fail "Rollback did not restore the original IPv4 listen line."
if grep -Fq 'http2' "${rollback_root}/fortcordis-app"; then
  fail "Rollback left an HTTP/2 directive in the failed vhost."
fi

ambiguous_root="${FIXTURE_ROOT}/sites-ambiguous"
ambiguous_enabled_root="${FIXTURE_ROOT}/enabled-ambiguous"
write_site "${ambiguous_root}" "${ambiguous_enabled_root}" "${host}"
cp "${ambiguous_root}/fortcordis-app" "${ambiguous_root}/fortcordis-app-copy"
ln -s "${ambiguous_root}/fortcordis-app" "${ambiguous_enabled_root}/fortcordis-app"
ln -s "${ambiguous_root}/fortcordis-app-copy" "${ambiguous_enabled_root}/fortcordis-app-copy"
if run_script "${ambiguous_root}" "${ambiguous_enabled_root}" "${host}" env; then
  fail "Ambiguous vhost discovery was accepted."
fi
grep -Fqx '    listen 443 ssl;' "${ambiguous_root}/fortcordis-app" || fail "Ambiguous discovery changed a vhost."

echo "Nginx HTTP/2 enablement tests passed."
