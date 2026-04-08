#!/usr/bin/env python3
"""Stop hook: blocks completion if code changes are unverified.

Escape hatch: set ADE_ALLOW_UNVERIFIED_STOP=1 environment variable to bypass.
No hidden counter-based escape hatch — the env var is the only override.

Stdin parsing always fails open — NEVER locks user in on parse errors.
"""

import json
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
try:
    from _lib import (
        audit_log,
        increment_stop_block_count,
        is_subagent,
        is_worktree_path,
        parse_hook_stdin,
        read_workflow_state,
        update_workflow_state,
    )
except (ImportError, AttributeError, OSError):
    import json as _json

    def parse_hook_stdin():  # type: ignore[misc]
        try:
            return _json.loads(sys.stdin.read())
        except (ValueError, OSError):
            return {}

    def audit_log(*a, **kw):  # type: ignore[misc]
        pass

    def increment_stop_block_count():  # type: ignore[misc]
        return 1

    def is_subagent(data):  # type: ignore[misc]
        return False

    def is_worktree_path(path):  # type: ignore[misc]
        return False

    def read_workflow_state():  # type: ignore[misc]
        return {}

    def update_workflow_state(**kw):  # type: ignore[misc]
        pass

    # On import failure, allow stop to prevent blocking the user
    sys.exit(0)


def main():
    state = read_workflow_state()
    marker_content = state.get("needs_verify")

    # Defense-in-depth: if hook fires in subagent context, allow stop without blocking.
    # Stop is a main-agent event; SubagentStop is a separate event handled elsewhere.
    data = parse_hook_stdin()
    if is_subagent(data):
        audit_log(
            "stop_verify_gate", "subagent_allow", "Subagent context — allowing stop"
        )
        sys.exit(0)

    # Sanitize stale worktree markers -- auto-clear if marker references a worktree path
    if marker_content and is_worktree_path(marker_content):
        update_workflow_state(needs_verify=None)
        audit_log(
            "stop_verify_gate",
            "sanitize",
            f"Cleared worktree marker: {marker_content[:200]}",
        )
        marker_content = None

    # Sanitize stale deleted-file markers -- auto-clear if referenced file no longer exists
    # Marker format: "Modified: {file_path} at {timestamp}"
    if marker_content and marker_content.startswith("Modified: "):
        # Extract file path: everything between "Modified: " and " at "
        rest = marker_content[len("Modified: ") :]
        at_idx = rest.rfind(" at ")
        if at_idx != -1:
            referenced_file = rest[:at_idx]
            if not Path(referenced_file).exists():
                update_workflow_state(needs_verify=None)
                audit_log(
                    "stop_verify_gate",
                    "sanitize",
                    f"Cleared deleted-file marker: {referenced_file[:200]}",
                )
                marker_content = None

    if not marker_content:
        # No unverified changes — allow stop
        # Advisory: remind user if the override env var is active (even though it's not needed)
        if os.environ.get("ADE_ALLOW_UNVERIFIED_STOP") == "1":
            sys.stderr.write(
                "[NOTE] ADE_ALLOW_UNVERIFIED_STOP=1 is set. No unverified changes this session,"
                " but the override is active.\n"
            )
        sys.exit(0)

    # Env var override: ADE_ALLOW_UNVERIFIED_STOP=1 bypasses the block
    if os.environ.get("ADE_ALLOW_UNVERIFIED_STOP") == "1":
        audit_log(
            "stop_verify_gate",
            "env_override_allow",
            f"ADE_ALLOW_UNVERIFIED_STOP=1 — bypassing block for: {marker_content[:200]}",
        )
        # Prominent warning so users notice a permanently-set env var
        truncated = marker_content[:100]
        sys.stderr.write(
            f"[WARNING] ADE_ALLOW_UNVERIFIED_STOP=1 is set -- stop gate BYPASSED.\n"
            f"  Unverified changes: {truncated}\n"
            f"  If this env var is set permanently in your shell profile, the stop gate will\n"
            f"  never block. Unset it when done: unset ADE_ALLOW_UNVERIFIED_STOP\n"
        )
        sys.stdout.write(
            json.dumps(
                {
                    "decision": "warn",
                    "reason": "ADE_ALLOW_UNVERIFIED_STOP=1: stopping with unverified code.",
                }
            )
            + "\n"
        )
        sys.exit(0)

    # Block and increment counter
    new_count = increment_stop_block_count()

    reason_detail = f"unverified code: {marker_content}"

    audit_log(
        "stop_verify_gate",
        "block",
        f"Attempt {new_count}, {reason_detail[:200]}",
    )

    if new_count == 1:
        msg = f"Blocked: {reason_detail}. Run tests or /verify before finishing."
    else:
        msg = (
            f"Still blocked: {reason_detail}. Run tests, /verify, "
            f"or set ADE_ALLOW_UNVERIFIED_STOP=1 to bypass."
        )

    sys.stdout.write(json.dumps({"decision": "block", "reason": msg}) + "\n")
    sys.exit(0)


def _allow_on_crash() -> None:
    """Emit a warn decision and exit 0 — NEVER lock the user in on crash."""
    # Best-effort crash logging for post-mortem analysis
    try:
        import traceback

        errors_dir = Path(__file__).resolve().parent.parent / "errors"
        errors_dir.mkdir(parents=True, exist_ok=True)
        crash_file = errors_dir / "stop-gate-crash.log"
        with open(crash_file, "a", encoding="utf-8") as f:
            f.write(f"\n--- {__import__('datetime').datetime.now().isoformat()} ---\n")
            traceback.print_exc(file=f)
    except OSError:
        pass  # If logging fails, still allow stop

    sys.stdout.write(
        json.dumps(
            {
                "decision": "warn",
                "reason": "Stop hook crashed — allowing stop. Check .claude/errors/.",
            }
        )
        + "\n"
    )
    sys.exit(0)


if __name__ == "__main__":
    try:
        main()
    except Exception as _crash_exc:  # noqa: BLE001 — intentional fail-open crash handler
        _allow_on_crash()
