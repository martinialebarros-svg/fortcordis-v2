#!/usr/bin/env python3
"""Exercise deploy selection with Git/launcher doubles; no network or services."""
import os
from pathlib import Path
import re
import subprocess
import tempfile
import unittest


ROOT = Path(__file__).resolve().parents[2]
PIN = "a" * 40
TIP = "b" * 40
LATER = "c" * 40
PREVIOUS = "d" * 40

GIT_DOUBLE = r'''
git() {
  printf '%s\n' "$*" >> "$TRACE"
  case "$1" in
    check-ref-format) return "${INVALID_BRANCH:-0}" ;;
    fetch)
      if [[ "$4" == "$PIN" && "${FAIL_PIN_FETCH:-0}" == 1 ]]; then return 1; fi
      if [[ "$4" == +refs/* && "${FAIL_BRANCH_FETCH:-0}" == 1 ]]; then return 1; fi
      return 0 ;;
    merge-base) return "${NOT_ANCESTOR:-0}" ;;
    rev-parse)
      if [[ "$2" == HEAD ]]; then cat "$FAKE_HEAD"; return; fi
      if [[ "$3" == "${PIN}^{commit}" ]]; then
        printf '%s\n' "${RESOLVED_PIN:-$PIN}"
      elif [[ "$3" == refs/remotes/* ]]; then cat "$FAKE_REMOTE"
      else return 98; fi ;;
    checkout)
      if [[ "${ADVANCE_ON_CHECKOUT:-0}" == 1 ]]; then
        printf '%s\n' "$LATER" > "$FAKE_REMOTE"
      fi
      return "${FAIL_CHECKOUT:-0}" ;;
    reset)
      [[ "${FAIL_RESET:-0}" != 1 ]] || return 1
      printf '%s\n' "${INSTALLED_OVERRIDE:-$3}" > "$FAKE_HEAD" ;;
    *) return 99 ;;
  esac
}
'''


def step_blocks(text, name):
    """Read a named step without a YAML dependency or evaluating expressions."""
    lines = text.splitlines()
    result = []
    for pos, line in enumerate(lines):
        if line.strip() != f"- name: {name}":
            continue
        indent = len(line) - len(line.lstrip())
        end = pos + 1
        while end < len(lines):
            if lines[end].strip() and len(lines[end]) - len(lines[end].lstrip()) <= indent:
                break
            end += 1
        result.append(lines[pos:end])
    return result


class ImmutableDeployShaTests(unittest.TestCase):
    def run_deploy_functions(self, commands="resolve_deploy_target\nupdate_deploy_code", **changes):
        with tempfile.TemporaryDirectory(prefix="deploy-sha-test-") as temp:
            folder = Path(temp)
            head, remote, trace, state = [folder / n for n in ("head", "remote", "trace", "state")]
            head.write_text(PREVIOUS + "\n")
            remote.write_text(TIP + "\n")
            env = dict(os.environ, APP_DIR=str(folder / "app"), BRANCH="main",
                       DEPLOY_SHA=PIN, DEPLOY_REF="refs/heads/main", PIN=PIN,
                       LATER=LATER, TRACE=str(trace), FAKE_HEAD=str(head),
                       FAKE_REMOTE=str(remote), STATE=str(state))
            # Isolate these tests from caller settings; every Git call is a double.
            for key in ("INVALID_BRANCH", "FAIL_PIN_FETCH", "FAIL_BRANCH_FETCH", "NOT_ANCESTOR",
                        "RESOLVED_PIN", "ADVANCE_ON_CHECKOUT", "FAIL_CHECKOUT", "FAIL_RESET",
                        "INSTALLED_OVERRIDE"):
                env.pop(key, None)
            env.update(changes)
            script = 'set -euo pipefail\nsource scripts/deploy_prod_vps.sh\n' + GIT_DOUBLE
            script += commands + '\nprintf "%s\\n" "$DEPLOY_TARGET_SHA" "$CODE_UPDATED" > "$STATE"\n'
            run = subprocess.run(["bash", "-c", script], cwd=ROOT, env=env, text=True,
                                 capture_output=True, timeout=10)
            return run, (trace.read_text().splitlines() if trace.exists() else []), head.read_text().strip(), (
                state.read_text().splitlines() if state.exists() else [])

    def test_branch_advance_does_not_replace_the_gated_sha(self):
        for branch in ("main", "stage"):
            with self.subTest(branch=branch):
                run, trace, head, state = self.run_deploy_functions(
                    BRANCH=branch, DEPLOY_REF=f"refs/heads/{branch}", ADVANCE_ON_CHECKOUT="1")
                self.assertEqual(run.returncode, 0, run.stderr)
                self.assertEqual(head, PIN)
                self.assertEqual(state, [PIN, "1"])
                self.assertIn(f"fetch --no-tags origin +refs/heads/{branch}:refs/remotes/origin/{branch}", trace)
                self.assertIn(f"fetch --no-tags origin {PIN}", trace)
                self.assertIn(f"merge-base --is-ancestor {PIN} refs/remotes/origin/{branch}", trace)
                self.assertIn(f"checkout {branch}", trace)
                self.assertIn(f"reset --hard {PIN}", trace)
                self.assertNotIn(f"reset --hard {TIP}", trace)
                self.assertNotIn(f"reset --hard {LATER}", trace)

    def test_invalid_context_aborts_before_any_remote_fetch_or_reset(self):
        for changes in ({"DEPLOY_SHA": ""}, {"DEPLOY_SHA": "abc123"},
                        {"DEPLOY_SHA": "z" * 40}, {"DEPLOY_REF": "refs/heads/stage"},
                        {"DEPLOY_REF": "refs/tags/main"}, {"INVALID_BRANCH": "1"}):
            with self.subTest(changes=changes):
                run, trace, head, _ = self.run_deploy_functions(**changes)
                self.assertNotEqual(run.returncode, 0)
                self.assertEqual(head, PREVIOUS)
                self.assertFalse(any(x.startswith(("fetch ", "checkout ", "reset ")) for x in trace))

    def test_unavailable_or_foreign_commit_never_falls_back_to_branch_tip(self):
        for changes in ({"FAIL_PIN_FETCH": "1"}, {"FAIL_BRANCH_FETCH": "1"},
                        {"NOT_ANCESTOR": "1"}, {"RESOLVED_PIN": TIP}):
            with self.subTest(changes=changes):
                run, trace, head, _ = self.run_deploy_functions(**changes)
                self.assertNotEqual(run.returncode, 0)
                self.assertEqual(head, PREVIOUS)
                self.assertFalse(any(x.startswith(("checkout ", "reset ")) for x in trace))

    def test_legacy_call_resolves_once_and_reports_its_limit(self):
        run, trace, head, state = self.run_deploy_functions(
            DEPLOY_SHA="", DEPLOY_REF="", ADVANCE_ON_CHECKOUT="1")
        self.assertEqual(run.returncode, 0, run.stderr)
        self.assertIn("WARNING: legacy deploy without DEPLOY_SHA", run.stdout)
        self.assertEqual(head, TIP)
        self.assertEqual(state, [TIP, "1"])
        self.assertEqual(sum(x.startswith("fetch ") for x in trace), 1)
        self.assertIn(f"reset --hard {TIP}", trace)
        self.assertNotIn(f"reset --hard {LATER}", trace)

    def test_installed_head_mismatch_remains_a_rollback_failure(self):
        commands = r'''
resolve_deploy_target
PRE_DEPLOY_HASH="dddddddddddddddddddddddddddddddddddddddd"
rollback_deploy() { printf '%s\n' "$PRE_DEPLOY_HASH" > "$STATE"; }
trap 'on_exit $?' EXIT
update_deploy_code
'''
        run, _, head, state = self.run_deploy_functions(commands, INSTALLED_OVERRIDE=TIP)
        self.assertNotEqual(run.returncode, 0)
        self.assertEqual(head, TIP)  # fake rollback only records the requested previous SHA
        self.assertEqual(state, [PREVIOUS])
        self.assertIn("Installed HEAD differs", run.stderr)
        self.assertIn("Deploy rollback executado com sucesso", run.stderr)

    def test_no_update_before_target_resolution(self):
        run, trace, head, _ = self.run_deploy_functions("update_deploy_code")
        self.assertNotEqual(run.returncode, 0)
        self.assertEqual(trace, [])
        self.assertEqual(head, PREVIOUS)

    def test_stage_wrapper_preserves_pin_and_environment_isolation(self):
        with tempfile.TemporaryDirectory(prefix="deploy-wrapper-test-") as temp:
            folder = Path(temp)
            fake_bin = folder / "bin"
            fake_bin.mkdir()
            output = folder / "context"
            launcher = fake_bin / "bash"
            launcher.write_text('#!/bin/sh\nprintf "%s\\n" "$BRANCH" "$DEPLOY_SHA" "$DEPLOY_REF" '
                                '"$DEPLOY_ACTIVATE_WHATSAPP_REMINDER_SERVICE" > "$CONTEXT_OUTPUT"\n')
            launcher.chmod(0o700)
            env = dict(os.environ, PATH=f"{fake_bin}:{os.environ['PATH']}", DEPLOY_SHA=PIN,
                       DEPLOY_REF="refs/heads/stage", BRANCH="main",
                       DEPLOY_ACTIVATE_WHATSAPP_REMINDER_SERVICE="1", CONTEXT_OUTPUT=str(output))
            run = subprocess.run(["/bin/bash", "scripts/deploy_stage_vps.sh"], cwd=ROOT,
                                 env=env, text=True, capture_output=True, timeout=10)
            self.assertEqual(run.returncode, 0, run.stderr)
            self.assertEqual(output.read_text().splitlines(), ["stage", PIN, "refs/heads/stage", "0"])

    def test_workflows_pin_checkout_archive_and_installer_and_keep_sync_assertion(self):
        for filename, branch in (("deploy.yml", "main"), ("deploy-stage.yml", "stage")):
            with self.subTest(workflow=filename):
                text = (ROOT / ".github/workflows" / filename).read_text()
                checkouts = text.count("uses: actions/checkout@v5")
                self.assertEqual(checkouts, len(re.findall(
                    r"uses: actions/checkout@v5\n\s+with:\n\s+ref: \$\{\{ github.sha \}\}", text)))
                self.assertIn('git archive --format=tar "$DEPLOY_SHA" --', text)
                self.assertNotRegex(text, r'git archive[^\n]*origin/')
                self.assertIn('git fetch --no-tags origin "$DEPLOY_SHA"', text)
                self.assertIn('DEPLOY_SHA="$DEPLOY_SHA" \\', text)
                self.assertIn('DEPLOY_REF="$DEPLOY_REF" \\', text)
                self.assertIn('test "$(git rev-parse HEAD)" = "${{ github.sha }}"', text)
                self.assertIn("run: python3 scripts/tests/test_deploy_immutable_sha.py", text)
                # A remote job must validate before even SSH secret preparation.
                jobs = re.split(r"(?m)^  ([a-z][a-z0-9-]*):\n", text)
                for name, body in zip(jobs[1::2], jobs[2::2]):
                    if "ssh -i" not in body and "secrets.VPS_SSH_KEY" not in body:
                        continue
                    self.assertIn("- name: Validate immutable deploy target", body, name)
                    self.assertLess(body.index("- name: Validate immutable deploy target"),
                                    body.index("secrets.VPS_SSH_KEY"), name)
                for block in step_blocks(text, "Validate immutable deploy target"):
                    value = "\n".join(block)
                    self.assertIn(f"BRANCH: {branch}", value)
                    self.assertIn("DEPLOY_REF: ${{ github.ref }}", value)
                    self.assertIn("DEPLOY_SHA: ${{ github.sha }}", value)
                    self.assertIn("validate_deploy_target", value)

    def test_workflow_validation_function_rejects_manual_wrong_ref_before_io(self):
        run, trace, _, _ = self.run_deploy_functions("validate_deploy_target", DEPLOY_REF="refs/heads/feature")
        self.assertNotEqual(run.returncode, 0)
        self.assertFalse(any(x.startswith(("fetch ", "checkout ", "reset ")) for x in trace))
        run, _, _, _ = self.run_deploy_functions("validate_deploy_target", DEPLOY_SHA="")
        self.assertNotEqual(run.returncode, 0)


if __name__ == "__main__":
    unittest.main(verbosity=2)
