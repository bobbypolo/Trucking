#!/usr/bin/env python3
"""Post-Format - Auto-format code files and set verification marker.

Runs after Edit/Write tool use on code files.
Formats with ruff (Python) or prettier (JS/TS/CSS/HTML).
Creates .needs_verify marker for code file modifications.
"""

import importlib.util
import shutil
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
try:
    from _lib import (
        CODE_EXTENSIONS,
        audit_log,
        is_subagent,
        load_workflow_config,
        parse_hook_stdin,
        run_formatter,
        write_marker,
    )
except Exception:
    import json as _json

    CODE_EXTENSIONS = frozenset({".py", ".js", ".ts", ".jsx", ".tsx", ".css", ".html"})

    def parse_hook_stdin():  # type: ignore[misc]
        try:
            return _json.loads(sys.stdin.read())
        except Exception:
            return {}

    def audit_log(*a, **kw):  # type: ignore[misc]
        pass

    def is_subagent(data):  # type: ignore[misc]
        return False

    def load_workflow_config():  # type: ignore[misc]
        return {}

    def run_formatter(cmd, timeout=30):  # type: ignore[misc]
        return 0, ""

    def write_marker(msg, **kw):  # type: ignore[misc]
        pass


PRETTIER_EXTENSIONS = {".ts", ".tsx", ".js", ".jsx", ".css", ".html"}


def set_verify_marker(file_path: str):
    """Create verification marker when code files are modified."""
    ext = Path(file_path).suffix.lower()
    if ext in CODE_EXTENSIONS:
        ts = datetime.now(timezone.utc).isoformat()
        write_marker(f"Modified: {file_path} at {ts}", source_path=file_path)


def main():
    data = parse_hook_stdin()
    tool_input = data.get("tool_input", {})

    # Flexible key search for the target file
    file_path = (
        tool_input.get("file_path")
        or tool_input.get("file")
        or tool_input.get("targetFile")
        or tool_input.get("TargetFile")
        or tool_input.get("path")
    )

    if not file_path:
        sys.exit(0)

    # Create verification marker for code files (unconditional —
    # worktree safety is handled by write_marker's is_worktree_path guard)
    set_verify_marker(file_path)

    p = Path(file_path)
    suffix = p.suffix.lower()

    # Load config for timeout
    config = load_workflow_config()
    timeout = config.get("format_timeout_seconds", 30)

    # Python formatting with ruff
    if suffix == ".py":
        if importlib.util.find_spec("ruff") is None:
            audit_log("post_format", "skip", f"ruff not installed for {file_path}")
            sys.exit(0)

        # Use list (shell=False) — safe and works for python -m ruff
        fmt_cmd = [sys.executable, "-m", "ruff", "format", str(p)]
        code, stderr = run_formatter(fmt_cmd, timeout=timeout)
        if code != 0:
            audit_log("post_format", "format_fail", f"ruff format: {stderr[:300]}")
            sys.stderr.write(
                f"WARNING: post_format ruff format failed (rc={code}): {stderr[:300]}\n"
            )
            # needs_verify remains set — do NOT clear it on formatter failure

        fix_cmd = [sys.executable, "-m", "ruff", "check", "--fix", str(p)]
        code, stderr = run_formatter(fix_cmd, timeout=timeout)
        if code != 0:
            audit_log("post_format", "lint_fail", f"ruff check: {stderr[:300]}")
            sys.stderr.write(
                f"WARNING: post_format ruff check --fix failed (rc={code}): {stderr[:300]}\n"
            )
            # needs_verify remains set — do NOT clear it on formatter failure

        sys.exit(0)

    # Web/Docs formatting with Prettier
    if suffix in PRETTIER_EXTENSIONS:
        if not shutil.which("npx"):
            audit_log("post_format", "skip", f"npx not found for {file_path}")
            sys.exit(0)

        # Use string (shell=True) — needed on Windows where npx is npx.cmd
        fmt_cmd = f'npx prettier --write "{p}"'
        code, stderr = run_formatter(fmt_cmd, timeout=timeout)
        if code != 0:
            audit_log("post_format", "format_fail", f"prettier: {stderr[:300]}")
            sys.stderr.write(
                f"WARNING: post_format prettier failed (rc={code}): {stderr[:300]}\n"
            )
            # needs_verify remains set — do NOT clear it on formatter failure

        sys.exit(0)

    sys.exit(0)


if __name__ == "__main__":
    main()
