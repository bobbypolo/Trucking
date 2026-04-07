"""Shared utilities for Claude Code workflow hooks."""

import json
import logging
import os
import re
import subprocess
import sys
import time
from datetime import datetime, timezone
from enum import Enum
from pathlib import Path

logger = logging.getLogger(__name__)


class AuditMode(str, Enum):
    """Audit execution mode for the /audit skill.

    Members
    -------
    QUICK    -- Run only the lightweight sections (1, 2, 3).
    DELIVERY -- Run sections suitable for pre-delivery review (1-6).
    FULL     -- Run all sections (default).
    """

    QUICK = "quick"
    DELIVERY = "delivery"
    FULL = "full"

    @classmethod
    def resolve(cls, requested: str | None) -> "AuditMode":
        """Return the AuditMode for *requested*.

        Returns AuditMode.FULL for None or any unrecognised string.
        """
        if requested is None:
            return cls.FULL
        try:
            return cls(requested)
        except ValueError:
            return cls.FULL


# Constants — paths resolved from __file__. Override via CLAUDE_PROJECT_ROOT env var.

_env_root = os.environ.get("CLAUDE_PROJECT_ROOT")
if _env_root:
    PROJECT_ROOT = Path(_env_root)
    _CLAUDE_DIR = PROJECT_ROOT / ".claude"
else:
    _HOOKS_DIR = Path(__file__).resolve().parent  # .claude/hooks/
    _CLAUDE_DIR = _HOOKS_DIR.parent  # .claude/
    PROJECT_ROOT = _CLAUDE_DIR.parent  # project root

MARKER_PATH = _CLAUDE_DIR / ".needs_verify"
STOP_COUNTER_PATH = _CLAUDE_DIR / ".stop_block_count"
AUDIT_LOG_PATH = _CLAUDE_DIR / "errors" / "hook_audit.jsonl"
ERROR_DIR = _CLAUDE_DIR / "errors"
WORKFLOW_CONFIG_PATH = _CLAUDE_DIR / "workflow.json"
WORKFLOW_STATE_PATH = _CLAUDE_DIR / ".workflow-state.json"

# State mutation rules are canonically documented in
# .claude/docs/knowledge/state-ownership.md
DEFAULT_WORKFLOW_STATE: dict = {
    # Owner: post_format.py (set) / post_bash_capture.py (clear) hooks only.
    # Mutation: set to "filename modified at <timestamp>" on code edit; cleared to
    # None when tests pass. Ralph and sub-agents read this but never write it.
    # Compaction recovery: re-read from .workflow-state.json on session start
    # (post_compact_restore.py). Value survives compaction because it is persisted.
    "needs_verify": None,
    # Owner: stop_verify_gate.py hook only.
    # Mutation: incremented each time the Stop event is blocked (unverified changes);
    # reset to 0 by clear_marker(). After 3 consecutive blocks, force-stop clears all.
    # Compaction recovery: persisted in .workflow-state.json; survives context resets.
    "stop_block_count": 0,
    # Owner: Ralph orchestrator (outer loop) only.
    # Mutation: ralph-worker is a read-only consumer of this section.
    # Each field is written before the relevant STEP executes so that compaction
    # recovery can resume from ralph.current_step without re-running completed steps.
    "ralph": {
        "consecutive_skips": 0,
        "stories_passed": 0,
        "stories_skipped": 0,
        "feature_branch": "",
        "current_story_id": "",
        "current_attempt": 0,
        "max_attempts": 4,
        "prior_failure_summary": "",
        "current_step": "",  # tracks orchestrator position for compaction recovery
        "checkpoint_hash": "",  # full git hash for rollback reference
        "cumulative_drift_warnings": 0,
    },
}

DEFAULT_TEST_PATTERNS = [
    "pytest",
    "python -m pytest",
    "vitest",
    "jest",
    "npm test",
    "npm run test",
    "go test",
    "cargo test",
    "tox",
    "mocha",
    "rspec",
    "phpunit",
    "dotnet test",
    "mix test",
    "bundle exec rspec",
]

CODE_EXTENSIONS: frozenset[str] = frozenset(
    {
        ".py",
        ".ts",
        ".tsx",
        ".js",
        ".jsx",
        ".go",
        ".rs",
        ".java",
        ".rb",
        ".cs",
        ".php",
        ".c",
        ".cpp",
        ".h",
        ".hpp",
    }
)

PROJECT_MODE_SELF_HOSTED = "self_hosted"
PROJECT_MODE_HOST_PROJECT = "host_project"
VALID_PROJECT_MODES: frozenset[str] = frozenset(
    {PROJECT_MODE_SELF_HOSTED, PROJECT_MODE_HOST_PROJECT}
)

AUDIT_MAX_LINES = 500
AUDIT_TRIM_TO = 250
AUDIT_SIZE_THRESHOLD = 75_000
VERIFICATION_LOG_RETENTION = 500
AUDIT_LOG_RETENTION = 500
ERROR_HISTORY_RETENTION = 100
RUNTIME_ARTIFACT_RETENTION: dict[str, int] = {
    "verification_log": VERIFICATION_LOG_RETENTION,
    "audit_log": AUDIT_LOG_RETENTION,
    "error_history": ERROR_HISTORY_RETENTION,
}


def _deep_merge_defaults(state: dict, defaults: dict) -> dict:
    """Merge defaults into state, filling missing keys recursively."""
    result = dict(defaults)
    for key, default_val in defaults.items():
        if key in state:
            if isinstance(default_val, dict) and isinstance(state[key], dict):
                result[key] = _deep_merge_defaults(state[key], default_val)
            else:
                result[key] = state[key]
    return result


def _load_workflow_state_raw() -> dict | None:
    """Load .workflow-state.json without applying defaults or validation."""
    try:
        if WORKFLOW_STATE_PATH.exists():
            content = WORKFLOW_STATE_PATH.read_text(encoding="utf-8").strip()
            if content:
                loaded = json.loads(content)
                if isinstance(loaded, dict):
                    return loaded
    except (json.JSONDecodeError, OSError, PermissionError, ValueError) as exc:
        audit_log(
            "read_workflow_state",
            "state_file_corrupt_or_unreadable",
            f"{type(exc).__name__}: {exc}",
        )
    return None


def _validate_ralph_dispatch_state(ralph_state: object) -> str | None:
    """Return a reason string when ralph state encodes an invalid dispatch step."""
    if not isinstance(ralph_state, dict):
        return None

    current_step = ralph_state.get("current_step")
    if not isinstance(current_step, str):
        return None

    normalized_step = current_step.strip().upper()
    if not normalized_step:
        return None

    if normalized_step == "DISPATCH" or normalized_step.endswith("_DISPATCH"):
        current_story_id = ralph_state.get("current_story_id")
        if not isinstance(current_story_id, str) or not current_story_id.strip():
            return (
                "invalid Ralph dispatch state: "
                f"current_step={current_step!r} requires non-empty current_story_id"
            )
    return None


def _validate_workflow_state(state: dict) -> str | None:
    """Return a reason string when the workflow state is internally inconsistent."""
    if not isinstance(state, dict):
        return None
    return _validate_ralph_dispatch_state(state.get("ralph"))


def _sanitize_workflow_state(state: dict) -> dict:
    """Return a copy of state with invalid Ralph dispatch data neutralized.

    This keeps unrelated workflow state intact when recovering from a stale or
    hand-edited invalid dispatch marker on disk.
    """
    sanitized = json.loads(json.dumps(state))
    ralph_state = sanitized.get("ralph")
    if isinstance(ralph_state, dict):
        ralph_state["current_step"] = ""
        ralph_state["current_story_id"] = ""
    return sanitized


# ---------------------------------------------------------------------------
# Platform-aware file locking for workflow state
# ---------------------------------------------------------------------------

_STATE_LOCK_PATH = WORKFLOW_STATE_PATH.with_suffix(".json.lock")


def _acquire_state_lock(lock_fh, retries: int = 3):
    """Acquire a platform-specific file lock on *lock_fh*.

    Uses fcntl.flock() on Unix and msvcrt.locking() on Windows with
    non-blocking modes, the same pattern used by ``_locked_append()``
    in ``_qa_lib.py``.

    Retries up to *retries* times with 10ms, 20ms, ... backoff.

    Returns True if the lock was acquired, False otherwise (caller should
    fall back to unlocked operation).
    """
    for attempt in range(retries):
        try:
            fd = lock_fh.fileno()
            if sys.platform == "win32":
                import msvcrt

                lock_fh.seek(0)
                msvcrt.locking(fd, msvcrt.LK_NBLCK, 1)
            else:
                import fcntl

                fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
            return True
        except (PermissionError, OSError):
            if attempt < retries - 1:
                time.sleep(0.01 * (attempt + 1))  # 10ms, 20ms, ...
    return False


def _release_state_lock(lock_fh):
    """Release a platform-specific file lock on *lock_fh*.

    Silently ignores errors — called in finally blocks.
    """
    try:
        fd = lock_fh.fileno()
        if sys.platform == "win32":
            import msvcrt

            lock_fh.seek(0)
            msvcrt.locking(fd, msvcrt.LK_UNLCK, 1)
        else:
            import fcntl

            fcntl.flock(fd, fcntl.LOCK_UN)
    except (PermissionError, OSError) as exc:
        audit_log("release_state_lock", "unlock_error", str(exc))


def read_workflow_state() -> dict:
    """Read .workflow-state.json, returning default state if missing or corrupt."""
    import copy

    defaults = copy.deepcopy(DEFAULT_WORKFLOW_STATE)
    loaded = _load_workflow_state_raw()
    if loaded is not None:
        state = _deep_merge_defaults(loaded, defaults)
        validation_reason = _validate_workflow_state(state)
        if validation_reason:
            audit_log(
                "read_workflow_state",
                "invalid_dispatch_state",
                validation_reason,
            )
            return _sanitize_workflow_state(state)
        return state
    return defaults


def write_workflow_state(state: dict, _locked: bool = False) -> bool:
    """Atomically write state with optional file locking.

    Acquires a lockfile (`.workflow-state.json.lock`) unless *_locked* is True
    (indicating the caller already holds the lock). Falls back to unlocked
    operation if locking fails — never breaks existing behavior.

    Retries ``os.replace`` 3x on PermissionError (Windows locking) as an
    additional inner safety layer.

    Returns True on successful write, False on any failure.
    """
    lock_fh = None
    tmp_path = WORKFLOW_STATE_PATH.with_suffix(".json.tmp")
    success = False
    try:
        validation_reason = _validate_workflow_state(state)
        if validation_reason:
            audit_log(
                "write_workflow_state",
                "invalid_dispatch_state",
                validation_reason,
            )
            return False

        WORKFLOW_STATE_PATH.parent.mkdir(parents=True, exist_ok=True)

        # Acquire lockfile unless caller already holds the lock
        if not _locked:
            try:
                lock_fh = _STATE_LOCK_PATH.open("a", encoding="utf-8")
                if not _acquire_state_lock(lock_fh):
                    audit_log(
                        "write_workflow_state",
                        "lock_fallback",
                        "All 3 lock attempts failed, proceeding unlocked",
                    )
                    # Close the handle — we'll proceed without locking
                    try:
                        lock_fh.close()
                    except OSError:
                        pass
                    lock_fh = None
            except OSError as exc:
                audit_log(
                    "write_workflow_state",
                    "lock_open_failed",
                    f"Cannot open lockfile: {exc}",
                )
                lock_fh = None

        tmp_path.write_text(json.dumps(state, indent=2) + "\n", encoding="utf-8")

        # Retry os.replace up to 3 times on PermissionError (Windows locking)
        last_err = None
        for attempt in range(3):
            try:
                os.replace(str(tmp_path), str(WORKFLOW_STATE_PATH))
                success = True
                return True  # Success
            except PermissionError as exc:
                last_err = exc
                if attempt < 2:
                    time.sleep(0.01 * (attempt + 1))  # 10ms, 20ms

        # Exhausted retries
        audit_log(
            "write_workflow_state",
            "retry_exhausted",
            f"3 PermissionError retries failed: {last_err}",
        )
    except (TypeError, ValueError) as exc:
        # Non-retryable: data serialization errors
        audit_log("write_workflow_state", "write_error", f"Non-retryable: {exc}")
    except OSError as exc:
        # Non-retryable: filesystem errors other than PermissionError in replace
        audit_log(
            "write_workflow_state", "write_error", f"Non-retryable OS error: {exc}"
        )
    finally:
        # Always clean up temp file
        try:
            if tmp_path.exists():
                tmp_path.unlink(missing_ok=True)
        except OSError:
            pass
        # Release lock if we acquired it
        if lock_fh is not None:
            _release_state_lock(lock_fh)
            try:
                lock_fh.close()
            except OSError:
                pass
    return success


def update_workflow_state(**kwargs) -> dict:
    """Read-modify-write for workflow state. The 'ralph' key is merged, not replaced.

    Acquires a lockfile (`.workflow-state.json.lock`) around the full
    read-modify-write cycle to prevent data loss from parallel hook execution.
    Uses platform-aware locking (fcntl on Unix, msvcrt on Windows) with 3
    retry attempts and 10ms/20ms backoff, consistent with ``_locked_append()``
    in ``_qa_lib.py``. Falls back to unlocked operation if locking fails.
    """
    lock_fh = None
    locked = False
    try:
        _STATE_LOCK_PATH.parent.mkdir(parents=True, exist_ok=True)
        lock_fh = _STATE_LOCK_PATH.open("a", encoding="utf-8")
        locked = _acquire_state_lock(lock_fh)
        if not locked:
            audit_log(
                "update_workflow_state",
                "lock_fallback",
                "All 3 lock attempts failed, proceeding unlocked",
            )
            try:
                lock_fh.close()
            except OSError:
                pass
            lock_fh = None
    except OSError as exc:
        audit_log(
            "update_workflow_state",
            "lock_open_failed",
            f"Cannot open lockfile: {exc}",
        )
        lock_fh = None

    try:
        import copy

        raw_state = _load_workflow_state_raw()
        if raw_state is None:
            state = copy.deepcopy(DEFAULT_WORKFLOW_STATE)
        else:
            state = _deep_merge_defaults(raw_state, copy.deepcopy(DEFAULT_WORKFLOW_STATE))
        for key, value in kwargs.items():
            if key == "ralph" and isinstance(value, dict):
                # Merge ralph sub-keys instead of replacing the whole section
                ralph_section = state.get("ralph", {})
                ralph_section.update(value)
                state["ralph"] = ralph_section
            else:
                state[key] = value
        validation_reason = _validate_workflow_state(state)
        if validation_reason:
            audit_log(
                "update_workflow_state",
                "invalid_dispatch_state",
                validation_reason,
            )
            raise ValueError(validation_reason)
        # Pass _locked=True so write_workflow_state skips its own locking
        if not write_workflow_state(state, _locked=locked):
            audit_log(
                "update_workflow_state",
                "write_failed",
                f"keys={list(kwargs.keys())}",
            )
        return state
    finally:
        if lock_fh is not None:
            _release_state_lock(lock_fh)
            try:
                lock_fh.close()
            except OSError:
                pass


def parse_hook_stdin(timeout: float = 2.0) -> dict:
    """Parse JSON from stdin. Returns {} on any failure. Never blocks forever.

    Uses a daemon thread with timeout to prevent hanging when stdin is a pipe
    that never sends EOF (e.g., background bash execution, manual testing).
    """
    if sys.stdin.isatty():
        return {}

    import threading

    result: list[str] = [""]

    def _reader() -> None:
        try:
            result[0] = sys.stdin.read()
        except Exception:
            pass

    t = threading.Thread(target=_reader, daemon=True)
    t.start()
    t.join(timeout=timeout)

    if t.is_alive():
        # stdin read timed out — not being called from hook system.
        # Trade-off: the daemon thread leaks until process exit, holding a
        # reference to sys.stdin. This is acceptable because hooks are
        # short-lived processes. In long-lived processes (e.g. test runners),
        # the leaked thread is cleaned up on process exit via daemon=True.
        return {}

    try:
        raw = result[0].strip()
        if not raw:
            return {}
        return json.loads(raw)
    except (json.JSONDecodeError, ValueError) as exc:
        audit_log("parse_hook_stdin", "parse_error", str(exc)[:300])
        return {}


def load_workflow_config() -> dict:
    """Load .claude/workflow.json with fallback defaults. Never crashes."""
    try:
        if WORKFLOW_CONFIG_PATH.exists():
            return json.loads(WORKFLOW_CONFIG_PATH.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, ValueError, OSError):
        pass
    return {}


def _normalize_project_mode(raw_mode: object) -> str:
    """Normalize workflow project mode, defaulting to host_project to fail closed."""
    if not isinstance(raw_mode, str):
        return PROJECT_MODE_HOST_PROJECT
    normalized = raw_mode.strip().lower().replace("-", "_")
    if normalized in VALID_PROJECT_MODES:
        return normalized
    return PROJECT_MODE_HOST_PROJECT


def get_project_mode(config: dict | None = None) -> str:
    """Return the normalized project mode from workflow.json."""
    if config is None:
        config = load_workflow_config()
    commands = config.get("commands", {}) if isinstance(config, dict) else {}
    for candidate in (config.get("project_mode"), commands.get("project_mode")):
        if isinstance(candidate, str) and candidate.strip():
            return _normalize_project_mode(candidate)
    return PROJECT_MODE_HOST_PROJECT


def _has_explicit_project_mode(config: dict) -> bool:
    """Return True when workflow.json declares a valid explicit project_mode."""
    if not isinstance(config, dict):
        return False
    commands = config.get("commands", {})
    candidates = (config.get("project_mode"), commands.get("project_mode"))
    return any(
        isinstance(candidate, str)
        and candidate.strip().lower().replace("-", "_") in VALID_PROJECT_MODES
        for candidate in candidates
    )


def _is_unconfigured_command(value: object) -> bool:
    """Return True when a command is empty or still a placeholder."""
    if not isinstance(value, str):
        return True
    stripped = value.strip()
    return not stripped or stripped.upper().startswith("TODO")


def _is_unsafe_host_project_command(key: str, value: object) -> bool:
    """Return True when a host-project command points back at ADE self-tests."""
    if not isinstance(value, str):
        return False
    lowered = value.replace("\\", "/").lower()
    if key == "project_test" and ".claude/hooks/tests" in lowered:
        return True
    return False


def get_runtime_artifact_retention() -> dict[str, int]:
    """Return the explicit runtime artifact retention policy."""
    return dict(RUNTIME_ARTIFACT_RETENTION)


def check_project_commands(config: dict | None = None) -> list[str]:
    """Return project_* command keys that are invalid for the current mode.

    Reads from the provided config dict (or loads workflow.json if None).
    Returns an empty list when all three keys are usable for the declared mode.
    """
    if config is None:
        config = load_workflow_config()
    cmds = config.get("commands", {})
    keys = ("project_test", "project_lint", "project_type_check")
    project_mode = get_project_mode(config)
    invalid: list[str] = []
    for key in keys:
        value = cmds.get(key)
        if _is_unconfigured_command(value):
            invalid.append(key)
            continue
        if (
            project_mode == PROJECT_MODE_HOST_PROJECT
            and _is_unsafe_host_project_command(key, value)
        ):
            invalid.append(key)
    return invalid


# Keys whose TODO status is a hard FAIL (QA pipeline runs wrong tests).
_CRITICAL_PROJECT_COMMANDS = frozenset({"project_test", "project_lint"})

# Keys whose TODO status is a soft WARN (optional tooling).
_OPTIONAL_PROJECT_COMMANDS = frozenset({"project_type_check"})


def validate_project_commands(config: dict | None = None) -> dict:
    """Validate project command configuration with severity-aware results.

    Returns a dict with:
      - "status": "PASS" | "FAIL" | "WARN"
      - "project_mode": normalized project mode
      - "failures": list of critical command keys still set to TODO
                    (project_test, project_lint -- FAIL level)
      - "warnings": list of optional command keys still set to TODO
                    (project_type_check -- WARN level)
      - "configured": dict mapping configured key names to their values
      - "mode_error": explicit project_mode contract failure, if any

    In host_project mode, project_test and project_lint being TODO is a FAIL
    because QA Steps 1-3 would otherwise miss host-project verification. A
    host_project project_test value that points at .claude/hooks/tests is also a
    FAIL because it routes verification back to ADE self-tests.
    project_type_check being TODO is only a WARN because type checking is optional.
    """
    if config is None:
        config = load_workflow_config()
    cmds = config.get("commands", {})
    project_mode = get_project_mode(config)

    failures: list[str] = []
    warnings: list[str] = []
    configured: dict[str, str] = {}
    mode_error = ""

    if not _has_explicit_project_mode(config):
        mode_error = (
            "workflow.json must declare project_mode as self_hosted or host_project"
        )
        failures.append("project_mode")

    all_keys = sorted(_CRITICAL_PROJECT_COMMANDS | _OPTIONAL_PROJECT_COMMANDS)
    for key in all_keys:
        value = cmds.get(key, "")
        if _is_unconfigured_command(value):
            if key in _CRITICAL_PROJECT_COMMANDS:
                failures.append(key)
            else:
                warnings.append(key)
            continue
        if (
            project_mode == PROJECT_MODE_HOST_PROJECT
            and _is_unsafe_host_project_command(key, value)
        ):
            failures.append(key)
            continue
        configured[key] = str(value)

    if failures:
        status = "FAIL"
    elif warnings:
        status = "WARN"
    else:
        status = "PASS"

    return {
        "status": status,
        "project_mode": project_mode,
        "failures": failures,
        "warnings": warnings,
        "configured": configured,
        "mode_error": mode_error,
    }


def get_test_patterns(config: dict) -> list[str]:
    """Return test patterns from config, merged with hardcoded defaults."""
    extra = config.get("test_patterns", [])
    if not isinstance(extra, list):
        extra = []
    # Merge: defaults + user patterns, preserving order, deduped
    seen = set()
    merged = []
    for p in DEFAULT_TEST_PATTERNS + extra:
        if p not in seen:
            seen.add(p)
            merged.append(p)
    return merged


_SPLIT_RE = re.compile(r"\s*(?:&&|\|\||\||;)\s*")
_ENV_VAR_PREFIX_RE = re.compile(r"^(\w+=\S+\s+)+")


def is_test_command(cmd: str, patterns: list[str]) -> bool:
    """Split on &&/||/;/|, strip env prefixes, check if any segment starts with a pattern."""
    segments = _SPLIT_RE.split(cmd)
    for segment in segments:
        segment = segment.strip()
        # Strip leading env var assignments like PYTHONPATH=. or CI=1
        cleaned = _ENV_VAR_PREFIX_RE.sub("", segment).strip()
        for pattern in patterns:
            if cleaned.startswith(pattern):
                return True
    return False


def run_formatter(cmd, timeout: int = 30) -> tuple[int, str]:
    """Run formatter with timeout. List→shell=False, str→shell=True. Returns (rc, stderr)."""
    use_shell = isinstance(cmd, str)
    try:
        result = subprocess.run(
            cmd,
            shell=use_shell,  # nosec B602
            capture_output=True,
            text=True,
            timeout=timeout,
        )
        return result.returncode, result.stderr
    except subprocess.TimeoutExpired:
        return -1, f"Formatter timed out after {timeout}s"
    except FileNotFoundError:
        return -1, f"Formatter not found: {cmd}"
    except (OSError, ValueError) as e:
        return -1, str(e)


def audit_log(hook_name: str, decision: str, detail: str):
    """Append to hook_audit.jsonl. Warns to stderr on failure. Auto-rotates by size."""
    try:
        AUDIT_LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
        entry = json.dumps(
            {
                "ts": datetime.now(timezone.utc).isoformat(),
                "hook": hook_name,
                "decision": decision,
                "detail": detail[:500],
            }
        )
        with AUDIT_LOG_PATH.open("a", encoding="utf-8") as f:
            f.write(entry + "\n")

        # Size-based rotation: only read file when it exceeds the threshold
        try:
            file_size = os.path.getsize(AUDIT_LOG_PATH)
        except OSError:
            return
        if file_size >= AUDIT_SIZE_THRESHOLD:
            lines = [
                line
                for line in AUDIT_LOG_PATH.read_text(encoding="utf-8")
                .strip()
                .split("\n")
                if line.strip()
            ]
            if len(lines) > AUDIT_MAX_LINES:
                AUDIT_LOG_PATH.write_text(
                    "\n".join(lines[-AUDIT_TRIM_TO:]) + "\n",
                    encoding="utf-8",
                )
    except (OSError, json.JSONDecodeError, ValueError) as e:
        sys.stderr.write(f"WARNING: audit_log write failed: {e}\n")


def read_marker() -> str | None:
    """Read needs_verify from .workflow-state.json, or None if absent/empty."""
    state = read_workflow_state()
    value = state.get("needs_verify")
    if isinstance(value, str) and value.strip():
        return value.strip()
    return None


def write_marker(content: str, source_path: str | None = None) -> None:
    """Write needs_verify. Skips if source_path is a worktree path."""
    if source_path is not None and is_worktree_path(source_path):
        return
    update_workflow_state(needs_verify=content)


def clear_marker() -> None:
    """Clear needs_verify and stop_block_count.

    Returns early (no-op) when running inside a worktree to preserve
    the single-writer invariant from state-ownership.md.
    """
    if is_worktree_path(os.getcwd()):
        return
    update_workflow_state(needs_verify=None, stop_block_count=0)


def write_atomic(path: "Path | str", content: "str | bytes") -> bool:
    """Write content to path atomically via temp file + fsync + rename.

    Writes a temp file in the same directory as path, fsyncs the file
    descriptor, then atomically renames to the target path.

    Returns True on success, False on any failure (never raises).
    Supports both str and bytes content.
    """
    import tempfile

    tmp_path: Path | None = None
    try:
        target = Path(path)
        parent = target.parent
        is_bytes = isinstance(content, bytes)
        mode = "wb" if is_bytes else "w"
        kwargs: dict = {"dir": str(parent), "delete": False, "prefix": ".tmp_"}
        if not is_bytes:
            kwargs["encoding"] = "utf-8"

        with tempfile.NamedTemporaryFile(mode=mode, **kwargs) as tmp_f:
            tmp_path = Path(tmp_f.name)
            tmp_f.write(content)
            tmp_f.flush()
            os.fsync(tmp_f.fileno())

        os.replace(str(tmp_path), str(target))
        return True
    except Exception:
        # Broad catch justified: write_atomic is used by hooks that must never
        # crash. Callers check the bool return to detect failure.
        try:
            if tmp_path is not None and tmp_path.exists():
                tmp_path.unlink()
        except OSError:
            pass
        return False


def is_subagent(data: dict) -> bool:
    """Return True if hook stdin data indicates a subagent context.

    The documented Claude hooks discriminator for subagent contexts is the
    presence of the 'agent_id' key in the hook stdin JSON. Returns False
    when agent_id is absent (main agent context).
    """
    return "agent_id" in data


def is_worktree_path(path: str) -> bool:
    """Check if path is inside .claude/worktrees/. Handles Unix and Windows separators."""
    normalized = path.replace("\\", "/")
    return ".claude/worktrees/" in normalized


def get_stop_block_count() -> int:
    """Read stop_block_count from .workflow-state.json, return 0 if absent."""
    state = read_workflow_state()
    count = state.get("stop_block_count", 0)
    if isinstance(count, int):
        return count
    return 0


def increment_stop_block_count() -> int:
    """Increment stop_block_count and return new value."""
    count = get_stop_block_count() + 1
    update_workflow_state(stop_block_count=count)
    return count


def clear_stop_block_count() -> None:
    """Reset stop_block_count to 0."""
    update_workflow_state(stop_block_count=0)


# ---------------------------------------------------------------------------
# Cleanup utilities
# ---------------------------------------------------------------------------


def rotate_log(
    path: "Path | str", max_entries: int = VERIFICATION_LOG_RETENTION
) -> dict:
    """Trim a JSONL log file to at most *max_entries* lines (keep the newest).

    Returns a result dict. Never raises.
    """
    _default = {"original_count": 0, "retained_count": 0, "removed_count": 0}
    try:
        target = Path(path)
        if not target.exists():
            return _default
        content = target.read_text(encoding="utf-8").strip()
        if not content:
            return _default
        lines = [line for line in content.split("\n") if line.strip()]
        original = len(lines)
        if original <= max_entries:
            return {
                "original_count": original,
                "retained_count": original,
                "removed_count": 0,
            }
        kept = lines[-max_entries:]
        write_atomic(target, "\n".join(kept) + "\n")
        return {
            "original_count": original,
            "retained_count": len(kept),
            "removed_count": original - len(kept),
        }
    except Exception as exc:
        logger.warning("rotate_log failed for %s: %s", path, exc)
        return _default


def prune_worktrees() -> dict:
    """Run ``git worktree prune`` and remove stale agent worktree directories.

    Returns ``{"pruned_count": int, "errors": list[str]}``. Never raises.
    """
    errors: list[str] = []
    pruned_count = 0
    try:
        # Step 1: run git worktree prune to clean up stale metadata
        result = subprocess.run(
            ["git", "worktree", "prune"],
            capture_output=True,
            text=True,
            cwd=str(PROJECT_ROOT),
        )
        if result.returncode != 0:
            errors.append(f"git worktree prune: {result.stderr.strip()}")

        # Step 2: list all known worktrees
        list_result = subprocess.run(
            ["git", "worktree", "list", "--porcelain"],
            capture_output=True,
            text=True,
            cwd=str(PROJECT_ROOT),
        )
        registered_paths: set[str] = set()
        if list_result.returncode == 0:
            for line in list_result.stdout.splitlines():
                if line.startswith("worktree "):
                    registered_paths.add(line[len("worktree ") :].strip())

        # Step 3: find agent-* directories under .claude/worktrees/
        worktrees_dir = _CLAUDE_DIR / "worktrees"
        if worktrees_dir.is_dir():
            import shutil

            for entry in sorted(worktrees_dir.iterdir()):
                if not entry.name.startswith("agent-"):
                    continue
                # Try git worktree remove first (handles registered worktrees)
                rm_result = subprocess.run(
                    ["git", "worktree", "remove", "--force", str(entry)],
                    capture_output=True,
                    text=True,
                    cwd=str(PROJECT_ROOT),
                )
                if rm_result.returncode == 0:
                    pruned_count += 1
                elif entry.is_dir():
                    # Fallback: directly remove the directory
                    try:
                        shutil.rmtree(str(entry))
                        pruned_count += 1
                    except Exception as rm_exc:
                        errors.append(f"rmtree {entry.name}: {rm_exc}")
    except Exception as exc:
        logger.warning("prune_worktrees failed: %s", exc)
        errors.append(str(exc))
    return {"pruned_count": pruned_count, "errors": errors}


def prune_receipts(receipts_dir: "Path | str", valid_story_ids: "set[str]") -> dict:
    """Remove receipt subdirectories whose story IDs are not in *valid_story_ids*.

    The retention policy is explicit: keep only receipt directories whose IDs are
    present in *valid_story_ids* and prune everything else.

    Returns ``{"pruned": list[str], "kept": list[str]}``. Never raises.
    """
    _default: dict = {"pruned": [], "kept": []}
    try:
        import shutil

        target = Path(receipts_dir)
        if not target.is_dir():
            return _default
        pruned: list[str] = []
        kept: list[str] = []
        for entry in sorted(target.iterdir()):
            if not entry.is_dir():
                continue
            if entry.name in valid_story_ids:
                kept.append(entry.name)
            else:
                try:
                    shutil.rmtree(str(entry))
                    pruned.append(entry.name)
                except Exception as exc:
                    logger.warning(
                        "prune_receipts: rmtree %s failed: %s", entry.name, exc
                    )
        return {"pruned": pruned, "kept": kept}
    except Exception as exc:
        logger.warning("prune_receipts failed: %s", exc)
        return _default


def count_orphan_markers(test_dir: "Path | str", prd_path: "Path | str") -> dict:
    """Count R-marker IDs in test files that no longer appear in prd.json.

    Uses lazy import of ``_qa_lib`` to avoid circular imports.
    Returns ``{"orphan_count": int, "orphan_ids": list[str], "files_scanned": int}``.
    Never raises.
    """
    _default: dict = {"orphan_count": 0, "orphan_ids": [], "files_scanned": 0}
    try:
        # Lazy import to avoid circular dependency (_qa_lib imports _lib at top level)
        import importlib

        _qa_lib = importlib.import_module("_qa_lib")
        result = _qa_lib.validate_r_markers(Path(test_dir), Path(prd_path))
        orphan_ids: list[str] = result.get("orphan_markers", [])
        # Count scanned files
        test_path = Path(test_dir)
        files_scanned = (
            len(list(test_path.rglob("test_*.py"))) if test_path.is_dir() else 0
        )
        return {
            "orphan_count": len(orphan_ids),
            "orphan_ids": orphan_ids,
            "files_scanned": files_scanned,
        }
    except Exception as exc:
        logger.warning("count_orphan_markers failed: %s", exc)
        return _default


def strip_orphan_markers(test_dir: "Path | str", prd_path: "Path | str") -> dict:
    """Remove orphan R-marker IDs from test files.

    For each ``# Tests R-PN-NN, R-PX-YY`` **standalone comment line**:
    - If only some IDs are orphans, strip the orphan IDs and keep valid ones.
    - If all IDs are orphans, remove the entire line.

    Lines inside triple-quoted strings (docstrings, string literals) and lines
    where ``#`` is not at the start (after optional whitespace) are never
    modified.  This prevents corruption of R-markers embedded as test data
    inside Python string literals.

    Uses lazy import of ``_qa_lib`` to avoid circular imports.
    Returns ``{"files_modified": int, "markers_removed": int, "files_unchanged": int,
    "errors": list[str]}``. Never raises.
    """
    _default: dict = {
        "files_modified": 0,
        "markers_removed": 0,
        "files_unchanged": 0,
        "errors": [],
    }
    try:
        # Lazy import to avoid circular dependency
        import importlib

        _qa_lib = importlib.import_module("_qa_lib")

        info = count_orphan_markers(test_dir, prd_path)
        orphan_set: set[str] = set(info.get("orphan_ids", []))
        if not orphan_set:
            # Count files for the unchanged count
            test_path = Path(test_dir)
            unchanged = (
                len(list(test_path.rglob("test_*.py"))) if test_path.is_dir() else 0
            )
            return {
                "files_modified": 0,
                "markers_removed": 0,
                "files_unchanged": unchanged,
                "errors": [],
            }

        marker_re = _qa_lib._R_MARKER_RE
        # Individual ID pattern (matches within a marker group)
        _id_re = re.compile(r"R-P\d+-\d{2}(?:-AC\d+)?")

        files_modified = 0
        markers_removed = 0
        files_unchanged = 0
        errors: list[str] = []

        test_path = Path(test_dir)
        for test_file in sorted(test_path.rglob("test_*.py")):
            try:
                original = test_file.read_text(encoding="utf-8")
            except Exception as exc:
                errors.append(f"{test_file.name}: read error: {exc}")
                continue

            new_lines: list[str] = []
            changed = False
            in_triple_quote = False
            for line in original.splitlines(keepends=True):
                stripped = line.lstrip()
                # Track triple-quoted string blocks (""" and ''').
                # Count triple-quote delimiters on this line; an odd total
                # count toggles whether we are inside a multi-line string.
                tq_count = stripped.count('"""') + stripped.count("'''")
                if tq_count % 2 == 1:
                    in_triple_quote = not in_triple_quote

                m = marker_re.search(line)
                if not m:
                    new_lines.append(line)
                    continue

                # Only strip from standalone comment lines (line starts
                # with '#' after whitespace) that are NOT inside a
                # triple-quoted string.  This protects R-markers embedded
                # as test data inside Python string literals / docstrings.
                if in_triple_quote or not stripped.startswith("#"):
                    new_lines.append(line)
                    continue
                # Extract IDs from this marker group
                group = m.group(1)
                ids = _id_re.findall(group)
                orphans_in_line = [i for i in ids if i in orphan_set]
                valid_in_line = [i for i in ids if i not in orphan_set]
                if not orphans_in_line:
                    # Nothing to remove on this line
                    new_lines.append(line)
                    continue
                markers_removed += len(orphans_in_line)
                changed = True
                if not valid_in_line:
                    # All IDs are orphans — remove the entire line
                    continue
                # Keep valid IDs, rewrite the line
                new_id_str = ", ".join(valid_in_line)
                new_line = line[: m.start(1)] + new_id_str + line[m.end(1) :]
                new_lines.append(new_line)

            if changed:
                ok = write_atomic(test_file, "".join(new_lines))
                if ok:
                    files_modified += 1
                else:
                    errors.append(f"{test_file.name}: write failed")
                    files_unchanged += 1
            else:
                files_unchanged += 1

        return {
            "files_modified": files_modified,
            "markers_removed": markers_removed,
            "files_unchanged": files_unchanged,
            "errors": errors,
        }
    except Exception as exc:
        logger.warning("strip_orphan_markers failed: %s", exc)
        return _default


# Re-export from _prod_patterns for backward compatibility
from _prod_patterns import PROD_VIOLATION_PATTERNS, scan_file_violations  # noqa: E402, F401

# Language-specific violation patterns for polyglot scanning.
# Each key is a language name matching workflow.json language profiles.
# Values are lists of (regex, violation_id, message, severity) tuples —
# same format as PROD_VIOLATION_PATTERNS.
LANG_VIOLATION_PATTERNS: dict[str, list[tuple[str, str, str, str]]] = {
    "typescript": [
        (
            r"\bconsole\.log\s*\(",
            "console-log",
            "console.log statement found in production TypeScript code",
            "warn",
        ),
        (
            r":\s*any\b",
            "ts-any",
            "Explicit 'any' type annotation found (prefer specific types)",
            "warn",
        ),
        (
            r"""(?:password|passwd|api_key|apikey|secret|token)\s*=\s*(['"`])(?!\1|[\$\{])""",
            "hardcoded-secret-ts",
            "Potential hardcoded secret or credential in TypeScript",
            "block",
        ),
        # XSS sinks (R-P1-07)
        (
            r"""\bdangerouslySetInnerHTML\b""",
            "xss-dangerously-set-inner-html-js",
            "dangerouslySetInnerHTML in TypeScript/JSX (XSS risk — sanitize with DOMPurify)",
            "block",
        ),
        (
            r"""\.html\s*\(\s*(?!(?:'[^'+\n]*'|"[^"+\n]*")\s*\))""",
            "xss-jquery-html",
            ".html() with non-literal argument in TypeScript (XSS risk — use .text() or sanitize)",
            "block",
        ),
    ],
    "javascript": [
        (
            r"\bconsole\.log\s*\(",
            "console-log",
            "console.log statement found in production JavaScript code",
            "warn",
        ),
        (
            r"""(?:password|passwd|api_key|apikey|secret|token)\s*=\s*(['"`])(?!\1|[\$\{])""",
            "hardcoded-secret-ts",
            "Potential hardcoded secret or credential in JavaScript",
            "block",
        ),
        # XSS sinks (R-P1-07)
        (
            r"""\bdangerouslySetInnerHTML\b""",
            "xss-dangerously-set-inner-html-js",
            "dangerouslySetInnerHTML in JavaScript/JSX (XSS risk — sanitize with DOMPurify)",
            "block",
        ),
        (
            r"""\.html\s*\(\s*(?!(?:'[^'+\n]*'|"[^"+\n]*")\s*\))""",
            "xss-jquery-html",
            ".html() with non-literal argument in JavaScript (XSS risk — use .text() or sanitize)",
            "block",
        ),
    ],
}
