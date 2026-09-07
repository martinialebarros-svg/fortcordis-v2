#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
WORKFLOW="${REPO_ROOT}/.github/workflows/deploy-stage.yml"

fail() {
  echo "[test-vps-ingress-stage-trigger] $*" >&2
  exit 1
}

grep -Fq "name: Run one-shot VPS ingress diagnostics on Stage" "${WORKFLOW}" || fail "missing one-shot diagnostic step"
grep -Fq "contains(github.event.head_commit.message, '[vps-ingress-diagnostics]')" "${WORKFLOW}" || fail "missing explicit marker guard"
grep -Fq "scripts/probe_public_https.sh" "${WORKFLOW}" || fail "missing external probe"
grep -Fq "scripts/collect_vps_ingress_diagnostics.sh" "${WORKFLOW}" || fail "missing remote collector"

if grep -A30 -F "name: Run one-shot VPS ingress diagnostics on Stage" "${WORKFLOW}" | rg -q '\bsudo\b|systemctl (restart|reload|stop)|rm -rf'; then
  fail "one-shot stage step contains a mutation-capable command"
fi

echo "VPS ingress diagnostics stage trigger tests passed."
