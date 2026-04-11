"""Smoke tests for .claude/hooks/ modules.

These are intentionally minimal. The python-hooks CI job runs:
    python -m pytest .claude/hooks/tests/ -v

The goal is a green CI signal — we verify the hook library modules
import cleanly on the target Python version and that a small number of
known-stable surface points still work. Comprehensive unit tests live
elsewhere and are out of scope for this smoke suite.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

# .claude/hooks/ is not a Python package (no __init__.py), so we inject it
# onto sys.path so `import _lib` resolves to the hook library. The path is
# anchored to this test file's location, which makes the test robust to
# being executed from any working directory.
HOOKS_DIR = Path(__file__).resolve().parent.parent
if str(HOOKS_DIR) not in sys.path:
    sys.path.insert(0, str(HOOKS_DIR))

# Workflow config lives at .claude/workflow.json, two levels up from this
# test file (hooks/tests/test_smoke.py -> .claude/workflow.json).
WORKFLOW_JSON = HOOKS_DIR.parent / "workflow.json"


def test_lib_imports() -> None:
    """_lib loads without error and exposes root_kind()."""
    import _lib  # noqa: F401  — side-effect import is the assertion

    assert hasattr(_lib, "root_kind"), "_lib must expose root_kind()"


def test_qa_lib_imports() -> None:
    """_qa_lib loads without error."""
    import _qa_lib  # noqa: F401  — side-effect import is the assertion

    # Sanity-check that the module has *some* public attribute so an
    # empty shim file would not silently pass.
    public_attrs = [name for name in dir(_qa_lib) if not name.startswith("_")]
    assert len(public_attrs) > 0, "_qa_lib appears to be empty"


def test_root_kind_returns_known_value() -> None:
    """root_kind() returns one of the three documented values."""
    import _lib

    result = _lib.root_kind()
    assert result in {
        "canonical_root",
        "linked_human_worktree",
        "worker_worktree",
    }, f"root_kind() returned unexpected value: {result!r}"


def test_workflow_json_is_valid() -> None:
    """.claude/workflow.json exists and parses as a JSON object."""
    assert WORKFLOW_JSON.is_file(), (
        f"workflow.json not found at {WORKFLOW_JSON}"
    )
    with WORKFLOW_JSON.open("r", encoding="utf-8") as fh:
        data = json.load(fh)
    assert isinstance(data, dict), "workflow.json must parse as an object"
    assert "commands" in data, "workflow.json must define 'commands'"
