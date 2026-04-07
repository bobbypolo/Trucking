import json
from pathlib import Path

import pytest

import _lib


def test_parse_hook_stdin_reads_json(monkeypatch):
    class FakeStdin:
        def isatty(self):
            return False

        def read(self):
            return '{"tool_input":{"path":"src/app.ts"}}'

    monkeypatch.setattr(_lib.sys, "stdin", FakeStdin())

    assert _lib.parse_hook_stdin() == {"tool_input": {"path": "src/app.ts"}}


def test_is_subagent_detects_agent_id():
    assert _lib.is_subagent({"agent_id": "agent-123"}) is True
    assert _lib.is_subagent({}) is False


def test_is_worktree_path_detects_nested_worktree():
    assert _lib.is_worktree_path("F:/repo/.claude/worktrees/agent-1/file.py")
    assert not _lib.is_worktree_path("F:/repo/hooks/file.py")


def test_write_atomic_handles_text_and_bytes(tmp_path):
    text_path = tmp_path / "text.json"
    bytes_path = tmp_path / "bytes.bin"

    assert _lib.write_atomic(text_path, "hello world") is True
    assert text_path.read_text(encoding="utf-8") == "hello world"

    assert _lib.write_atomic(bytes_path, b"\x00\x01\x02") is True
    assert bytes_path.read_bytes() == b"\x00\x01\x02"


def test_workflow_state_round_trip_with_defaults(tmp_path, monkeypatch):
    state_path = tmp_path / ".workflow-state.json"
    lock_path = tmp_path / ".workflow-state.json.lock"

    monkeypatch.setattr(_lib, "WORKFLOW_STATE_PATH", state_path)
    monkeypatch.setattr(_lib, "_STATE_LOCK_PATH", lock_path)

    state = _lib.update_workflow_state(
        needs_verify="Modified: app.py",
        ralph={"current_story_id": "STORY-123"},
    )

    assert state["needs_verify"] == "Modified: app.py"
    assert state["stop_block_count"] == 0
    assert state["ralph"]["current_story_id"] == "STORY-123"

    reloaded = _lib.read_workflow_state()
    assert reloaded["needs_verify"] == "Modified: app.py"
    assert reloaded["ralph"]["current_story_id"] == "STORY-123"
    assert json.loads(state_path.read_text(encoding="utf-8"))["needs_verify"] == (
        "Modified: app.py"
    )

