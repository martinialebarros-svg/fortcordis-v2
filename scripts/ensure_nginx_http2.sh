#!/usr/bin/env bash
set -euo pipefail

# Enables HTTP/2 only in the HTTPS vhost that declares the expected host.
# The script is deliberately fail-closed: it refuses ambiguous discovery,
# validates Nginx before reload, and restores its backup on a failed change.

ENABLE_NGINX_HTTP2="${ENABLE_NGINX_HTTP2:-0}"
NGINX_HTTP2_EXPECTED_HOST="${NGINX_HTTP2_EXPECTED_HOST:-}"
NGINX_HTTP2_SITE_ROOT="${NGINX_HTTP2_SITE_ROOT:-/etc/nginx/sites-available}"
NGINX_HTTP2_ENABLED_ROOT="${NGINX_HTTP2_ENABLED_ROOT:-/etc/nginx/sites-enabled}"
PUBLIC_URL="${PUBLIC_URL:-}"
SUDO_PASSWORD="${SUDO_PASSWORD:-${VPS_SUDO_PASSWORD:-}}"

log() {
  printf '[nginx-http2] %s\n' "$*"
}

run_with_sudo() {
  if ! command -v sudo >/dev/null 2>&1; then
    "$@"
    return $?
  fi

  if sudo -n true >/dev/null 2>&1; then
    sudo -n "$@"
    return $?
  fi

  if [[ -n "${SUDO_PASSWORD}" ]] && printf '%s\n' "${SUDO_PASSWORD}" | sudo -S -p '' -v >/dev/null 2>&1; then
    printf '%s\n' "${SUDO_PASSWORD}" | sudo -S -p '' "$@"
    return $?
  fi

  "$@"
}

restore_site_file() {
  local site_file="$1"
  local backup_file="$2"
  local nginx_bin="$3"

  log "Restoring Nginx vhost backup after failed HTTP/2 validation."
  run_with_sudo cp -- "$backup_file" "$site_file"
  run_with_sudo "$nginx_bin" -t || true
  run_with_sudo systemctl reload nginx || true
}

if [[ "${ENABLE_NGINX_HTTP2}" != "1" ]]; then
  log "HTTP/2 enablement disabled; skipping."
  exit 0
fi

if [[ -z "${NGINX_HTTP2_EXPECTED_HOST}" || -z "${PUBLIC_URL}" ]]; then
  echo "[nginx-http2] Expected host and public URL are required when HTTP/2 is enabled." >&2
  exit 1
fi

if ! run_with_sudo test -d "${NGINX_HTTP2_SITE_ROOT}" || ! run_with_sudo test -d "${NGINX_HTTP2_ENABLED_ROOT}"; then
  echo "[nginx-http2] Nginx site directories are unavailable." >&2
  exit 1
fi

nginx_bin="$(command -v nginx 2>/dev/null || true)"
if [[ -z "${nginx_bin}" ]]; then
  echo "[nginx-http2] Nginx binary is unavailable." >&2
  exit 1
fi

declare -a site_candidates=()
while IFS= read -r -d '' enabled_entry; do
  candidate="$(run_with_sudo readlink -f -- "${enabled_entry}")"
  if [[ "${candidate}" == "${NGINX_HTTP2_SITE_ROOT}/"* ]] && \
    run_with_sudo test -f "${candidate}" && \
    run_with_sudo grep -Fq -- "${NGINX_HTTP2_EXPECTED_HOST}" "${candidate}"; then
    site_candidates+=("${candidate}")
  fi
# Nginx sites-enabled is intentionally a flat directory. Avoid GNU-only
# find flags here because the helper is also exercised by the local shell test.
done < <(run_with_sudo find "${NGINX_HTTP2_ENABLED_ROOT}" \( -type f -o -type l \) -print0)

if [[ "${#site_candidates[@]}" -ne 1 ]]; then
  echo "[nginx-http2] Expected exactly one vhost for ${NGINX_HTTP2_EXPECTED_HOST}; found ${#site_candidates[@]}." >&2
  exit 1
fi

site_file="${site_candidates[0]}"
if ! run_with_sudo grep -Eq '^[[:space:]]*listen[[:space:]]+(\[::\]:)?443[[:space:]].*ssl.*;' "${site_file}"; then
  echo "[nginx-http2] HTTPS listen directive was not found in ${site_file}." >&2
  exit 1
fi

updated_file="$(mktemp)"
cleanup() {
  rm -f -- "${updated_file}"
}
trap cleanup EXIT

run_with_sudo cat -- "${site_file}" > "${updated_file}"
awk '
  /^[[:space:]]*listen[[:space:]]+(\[::\]:)?443[[:space:]].*ssl.*;[[:space:]]*$/ {
    if ($0 !~ /(^|[[:space:]])http2([[:space:];]|$)/) {
      sub(/;[[:space:]]*$/, " http2;")
    }
  }
  { print }
' "${updated_file}" > "${updated_file}.next"
mv -- "${updated_file}.next" "${updated_file}"

changed=0
backup_file=""
if ! cmp -s "${site_file}" "${updated_file}"; then
  changed=1
  backup_file="${site_file}.bak.http2.$(date +%Y%m%d%H%M%S)"
  run_with_sudo cp -- "${site_file}" "${backup_file}"
  run_with_sudo cp -- "${updated_file}" "${site_file}"
  log "HTTP/2 directive added to ${site_file}; validating Nginx."

  if ! run_with_sudo "${nginx_bin}" -t; then
    restore_site_file "${site_file}" "${backup_file}" "${nginx_bin}"
    exit 1
  fi

  if ! run_with_sudo systemctl reload nginx; then
    restore_site_file "${site_file}" "${backup_file}" "${nginx_bin}"
    exit 1
  fi
else
  log "HTTP/2 directive already present in ${site_file}."
fi

protocol="$(curl --silent --show-error --fail --http2 \
  --connect-timeout 8 --max-time 20 --output /dev/null --write-out '%{http_version}' \
  --resolve "${NGINX_HTTP2_EXPECTED_HOST}:443:127.0.0.1" \
  "${PUBLIC_URL}" || true)"

if [[ "${protocol}" != "2" && "${protocol}" != "2.0" ]]; then
  echo "[nginx-http2] HTTP/2 verification failed for ${NGINX_HTTP2_EXPECTED_HOST}; negotiated '${protocol:-none}'." >&2
  if [[ "${changed}" == "1" ]]; then
    restore_site_file "${site_file}" "${backup_file}" "${nginx_bin}"
  fi
  exit 1
fi

log "HTTP/2 verified for ${NGINX_HTTP2_EXPECTED_HOST}."
