#!/usr/bin/env python3
"""Post-Bash Capture - Log errors and detect test runs.

Captures failed commands to .claude/errors/last_error.json.
Clears verification marker on successful test runs.
"""

import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
try:
    from _lib import (
        ERROR_DIR,
        audit_log,
        clear_marker,
        get_test_patterns,
        is_subagent,
        is_test_command,
        load_workflow_config,
        parse_hook_stdin,
    )
    from _qa_lib import _locked_append as _locked_append_impl

    def _locked_append(path: Path, data: str) -> None:
        _locked_append_impl(path, data)

except (ImportError, AttributeError, RuntimeError):
    import json as _json
    from pathlib import Path as _Path

    ERROR_DIR = _Path(__file__).resolve().parent.parent / "errors"

    def parse_hook_stdin():  # type: ignore[misc]
        try:
            return _json.loads(sys.stdin.read())
        except (ValueError, OSError):
            return {}

    def audit_log(*a, **kw):  # type: ignore[misc]
        pass

    def clear_marker():  # type: ignore[misc]
        pass

    def get_test_patterns(config):  # type: ignore[misc]
        return []

    def is_subagent(data):  # type: ignore[misc]
        return False

    def is_test_command(cmd, patterns):  # type: ignore[misc]
        return False

    def load_workflow_config():  # type: ignore[misc]
        return {}

    def _locked_append(path: "_Path", data: str) -> None:  # type: ignore[misc]
        with path.open("a", encoding="utf-8") as fh:
            fh.write(data)


# Patterns indicating actual test counts from various test runners.
# Pytest:   "3 passed", "1 failed", "2 error"
# Jest:     "Tests: 3 passed, 3 total", "Test Suites: 1 passed, 1 total",
#           "PASS src/foo.test.ts", "FAIL src/bar.test.ts"
# Vitest:   "Tests 5 passed (5)", "Test Files 2 passed (2)",
#           "\u2713 3 tests passed", "\u00d7 1 failed"
# Mocha:    "3 passing (10ms)", "2 failing"
# Cypress:  "All specs passed!", "Running: foo.cy.ts"
_EXECUTED_WITH_TESTS_PATTERNS = re.compile(
    r"|".join(
        [
            # Pytest: "N passed", "N failed", "N error(s)"
            r"\b\d+\s+(?:passed|failed|error|errors)\b",
            # Jest: "Tests: N passed, N total" or "Test Suites: N passed, N total"
            r"\bTests?(?:\s+Suites)?:\s*(?:\d+\s+\w+,\s*)*\d+\s+total\b",
            # Jest: "PASS path" or "FAIL path" (standalone line markers)
            r"(?:^|\n)\s*(?:PASS|FAIL)\s+\S+",
            # Vitest: "Tests N passed" or "Test Files N passed"
            r"\bTests?\s+(?:Files\s+)?\d+\s+passed\b",
            # Vitest: checkmark/cross with count: "N tests passed" or "N failed"
            r"\d+\s+tests?\s+passed",
            # Mocha: "N passing (Xms)" or "N failing"
            r"\b\d+\s+(?:passing|failing)\b",
            # Cypress: "All specs passed!"
            r"\bAll\s+specs\s+passed\b",
        ]
    ),
    re.IGNORECASE,
)

# Patterns indicating zero tests collected/ran
# Pytest:  "collected 0 items", "no tests ran"
# Jest:    "Tests: 0 total" or "Test Suites: 0 passed"
# Mocha:   "0 passing"
# Vitest:  "Tests 0 passed"
_EXECUTED_ZERO_TESTS_PATTERNS = re.compile(
    r"|".join(
        [
            # Pytest
            r"collected\s+0\s+items",
            r"no\s+tests\s+ran",
            # Jest: "Tests: 0 total" or "Test Suites: 0 passed, 0 total"
            r"\bTests?(?:\s+Suites)?:\s*(?:0\s+\w+,\s*)*0\s+total\b",
            # Mocha: "0 passing"
            r"\b0\s+passing\b",
            # Vitest: "Tests 0 passed"
            r"\bTests?\s+(?:Files\s+)?0\s+passed\b",
        ]
    ),
    re.IGNORECASE,
)


def _classify_test_execution(stdout: str, stderr: str) -> str:
    """Classify the test execution based on command output.

    Returns:
        "EXECUTED_WITH_TESTS" — stdout contains test counts from any supported runner
                                (pytest, Jest, Vitest, Mocha, Cypress)
        "EXECUTED_ZERO_TESTS" — stdout indicates zero tests were collected or ran
        "NO_EVIDENCE"         — no test-related output detected in stdout or stderr
    """
    combined = stdout + stderr
    # Check zero-tests first: "0 passing", "Tests: 0 total", etc. overlap
    # with the broader "with tests" patterns, so the specific zero-check
    # must take priority to avoid false clears.
    if _EXECUTED_ZERO_TESTS_PATTERNS.search(combined):
        return "EXECUTED_ZERO_TESTS"
    if _EXECUTED_WITH_TESTS_PATTERNS.search(combined):
        return "EXECUTED_WITH_TESTS"
    return "NO_EVIDENCE"


def main():
    ERROR_DIR.mkdir(parents=True, exist_ok=True)

    data = parse_hook_stdin()

    tool_input = data.get("tool_input", {})
    tool_response = data.get("tool_response", {})

    # Get exit code — explicit None check (0 is falsy in Python)
    exit_code = tool_response.get("exitCode")
    if exit_code is None:
        exit_code = 0

    # Load configurable test patterns
    config = load_workflow_config()
    patterns = get_test_patterns(config)

    # Detect successful test runs and clear verification marker.
    # All three conditions required:
    #   1. exit_code == 0
    #   2. is_test_command() == True
    #   3. _classify_test_execution() == "EXECUTED_WITH_TESTS"
    # Note: clear_marker() is called unconditionally. Worktree safety is
    # enforced inside clear_marker() itself via the is_worktree_path(cwd)
    # guard in _lib.py, so a subagent running in a .claude/worktrees/agent-*
    # worktree cannot corrupt the main repo's workflow-state.json. A subagent
    # running in the main repo root with real passing-test evidence IS
    # allowed to clear the marker — Ralph workers always dispatch with
    # isolation: "worktree", so the worktree guard is the load-bearing check.
    cmd = tool_input.get("command", "")
    stdout_out = tool_response.get("stdout", "") or ""
    stderr_out = tool_response.get("stderr", "") or ""
    test_evidence = _classify_test_execution(stdout_out, stderr_out)
    if (
        exit_code == 0
        and is_test_command(cmd, patterns)
        and test_evidence == "EXECUTED_WITH_TESTS"
    ):
        clear_marker()  # Clears .needs_verify and .stop_block_count (unconditional —
        # worktree safety handled by clear_marker's is_worktree_path guard)
        audit_log("post_bash_capture", "marker_cleared", f"Test passed: {cmd[:200]}")
    elif (
        exit_code == 0
        and is_test_command(cmd, patterns)
        and test_evidence != "EXECUTED_WITH_TESTS"
    ):
        audit_log(
            "post_bash_capture",
            "marker_skip_no_evidence",
            f"Test command had no evidence ({test_evidence}): {cmd[:200]}",
        )

    # Only capture failures
    if exit_code == 0:
        sys.exit(0)

    command = tool_input.get("command", "unknown")
    stdout = tool_response.get("stdout", "")
    stderr = tool_response.get("stderr", "")

    # Build error record
    error_data = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "exit_code": exit_code,
        "command": command[:1000],
        "stderr": stderr[-2000:] if stderr else "",
        "stdout_tail": stdout[-500:] if stdout else "",
        "cwd": str(Path.cwd()),
    }

    # Write last error (overwrite — quick access to most recent)
    last_error = ERROR_DIR / "last_error.json"
    last_error.write_text(json.dumps(error_data, indent=2))

    # Append to rolling error history (JSONL, one error per line)
    history_path = ERROR_DIR / "error_history.jsonl"
    _locked_append(history_path, json.dumps(error_data) + "\n")
    # Truncate if exceeds 50KB: keep last ~25KB
    try:
        if history_path.stat().st_size > 50 * 1024:
            content = history_path.read_bytes()
            history_path.write_bytes(content[-(25 * 1024) :])
    except OSError:
        pass

    audit_log(
        "post_bash_capture",
        "error_captured",
        f"exit={exit_code} cmd={command[:200]}",
    )
    sys.exit(0)


if __name__ == "__main__":
    main()
