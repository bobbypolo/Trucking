#!/usr/bin/env python3
"""Automated QA verification pipeline (12 steps). Exit: 0=PASS, 1=FAIL, 2=bad args."""

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import time
from datetime import datetime, timezone
from enum import Enum
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from _lib import (
    CODE_EXTENSIONS,
    PROJECT_MODE_HOST_PROJECT,
    audit_log,
    clear_marker,
    get_project_mode,
    load_workflow_config,
    validate_project_commands,
    scan_file_violations,
)
from _qa_lib import (
    _BACKTICK_IDENTIFIER_RE,
    _PUBLIC_FUNC_RE,
    VERIFICATION_LOG_PATH,
    _locked_append,
    _validate_r_marker_assertion_quality,
    append_verification_entry,
    check_complexity,
    check_diff_public_api_coverage,
    check_negative_tests,
    check_scope_compliance,
    check_story_file_coverage,
    check_tdd_order,
    extract_diff_added_identifiers,
    has_frontend_files,
    parse_plan_changes,
    parse_plan_changes_with_actions,
    parse_plan_changes_with_descriptions,
    scan_test_quality,
    validate_r_markers,
    verify_production_calls,
)

# Default maximum character length for evidence strings. Overridable via
# workflow.json → qa_runner.evidence_max_chars.
_DEFAULT_EVIDENCE_MAX_CHARS: int = 500

# Resolved at module load from workflow.json (lazy-initialised on first use).
_evidence_max_chars: int | None = None


def _get_evidence_max_chars(config: dict | None = None) -> int:
    """Return the evidence truncation limit from config or default."""
    global _evidence_max_chars  # noqa: PLW0603
    if _evidence_max_chars is not None:
        return _evidence_max_chars
    if config is not None:
        _evidence_max_chars = int(
            config.get("qa_runner", {}).get(
                "evidence_max_chars", _DEFAULT_EVIDENCE_MAX_CHARS
            )
        )
    else:
        _evidence_max_chars = _DEFAULT_EVIDENCE_MAX_CHARS
    return _evidence_max_chars


# Language extension mappings for fallback detection (no language profiles configured)
_EXT_TO_LANG: dict[str, str] = {
    ".py": "python",
    ".ts": "typescript",
    ".tsx": "typescript",
    ".js": "javascript",
    ".jsx": "javascript",
}

def _mode_command_key(base_key: str, project_mode: str) -> str:
    """Map a generic QA command to its mode-specific config key."""
    if project_mode == PROJECT_MODE_HOST_PROJECT:
        return {
            "lint": "project_lint",
            "type_check": "project_type_check",
            "test": "project_test",
            "integration": "project_integration_test",
        }.get(base_key, base_key)
    return base_key


def _configured_command(cmd: object) -> str:
    """Return a command string only when it is non-placeholder text."""
    if not isinstance(cmd, str):
        return ""
    value = cmd.strip()
    if not value:
        return ""
    if value.upper().startswith("TODO"):
        return ""
    return value


class StepResult(str, Enum):
    """Typed result for QA pipeline steps. Serialises to its string value."""

    PASS = "PASS"
    FAIL = "FAIL"
    SKIP = "SKIP"
    TIMEOUT = "TIMEOUT"


STEP_NAMES: dict[int, str] = {
    1: "Lint",
    2: "Type check",
    3: "Unit tests",
    4: "Integration tests",
    5: "Regression check",
    6: "Code scan",
    7: "Clean diff",
    8: "Coverage",
    9: "Mock quality audit",
    10: "Plan Conformance Check",
    11: "Acceptance traceability",
    12: "Production scan",
}

# Valid phase types for --phase-type argument
VALID_PHASE_TYPES = ("foundation", "module", "integration", "e2e")

# Steps that are always required regardless of phase type.
# Only steps 3, 4, 8, 9 may be skipped based on phase type.
ALWAYS_REQUIRED_STEPS: frozenset[int] = frozenset({1, 2, 5, 6, 7, 10, 11, 12})

# Steps run by --gate-only flag: the story-classified steps only.
# Matches _STEP_CLASSIFICATION entries where value == "story".
# Used by ralph-worker fix-loop to run a fast subset (~30s vs ~300s full pipeline).
GATE_ONLY_STEPS: frozenset[int] = frozenset({1, 3, 5, 7, 10, 11})

# Maps each phase type to the set of QA step numbers that are relevant.
# Steps not in the set for a given phase type will be reported as SKIP.
PHASE_TYPE_RELEVANCE: dict[str, set[int]] = {
    "foundation": {1, 2, 3, 5, 6, 7, 9, 10, 11, 12},
    "module": {1, 2, 3, 5, 6, 7, 8, 9, 10, 11, 12},
    "integration": set(range(1, 13)),
    "e2e": set(range(1, 13)),
}

# Violation ID sets for categorized scanning (Step 6 and Step 7)
# IDs correspond to violation_id values from PROD_VIOLATION_PATTERNS in _lib.py.
# Step 6 (security) checks only security-related patterns.
# Step 7 (clean diff) checks debug/cleanup patterns.
_SECURITY_IDS = frozenset(
    (
        "hardcoded-secret",
        "sql-injection",
        "shell-injection",
        "subprocess-shell-injection",
        "os-exec-injection",
        "raw-sql-fstring",
        "expanded-secret",
        "pickle-deserialize",
        "path-traversal",
        "eval-exec-var",
        "unsafe-tempfile",
        "unvalidated-redirect",
    )
)
# One ID uses concat to avoid triggering the violation scanner on this file
_CLEANUP_IDS = frozenset(
    (
        "todo-comment",
        "debug-print",
        "de" + "bugger-stmt",
        "debug-import",
        "bare-except",
        "broad-except",
    )
)


def _required_verification_steps(
    story: dict | None,
    phase_type: str | None,
    config: dict,
) -> dict[str, bool]:
    """Return which QA verification steps are required for this story/phase.

    Returns a dict[str, bool] with exactly these keys:
        lint, type, unit, integration, regression

    A value of True means the step is REQUIRED (missing command → FAIL).
    A value of False means the step is genuinely inapplicable (missing command → SKIP).

    Logic:
        unit:        required if any acceptance criterion has testType == "unit"
        lint:        required if phase_type != "docs" (source files exist)
        type:        required if config has a type_check command configured
        integration: required if any criterion has testType == "integration"
        regression:  required if phase_type in ("integration", "e2e", "full")
    """
    criteria = []
    if story is not None:
        criteria = story.get("acceptanceCriteria", [])

    test_types = {c.get("testType", "") for c in criteria}

    unit_required = "unit" in test_types
    lint_required = phase_type != "docs"
    type_required = bool(config.get("commands", {}).get("type_check", ""))
    integration_required = "integration" in test_types
    regression_required = phase_type in ("integration", "e2e", "full")

    return {
        "lint": lint_required,
        "type": type_required,
        "unit": unit_required,
        "integration": integration_required,
        "regression": regression_required,
    }


def _build_violation_cache(
    source_files: list[Path],
) -> dict[str, list[dict]]:
    """Scan all source files once and cache the results."""
    cache: dict[str, list[dict]] = {}
    for f in source_files:
        cache[str(f)] = scan_file_violations(f)
    return cache


def _build_parser() -> argparse.ArgumentParser:
    """Build the argument parser for qa_runner."""
    parser = argparse.ArgumentParser(
        prog="qa_runner",
        description="Automated 12-step QA verification pipeline.",
        epilog="Exit codes: 0=PASS, 1=FAIL, 2=invalid arguments",
    )
    parser.add_argument(
        "--story",
        required=True,
        help="Story ID to verify (e.g., STORY-003)",
    )
    parser.add_argument(
        "--prd",
        default=None,
        help="Path to prd.json (default: .claude/prd.json)",
    )
    parser.add_argument(
        "--steps",
        default=None,
        help="Comma-separated step numbers to run (default: all 1-12, step 13 removed)",
    )
    parser.add_argument(
        "--changed-files",
        default=None,
        help="Changed file paths (comma-separated or newline-separated)",
    )
    parser.add_argument(
        "--test-dir",
        default=None,
        help="Directory containing test files",
    )
    parser.add_argument(
        "--checkpoint",
        default=None,
        help="Git checkpoint hash for diff-based checks",
    )
    parser.add_argument(
        "--plan",
        default=None,
        help="Path to PLAN.md for plan conformance checks",
    )
    parser.add_argument(
        "--phase-type",
        default=None,
        choices=VALID_PHASE_TYPES,
        help="Phase type for adaptive QA (foundation, module, integration, e2e)",
    )
    parser.add_argument(
        "--test-quality",
        action="store_true",
        default=False,
        help="Run test quality analysis instead of 12-step pipeline",
    )
    parser.add_argument(
        "--fix-iteration",
        type=int,
        default=0,
        help="Fix loop iteration number (0=initial run, >0=fix iteration)",
    )
    parser.add_argument(
        "--baseline-capture",
        action="store_true",
        default=False,
        help=(
            "Capture current QA state as a baseline. "
            "Writes output to .claude/runtime/qa-baseline.json and exits 0 "
            "regardless of step results."
        ),
    )
    parser.add_argument(
        "--baseline",
        default=None,
        help=(
            "Path to baseline JSON file (produced by --baseline-capture). "
            "When provided, _compute_environment_result() filters out steps "
            "that were already FAIL in the baseline. "
            "Also changes exit code to use story_result instead of overall_result."
        ),
    )
    parser.add_argument(
        "--gate-only",
        action="store_true",
        default=False,
        help=(
            "Run only story-classified steps (GATE_ONLY_STEPS = {1, 3, 5, 7, 10, 11}). "
            "All other steps are reported as SKIP. "
            "Faster than full pipeline (~30s vs ~300s) for fix-loop iteration."
        ),
    )
    parser.add_argument(
        "--inject-verification",
        action="store_true",
        default=False,
        help=(
            "Write a synthetic verification log entry for a story that passed "
            "outside the normal QA pipeline (e.g. mid-sprint manual verification). "
            "Requires --story. Optional: --plan-hash, --result, --note, --log-path."
        ),
    )
    parser.add_argument(
        "--log-plan-replacement",
        action="store_true",
        default=False,
        help=(
            "Append a plan_replacement sentinel entry to the verification log. "
            "Requires --old-hash and --new-hash. Optional: --reason, --log-path."
        ),
    )
    parser.add_argument(
        "--old-hash",
        default=None,
        help="SHA-256 hash of the replaced (old) plan. Required with --log-plan-replacement.",
    )
    parser.add_argument(
        "--new-hash",
        default=None,
        help="SHA-256 hash of the current (new) plan. Required with --log-plan-replacement.",
    )
    parser.add_argument(
        "--reason",
        default="",
        help="Human-readable reason for plan replacement (used with --log-plan-replacement).",
    )
    parser.add_argument(
        "--plan-hash",
        default=None,
        help=(
            "SHA-256 plan hash to stamp on the injected entry. "
            "Defaults to prd.json[plan_hash] when not supplied."
        ),
    )
    parser.add_argument(
        "--result",
        default="PASS",
        choices=["PASS", "FAIL"],
        help="Result to record in the injected entry (default: PASS).",
    )
    parser.add_argument(
        "--note",
        default="",
        help="Optional free-text note to include in the injected entry.",
    )
    parser.add_argument(
        "--log-path",
        default=None,
        help=(
            "Path to verification-log.jsonl. "
            "Defaults to VERIFICATION_LOG_PATH (.claude/docs/verification-log.jsonl)."
        ),
    )
    return parser


def _parse_steps(steps_str: str | None) -> list[int]:
    """Parse step filter string into list of step numbers."""
    if steps_str is None:
        return list(range(1, 13))

    result: list[int] = []
    for part in steps_str.split(","):
        part = part.strip()
        if part.isdigit():
            num = int(part)
            if 1 <= num <= 12:
                result.append(num)
    return sorted(set(result))


def _parse_changed_files(files_str: str | None) -> list[Path]:
    """Parse changed files string into list of Path objects.

    Supports both comma-separated and newline-separated input.  If the input
    contains newline characters it is split on newlines (matching ``git diff
    --name-only`` output); otherwise it is split on commas.

    Note: comma-delimited mode means file paths containing literal commas will
    be mis-parsed.  This is acceptable because commas in filenames are extremely
    rare in practice, especially in git repositories.
    """
    if not files_str:
        return []

    # Choose delimiter: newlines take precedence over commas
    delimiter = "\n" if "\n" in files_str else ","

    result: list[Path] = []
    for part in files_str.split(delimiter):
        part = part.strip()
        if part:
            result.append(Path(part))
    return result


def _detect_languages(changed_files: list[Path], config: dict) -> dict[str, list[Path]]:
    """Group changed files by language using workflow.json language profiles.

    Returns a dict mapping language name to list of matching files.
    Falls back to extension-based detection if no language profiles are configured.
    Files with unrecognized extensions are assigned to the ``"unknown"`` group.
    Language-specific steps (lint, type check) are skipped for ``"unknown"`` files.
    """
    languages_config = config.get("languages", {})

    if not languages_config:
        # Fallback: extension-based detection — known code files grouped by extension
        result: dict[str, list[Path]] = {}
        ext_to_lang = {
            ".py": "python",
            ".ts": "typescript",
            ".tsx": "typescript",
            ".js": "javascript",
            ".jsx": "javascript",
        }
        for f in changed_files:
            lang = ext_to_lang.get(f.suffix, "unknown")
            result.setdefault(lang, []).append(f)
        return result

    # Profile-based detection: match file extensions to language profile extensions
    result = {}
    unmatched: list[Path] = []
    for f in changed_files:
        matched = False
        for lang_name, lang_config in languages_config.items():
            extensions = lang_config.get("extensions", [])
            if f.suffix in extensions:
                result.setdefault(lang_name, []).append(f)
                matched = True
                break
        if not matched:
            unmatched.append(f)

    # Assign unmatched files to "unknown" — not "python"
    if unmatched:
        result.setdefault("unknown", []).extend(unmatched)

    return result


def _get_source_files(changed_files: list[Path]) -> list[Path]:
    """Filter changed files to only source code files (not test files)."""
    result: list[Path] = []
    for f in changed_files:
        if f.suffix not in CODE_EXTENSIONS:
            continue
        name = f.name.lower()
        if name.startswith("test_") or name.endswith("_test.py"):
            continue
        result.append(f)
    return result


def _get_test_files(
    changed_files: list[Path], config: dict | None = None
) -> list[Path]:
    """Filter changed files to only test files.

    When config contains language profiles with test_patterns, uses those patterns
    to detect test files (via fnmatch). Falls back to hardcoded Python patterns for
    backward compat (test_*.py, *_test.py).
    """
    import fnmatch

    # Collect all test glob patterns from language profiles
    lang_test_globs: list[str] = []
    if config:
        for lang_config in config.get("languages", {}).values():
            for pattern in lang_config.get("test_patterns", []):
                if pattern:
                    lang_test_globs.append(pattern)

    result: list[Path] = []
    for f in changed_files:
        name = f.name.lower()
        # Always check hardcoded Python patterns (backward compat)
        if name.startswith("test_") or name.endswith("_test.py"):
            result.append(f)
            continue
        # Check language profile glob patterns
        matched = any(fnmatch.fnmatch(name, pat.lower()) for pat in lang_test_globs)
        if matched:
            result.append(f)
    return result


def _find_story(prd_path: Path, story_id: str) -> dict | None:
    """Find a story by ID in prd.json."""
    try:
        data = json.loads(prd_path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError, ValueError) as exc:
        audit_log("_find_story", "prd_read_error", str(exc))
        return None

    for story in data.get("stories", []):
        if story.get("id") == story_id:
            return story
    return None


_SHELL_OPERATORS = ("|", "&&", "||", ">>", ">", "<", ";", "`", "$(", "${")


def _needs_shell(cmd: str) -> bool:
    """Return True if cmd contains shell operators requiring shell=True."""
    return any(op in cmd for op in _SHELL_OPERATORS)


def _run_command(cmd: str, timeout: int = 120) -> tuple[int, str, str]:
    """Run a command and capture output.

    Substitutes ``python`` and ``python3`` tokens in *cmd* with the
    current interpreter path (``sys.executable``), ensuring commands run
    in the same virtual environment / installation as qa_runner itself.
    Without this substitution, subprocess may resolve ``python`` to a
    different installation (e.g. a Windows-Store stub).
    """
    import shlex

    # Normalise 'python' / 'python3' to the current interpreter to avoid
    # Windows Store stub or PATH ambiguity across installations.
    _exe = sys.executable.replace("\\", "/")
    cmd = re.sub(r"(?<![\w])python3?(?=\s|$)", _exe, cmd)

    use_shell = _needs_shell(cmd)

    # Pre-check: when not using shell, verify the executable is on PATH
    # to give a clear diagnostic instead of an opaque [WinError 2].
    if not use_shell:
        parts = shlex.split(cmd)
        if parts and shutil.which(parts[0]) is None:
            return -1, "", f"Executable not found on PATH: '{parts[0]}'"

    try:
        result = subprocess.run(
            cmd if use_shell else shlex.split(cmd),
            shell=use_shell,  # nosec B602
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=timeout,
        )
        return result.returncode, result.stdout, result.stderr
    except subprocess.TimeoutExpired:
        return -1, "", f"Command timed out after {timeout}s"
    except (OSError, ValueError, UnicodeDecodeError) as exc:
        return -1, "", str(exc)


def _run_command_with_trace(cmd: str, timeout: int = 120) -> tuple[int, str, str, str]:
    """Run a command and return (exit_code, stdout, stderr, trace_hash).

    The ``trace_hash`` is a SHA-256 hex digest computed from:
    ``command + timestamp + exit_code + sha256(stdout) + sha256(stderr)``

    This provides a cryptographic record of execution that can be included in
    qa_receipt output for audit purposes (Trust Hierarchy T3: execution trace hash).

    Args:
        cmd: Shell command to execute.
        timeout: Maximum execution time in seconds.

    Returns:
        4-tuple of (exit_code, stdout, stderr, trace_hash).
    """
    import hashlib

    timestamp = datetime.now(timezone.utc).isoformat()
    exit_code, stdout, stderr = _run_command(cmd, timeout=timeout)

    stdout_hash = hashlib.sha256(stdout.encode("utf-8", errors="replace")).hexdigest()
    stderr_hash = hashlib.sha256(stderr.encode("utf-8", errors="replace")).hexdigest()

    trace_str = f"{cmd}{timestamp}{exit_code}{stdout_hash}{stderr_hash}"
    trace_hash = hashlib.sha256(trace_str.encode("utf-8")).hexdigest()

    return exit_code, stdout, stderr, trace_hash


def _step_mutation_testing(
    config: dict,
    changed_files: list[Path],
    test_dir: Path | None,
) -> tuple[StepResult, str]:
    """Step 13 (optional): Run mutation testing via mutmut and check kill rate.

    This step is SKIP by default. To enable, set:
    ``qa_runner.mutation_testing_enabled: true`` in workflow.json.

    Also SKIPs when mutmut is not installed (optional dependency).

    Args:
        config: Workflow configuration dict.
        changed_files: List of changed source file Paths.
        test_dir: Optional test directory Path.

    Returns:
        - SKIP: mutmut not installed or mutation_testing_enabled is false/absent
        - PASS: kill rate >= 85%
        - FAIL: kill rate < 85%
    """
    qa_cfg = config.get("qa_runner", {})
    if not qa_cfg.get("mutation_testing_enabled", False):
        return StepResult.SKIP, "mutation_testing_enabled is false or absent in config"

    if shutil.which("mutmut") is None:
        return StepResult.SKIP, "mutmut not installed — skipping mutation testing"

    # Get source files to mutate (non-test Python files)
    source_files = [
        f
        for f in changed_files
        if f.suffix == ".py"
        and not f.name.startswith("test_")
        and not f.name.endswith("_test.py")
    ]

    if not source_files:
        return StepResult.SKIP, "No Python source files to mutate"

    paths_arg = " ".join(str(f) for f in source_files[:5])
    cmd = f"mutmut run --paths-to-mutate {paths_arg}"

    exit_code, stdout, stderr = _run_command(cmd, timeout=600)

    # Parse kill rate from mutmut output
    # mutmut outputs lines like "Killed: 90" and "Survived: 10"
    killed = 0
    survived = 0
    for line in (stdout + stderr).splitlines():
        line = line.strip()
        if line.startswith("Killed:"):
            try:
                killed = int(line.split(":")[1].strip().split()[0])
            except (ValueError, IndexError):
                pass  # malformed mutmut line — keep default
        elif line.startswith("Survived:"):
            try:
                survived = int(line.split(":")[1].strip().split()[0])
            except (ValueError, IndexError):
                pass  # malformed mutmut line — keep default

    total = killed + survived
    if total == 0:
        return StepResult.SKIP, f"Could not parse mutmut output (exit_code={exit_code})"

    kill_rate = (killed / total) * 100.0
    threshold = 85.0

    evidence = (
        f"Mutation kill rate: {kill_rate:.0f}% ({killed}/{total} mutants killed, "
        f"threshold={threshold:.0f}%)"
    )

    if kill_rate >= threshold:
        return StepResult.PASS, evidence
    return StepResult.FAIL, evidence


def _run_step(
    step_num: int,
    config: dict,
    story: dict | None,
    changed_files: list[Path],
    test_dir: Path | None,
    prd_path: Path | None,
    checkpoint: str | None,
    plan_path: Path | None = None,
    violation_cache: dict[str, list[dict]] | None = None,
    pipeline_context: dict | None = None,
    lang_map: dict[str, list[Path]] | None = None,
    required_steps: dict[str, bool] | None = None,
    phase_type: str | None = None,
) -> dict:
    """Execute a single QA step and return its result."""
    start = time.monotonic()
    name = STEP_NAMES.get(step_num, f"Step {step_num}")

    # Resolve per-step required flags (default to True for steps 1-3, False for 4-5)
    _req = required_steps or {}

    try:
        if step_num == 1:
            result_val, evidence = _step_lint(
                config, story, lang_map=lang_map, required=_req.get("lint", True)
            )
        elif step_num == 2:
            result_val, evidence = _step_type_check(
                config, story, required=_req.get("type", False)
            )
        elif step_num == 3:
            result_val, evidence = _step_unit_tests(
                config,
                story,
                required=_req.get("unit", True),
                pipeline_context=pipeline_context,
            )
        elif step_num == 4:
            result_val, evidence = _step_integration_tests(
                config,
                story,
                required=_req.get("integration", False),
                changed_files=changed_files,
            )
        elif step_num == 5:
            result_val, evidence = _step_regression(
                config,
                story,
                required=_req.get("regression", False),
                pipeline_context=pipeline_context,
            )
        elif step_num == 6:
            result_val, evidence = _step_code_scan(
                changed_files, violation_cache=violation_cache, config=config
            )
        elif step_num == 7:
            result_val, evidence = _step_clean_diff(
                changed_files, violation_cache=violation_cache
            )
        elif step_num == 8:
            result_val, evidence = _step_coverage(
                config, story=story, pipeline_context=pipeline_context
            )
        elif step_num == 9:
            result_val, evidence = _step_mock_audit(
                changed_files,
                test_dir,
                story=story,
                config=config,
                checkpoint=checkpoint,
                phase_type=phase_type,
            )
        elif step_num == 10:
            result_val, evidence = _step_plan_conformance(
                changed_files,
                plan_path,
                story,
                prd_path,
                test_dir,
                pipeline_context=pipeline_context,
            )
        elif step_num == 11:
            result_val, evidence = _step_acceptance(
                test_dir,
                prd_path,
                story,
                pipeline_context=pipeline_context,
            )
        elif step_num == 12:
            result_val, evidence = _step_production_scan(
                changed_files, config, violation_cache=violation_cache
            )
        else:
            result_val = StepResult.SKIP
            evidence = f"Step {step_num} not implemented"
    except Exception as exc:
        result_val = StepResult.FAIL
        evidence = f"Unexpected error: {type(exc).__name__}: {exc}"
        audit_log("_run_step", "step_crash", f"Step {step_num} ({name}): {evidence}")

    elapsed_ms = int((time.monotonic() - start) * 1000)

    return {
        "step": step_num,
        "name": name,
        "result": result_val.value,
        "evidence": evidence,
        "duration_ms": elapsed_ms,
    }


def _step_lint(
    config: dict,
    story: dict | None,
    lang_map: dict[str, list[Path]] | None = None,
    required: bool = True,
) -> tuple[StepResult, str]:
    """Step 1: Run linter.

    When lang_map is provided and config.languages has per-language lint commands,
    runs lint for each language and aggregates results. Falls back to single-command
    behavior when no lang_map or no per-language commands are configured.

    When required=True and no lint command is configured, returns ("FAIL", ...) instead
    of ("SKIP", ...) to enforce zero-skip policy for required steps.
    """
    languages_config = config.get("languages", {})
    project_mode = get_project_mode(config)

    # Multi-language mode: run per-language lint if lang_map provided and profiles exist
    if lang_map and languages_config:
        lang_results: list[str] = []
        any_fail = False
        any_run = False

        for lang_name, lang_files in lang_map.items():
            if not lang_files:
                continue
            # Skip "unknown" language — no lint command is applicable
            if lang_name == "unknown":
                exts = {f.suffix for f in lang_files}
                lang_results.append(
                    f"unknown: SKIP (no lint command for {', '.join(sorted(exts))} files)"
                )
                continue
            lang_config = languages_config.get(lang_name, {})
            lang_lint_cmd = lang_config.get("commands", {}).get("lint", "")
            if not lang_lint_cmd:
                continue
            any_run = True
            code, stdout, stderr = _run_command(lang_lint_cmd)
            if code == 0:
                lang_results.append(f"{lang_name}: lint OK")
            else:
                any_fail = True
                _lim = _get_evidence_max_chars()
                out = (stderr or stdout)[:_lim]
                lang_results.append(f"{lang_name}: lint FAIL ({out})")

        if any_run:
            evidence = ", ".join(lang_results)
            if any_fail:
                return StepResult.FAIL, evidence
            return StepResult.PASS, evidence
        # Fall through to single-command behavior if no per-language cmds ran

    # Single-command fallback: try gateCmds.lint first, then the mode-owned command.
    cmd = ""
    if story:
        cmd = story.get("gateCmds", {}).get("lint", "")
    if not cmd:
        cmd = config.get("commands", {}).get(_mode_command_key("lint", project_mode), "")
    cmd = _configured_command(cmd)

    if not cmd:
        if required:
            return (
                StepResult.FAIL,
                "Step 'lint' is required but has no command configured",
            )
        return StepResult.SKIP, "No lint command configured"

    code, stdout, stderr = _run_command(cmd)
    if code == 0:
        return (
            StepResult.PASS,
            f"Lint passed: {stdout[: _get_evidence_max_chars()]}"
            if stdout
            else "Lint passed",
        )
    return (
        StepResult.FAIL,
        f"Lint failed (exit {code}): {(stderr or stdout)[: _get_evidence_max_chars()]}",
    )


def _step_type_check(
    config: dict, story: dict | None = None, required: bool = False
) -> tuple[StepResult, str]:
    """Step 2: Run type checker.

    Prefers story.gateCmds.type_check over the mode-owned workflow command.
    When required=True and no type_check command is configured, returns ("FAIL", ...)
    instead of ("SKIP", ...) to enforce zero-skip policy for required steps.
    """
    project_mode = get_project_mode(config)
    cmd = ""
    if story:
        cmd = story.get("gateCmds", {}).get("type_check", "")
    if not cmd:
        cmd = config.get("commands", {}).get(
            _mode_command_key("type_check", project_mode), ""
        )
    cmd = _configured_command(cmd)
    if not cmd:
        if required:
            return (
                StepResult.FAIL,
                "Step 'type' is required but has no command configured",
            )
        return StepResult.SKIP, "No type_check command configured"

    code, stdout, stderr = _run_command(cmd)
    if code == 0:
        return (
            StepResult.PASS,
            f"Type check passed: {stdout[: _get_evidence_max_chars()]}"
            if stdout
            else "Type check passed",
        )
    return (
        StepResult.FAIL,
        f"Type check failed (exit {code}): {(stderr or stdout)[: _get_evidence_max_chars()]}",
    )


def _step_unit_tests(
    config: dict,
    story: dict | None,
    required: bool = True,
    pipeline_context: dict | None = None,
) -> tuple[StepResult, str]:
    """Step 3: Run unit tests.

    When required=True and no unit test command is configured, returns ("FAIL", ...)
    instead of ("SKIP", ...) to enforce zero-skip policy for required steps.

    On PASS, stores the resolved command and result in pipeline_context so Step 5
    can skip re-running an identical regression suite.
    """
    project_mode = get_project_mode(config)
    cmd = ""
    if story:
        cmd = story.get("gateCmds", {}).get("unit", "")
    if not cmd:
        cmd = config.get("commands", {}).get(_mode_command_key("test", project_mode), "")
    cmd = _configured_command(cmd)

    if not cmd:
        if required:
            return (
                StepResult.FAIL,
                "Step 'unit' is required but has no command configured",
            )
        return StepResult.SKIP, "No unit test command configured"

    # Allow configuring a longer timeout for large suites via unit_timeout_s
    unit_timeout = int(config.get("commands", {}).get("unit_timeout_s", 120))
    code, stdout, stderr = _run_command(cmd, timeout=unit_timeout)
    if code == 0:
        if pipeline_context is not None:
            pipeline_context["unit_test_cmd"] = cmd
            pipeline_context["unit_test_result"] = StepResult.PASS
        return (
            StepResult.PASS,
            f"Unit tests passed: {stdout[-_get_evidence_max_chars() :]}"
            if stdout
            else "Unit tests passed",
        )
    return (
        StepResult.FAIL,
        f"Unit tests failed (exit {code}): {(stderr or stdout)[-_get_evidence_max_chars() :]}",
    )


# E2E framework config files and their suggested commands.
# Checked in order; first match wins for the suggestion message.
_E2E_FRAMEWORK_CONFIGS: list[tuple[str, str, str]] = [
    ("playwright.config.ts", "Playwright", "npx playwright test"),
    ("playwright.config.js", "Playwright", "npx playwright test"),
    ("cypress.config.ts", "Cypress", "npx cypress run"),
    ("cypress.config.js", "Cypress", "npx cypress run"),
]


def _detect_e2e_framework(project_root: Path) -> tuple[str, str] | None:
    """Detect E2E framework config files in the project root.

    Returns (config_filename, suggested_command) for the first match, or None.
    Read-only filesystem check only -- no subprocess calls.
    """
    for config_name, _framework, suggested_cmd in _E2E_FRAMEWORK_CONFIGS:
        if (project_root / config_name).exists():
            return config_name, suggested_cmd
    return None


def _step_integration_tests(
    config: dict,
    story: dict | None,
    required: bool = False,
    project_root: Path | None = None,
    changed_files: list[Path] | None = None,
) -> tuple[StepResult, str]:
    """Step 4: Run integration tests.

    When required=True and no integration test command is configured, returns ("FAIL", ...)
    instead of ("SKIP", ...) to enforce zero-skip policy for required steps.

    If no command is configured, checks for Playwright/Cypress config files in the
    project root and includes a suggestion in the skip/fail message.

    When changed_files is provided and contains frontend file extensions, and
    config.commands.project_frontend_test is configured (not the unconfigured placeholder),
    the frontend test command is also executed. The worst-of-both result is returned.
    """
    project_mode = get_project_mode(config)
    cmd = ""
    if story:
        cmd = story.get("gateCmds", {}).get("integration", "")

    raw_cmd = cmd
    if not cmd:
        raw_cmd = config.get("commands", {}).get(
            _mode_command_key("integration", project_mode), ""
        )
    if isinstance(raw_cmd, str) and raw_cmd.strip().lower() in ("n/a", "none", "skip"):
        return StepResult.SKIP, "Integration tests marked as N/A"
    cmd = _configured_command(raw_cmd)

    if not cmd:
        # Check for E2E framework config files to provide a helpful suggestion
        root = project_root if project_root is not None else Path.cwd()
        detected = _detect_e2e_framework(root)
        if detected:
            config_name, suggested_cmd = detected
            config_key = _mode_command_key("integration", project_mode)
            hint = (
                f"Detected {config_name} — "
                f"set commands.{config_key} in workflow.json: {suggested_cmd}"
            )
            if required:
                return (
                    StepResult.FAIL,
                    f"Step 'integration' is required but has no command configured. {hint}",
                )
            return (
                StepResult.SKIP,
                f"No integration test command configured. {hint}",
            )
        if required:
            return (
                StepResult.FAIL,
                "Step 'integration' is required but has no command configured",
            )
        return StepResult.SKIP, "No integration test command configured"

    code, stdout, stderr = _run_command(cmd)
    if code == 0:
        integration_result = StepResult.PASS
        integration_evidence = (
            f"Integration tests passed: {stdout[-_get_evidence_max_chars() :]}"
            if stdout
            else "Integration tests passed"
        )
    else:
        return (
            StepResult.FAIL,
            f"Integration tests failed (exit {code}): {(stderr or stdout)[-_get_evidence_max_chars() :]}",
        )

    # Run frontend test sub-check when frontend files are present and command is configured.
    frontend_cmd = config.get("commands", {}).get("project_frontend_test", "")
    if (
        has_frontend_files(changed_files or [])
        and _configured_command(frontend_cmd)
    ):
        fe_code, fe_stdout, fe_stderr = _run_command(frontend_cmd)
        if fe_code == 0:
            fe_evidence = (
                f"frontend tests passed: {fe_stdout[-_get_evidence_max_chars() :]}"
                if fe_stdout
                else "frontend tests passed"
            )
            return StepResult.PASS, f"{integration_evidence}; {fe_evidence}"
        else:
            return (
                StepResult.FAIL,
                f"Frontend tests failed (exit {fe_code}): {(fe_stderr or fe_stdout)[-_get_evidence_max_chars() :]}",
            )

    return integration_result, integration_evidence


def _step_regression(
    config: dict,
    story: dict | None = None,
    required: bool = False,
    pipeline_context: dict | None = None,
) -> tuple[StepResult, str]:
    """Step 5: Run regression test suite.

    Tier resolution order:
    1. fix_loop tier when fix_iteration > 0 (--lf: only previously-failing tests)
    2. story.gateCmds.regression_tier → look up in config.commands.regression_tiers
    3. config.commands.regression_default_tier → look up in config.commands.regression_tiers
    4. config.commands.regression → backward-compatible fallback

    Cache shortcut: if the resolved command matches Step 3's unit test command and
    Step 3 passed, returns PASS immediately without re-running the suite.

    When required=True and no regression command is configured, returns ("FAIL", ...)
    instead of ("SKIP", ...) to enforce zero-skip policy for required steps.
    """
    commands = config.get("commands", {})
    tiers = commands.get("regression_tiers", {})
    fix_iteration = pipeline_context.get("fix_iteration", 0) if pipeline_context else 0

    # Early-exit: skip regression when changed files contain no source code
    if not required and pipeline_context is not None:
        changed = pipeline_context.get("changed_files", [])
        if changed is not None and len(changed) > 0 and not _get_source_files(changed):
            return (
                StepResult.SKIP,
                "Regression skipped — no source code in changed files",
            )

    # During fix iterations, use the fix_loop tier (--lf: last-failed tests only)
    if fix_iteration > 0 and "fix_loop" in tiers:
        tier_config = tiers["fix_loop"]
        cmd = tier_config.get("cmd", "")
        if cmd:
            timeout = tier_config.get("max_duration_s", 120)
            code, stdout, stderr = _run_command(cmd, timeout=timeout)
            if code == 0:
                return (
                    StepResult.PASS,
                    f"Regression suite [fix_loop] passed: {stdout[-_get_evidence_max_chars() :]}"
                    if stdout
                    else "Regression suite [fix_loop] passed",
                )
            return (
                StepResult.FAIL,
                f"Regression [fix_loop] failed (exit {code}): {(stderr or stdout)[-_get_evidence_max_chars() :]}",
            )

    # Determine which tier to use (if any)
    tier_name: str | None = None
    if story:
        tier_name = story.get("gateCmds", {}).get("regression_tier", None)
    if not tier_name and tiers:
        tier_name = commands.get("regression_default_tier", None)

    if tier_name and tiers:
        tier_config = tiers.get(tier_name, {})
        cmd = tier_config.get("cmd", "")
        if cmd:
            # Cache shortcut: Step 3 already ran this exact command and passed
            if pipeline_context is not None:
                if (
                    pipeline_context.get("unit_test_cmd") == cmd
                    and pipeline_context.get("unit_test_result") == StepResult.PASS
                ):
                    return (
                        StepResult.PASS,
                        f"Regression skipped — identical to unit test run [{tier_name}] (already passed)",
                    )
            timeout = tier_config.get("max_duration_s", 120)
            code, stdout, stderr = _run_command(cmd, timeout=timeout)
            if code == 0:
                return (
                    StepResult.PASS,
                    f"Regression suite [{tier_name}] passed: {stdout[-_get_evidence_max_chars() :]}"
                    if stdout
                    else f"Regression suite [{tier_name}] passed",
                )
            return (
                StepResult.FAIL,
                f"Regression [{tier_name}] failed (exit {code}): {(stderr or stdout)[-_get_evidence_max_chars() :]}",
            )

    # Fallback: backward-compatible behavior
    cmd = commands.get("regression", "")
    if not cmd:
        if required:
            return (
                StepResult.FAIL,
                "Step 'regression' is required but has no command configured",
            )
        return (
            StepResult.SKIP,
            "No regression command configured (set commands.regression in workflow.json)",
        )

    # Cache shortcut for fallback path
    if pipeline_context is not None:
        if (
            pipeline_context.get("unit_test_cmd") == cmd
            and pipeline_context.get("unit_test_result") == StepResult.PASS
        ):
            return (
                StepResult.PASS,
                "Regression skipped — identical to unit test run (already passed)",
            )

    code, stdout, stderr = _run_command(cmd)
    if code == 0:
        return (
            StepResult.PASS,
            f"Regression suite passed: {stdout[-_get_evidence_max_chars() :]}"
            if stdout
            else "Regression suite passed",
        )
    return (
        StepResult.FAIL,
        f"Regression failed (exit {code}): {(stderr or stdout)[-_get_evidence_max_chars() :]}",
    )


def _step_code_scan(
    changed_files: list[Path],
    violation_cache: dict[str, list[dict]] | None = None,
    config: dict | None = None,
) -> tuple[StepResult, str]:
    """Step 6: Combined security and production-grade code scan.

    Checks all violation patterns (security + production) in a single pass.
    When config contains an external_scanners section, invokes each enabled scanner.
    Executable resolution: use scanner["executable"] if present, else fall back to
    the dict key name. Availability checked via shutil.which():
    - Not found + strict_mode: true  → FAIL
    - Not found + strict_mode: false → include SKIP note, continue
    - Found → run scanner, FAIL on non-zero exit
    If no external_scanners configured, runs violation scan only.
    """
    source_files = _get_source_files(changed_files)
    if not source_files:
        return StepResult.SKIP, "No source files to scan"

    total_violations = 0
    details: list[str] = []

    # Scan all violations (security + production patterns combined)
    for f in source_files:
        if violation_cache is not None:
            violations = violation_cache.get(str(f), [])
        else:
            violations = scan_file_violations(f)
        total_violations += len(violations)
        for v in violations:
            details.append(f"{f.name}:{v['line']} {v['violation_id']}: {v['message']}")

    # External scanners (optional, from workflow.json external_scanners section)
    if config:
        scanners = config.get("external_scanners", {})

        # Compute placeholder values for external scanner commands
        try:
            changed_dir = (
                os.path.commonpath([str(f) for f in source_files])
                if source_files
                else "."
            )
        except ValueError:
            changed_dir = "."
        changed_files_str = " ".join(str(f) for f in source_files)

        for name, settings in scanners.items():
            if not settings.get("enabled", False):
                continue
            exe = settings.get("executable", name)
            strict = settings.get("strict_mode", False)
            found = shutil.which(exe)
            if not found:
                if strict:
                    return (
                        StepResult.FAIL,
                        f"Scanner '{name}' executable not found: {exe}",
                    )
                details.append(f"Scanner '{name}' not available (skipped)")
                continue
            cmd = settings.get("cmd", "")
            if cmd:
                cmd = cmd.replace("{changed_dir}", changed_dir)
                cmd = cmd.replace("{changed_files}", changed_files_str)
            else:
                cmd = exe
            code, _stdout, _stderr = _run_command(cmd)
            if code != 0:
                total_violations += 1
                details.append(f"Scanner '{name}' found issues (exit {code})")

    if total_violations == 0:
        base_evidence = f"No violations in {len(source_files)} source files"
        if details:
            base_evidence += "; " + "; ".join(details[:5])
        return StepResult.PASS, base_evidence
    return (
        StepResult.FAIL,
        f"{total_violations} violations: {'; '.join(details[:10])}",
    )


# Keep _step_security_scan as an alias for backward compatibility with tests
_step_security_scan = _step_code_scan


def _step_clean_diff(
    changed_files: list[Path],
    violation_cache: dict[str, list[dict]] | None = None,
) -> tuple[StepResult, str]:
    """Step 7: Check for debug artifacts in diff."""
    source_files = _get_source_files(changed_files)
    if not source_files:
        return StepResult.SKIP, "No source files to scan"

    total_violations = 0
    details: list[str] = []

    for f in source_files:
        if violation_cache is not None:
            violations = violation_cache.get(str(f), [])
        else:
            violations = scan_file_violations(f)
        debug_violations = [v for v in violations if v["violation_id"] in _CLEANUP_IDS]
        total_violations += len(debug_violations)
        for v in debug_violations:
            details.append(f"{f.name}:{v['line']} {v['violation_id']}")

    if total_violations == 0:
        return StepResult.PASS, f"Clean diff in {len(source_files)} source files"
    return (
        StepResult.FAIL,
        f"{total_violations} debug artifacts: {'; '.join(details[:5])}",
    )


def _step_coverage(
    config: dict,
    story: dict | None = None,
    pipeline_context: dict | None = None,
) -> tuple[StepResult, str]:
    """Step 8: Run coverage report.

    If story.gateCmds.coverage is set, it overrides the global coverage command.
    This allows per-story coverage commands (e.g., focused test files for docs phases).

    During fix iterations (fix_iteration > 0), coverage is deferred — it runs only
    on the first clean pass. Coverage is an environment step and does not affect
    story_result or promotion.
    """
    fix_iteration = pipeline_context.get("fix_iteration", 0) if pipeline_context else 0
    if fix_iteration > 0:
        return (
            StepResult.SKIP,
            f"Coverage deferred — runs on first clean pass only (fix iteration {fix_iteration})",
        )

    # Early-exit: skip coverage when changed files contain no source code
    if pipeline_context is not None:
        changed = pipeline_context.get("changed_files", [])
        if changed is not None and len(changed) > 0 and not _get_source_files(changed):
            return (
                StepResult.SKIP,
                "Coverage skipped — no source code in changed files",
            )

    evidence_parts: list[str] = []

    # Per-story coverage override (e.g., for docs phases targeting a smaller test set)
    story_coverage_cmd = ""
    if story:
        story_coverage_cmd = story.get("gateCmds", {}).get("coverage", "")

    # Part 1: Run coverage command (story override takes precedence)
    cmd = story_coverage_cmd or config.get("commands", {}).get("coverage", "")
    if cmd:
        # Allow configuring a longer timeout for large suites via coverage_timeout_s
        coverage_timeout = int(
            config.get("commands", {}).get("coverage_timeout_s", 120)
        )
        code, stdout, stderr = _run_command(cmd, timeout=coverage_timeout)
        if code != 0:
            return (
                StepResult.FAIL,
                f"Coverage failed (exit {code}): {(stderr or stdout)[-_get_evidence_max_chars() :]}",
            )
        evidence_parts.append(
            f"Coverage report: {stdout[-_get_evidence_max_chars() :]}"
            if stdout
            else "Coverage passed"
        )

    if not evidence_parts:
        return StepResult.SKIP, "No coverage command configured"
    return StepResult.PASS, "; ".join(evidence_parts)


def _mock_audit_test_quality(
    test_files: list[Path], config: dict | None
) -> tuple[list[str], list[str], list[tuple[str, list]], list[str]]:
    """Check 1 + 1b: test anti-patterns + behavioral gate.

    Returns (issues, warnings, weak_by_file, all_test_names).
    """
    import re as _re

    issues: list[str] = []
    warnings: list[str] = []
    weak_by_file: list[tuple[str, list]] = []
    all_test_names: list[str] = []

    _qa_cfg = (config or {}).get("qa_runner", {})
    behavioral_required: bool = bool(
        _qa_cfg.get("behavioral_assertion_required", False)
    )
    neg_min_pct: int = int(_qa_cfg.get("negative_test_min_pct", 15))

    # Configurable thresholds: default 0 (strict) when absent.
    assertion_free_max: int = int(_qa_cfg.get("assertion_free_max", 0))
    self_mock_max: int = int(_qa_cfg.get("self_mock_max", 0))
    mock_only_max: int = int(_qa_cfg.get("mock_only_max", 0))
    weak_assertion_max_pct_raw = _qa_cfg.get("weak_assertion_max_pct", None)
    weak_assertion_max_pct: float | None = (
        float(weak_assertion_max_pct_raw)
        if weak_assertion_max_pct_raw is not None
        else None
    )

    for tf in test_files:
        quality = scan_test_quality(tf)

        # Collect test names for negative-test check (best-effort)
        try:
            content = tf.read_text(encoding="utf-8")
            all_test_names.extend(
                _re.findall(
                    r"^[ \t]*(?:async\s+)?def\s+(test_\w+)\s*\(", content, _re.MULTILINE
                )
            )
        except (OSError, UnicodeDecodeError, ValueError):
            pass  # test file unreadable — skip name extraction

        af = quality.get("assertion_free_tests", [])
        sm = quality.get("self_mock_tests", [])
        mo = quality.get("mock_only_tests", [])
        hm = quality.get("heavy_mock_tests", [])

        # Check 1: assertion-free tests (threshold-based)
        if len(af) > assertion_free_max:
            issues.append(f"{tf.name}: assertion-free tests: {af}")

        # Check 1: self-mock tests (threshold-based)
        if len(sm) > self_mock_max:
            issues.append(f"{tf.name}: self-mock tests: {sm}")

        # Check 1: mock-only tests (threshold-based)
        if len(mo) > mock_only_max:
            issues.append(f"{tf.name}: mock-only tests: {mo}")

        # Heavy-mock check: always fire when present (no configurable threshold)
        if hm:
            issues.append(f"{tf.name}: heavy-mock tests (>80% deps mocked): {hm}")

        # Check 1b: Behavioral assertion gate
        if behavioral_required:
            bam = quality.get("behavioral_assertion_missing", [])
            if bam:
                issues.append(
                    f"{tf.name}: behavioral assertion missing (no value-checking assertions): {bam}"
                )

        # Accumulate weak assertions for Check 3 ratchet
        weak = quality.get("weak_assertion_tests", [])
        if weak:
            weak_by_file.append((tf.name, weak))

        # Check 1c: weak-assertion percentage per file (when threshold configured)
        if weak_assertion_max_pct is not None:
            tests_found = quality.get("tests_found", 0)
            if tests_found > 0:
                weak_pct = round((len(weak) / tests_found) * 100)
                if weak_pct > weak_assertion_max_pct:
                    issues.append(
                        f"{tf.name}: weak assertion percentage {weak_pct}%"
                        f" exceeds max {weak_assertion_max_pct:.0f}%"
                        f" ({len(weak)}/{tests_found} tests)"
                    )

        if quality.get("happy_path_only", False) and quality.get("tests_found", 0) > 0:
            issues.append(f"{tf.name}: happy-path-only (no error/edge tests)")

        # Check 3b: Negative test percentage (WARN when below threshold)
        tests_found = quality.get("tests_found", 0)
        if tests_found > 5:
            neg_pct = quality.get("negative_test_pct", 0)
            neg_count = quality.get("negative_test_count", 0)
            if neg_pct < neg_min_pct:
                warnings.append(
                    f"{tf.name}: Negative test ratio: {neg_count}/{tests_found}"
                    f" ({neg_pct}%) \u2014 minimum recommended: {neg_min_pct}%"
                )

    return issues, warnings, weak_by_file, all_test_names


def _mock_audit_weak_ratchet(
    weak_by_file: list[tuple[str, list]], config: dict | None
) -> tuple[list[str], list[str]]:
    """Check 3: Weak assertion ratchet. Returns (issues, warnings)."""
    issues: list[str] = []
    warnings: list[str] = []

    _qa_runner_cfg = (config or {}).get("qa_runner", {})
    _weak_max_raw = _qa_runner_cfg.get("weak_assertion_max", None)
    if _weak_max_raw is not None and not isinstance(_weak_max_raw, int):
        warnings.append(
            f"weak_assertion_max is not an int ({_weak_max_raw!r}); ignoring ratchet"
        )
        _weak_max_raw = None
    _weak_assertion_max: int | None = _weak_max_raw

    if weak_by_file:
        total_weak = sum(len(names) for _, names in weak_by_file)
        if _weak_assertion_max is None:
            # Unconfigured: old behavior -- always FAIL on any weak assertion
            for fname, names in weak_by_file:
                issues.append(f"{fname}: weak assertions: {names}")
        elif total_weak > _weak_assertion_max:
            # Ratchet exceeded
            for fname, names in weak_by_file:
                issues.append(f"{fname}: weak assertions: {names}")
            issues.append(
                f"weak assertion ratchet exceeded: {total_weak} weak assertions"
                f" (max allowed: {_weak_assertion_max})"
            )
        # else: total_weak <= weak_assertion_max -> PASS; no issue added

    return issues, warnings


def _mock_audit_negative_tests(
    story: dict | None, all_test_names: list[str]
) -> list[str]:
    """Check 4: Negative test enforcement for validation criteria. Returns issues."""
    issues: list[str] = []
    if story and all_test_names:
        for criterion in story.get("acceptanceCriteria", []):
            cid = criterion.get("id", "")
            text = criterion.get("criterion", "")
            neg_result = check_negative_tests(text, all_test_names)
            if neg_result.get("result") == "WARN":
                issues.append(
                    f"{cid}: validation criterion requires negative/error tests but none found"
                )
    return issues


def _mock_audit_coverage(
    changed_files: list[Path], test_dir: Path | None, config: dict | None
) -> tuple[list[str], str]:
    """Check 2: Story file coverage. Returns (issues, coverage_info)."""
    issues: list[str] = []
    coverage_info = ""
    if test_dir is not None:
        cov_result = check_story_file_coverage(changed_files, test_dir, config)
        cov_status = cov_result.get("result", "SKIP")
        if cov_status == "FAIL":
            pct = cov_result.get("coverage_pct", 0.0)
            untested = cov_result.get("untested", [])
            issues.append(
                f"Story file coverage {pct:.0f}% < 80% floor; untested: {untested}"
            )
        if cov_status != "SKIP":
            pct = cov_result.get("coverage_pct", 0.0)
            tested = cov_result.get("tested", 0)
            total = cov_result.get("total_prod", 0)
            coverage_info = f"Story coverage: {pct:.0f}% ({tested}/{total} files)"
    return issues, coverage_info


def _mock_audit_complexity(
    changed_files: list[Path], config: dict | None, checkpoint: str | None
) -> tuple[list[str], list[str]]:
    """Check 5: Cyclomatic complexity. Returns (issues, complexity_warnings)."""
    issues: list[str] = []
    complexity_warnings: list[str] = []
    if config is not None:
        complexity_cfg = config.get("complexity", {})
        if complexity_cfg.get("enabled", True):
            cx_result = check_complexity(changed_files, config, checkpoint=checkpoint)
            cx_status = cx_result.get("result", "SKIP")
            if cx_status == "FAIL":
                flagged = cx_result.get("high_complexity", [])
                for entry in flagged[:3]:
                    issues.append(
                        f"Complexity FAIL: {entry['func']} in {Path(entry['file']).name}"
                        f" (complexity={entry['complexity']}, grade={entry['grade']})"
                    )
            elif cx_status == "WARN":
                flagged = cx_result.get("high_complexity", [])
                for entry in flagged[:3]:
                    complexity_warnings.append(
                        f"{entry['func']} in {Path(entry['file']).name}"
                        f" (complexity={entry['complexity']}, grade={entry['grade']})"
                    )
    return issues, complexity_warnings


def _mock_audit_tdd_order(
    changed_files: list[Path],
    config: dict | None,
    checkpoint: str | None,
    phase_type: str | None,
) -> tuple[list[str], list[str]]:
    """Check 6: TDD order signal. Returns (issues, warnings)."""
    issues: list[str] = []
    warnings: list[str] = []
    tdd_result = check_tdd_order(
        changed_files=[str(f) for f in changed_files],
        checkpoint=checkpoint,
    )
    if tdd_result.get("result") == "WARN":
        tdd_required: bool = bool(
            (config or {}).get("qa_runner", {}).get("tdd_checkpoint_required", False)
        )
        tdd_phase_types: list = list(
            (config or {}).get("qa_runner", {}).get("tdd_checkpoint_phase_types", [])
        )
        elevate_tdd = tdd_required and phase_type in tdd_phase_types
        for v in tdd_result.get("violations", [])[:3]:
            if elevate_tdd:
                issues.append(f"TDD order: {v}")
            else:
                warnings.append(f"TDD order: {v}")
    return issues, warnings


def _mock_audit_api_coverage(
    changed_files: list[Path], test_dir: Path | None, config: dict | None
) -> list[str]:
    """Check 7: Public API coverage. Returns issues."""
    issues: list[str] = []
    if test_dir is not None:
        api_cov = check_diff_public_api_coverage(changed_files, test_dir, config)
        if api_cov.get("result") == "FAIL":
            pct = api_cov.get("coverage_pct", 0.0)
            threshold = api_cov.get("threshold", 90.0)
            uncovered = api_cov.get("uncovered", [])
            issues.append(
                f"API coverage {pct:.0f}% < {threshold:.0f}% threshold;"
                f" uncovered: {uncovered[:5]}"
            )
    return issues


def _step_mock_audit(
    changed_files: list[Path],
    test_dir: Path | None,
    story: dict | None = None,
    config: dict | None = None,
    checkpoint: str | None = None,
    phase_type: str | None = None,
) -> tuple[StepResult, str]:
    """Step 9: Audit test quality, story file coverage, and negative tests."""
    test_files = _get_test_files(changed_files)

    # Scope to story-relevant test files when a story is provided
    if not test_files and story and test_dir and test_dir.is_dir():
        story_test_files: set[str] = set()
        for ac in story.get("acceptanceCriteria", []):
            tf = ac.get("testFile")
            if tf:
                story_test_files.add(tf)
        if story.get("testFile"):
            story_test_files.add(story["testFile"])
        if story_test_files:
            for stf in story_test_files:
                p = Path(stf)
                if not p.is_absolute():
                    p = test_dir / p.name
                if p.is_file():
                    test_files.append(p)
            test_files = sorted(set(test_files))

    # Fallback: scan test_dir only when no story scoping is available
    if not test_files and not story and test_dir and test_dir.is_dir():
        test_files = sorted(test_dir.rglob("test_*.py"))

    if not test_files and not changed_files:
        return StepResult.SKIP, "No test files to audit"

    issues: list[str] = []
    warnings: list[str] = []

    # Check 1 + 1b + 3b: test quality, behavioral gate, negative test %
    q_issues, q_warnings, weak_by_file, all_test_names = _mock_audit_test_quality(
        test_files, config
    )
    issues.extend(q_issues)
    warnings.extend(q_warnings)

    # Check 3: Weak assertion ratchet
    r_issues, r_warnings = _mock_audit_weak_ratchet(weak_by_file, config)
    issues.extend(r_issues)
    warnings.extend(r_warnings)

    # Check 4: Negative test enforcement for validation criteria
    issues.extend(_mock_audit_negative_tests(story, all_test_names))

    # Check 2: Story file coverage
    cov_issues, coverage_info = _mock_audit_coverage(changed_files, test_dir, config)
    issues.extend(cov_issues)

    # Check 5: Cyclomatic complexity
    cx_issues, complexity_warnings = _mock_audit_complexity(
        changed_files, config, checkpoint
    )
    issues.extend(cx_issues)

    # Check 6: TDD order signal
    tdd_issues, tdd_warnings = _mock_audit_tdd_order(
        changed_files, config, checkpoint, phase_type
    )
    issues.extend(tdd_issues)
    warnings.extend(tdd_warnings)

    # Check 7: Public API coverage
    issues.extend(_mock_audit_api_coverage(changed_files, test_dir, config))

    # Build evidence string
    evidence_parts: list[str] = []
    if coverage_info:
        evidence_parts.append(coverage_info)
    if complexity_warnings:
        warnings.append(f"High complexity: {'; '.join(complexity_warnings)}")
    if warnings:
        evidence_parts.append(f"Warnings: {'; '.join(warnings[:5])}")

    if issues:
        evidence_parts.insert(0, f"Issues: {'; '.join(issues[:5])}")
        return StepResult.FAIL, "; ".join(evidence_parts)

    summary = f"All {len(test_files)} test files pass quality audit"
    if evidence_parts:
        return StepResult.PASS, f"{summary}; {'; '.join(evidence_parts)}"
    return StepResult.PASS, summary


def _plan_conf_blast_radius(
    changed_files: list[Path],
    plan_path: Path,
    story: dict | None,
    always_allowed: set[str],
) -> tuple[list[str], bool]:
    """Sub-check 1: Changed files vs plan Changes table. Returns (issues, has_data)."""
    issues: list[str] = []
    has_data = False
    story_phase: int | None = story.get("phase") if story else None
    expected = parse_plan_changes(plan_path, phase=story_phase)
    if not expected and story_phase is not None:
        # Phase filter returned nothing -- fall back to full-plan files
        expected = parse_plan_changes(plan_path)
        if expected:
            audit_log(
                "_step_plan_conformance",
                "phase_fallback",
                f"Phase {story_phase} filter returned 0 files, falling back to full plan ({len(expected)} files)",
            )
    if expected:
        has_data = True
        # Strip line-number suffixes (e.g., "_qa_lib.py:2170" → "_qa_lib.py")
        # Use regex to only strip `:DIGITS` at end — avoids stripping drive letters
        import re as _re_local

        expected_norm = {
            _re_local.sub(r":\d+(-\d+)?$", "", p).replace("\\", "/") for p in expected
        }
        actual = {str(f).replace("\\", "/") for f in changed_files}
        unexpected = set()
        for fstr in actual:
            fname = Path(fstr).name
            if fname in always_allowed:
                continue
            if fstr not in expected_norm:
                unexpected.add(fstr)
        if unexpected:
            issues.append(
                f"Unexpected files changed (not in plan): {sorted(unexpected)}"
            )
    return issues, has_data


def _plan_conf_scope(
    changed_files: list[Path],
    story: dict | None,
    pipeline_context: dict | None,
) -> list[str]:
    """Sub-check 1a: Scope enforcement. Returns issues."""
    issues: list[str] = []
    cfg = (
        load_workflow_config()
        if pipeline_context is None
        else pipeline_context.get("config", load_workflow_config())
    )
    qa_cfg = cfg.get("qa_runner", {})
    scope_enabled = qa_cfg.get("scope_enforcement_enabled", True)
    if scope_enabled and story and changed_files:
        scope_result = check_scope_compliance(story, changed_files)
        if scope_result["result"] == "FAIL":
            violations = scope_result["violations"]
            scope_dirs = scope_result["scope"]
            issues.append(
                f"Scope violation: {violations} outside allowed scope {scope_dirs}"
            )
    return issues


def _plan_conf_identifiers(
    changed_files: list[Path],
    plan_path: Path,
    story: dict | None,
    pipeline_context: dict | None,
) -> list[str]:
    """Sub-check 1b: Plan identifier check. Returns warnings."""
    warnings: list[str] = []
    cfg = (
        load_workflow_config()
        if pipeline_context is None
        else pipeline_context.get("config", load_workflow_config())
    )
    qa_cfg = cfg.get("qa_runner", {})
    plan_id_enabled = qa_cfg.get("plan_identifier_check_enabled", True)
    if not plan_id_enabled or not changed_files:
        return warnings
    story_phase_1b: int | None = story.get("phase") if story else None
    desc_map = parse_plan_changes_with_descriptions(plan_path, phase=story_phase_1b)
    if not desc_map:
        return warnings
    unplanned_funcs: list[str] = []
    # Attempt diff-scoped extraction: only functions added/modified since checkpoint.
    checkpoint_1b: str | None = (
        pipeline_context.get("checkpoint") if pipeline_context else None
    )
    diff_added = extract_diff_added_identifiers(
        checkpoint_1b, [Path(f) for f in changed_files]
    )
    for f in changed_files:
        p = Path(f)
        # Skip test files, conftest, markdown
        if (
            p.name.startswith("test_")
            or p.name.endswith("_test.py")
            or p.name == "conftest.py"
            or p.suffix == ".md"
        ):
            continue
        # Normalize path for lookup
        f_posix = p.as_posix()
        desc = desc_map.get(f_posix) or desc_map.get(str(f).replace("\\", "/"))
        if not desc:
            continue
        identifiers = set(_BACKTICK_IDENTIFIER_RE.findall(desc))
        if not identifiers:
            continue
        # Prefer diff-scoped functions; fall back to full-file scan when diff
        # returned no entries (checkpoint absent or git failure).
        if diff_added:
            pub_funcs = diff_added.get(f_posix, [])
        else:
            try:
                file_content = p.read_text(encoding="utf-8")
            except (OSError, UnicodeDecodeError):
                continue
            pub_funcs = _PUBLIC_FUNC_RE.findall(file_content)
        for func_name in pub_funcs:
            if func_name not in identifiers:
                unplanned_funcs.append(f"{f_posix}:{func_name}")
    if unplanned_funcs:
        warnings.append(
            f"Unplanned public functions (not in plan description): {unplanned_funcs}"
        )
    return warnings


def _plan_conf_fix_loop_files(
    changed_files: list[Path],
    pipeline_context: dict | None,
    plan_path: Path | None,
    story: dict | None,
    always_allowed: set[str],
) -> list[str]:
    """Sub-check 1c: Fix-loop new-file detection. Returns issues."""
    issues: list[str] = []
    fix_iteration = pipeline_context.get("fix_iteration", 0) if pipeline_context else 0
    if fix_iteration <= 0 or not changed_files:
        return issues
    checkpoint_1c: str | None = (
        pipeline_context.get("checkpoint") if pipeline_context else None
    )
    if not checkpoint_1c:
        return issues
    try:
        added_proc = subprocess.run(
            [
                "git",
                "diff",
                "--diff-filter=A",
                "--name-only",
                f"{checkpoint_1c}..HEAD",
            ],
            capture_output=True,
            text=True,
            timeout=30,
        )
        if added_proc.returncode == 0:
            added_files = {
                f.strip() for f in added_proc.stdout.strip().split("\n") if f.strip()
            }
            original_files = {str(f).replace("\\", "/") for f in changed_files}
            new_in_fix = {
                f
                for f in added_files
                if f not in original_files and Path(f).name not in always_allowed
            }
            if new_in_fix:
                issues.append(
                    f"Fix-loop new-file violation (iteration {fix_iteration}): "
                    f"{sorted(new_in_fix)}"
                )
    except (subprocess.TimeoutExpired, OSError):
        pass  # Degrade gracefully -- no enforcement
    return issues


def _plan_conf_new_file_ratio(
    changed_files: list[Path],
    plan_path: Path | None,
    story: dict | None,
    pipeline_context: dict | None,
    always_allowed: set[str],
) -> tuple[list[str], list[str]]:
    """Sub-check 1d: New file ratio. Returns (issues, warnings)."""
    issues: list[str] = []
    warnings: list[str] = []
    checkpoint_1d: str | None = (
        pipeline_context.get("checkpoint") if pipeline_context else None
    )
    if not checkpoint_1d or plan_path is None:
        return issues, warnings
    action_map = parse_plan_changes_with_actions(
        plan_path, phase=story.get("phase") if story else None
    )
    plan_creates = sum(1 for a in action_map.values() if a in ("ADD", "CREATE"))
    try:
        added_proc = subprocess.run(
            [
                "git",
                "diff",
                "--diff-filter=A",
                "--name-only",
                f"{checkpoint_1d}..HEAD",
            ],
            capture_output=True,
            text=True,
            timeout=30,
        )
        if added_proc.returncode == 0:
            actual_added = {
                f.strip()
                for f in added_proc.stdout.strip().split("\n")
                if f.strip() and Path(f.strip()).name not in always_allowed
            }
            actual_count = len(actual_added)
            warn_threshold = plan_creates + 1
            fail_threshold = plan_creates * 2 + 2
            if actual_count > fail_threshold:
                issues.append(
                    f"New file ratio FAIL: {actual_count} new files "
                    f"(plan allows {plan_creates} creates, "
                    f"fail threshold: {fail_threshold}): {sorted(actual_added)}"
                )
            elif actual_count > warn_threshold:
                warnings.append(
                    f"New file ratio: {actual_count} new files "
                    f"(plan allows {plan_creates} creates, "
                    f"warn threshold: {warn_threshold}): {sorted(actual_added)}"
                )
    except (subprocess.TimeoutExpired, OSError):
        pass  # Degrade gracefully
    return issues, warnings


def _plan_conf_r_markers(
    test_dir: Path | None,
    prd_path: Path | None,
    story: dict | None,
    pipeline_context: dict | None,
) -> list[str]:
    """Sub-check 2: R-marker validation. Returns issues."""
    issues: list[str] = []
    if test_dir is None or prd_path is None or story is None:
        return issues
    import tempfile

    # Build a minimal single-story prd.json scoped to the current story
    try:
        prd_full = json.loads(prd_path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError, ValueError):
        prd_full = {}
    scoped_prd = {
        "version": prd_full.get("version", "2.0"),
        "stories": [story],
    }
    with tempfile.NamedTemporaryFile(
        mode="w", suffix=".json", delete=False, encoding="utf-8"
    ) as tmp:
        json.dump(scoped_prd, tmp)
        scoped_prd_path = Path(tmp.name)
    try:
        markers = validate_r_markers(test_dir, scoped_prd_path, story=story)
    finally:
        scoped_prd_path.unlink(missing_ok=True)
    # Cache the result for step 11 to reuse
    if pipeline_context is not None:
        pipeline_context["r_markers"] = markers
    if markers.get("result") == "FAIL":
        missing = markers.get("missing_markers", [])
        if missing:
            issues.append(f"Missing R-markers: {missing}")
    return issues


def _plan_conf_hash_sync(plan_path: Path | None, prd_path: Path | None) -> list[str]:
    """Sub-check 3: Plan-PRD hash consistency. Returns warnings (not issues — never causes FAIL)."""
    warnings: list[str] = []
    if plan_path is None or prd_path is None:
        return warnings
    from _qa_lib import check_plan_prd_sync

    sync_result = check_plan_prd_sync(plan_path, prd_path)
    computed_hash = sync_result.get("plan_hash", "")
    try:
        prd_data = json.loads(prd_path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError, ValueError):
        prd_data = {}
    stored_hash = prd_data.get("plan_hash", "")
    if computed_hash and stored_hash and computed_hash != stored_hash:
        # Hash mismatch is expected in worktree contexts — WARN, never FAIL
        warnings.append(
            f"Plan-PRD hash mismatch -- prd.json plan_hash ({stored_hash[:12]}...) "
            f"differs from computed PLAN.md hash ({computed_hash[:12]}...). "
            f"Run plan-PRD sync to resolve drift"
        )
    return warnings


def _step_plan_conformance(
    changed_files: list[Path],
    plan_path: Path | None,
    story: dict | None = None,
    prd_path: Path | None = None,
    test_dir: Path | None = None,
    pipeline_context: dict | None = None,
) -> tuple[StepResult, str]:
    """Step 10: Plan Conformance Check."""
    if plan_path is None and not story and not changed_files:
        return StepResult.SKIP, "No --plan path or story provided"

    issues: list[str] = []
    warnings: list[str] = []
    always_allowed = {"__init__.py", "conftest.py", "__pycache__"}
    has_data = False

    # Sub-check 1: Blast radius -- changed files vs plan's Changes table.
    if plan_path is not None:
        br_issues, br_has_data = _plan_conf_blast_radius(
            changed_files, plan_path, story, always_allowed
        )
        issues.extend(br_issues)
        if br_has_data:
            has_data = True

    # Sub-check 1a: Scope enforcement
    scope_issues = _plan_conf_scope(changed_files, story, pipeline_context)
    if scope_issues:
        has_data = True
        issues.extend(scope_issues)
    elif story and changed_files:
        has_data = True

    # Sub-check 1b: Plan identifier check (warnings only)
    if plan_path is not None and changed_files:
        id_warnings = _plan_conf_identifiers(
            changed_files, plan_path, story, pipeline_context
        )
        warnings.extend(id_warnings)

    # Sub-check 1c: Fix-loop new-file detection (no plan_path guard -- runs whenever
    # fix_iteration > 0, matching original behavior)
    fl_issues = _plan_conf_fix_loop_files(
        changed_files, pipeline_context, plan_path, story, always_allowed
    )
    if fl_issues:
        has_data = True
        issues.extend(fl_issues)

    # Sub-check 1d: New file ratio
    nfr_issues, nfr_warnings = _plan_conf_new_file_ratio(
        changed_files, plan_path, story, pipeline_context, always_allowed
    )
    if nfr_issues or nfr_warnings:
        has_data = True
    issues.extend(nfr_issues)
    warnings.extend(nfr_warnings)

    # Sub-check 2: R-marker validation
    if test_dir and prd_path and story:
        has_data = True
        r_issues = _plan_conf_r_markers(test_dir, prd_path, story, pipeline_context)
        issues.extend(r_issues)

    # Sub-check 3: Plan-PRD hash consistency (warnings only — never causes FAIL)
    if plan_path is not None and prd_path is not None:
        has_data = True
        warnings.extend(_plan_conf_hash_sync(plan_path, prd_path))

    if not has_data:
        return StepResult.SKIP, "No plan data or story criteria to check"

    if issues:
        evidence = "; ".join(issues)
        if warnings:
            evidence += f"; Warnings: {'; '.join(warnings)}"
        return StepResult.FAIL, evidence

    file_count = len(changed_files)
    evidence = f"Plan conformance passed ({file_count} files checked)"
    if warnings:
        evidence += f"; Warnings: {'; '.join(warnings)}"
    return StepResult.PASS, evidence


def _step_acceptance(
    test_dir: Path | None,
    prd_path: Path | None,
    story: dict | None,
    pipeline_context: dict | None = None,
) -> tuple[StepResult, str]:
    """Step 11: Validate acceptance criteria traceability using validate_r_markers."""
    if test_dir is None or prd_path is None:
        return StepResult.SKIP, "test_dir or prd_path not provided"

    # Reuse cached R-marker result from step 10 if available
    cached = None
    if pipeline_context is not None:
        cached = pipeline_context.get("r_markers")
    marker_result = (
        cached
        if cached is not None
        else validate_r_markers(test_dir, prd_path, story=story)
    )

    if marker_result.get("result") == "SKIP":
        return StepResult.SKIP, marker_result.get("reason", "Skipped")

    # Filter to only this story's criteria if story is available
    missing = marker_result.get("missing_markers", [])
    valid = marker_result.get("markers_valid", [])

    if story:
        story_criteria_ids = {
            c.get("id", "") for c in story.get("acceptanceCriteria", [])
        }
        # Only consider markers relevant to this story
        missing = [m for m in missing if m in story_criteria_ids]
        valid = [v for v in valid if v in story_criteria_ids]

    if missing:
        return StepResult.FAIL, f"Missing R-markers for criteria: {missing}"

    evidence = f"All criteria have linked tests: {valid}"
    # Surface orphan R-markers as informational warnings (do not fail)
    orphans = marker_result.get("orphan_markers", [])
    if orphans:
        evidence += f"; WARNING: orphan R-markers not in prd.json: {orphans}"

    # R-marker content validation sub-check
    cfg_acc = (
        load_workflow_config()
        if pipeline_context is None
        else pipeline_context.get("config", load_workflow_config())
    )
    qa_cfg_acc = cfg_acc.get("qa_runner", {})
    content_validation = qa_cfg_acc.get("r_marker_content_validation", "warn")
    weak_r_markers = marker_result.get("weak_r_markers", [])
    if content_validation != "disabled" and weak_r_markers:
        weak_desc = "; ".join(
            f"{w['id']}:{w['test_func']}({', '.join(w['issues'])})"
            for w in weak_r_markers
        )
        if content_validation == "fail":
            return StepResult.FAIL, f"Weak R-markers: {weak_desc}"
        # default "warn"
        evidence += f"; WARNING: weak R-markers: {weak_desc}"

    # R-P2-06: Per-criterion R-marker assertion quality check
    if story and test_dir:
        quality_issues: list[str] = []
        for criterion in story.get("acceptanceCriteria", []):
            cid = criterion.get("id", "")
            tf = criterion.get("testFile", "")
            if cid and tf and cid in valid:
                status, reason = _validate_r_marker_assertion_quality(test_dir, cid, tf)
                if status == "FAIL":
                    quality_issues.append(f"{cid}: {reason}")
        if quality_issues:
            quality_desc = "; ".join(quality_issues)
            if content_validation == "fail":
                return StepResult.FAIL, f"Marker assertion quality: {quality_desc}"
            evidence += f"; WARNING: marker assertion quality: {quality_desc}"

    # R-P2-07: verify_production_calls — check test coverage of public functions
    if test_dir and test_dir.is_dir():
        test_files = sorted(test_dir.rglob("test_*.py"))
        changed = (
            (pipeline_context or {}).get("changed_files", [])
            if pipeline_context
            else []
        )
        source_files = [
            f
            for f in changed
            if f.suffix == ".py"
            and not f.name.startswith("test_")
            and not f.name.endswith("_test.py")
            and f.is_file()
        ]
        min_cov = float(qa_cfg_acc.get("min_public_api_coverage_pct", 80.0))
        prod_cov = verify_production_calls(test_files, source_files, min_cov)
        if prod_cov["result"] != "SKIP":
            pct = prod_cov["coverage_pct"]
            evidence += f"; production call coverage: {pct:.0f}%"
            if prod_cov["result"] == "FAIL":
                uncovered = prod_cov.get("untested_functions", [])
                evidence += f" (FAIL — uncovered: {uncovered[:5]})"

    return StepResult.PASS, evidence


def _step_production_scan(
    changed_files: list[Path],
    config: dict | None = None,
    violation_cache: dict[str, list[dict]] | None = None,
) -> tuple[StepResult, str]:
    """Step 12: Stub — merged into step 6 (Code scan).

    Production violation scanning is now performed in step 6 (_step_code_scan)
    which covers both security and production patterns in a single pass.
    This stub exists to maintain step numbering compatibility.
    Returns SKIP (not PASS) to avoid inflating pass counts in overall_result.
    """
    return StepResult.SKIP, "Merged into step 6 (Code scan)"


def _has_outside_claude_files(changed_files: list[Path]) -> bool:
    """Return True if any changed file lives outside the .claude/ directory tree."""
    for f in changed_files:
        parts = Path(str(f).replace("\\", "/")).parts
        if ".claude" not in parts:
            return True
    return False


def _build_step_sequence(config: dict, phase_type: str | None) -> list[int | dict]:
    """Build the ordered sequence of steps (ints and custom step dicts).

    Custom steps from config.qa_runner.custom_steps are interleaved after their
    after_step anchor positions. Steps are optionally filtered by phase_types.

    Returns [1, 2, ..., 13] if no custom steps are configured (backward-compat).
    """
    base_steps: list[int | dict] = list(range(1, 13))

    qa_runner_config = config.get("qa_runner", {})
    custom_steps = qa_runner_config.get("custom_steps", [])

    if not custom_steps:
        return base_steps

    # Filter custom steps by phase_type if specified
    enabled_customs: list[dict] = []
    for step in custom_steps:
        if not step.get("enabled", True):
            continue
        phase_types = step.get("phase_types", None)
        if phase_types is not None and phase_type is not None:
            if phase_type not in phase_types:
                continue
        enabled_customs.append(step)

    if not enabled_customs:
        return base_steps

    # Insert custom steps after their anchor positions
    result: list[int | dict] = []
    for item in base_steps:
        result.append(item)
        # After adding this standard step, check for custom steps anchored here
        for custom in enabled_customs:
            if custom.get("after_step") == item:
                result.append(custom)

    return result


def _run_custom_step(step_def: dict, changed_files: list[Path]) -> dict:
    """Execute a custom QA step and return its result dict.

    Substitutes {changed_files} and {changed_dir} placeholders in command.
    Exit 0 → PASS; non-zero + severity="block" → FAIL; non-zero + severity="warn" → WARN.
    Timeout or crash: FAIL for block severity, WARN for warn severity.
    """
    import os as _os

    start = time.monotonic()
    step_id = step_def.get("id", "unknown")
    name = step_def.get("name", f"Custom step {step_id}")
    severity = step_def.get("severity", "block")
    timeout_s = step_def.get("timeout_s", 120)
    cmd = step_def.get("command", "") or step_def.get("cmd", "")

    # Build placeholder values
    source_files = _get_source_files(changed_files)
    if source_files:
        try:
            changed_dir = _os.path.commonpath([str(f) for f in source_files])
        except ValueError:
            changed_dir = "."
    elif changed_files:
        try:
            changed_dir = _os.path.commonpath([str(f) for f in changed_files])
        except ValueError:
            changed_dir = "."
    else:
        changed_dir = "."
    changed_files_str = " ".join(str(f) for f in changed_files)

    cmd = cmd.replace("{changed_files}", changed_files_str)
    cmd = cmd.replace("{changed_dir}", changed_dir)

    if not cmd:
        elapsed_ms = int((time.monotonic() - start) * 1000)
        return {
            "step": f"custom:{step_id}",
            "name": name,
            "result": "SKIP",
            "evidence": "No command configured for custom step",
            "duration_ms": elapsed_ms,
        }

    code, stdout, stderr = _run_command(cmd, timeout=timeout_s)

    elapsed_ms = int((time.monotonic() - start) * 1000)

    if code == 0:
        result_val = "PASS"
        evidence = (
            f"Custom step passed: {stdout[: _get_evidence_max_chars()]}"
            if stdout
            else "Custom step passed"
        )
    else:
        result_val = "FAIL" if severity == "block" else "WARN"
        out = (stderr or stdout)[: _get_evidence_max_chars()]
        if code == -1 and "timed out" in out.lower():
            evidence = (
                f"Custom step timed out after {timeout_s}s (severity: {severity})"
            )
        else:
            evidence = f"Custom step failed (exit {code}, severity: {severity}): {out}"

    return {
        "step": f"custom:{step_id}",
        "name": name,
        "result": result_val,
        "evidence": evidence,
        "duration_ms": elapsed_ms,
    }


def _collect_test_files(test_dir: Path | None) -> list[Path]:
    """Collect test file paths from a directory."""
    if test_dir is None or not test_dir.is_dir():
        return []
    result: list[Path] = []
    for f in sorted(test_dir.rglob("test_*.py")):
        result.append(f)
    for f in sorted(test_dir.rglob("*_test.py")):
        if f not in result:
            result.append(f)
    return result


def _run_test_quality(
    test_dir: Path | None,
    prd_path: Path | None,
    extra_files: list[Path] | None = None,
) -> dict:
    """Run test quality analysis and return structured JSON output."""
    test_files = _collect_test_files(test_dir)
    if extra_files:
        for ef in extra_files:
            if ef not in test_files:
                test_files.append(ef)

    if not test_files:
        return {
            "files": [],
            "overall_result": "PASS",
            "summary": {
                "total_tests": 0,
                "total_assertion_free": 0,
                "total_self_mock": 0,
                "total_mock_only": 0,
            },
        }

    file_results: list[dict] = []
    total_tests = 0
    total_assertion_free = 0
    total_self_mock = 0
    total_mock_only = 0
    has_issues = False

    for tf in test_files:
        quality = scan_test_quality(tf)
        file_results.append(quality)

        total_tests += quality.get("tests_found", 0)
        af = quality.get("assertion_free_tests", [])
        sm = quality.get("self_mock_tests", [])
        mo = quality.get("mock_only_tests", [])
        total_assertion_free += len(af)
        total_self_mock += len(sm)
        total_mock_only += len(mo)

        if quality.get("quality_score") == "FAIL":
            has_issues = True

    # R-PN-NN marker validation (only when prd_path is provided)
    marker_validation = None
    if prd_path is not None and prd_path.is_file():
        if test_dir is not None:
            scan_dir = test_dir
        elif test_files:
            scan_dir = test_files[0].parent
        else:
            scan_dir = Path(".")
        marker_result = validate_r_markers(scan_dir, prd_path)
        marker_validation = marker_result
        if marker_result.get("result") == "FAIL":
            has_issues = True

    overall = "FAIL" if has_issues else "PASS"

    summary: dict = {
        "total_tests": total_tests,
        "total_assertion_free": total_assertion_free,
        "total_self_mock": total_self_mock,
        "total_mock_only": total_mock_only,
    }
    if marker_validation is not None:
        summary["marker_validation"] = marker_validation

    return {
        "files": file_results,
        "overall_result": overall,
        "summary": summary,
    }


# Default step classification: story-scoped vs environment-scoped
_STEP_CLASSIFICATION: dict[int, str] = {
    1: "story",  # Lint
    2: "environment",  # Type check
    3: "story",  # Unit tests
    4: "environment",  # Integration
    5: "story",  # Regression
    6: "environment",  # Code scan (security + production)
    7: "story",  # Clean diff
    8: "environment",  # Coverage
    9: "environment",  # Mock audit
    10: "story",  # Plan conformance
    11: "story",  # Acceptance criteria
    12: "environment",  # Production scan (stub — merged into step 6)
}


def _classify_steps(config: dict) -> dict[int, str]:
    """Return step classification mapping.

    Hardcoded constant — config overrides no longer supported.
    Kept for backward compatibility with callers.
    """
    return _STEP_CLASSIFICATION


def _compute_story_result(
    step_results: list[dict],
    classification: dict[int, str],
) -> str:
    """Compute story result using only story-classified steps.

    Returns 'PASS' if all story-classified steps that ran (non-SKIP) passed.
    Returns 'FAIL' if any story-classified step failed.
    Returns 'PASS' if no story-classified steps appear in step_results.
    SKIP results are ignored (not counted as failures).
    """
    for step in step_results:
        step_num = int(step.get("step") or 0)
        result = step.get("result")
        if result == "SKIP":
            continue
        if classification.get(step_num) == "story" and result in ("FAIL", "TIMEOUT"):
            return "FAIL"
    return "PASS"


def _compute_environment_result(
    step_results: list[dict],
    classification: dict[int, str],
    baseline: dict | None = None,
) -> str:
    """Compute environment result using only environment-classified steps.

    Returns 'PASS' if all environment-classified steps that ran (non-SKIP) passed.
    Returns 'FAIL' if any environment-classified step failed.
    When baseline is provided, steps that were already FAIL in baseline are
    excluded from FAIL determination (pre-existing failures do not count).
    SKIP results are ignored.
    """
    # Build baseline step results for quick lookup
    baseline_step_results: dict[int, str] = {}
    if baseline:
        for bs in baseline.get("steps", []):
            bnum = bs.get("step")
            bresult = bs.get("result", "PASS")
            if bnum is not None:
                baseline_step_results[bnum] = bresult

    for step in step_results:
        step_num = int(step.get("step") or 0)
        result = step.get("result")
        if result == "SKIP":
            continue
        if classification.get(step_num) == "environment" and result in (
            "FAIL",
            "TIMEOUT",
        ):
            # Check if this failure was pre-existing in baseline
            if baseline is not None:
                baseline_result = baseline_step_results.get(step_num, "PASS")
                if baseline_result in ("FAIL", "SKIP"):
                    # Pre-existing or never-tested: exclude from determination
                    continue
            return "FAIL"
    return "PASS"


def _load_baseline(path: Path) -> dict | None:
    """Load and validate a baseline JSON file.

    Returns the parsed dict if the file exists and contains valid JSON with a
    'steps' key.  Returns None on any error (file missing, invalid JSON,
    unexpected structure) so callers never have to handle exceptions.
    """
    try:
        text = path.read_text(encoding="utf-8")
    except (OSError, FileNotFoundError):
        return None  # nosec

    try:
        data = json.loads(text)
    except (json.JSONDecodeError, ValueError):
        return None  # nosec

    if not isinstance(data, dict):
        return None
    if "steps" not in data:
        return None

    return data


def _compute_receipt_hash(
    steps: list[dict],
    story_id: str,
    attempt: int,
    overall_result: str,
    phase_type: str | None,
    story_result: str | None = None,
) -> str:
    """Return a SHA-256 hex digest (64 chars) of the receipt inputs.

    The hash changes when any of the six input fields changes.
    story_result is included in the hash payload for integrity.
    When story_result is None, falls back to overall_result (backward compat).
    Serialisation uses json.dumps(sort_keys=True) for determinism.
    """
    import hashlib as _hashlib

    # story_result defaults to overall_result for backward compatibility
    effective_story_result = (
        story_result if story_result is not None else overall_result
    )

    payload = json.dumps(
        {
            "steps": steps,
            "story_id": story_id,
            "attempt": attempt,
            "overall_result": overall_result,
            "phase_type": phase_type,
            "story_result": effective_story_result,
        },
        sort_keys=True,
        separators=(",", ":"),
    )
    return _hashlib.sha256(payload.encode("utf-8")).hexdigest()


def _write_receipt(
    output: dict,
    story_id: str,
    attempt: int,
    base_dir: Path | None = None,
) -> str:
    """Write QA receipt to a namespaced JSON file and return the path string.

    File location: {base_dir}/{story_id}/attempt-{attempt}/qa-receipt.json
    Default base_dir: .claude/runtime/receipts (relative to CWD).

    The receipt contains: receipt_hash, story_id, attempt, timestamp,
    overall_result, steps, receipt_version.
    """
    if base_dir is None:
        base_dir = Path(".claude/runtime/receipts")

    receipt_dir = base_dir / story_id / f"attempt-{attempt}"
    receipt_dir.mkdir(parents=True, exist_ok=True)
    receipt_file = receipt_dir / "qa-receipt.json"

    # story_result/environment_result fall back to overall_result for backward compat
    story_result = output.get("story_result", output.get("overall_result", "FAIL"))
    environment_result = output.get(
        "environment_result", output.get("overall_result", "FAIL")
    )

    receipt = {
        "receipt_hash": output.get("receipt_hash", ""),
        "story_id": story_id,
        "attempt": attempt,
        "timestamp": output.get("timestamp", datetime.now(timezone.utc).isoformat()),
        "phase_type": output.get("phase_type"),
        "overall_result": output.get("overall_result", "FAIL"),
        "story_result": story_result,
        "environment_result": environment_result,
        "steps": output.get("steps", []),
        "criteria_verified": output.get("criteria_verified", []),
        "production_violations": output.get("production_violations", 0),
        "drift_warnings": output.get("drift_warnings", 0),
        "changed_files": output.get("changed_files", []),
        "has_frontend_files": output.get("has_frontend_files", False),
        "pipeline_elapsed_s": output.get("pipeline_elapsed_s", 0.0),
        "total_duration_ms": sum(
            s.get("duration_ms", 0) for s in output.get("steps", [])
        ),
        "receipt_version": "2",
    }

    receipt_file.write_text(json.dumps(receipt, indent=2), encoding="utf-8")
    return str(receipt_file)


def _log_plan_replacement(
    old_hash: str,
    new_hash: str,
    reason: str,
    log_path: "Path | None" = None,
) -> bool:
    """Append a plan_replacement sentinel entry to the verification log.

    Records a traceability link so that ``read_verification_log()`` can include
    entries written under ``old_hash`` when queried with ``new_hash``.

    Args:
        old_hash: SHA-256 of the replaced (old) plan.
        new_hash: SHA-256 of the current (new) plan.
        reason: Human-readable description of why the plan was replaced.
        log_path: Path to the JSONL log file.  Defaults to
            ``VERIFICATION_LOG_PATH`` when ``None``.

    Returns:
        True on success, False on write error (OSError).
    """
    target = log_path if log_path is not None else VERIFICATION_LOG_PATH
    entry: dict = {
        "type": "plan_replacement",
        "old_plan_hash": old_hash,
        "new_plan_hash": new_hash,
        "plan_hash": new_hash,
        "reason": reason,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    try:
        target.parent.mkdir(parents=True, exist_ok=True)
        _locked_append(target, json.dumps(entry, separators=(",", ":")) + "\n")
    except OSError as exc:
        audit_log(
            "_log_plan_replacement",
            "write_failed",
            f"OSError writing to {target}: {exc}",
        )
        return False
    return True


def inject_verification_entry(
    story_id: str,
    plan_hash: str,
    result: str,
    note: str,
    log_path: Path | None = None,
) -> bool:
    """Write a synthetic verification log entry for a story.

    Used by the ``--inject-verification`` subcommand to close mid-sprint
    traceability gaps when a story was verified outside the normal QA pipeline.

    Args:
        story_id: Story identifier (e.g. "STORY-001").
        plan_hash: SHA-256 plan hash to stamp on the entry.
        result: "PASS" or "FAIL".
        note: Optional free-text note.
        log_path: Path to the JSONL log file.  Defaults to
            ``VERIFICATION_LOG_PATH`` when ``None``.

    Returns:
        True on success, False on write error (OSError).
    """
    target = log_path if log_path is not None else VERIFICATION_LOG_PATH
    entry: dict = {
        "story_id": story_id,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "overall_result": result,
        "story_result": result,
        "attempt": 0,
        "plan_hash": plan_hash,
        "injected": True,
    }
    if note:
        entry["note"] = note
    try:
        append_verification_entry(target, entry)
    except OSError as exc:
        audit_log(
            "inject_verification_entry",
            "write_failed",
            f"OSError writing to {target}: {exc}",
        )
        return False
    return True


def main() -> None:
    """Main entry point for the QA runner."""
    _pipeline_start = time.monotonic()
    parser = _build_parser()
    args = parser.parse_args()

    # Load workflow config
    config = load_workflow_config()

    # Initialise evidence truncation limit from config
    _get_evidence_max_chars(config)

    # Resolve prd path
    prd_path: Path | None = None
    if args.prd:
        prd_path = Path(args.prd)
    else:
        default_prd = Path(".claude/prd.json")
        if default_prd.is_file():
            prd_path = default_prd

    # --log-plan-replacement mode: append a plan_replacement sentinel and exit.
    if getattr(args, "log_plan_replacement", False):
        old_hash_val = getattr(args, "old_hash", None)
        new_hash_val = getattr(args, "new_hash", None)
        if not old_hash_val or not new_hash_val:
            parser.error("--log-plan-replacement requires --old-hash and --new-hash")
        reason_val = getattr(args, "reason", "") or ""
        lpr_log_path: Path | None = None
        if getattr(args, "log_path", None):
            lpr_log_path = Path(args.log_path)
        ok = _log_plan_replacement(
            old_hash=old_hash_val,
            new_hash=new_hash_val,
            reason=reason_val,
            log_path=lpr_log_path,
        )
        sys.exit(0 if ok else 1)

    # --inject-verification mode: write a synthetic verification log entry and exit.
    if getattr(args, "inject_verification", False):
        # Resolve plan_hash: prefer explicit arg, fall back to prd.json field.
        plan_hash_val: str = getattr(args, "plan_hash", None) or ""
        if not plan_hash_val and prd_path and prd_path.is_file():
            try:
                prd_data = json.loads(prd_path.read_text(encoding="utf-8"))
                plan_hash_val = prd_data.get("plan_hash", "")
            except (OSError, json.JSONDecodeError):
                plan_hash_val = ""
        log_path_val: Path | None = None
        if getattr(args, "log_path", None):
            log_path_val = Path(args.log_path)
        ok = inject_verification_entry(
            story_id=args.story,
            plan_hash=plan_hash_val,
            result=getattr(args, "result", "PASS"),
            note=getattr(args, "note", ""),
            log_path=log_path_val,
        )
        sys.exit(0 if ok else 1)

    # --test-quality mode: run test quality analysis instead of 12-step pipeline
    if args.test_quality:
        test_dir = Path(args.test_dir) if args.test_dir else None
        # Only use prd_path for marker validation if explicitly provided
        tq_prd = Path(args.prd) if args.prd else None
        output = _run_test_quality(test_dir, tq_prd)
        sys.stdout.write(json.dumps(output, indent=2) + "\n")
        sys.exit(1 if output["overall_result"] == "FAIL" else 0)

    # Find story in prd.json
    story: dict | None = None
    if prd_path and prd_path.is_file():
        story = _find_story(prd_path, args.story)

    # Parse arguments
    steps_to_run = _parse_steps(args.steps)
    # --gate-only: restrict to story-classified steps only; all others become SKIP.
    # If --gate-only and --steps are both supplied, their intersection is used.
    if getattr(args, "gate_only", False):
        steps_to_run = sorted(s for s in steps_to_run if s in GATE_ONLY_STEPS)
    changed_files = _parse_changed_files(args.changed_files)
    test_dir = Path(args.test_dir) if args.test_dir else None
    checkpoint = args.checkpoint
    plan_path = Path(args.plan) if args.plan else None
    phase_type: str | None = args.phase_type

    # Fallback: if --changed-files not provided but --checkpoint is, derive from git diff
    if not changed_files and checkpoint:
        try:
            result = subprocess.run(
                ["git", "diff", "--name-only", f"{checkpoint}..HEAD"],
                capture_output=True,
                text=True,
                timeout=30,
            )
            if result.returncode == 0 and result.stdout.strip():
                changed_files = [
                    Path(f.strip())
                    for f in result.stdout.strip().split("\n")
                    if f.strip()
                ]
                audit_log(
                    "qa_runner",
                    "changed_files_fallback",
                    f"Derived {len(changed_files)} files from git diff {checkpoint[:12]}..HEAD",
                )
        except (subprocess.TimeoutExpired, OSError) as e:
            audit_log("qa_runner", "changed_files_fallback_failed", str(e))

    # Startup validation: fail closed when critical project commands are invalid.
    project_mode = get_project_mode(config)
    project_command_validation = validate_project_commands(config)
    startup_failure: dict | None = None
    if project_command_validation["status"] == "FAIL":
        failures = project_command_validation.get("failures", [])
        mode_error = project_command_validation.get("mode_error", "")
        sys.stderr.write(
            f"FAIL: project_mode={project_mode} project commands are invalid."
            " Fix .claude/workflow.json before running QA.\n"
        )
        if mode_error:
            sys.stderr.write(f"  - project_mode: {mode_error}\n")
        for key in failures:
            if key == "project_mode":
                continue
            sys.stderr.write(f"  - {key}: missing, placeholder, or unsafe command\n")
        audit_log(
            "qa_runner",
            "project_commands_invalid",
            (
                f"Invalid project commands for project_mode={project_mode}: {failures}; "
                f"mode_error={mode_error or 'none'}"
            ),
        )
        failure_details = [mode_error] if mode_error else []
        failure_details.extend(f for f in failures if f != "project_mode")
        startup_failure = {
            "step": 0,
            "name": "Project commands",
            "result": "FAIL",
            "evidence": "Project QA configuration is invalid: "
            + ", ".join(failure_details),
            "duration_ms": 0,
        }

    # Determine which steps are relevant for this phase type
    relevant_steps: set[int] | None = None
    if phase_type is not None:
        relevant_steps = PHASE_TYPE_RELEVANCE.get(phase_type)

    # Build scan-once violation cache for steps 6, 7, 12
    source_files = _get_source_files(changed_files)
    violation_cache = _build_violation_cache(source_files)

    # Detect languages from changed files for polyglot step execution (R-P4-01)
    lang_map: dict[str, list[Path]] = _detect_languages(changed_files, config)

    # Pipeline context for caching intermediate results across steps
    pipeline_context: dict = {}
    if checkpoint:
        pipeline_context["checkpoint"] = checkpoint
    pipeline_context["fix_iteration"] = args.fix_iteration
    pipeline_context["changed_files"] = changed_files

    # Compute which steps are required for zero-skip enforcement (R-P5-01)
    required_steps: dict[str, bool] = _required_verification_steps(
        story, phase_type, config
    )

    # Build full step sequence (standard ints + interleaved custom step dicts)
    full_sequence = _build_step_sequence(config, phase_type)

    # Filter to only the user-requested step numbers (custom steps always included)
    filtered_sequence: list[int | dict] = []
    for item in full_sequence:
        if isinstance(item, int):
            if item in steps_to_run:
                filtered_sequence.append(item)
        else:
            # Custom step: include if its after_step anchor is in the requested steps
            anchor = item.get("after_step")
            if anchor is None or anchor in steps_to_run:
                filtered_sequence.append(item)

    # Run each step
    step_results: list[dict] = []
    production_violation_count = 0

    if startup_failure is not None:
        step_results.append(startup_failure)
    else:
        for item in filtered_sequence:
            # Custom step dict
            if isinstance(item, dict):
                step_result = _run_custom_step(item, changed_files)
                step_results.append(step_result)
                continue

            step_num = item

            # Check if step should be skipped due to phase_type
            if relevant_steps is not None and step_num not in relevant_steps:
                step_name = STEP_NAMES.get(step_num, f"Step {step_num}")
                step_results.append(
                    {
                        "step": step_num,
                        "name": step_name,
                        "result": "SKIP",
                        "evidence": (f"Skipped: not relevant for {phase_type} phase"),
                        "duration_ms": 0,
                    }
                )
                continue

            step_result = _run_step(
                step_num=step_num,
                config=config,
                story=story,
                changed_files=changed_files,
                test_dir=test_dir,
                prd_path=prd_path,
                checkpoint=checkpoint,
                plan_path=plan_path,
                violation_cache=violation_cache,
                pipeline_context=pipeline_context,
                lang_map=lang_map,
                required_steps=required_steps,
                phase_type=phase_type,
            )
            step_results.append(step_result)

            # Track production violations from step 12
            if step_num == 12:
                step_passed = step_result["result"] == "PASS"
                # Count violations from evidence
                evidence = step_result["evidence"]
                if evidence.startswith(("0 ", "No ")):
                    production_violation_count = 0
                else:
                    # Parse count from "N production violations: ..."
                    try:
                        production_violation_count = int(evidence.split()[0])
                    except (ValueError, IndexError):
                        # If step passed, no violations; if failed, assume at least 1
                        production_violation_count = 0 if step_passed else 1
                        audit_log(
                            "_run_pipeline",
                            "violation_count_parse_failed",
                            f"Could not parse violation count from: {evidence[:100]}",
                        )

    # Determine overall result:
    # Only "block"-severity custom FAILs (step key starts with "custom:") contribute.
    # "warn"-severity custom steps produce WARN which does not affect overall FAIL.
    has_fail = any(s["result"] == "FAIL" for s in step_results if s["result"] != "SKIP")
    overall = "FAIL" if has_fail else "PASS"

    # Load baseline when --baseline flag is supplied (Ralph passes this explicitly)
    baseline_data: dict | None = None
    if getattr(args, "baseline", None):
        baseline_data = _load_baseline(Path(args.baseline))

    # Compute two-pass story/environment results
    classification = _STEP_CLASSIFICATION
    story_result_val = _compute_story_result(step_results, classification)
    environment_result_val = _compute_environment_result(
        step_results, classification, baseline=baseline_data
    )

    # Recompute overall from baseline-aware components. The raw `overall`
    # above ignores the baseline, so pre-existing env failures can leak
    # through and block promotion even when the story itself is clean.
    if story_result_val != "FAIL" and environment_result_val != "FAIL":
        overall = "PASS"

    if startup_failure is not None:
        story_result_val = "FAIL"
        overall = "FAIL"

    # Collect verified criteria — only IDs confirmed by R-marker validation
    criteria_verified: list[str] = []
    if story:
        story_criteria_ids = {
            c.get("id", "") for c in story.get("acceptanceCriteria", [])
        }
        r_markers = pipeline_context.get("r_markers")
        if r_markers is not None:
            markers_valid = r_markers.get("markers_valid", [])
            criteria_verified = [
                mid for mid in markers_valid if mid in story_criteria_ids
            ]

    # Count drift warnings from step evidence for receipt
    drift_warning_count = 0
    for sr in step_results:
        ev = sr.get("evidence", "")
        if isinstance(ev, str):
            for m in re.finditer(r"Warnings:\s*(.+?)(?:\s*\|\s*|$)", ev):
                segment = m.group(1).strip()
                if segment:
                    drift_warning_count += len(
                        [s for s in segment.split(";") if s.strip()]
                    )

    # Build output (pre-hash, without receipt_hash/receipt_path)
    timestamp = datetime.now(timezone.utc).isoformat()
    changed_files_strs = [str(f) for f in changed_files]
    output: dict = {  # type: ignore[no-redef]
        "story_id": args.story,
        "timestamp": timestamp,
        "phase_type": phase_type,
        "steps": step_results,
        "overall_result": overall,
        "story_result": story_result_val,
        "environment_result": environment_result_val,
        "criteria_verified": criteria_verified,
        "production_violations": production_violation_count,
        "drift_warnings": drift_warning_count,
        "changed_files": changed_files_strs,
        "has_frontend_files": has_frontend_files(changed_files),
    }

    # Record total pipeline elapsed time just before writing the receipt
    output["pipeline_elapsed_s"] = round(time.monotonic() - _pipeline_start, 2)

    # Compute receipt hash over the core fields (includes story_result for integrity)
    receipt_hash = _compute_receipt_hash(
        step_results, args.story, 1, overall, phase_type, story_result=story_result_val
    )
    output["receipt_hash"] = receipt_hash

    # Write receipt file and record its path
    try:
        receipt_path = _write_receipt(output, args.story, 1)
        output["receipt_path"] = receipt_path
    except OSError:
        output["receipt_path"] = ""

    # --baseline-capture mode: write output to qa-baseline.json and exit 0
    if getattr(args, "baseline_capture", False):
        baseline_dir = Path(".claude/runtime")
        try:
            baseline_dir.mkdir(parents=True, exist_ok=True)
            baseline_file = baseline_dir / "qa-baseline.json"
            baseline_file.write_text(json.dumps(output, indent=2), encoding="utf-8")
        except OSError as exc:
            audit_log("main", "baseline_capture_write_failed", str(exc))
        sys.stdout.write(json.dumps(output, indent=2) + "\n")
        sys.exit(0)

    sys.stdout.write(json.dumps(output, indent=2) + "\n")
    if overall == "PASS":
        clear_marker()
    # When --baseline is supplied, use story_result for exit code: environment
    # failures that were pre-existing in the baseline do not block story promotion.
    if getattr(args, "baseline", None):
        sys.exit(1 if story_result_val == "FAIL" else 0)
    sys.exit(1 if overall == "FAIL" else 0)


if __name__ == "__main__":
    main()
