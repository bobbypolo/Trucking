#!/usr/bin/env python3
"""Automated 12-step QA verification pipeline. Exit: 0=PASS, 1=FAIL, 2=bad args."""

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
    LANG_VIOLATION_PATTERNS,
    audit_log,
    check_project_commands,
    clear_marker,
    load_workflow_config,
    scan_file_violations,
)
from _qa_lib import (
    _BACKTICK_IDENTIFIER_RE,
    _PUBLIC_FUNC_RE,
    check_complexity,
    check_diff_public_api_coverage,
    check_negative_tests,
    check_scope_compliance,
    check_story_file_coverage,
    check_tdd_order,
    extract_diff_added_identifiers,
    parse_plan_changes,
    parse_plan_changes_with_descriptions,
    scan_test_quality,
    validate_r_markers,
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

# Build set of language-specific security violation IDs from LANG_VIOLATION_PATTERNS.
# These are added to _SECURITY_IDS for per-language scanning.
_LANG_SECURITY_IDS: frozenset[str] = frozenset(
    vid
    for lang_patterns in LANG_VIOLATION_PATTERNS.values()
    for _, vid, _, sev in lang_patterns
    if sev == "block"
)


class StepResult(str, Enum):
    """Typed result for QA pipeline steps. Serialises to its string value."""

    PASS = "PASS"
    FAIL = "FAIL"
    SKIP = "SKIP"


STEP_NAMES: dict[int, str] = {
    1: "Lint",
    2: "Type check",
    3: "Unit tests",
    4: "Integration tests",
    5: "Regression check",
    6: "Security scan",
    7: "Clean diff",
    8: "Coverage",
    9: "Mock quality audit",
    10: "Plan Conformance Check",
    11: "Acceptance traceability",
    12: "Production scan",
    13: "Mutation testing",
}

# Valid phase types for --phase-type argument
VALID_PHASE_TYPES = ("foundation", "module", "integration", "e2e")

# Steps that are always required regardless of phase type.
# Only steps 3, 4, 8, 9, 13 may be skipped based on phase type.
ALWAYS_REQUIRED_STEPS: frozenset[int] = frozenset({1, 2, 5, 6, 7, 10, 11, 12})

# Maps each phase type to the set of QA step numbers that are relevant.
# Steps not in the set for a given phase type will be reported as SKIP.
PHASE_TYPE_RELEVANCE: dict[str, set[int]] = {
    "foundation": {1, 2, 3, 5, 6, 7, 9, 10, 11, 12},
    "module": {1, 2, 3, 5, 6, 7, 8, 9, 10, 11, 12, 13},
    "integration": set(range(1, 14)),
    "e2e": set(range(1, 14)),
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
        help="Comma-separated step numbers to run (default: all 1-12)",
    )
    parser.add_argument(
        "--changed-files",
        default=None,
        help="Comma-separated list of changed file paths",
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
        help="Phase type for adaptive QA (foundation, module, integration, e2e). Unknown values are treated as None.",
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
    return parser


def _parse_steps(steps_str: str | None) -> list[int]:
    """Parse step filter string into list of step numbers."""
    if steps_str is None:
        return list(range(1, 14))

    result: list[int] = []
    for part in steps_str.split(","):
        part = part.strip()
        if part.isdigit():
            num = int(part)
            if 1 <= num <= 13:
                result.append(num)
    return sorted(set(result))


def _parse_changed_files(files_str: str | None) -> list[Path]:
    """Parse changed files string into list of Path objects."""
    if not files_str:
        return []

    result: list[Path] = []
    for part in files_str.split(","):
        part = part.strip()
        if part:
            result.append(Path(part))
    return result


def _detect_languages(changed_files: list[Path], config: dict) -> dict[str, list[Path]]:
    """Group changed files by language using workflow.json language profiles.

    Returns a dict mapping language name to list of matching files.
    Falls back to extension-based detection if no language profiles are configured.
    If no profiles match, all files are assigned to 'python' (backward-compatible).
    """
    languages_config = config.get("languages", {})

    if not languages_config:
        # Fallback: extension-based detection — all code files grouped by extension
        result: dict[str, list[Path]] = {}
        ext_to_lang = {
            ".py": "python",
            ".ts": "typescript",
            ".tsx": "typescript",
            ".js": "javascript",
            ".jsx": "javascript",
        }
        for f in changed_files:
            lang = ext_to_lang.get(f.suffix, "python")
            result.setdefault(lang, []).append(f)
        if not result and changed_files:
            result["python"] = list(changed_files)
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

    # Assign unmatched files to python (default)
    if unmatched:
        result.setdefault("python", []).extend(unmatched)

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

    # On Windows, .CMD wrappers (e.g. npx.CMD) cannot be launched by subprocess
    # without shell=True, even when shutil.which finds them. Force shell=True
    # whenever the resolved executable ends with .cmd/.bat, or when we are on
    # Windows and the command does not start with the Python interpreter path
    # (Python itself is a .exe and can be launched directly).
    if not use_shell and sys.platform == "win32":
        parts_check = shlex.split(cmd)
        if parts_check:
            resolved = shutil.which(parts_check[0])
            if resolved and resolved.lower().endswith((".cmd", ".bat")):
                use_shell = True

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
                config, story, required=_req.get("unit", True)
            )
        elif step_num == 4:
            result_val, evidence = _step_integration_tests(
                config, story, required=_req.get("integration", False)
            )
        elif step_num == 5:
            result_val, evidence = _step_regression(
                config, story, required=_req.get("regression", False)
            )
        elif step_num == 6:
            result_val, evidence = _step_security_scan(
                changed_files, violation_cache=violation_cache, config=config
            )
        elif step_num == 7:
            result_val, evidence = _step_clean_diff(
                changed_files, violation_cache=violation_cache
            )
        elif step_num == 8:
            result_val, evidence = _step_coverage(config, story=story)
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
        elif step_num == 13:
            result_val, evidence = _step_mutation_testing(changed_files, config=config)
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

    # Multi-language mode: run per-language lint if lang_map provided and profiles exist
    if lang_map and languages_config:
        lang_results: list[str] = []
        any_fail = False
        any_run = False

        for lang_name, lang_files in lang_map.items():
            if not lang_files:
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

    # Single-command fallback: try gateCmds.lint first, then workflow.json commands.lint
    cmd = ""
    if story:
        cmd = story.get("gateCmds", {}).get("lint", "")
    if not cmd:
        cmd = config.get("commands", {}).get("lint", "")

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

    Prefers story.gateCmds.type_check over config.commands.type_check.
    When required=True and no type_check command is configured, returns ("FAIL", ...)
    instead of ("SKIP", ...) to enforce zero-skip policy for required steps.
    """
    cmd = ""
    if story:
        cmd = story.get("gateCmds", {}).get("type_check", "")
    if not cmd:
        cmd = config.get("commands", {}).get("type_check", "")
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
    config: dict, story: dict | None, required: bool = True
) -> tuple[StepResult, str]:
    """Step 3: Run unit tests.

    When required=True and no unit test command is configured, returns ("FAIL", ...)
    instead of ("SKIP", ...) to enforce zero-skip policy for required steps.
    """
    cmd = ""
    if story:
        cmd = story.get("gateCmds", {}).get("unit", "")
    if not cmd:
        cmd = config.get("commands", {}).get("test", "")

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


def _step_integration_tests(
    config: dict, story: dict | None, required: bool = False
) -> tuple[StepResult, str]:
    """Step 4: Run integration tests.

    When required=True and no integration test command is configured, returns ("FAIL", ...)
    instead of ("SKIP", ...) to enforce zero-skip policy for required steps.
    """
    cmd = ""
    if story:
        cmd = story.get("gateCmds", {}).get("integration", "")

    if not cmd:
        if required:
            return (
                StepResult.FAIL,
                "Step 'integration' is required but has no command configured",
            )
        return StepResult.SKIP, "No integration test command configured"

    if cmd.lower() in ("n/a", "none", "skip"):
        return StepResult.SKIP, "Integration tests marked as N/A"

    code, stdout, stderr = _run_command(cmd)
    if code == 0:
        return (
            StepResult.PASS,
            f"Integration tests passed: {stdout[-_get_evidence_max_chars() :]}"
            if stdout
            else "Integration tests passed",
        )
    return (
        StepResult.FAIL,
        f"Integration tests failed (exit {code}): {(stderr or stdout)[-_get_evidence_max_chars() :]}",
    )


def _step_regression(
    config: dict, story: dict | None = None, required: bool = False
) -> tuple[StepResult, str]:
    """Step 5: Run regression test suite.

    Tier resolution order:
    1. story.gateCmds.regression_tier → look up in config.commands.regression_tiers
    2. config.commands.regression_default_tier → look up in config.commands.regression_tiers
    3. config.commands.regression → backward-compatible fallback

    When required=True and no regression command is configured, returns ("FAIL", ...)
    instead of ("SKIP", ...) to enforce zero-skip policy for required steps.
    """
    commands = config.get("commands", {})
    tiers = commands.get("regression_tiers", {})

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


def _step_security_scan(
    changed_files: list[Path],
    violation_cache: dict[str, list[dict]] | None = None,
    config: dict | None = None,
) -> tuple[StepResult, str]:
    """Step 6: Scan for security violations.

    When config contains an external_scanners section, invokes each enabled scanner.
    Executable resolution: use scanner["executable"] if present, else fall back to
    the dict key name. Availability checked via shutil.which():
    - Not found + strict_mode: true  → FAIL
    - Not found + strict_mode: false → include SKIP note, continue
    - Found → run scanner, FAIL on non-zero exit
    If no external_scanners configured, runs existing prod violation scan only.
    """
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
        sec_violations = [v for v in violations if v["violation_id"] in _SECURITY_IDS]
        total_violations += len(sec_violations)
        for v in sec_violations:
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
        # On Windows, commonpath can return empty string when files span
        # different drive roots or have no common prefix. Fall back to ".".
        if not changed_dir:
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
                if strict:
                    total_violations += 1
                    details.append(
                        f"External scanner {name} found issues (exit {code})"
                    )
                else:
                    details.append(
                        f"Scanner '{name}' found issues (exit {code}, non-strict, noted)"
                    )

    if total_violations == 0:
        base_evidence = f"No security violations in {len(source_files)} source files"
        if details:
            base_evidence += "; " + "; ".join(details[:5])
        return StepResult.PASS, base_evidence
    return (
        StepResult.FAIL,
        f"{total_violations} security violations: {'; '.join(details[:5])}",
    )


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
) -> tuple[StepResult, str]:
    """Step 8: Run coverage report.

    If story.gateCmds.coverage is set, it overrides the global coverage command.
    This allows per-story coverage commands (e.g., focused test files for docs phases).
    """
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

    # Collect all test function names across files for negative-test checking
    all_test_names: list[str] = []

    # --- Check 1: Test quality anti-patterns ---
    for tf in test_files:
        quality = scan_test_quality(tf)
        # Collect test names for negative-test check
        try:
            content = tf.read_text(encoding="utf-8")
            import re as _re

            all_test_names.extend(
                _re.findall(
                    r"^[ \t]*(?:async\s+)?def\s+(test_\w+)\s*\(", content, _re.MULTILINE
                )
            )
        except (OSError, UnicodeDecodeError, ValueError):
            pass  # Non-fatal: test name collection is best-effort; scan_test_quality still ran

        if quality.get("quality_score") == "FAIL":
            af = quality.get("assertion_free_tests", [])
            sm = quality.get("self_mock_tests", [])
            mo = quality.get("mock_only_tests", [])
            hm = quality.get("heavy_mock_tests", [])
            if af:
                issues.append(f"{tf.name}: assertion-free tests: {af}")
            if sm:
                issues.append(f"{tf.name}: self-mock tests: {sm}")
            if mo:
                issues.append(f"{tf.name}: mock-only tests: {mo}")
            if hm:
                issues.append(f"{tf.name}: heavy-mock tests (>80% deps mocked): {hm}")

        # --- Check 1b: Behavioral assertion gate ---
        behavioral_required: bool = bool(
            (config or {})
            .get("qa_runner", {})
            .get("behavioral_assertion_required", False)
        )
        if behavioral_required:
            bam = quality.get("behavioral_assertion_missing", [])
            if bam:
                issues.append(
                    f"{tf.name}: behavioral assertion missing (no value-checking assertions): {bam}"
                )

        # --- Check 3: Weak assertions (FAIL) and happy-path-only (FAIL) ---
        weak = quality.get("weak_assertion_tests", [])
        if weak:
            issues.append(f"{tf.name}: weak assertions: {weak}")
        if quality.get("happy_path_only", False) and quality.get("tests_found", 0) > 0:
            issues.append(f"{tf.name}: happy-path-only (no error/edge tests)")

        # --- Check 3b: Negative test percentage (WARN when below threshold) ---
        tests_found = quality.get("tests_found", 0)
        if tests_found > 5:
            neg_min_pct: int = int(
                (config or {}).get("qa_runner", {}).get("negative_test_min_pct", 15)
            )
            neg_pct = quality.get("negative_test_pct", 0)
            neg_count = quality.get("negative_test_count", 0)
            if neg_pct < neg_min_pct:
                warnings.append(
                    f"{tf.name}: Negative test ratio: {neg_count}/{tests_found}"
                    f" ({neg_pct}%) \u2014 minimum recommended: {neg_min_pct}%"
                )

    # --- Check 4: Negative test enforcement for validation criteria ---
    if story and all_test_names:
        for criterion in story.get("acceptanceCriteria", []):
            cid = criterion.get("id", "")
            text = criterion.get("criterion", "")
            neg_result = check_negative_tests(text, all_test_names)
            if neg_result.get("result") == "WARN":
                issues.append(
                    f"{cid}: validation criterion requires negative/error tests but none found"
                )

    # --- Check 2: Story file coverage gate ---
    coverage_info = ""
    if test_dir is not None:
        cov_result = check_story_file_coverage(changed_files, test_dir)
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

    # --- Check 5: Cyclomatic complexity gate ---
    complexity_warnings: list[str] = []
    if config is not None:
        complexity_cfg = config.get("complexity", {})
        if complexity_cfg.get("enabled", True):
            cx_result = check_complexity(changed_files, config)
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

    # --- Check 6: TDD order signal (WARN by default; FAIL when checkpoint config enabled) ---
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

    # --- Check 7: Diff-aware public API coverage gate ---
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
    # When the story carries a phase number, scope to that phase only so that
    # files from other phases do not inflate the allowed set.
    if plan_path is not None:
        story_phase: int | None = story.get("phase") if story else None
        expected = parse_plan_changes(plan_path, phase=story_phase)
        if not expected and story_phase is not None:
            # Phase filter returned nothing — fall back to full-plan files
            expected = parse_plan_changes(plan_path)
            if expected:
                audit_log(
                    "_step_plan_conformance",
                    "phase_fallback",
                    f"Phase {story_phase} filter returned 0 files, falling back to full plan ({len(expected)} files)",
                )
        if expected:
            has_data = True
            expected_norm = {p.replace("\\", "/") for p in expected}
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

    # Sub-check 1a: Scope enforcement -- changed files vs story scope directories.
    cfg = (
        load_workflow_config()
        if pipeline_context is None
        else pipeline_context.get("config", load_workflow_config())
    )
    qa_cfg = cfg.get("qa_runner", {})
    scope_enabled = qa_cfg.get("scope_enforcement_enabled", True)
    if scope_enabled and story and changed_files:
        has_data = True
        scope_result = check_scope_compliance(story, changed_files)
        if scope_result["result"] == "FAIL":
            violations = scope_result["violations"]
            scope_dirs = scope_result["scope"]
            issues.append(
                f"Scope violation: {violations} outside allowed scope {scope_dirs}"
            )

    # Sub-check 1b: Plan identifier check -- new public funcs vs plan descriptions.
    # Uses extract_diff_added_identifiers() to scope the check to diff-added functions
    # only, avoiding false positives from pre-existing functions in modified files.
    # Falls back to full-file scan when no checkpoint is available (preserves existing
    # behavior for callers that don't supply a checkpoint).
    plan_id_enabled = qa_cfg.get("plan_identifier_check_enabled", True)
    if plan_id_enabled and plan_path is not None and changed_files:
        story_phase_1b: int | None = story.get("phase") if story else None
        desc_map = parse_plan_changes_with_descriptions(plan_path, phase=story_phase_1b)
        if desc_map:
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

    # Sub-check 1c: Fix-loop new-file detection -- when fix_iteration > 0 and
    # checkpoint is available, detect files Added since checkpoint that are not
    # in the original changed_files list.
    fix_iteration = pipeline_context.get("fix_iteration", 0) if pipeline_context else 0
    if fix_iteration > 0 and changed_files:
        checkpoint_1c: str | None = (
            pipeline_context.get("checkpoint") if pipeline_context else None
        )
        if checkpoint_1c:
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
                        f.strip()
                        for f in added_proc.stdout.strip().split("\n")
                        if f.strip()
                    }
                    original_files = {str(f).replace("\\", "/") for f in changed_files}
                    new_in_fix = {
                        f
                        for f in added_files
                        if f not in original_files
                        and Path(f).name not in always_allowed
                    }
                    if new_in_fix:
                        has_data = True
                        issues.append(
                            f"Fix-loop new-file violation (iteration {fix_iteration}): "
                            f"{sorted(new_in_fix)}"
                        )
            except (subprocess.TimeoutExpired, OSError):
                pass  # Degrade gracefully — no enforcement

    # Sub-check 2: R-marker validation -- test files link to acceptance criteria.
    # When a story is provided, scope the check to only that story's criteria IDs
    # by building a single-story prd and writing it to a temp file.
    if test_dir and prd_path and story:
        import tempfile

        has_data = True
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

    # Sub-check 3: Plan-PRD hash consistency
    if plan_path is not None and prd_path is not None:
        from _qa_lib import check_plan_prd_sync

        has_data = True
        sync_result = check_plan_prd_sync(plan_path, prd_path)
        computed_hash = sync_result.get("plan_hash", "")
        try:
            prd_data = json.loads(prd_path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError, ValueError):
            prd_data = {}
        stored_hash = prd_data.get("plan_hash", "")
        if computed_hash and stored_hash and computed_hash != stored_hash:
            issues.append(
                f"WARNING: Plan-PRD hash mismatch — prd.json plan_hash ({stored_hash[:12]}...) "
                f"differs from computed PLAN.md hash ({computed_hash[:12]}...). "
                f"Run plan-PRD sync to resolve drift"
            )

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

    return StepResult.PASS, evidence


def _step_production_scan(
    changed_files: list[Path],
    config: dict | None = None,
    violation_cache: dict[str, list[dict]] | None = None,
) -> tuple[StepResult, str]:
    """Step 12: Production-grade code scan using scan_file_violations."""
    source_files = _get_source_files(changed_files)
    if not source_files:
        return StepResult.PASS, "No source files to scan"

    total_violations = 0
    details: list[str] = []

    for f in source_files:
        if violation_cache is not None:
            violations = violation_cache.get(str(f), [])
        else:
            violations = scan_file_violations(f)
        total_violations += len(violations)
        for v in violations:
            details.append(f"{f.name}:{v['line']} {v['violation_id']}: {v['message']}")

    # External scanners (optional, from workflow.json)
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
        # On Windows, commonpath can return empty string when files span
        # different drive roots or have no common prefix. Fall back to ".".
        if not changed_dir:
            changed_dir = "."
        changed_files_str = " ".join(str(f) for f in source_files)

        for name, settings in scanners.items():
            if settings.get("enabled", False):
                exe = settings.get("executable", name)
                strict = settings.get("strict_mode", False)
                found = shutil.which(exe)
                if not found:
                    if strict:
                        details.append(f"Scanner '{name}' executable not found: {exe}")
                        total_violations += 1
                    else:
                        details.append(f"Scanner '{name}' not available (skipped)")
                    continue
                cmd = settings.get("cmd", "")
                if cmd:
                    cmd = cmd.replace("{changed_dir}", changed_dir)
                    cmd = cmd.replace("{changed_files}", changed_files_str)
                    code, _out, _err = _run_command(cmd)
                    if code != 0:
                        if strict:
                            details.append(f"External scanner {name} found issues")
                            total_violations += 1
                        else:
                            details.append(
                                f"Scanner '{name}' found issues (non-strict, noted)"
                            )

    if total_violations == 0:
        return (
            StepResult.PASS,
            f"No production violations in {len(source_files)} source files",
        )
    return (
        StepResult.FAIL,
        f"{total_violations} production violations: {'; '.join(details[:10])}",
    )


def _step_mutation_testing(
    changed_files: list[Path],
    config: dict | None = None,
) -> tuple[StepResult, str]:
    """Step 13: Run mutation testing on changed Python files.

    Uses mutmut to generate mutants and verify that the test suite catches them.
    Skips gracefully if mutmut is not installed. Configurable via workflow.json:
      mutation_testing.threshold (float, 0-100): minimum mutation score to pass (default 80.0)
      mutation_testing.timeout_s (int): per-file timeout in seconds (default 120)
    """
    py_files = [f for f in changed_files if f.suffix == ".py" and f.is_file()]
    # Exclude test files — only mutate production code
    py_files = [
        f
        for f in py_files
        if not f.name.startswith("test_") and "tests/" not in str(f).replace("\\", "/")
    ]
    if not py_files:
        return StepResult.SKIP, "No Python production files to mutate"

    # Check if mutmut is available
    if not shutil.which("mutmut"):
        return (
            StepResult.SKIP,
            "mutmut not installed (pip install mutmut to enable mutation testing)",
        )

    # Configuration
    threshold = 80.0
    timeout_s = 120
    if config:
        mt_config = config.get("mutation_testing", {})
        threshold = float(mt_config.get("threshold", 80.0))
        timeout_s = int(mt_config.get("timeout_s", 120))

    results: list[str] = []
    total_survived = 0
    total_killed = 0

    for f in py_files[:5]:  # Cap at 5 files to avoid excessive runtime
        cmd = f"mutmut run --paths-to-mutate {f} --no-progress"
        code, stdout, stderr = _run_command(cmd, timeout=timeout_s)

        # Parse results from mutmut output
        output = stdout or stderr or ""
        # Look for summary line like "X killed, Y survived"
        killed_match = re.search(r"(\d+)\s+killed", output, re.IGNORECASE)
        survived_match = re.search(r"(\d+)\s+survived", output, re.IGNORECASE)

        killed = int(killed_match.group(1)) if killed_match else 0
        survived = int(survived_match.group(1)) if survived_match else 0

        total_killed += killed
        total_survived += survived
        total = killed + survived
        score = (killed / total * 100) if total > 0 else 100.0
        results.append(f"{f.name}: {score:.0f}% ({killed}/{total})")

    total = total_killed + total_survived
    overall_score = (total_killed / total * 100) if total > 0 else 100.0

    evidence = f"Mutation score: {overall_score:.1f}% — {'; '.join(results)}"

    if overall_score < threshold:
        return (
            StepResult.FAIL,
            f"{evidence} (threshold: {threshold}%)",
        )
    return StepResult.PASS, evidence


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
    base_steps: list[int | dict] = list(range(1, 14))

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
    cmd = step_def.get("command", "")

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


def _compute_receipt_hash(
    steps: list[dict],
    story_id: str,
    attempt: int,
    overall_result: str,
    phase_type: str | None,
) -> str:
    """Return a SHA-256 hex digest (64 chars) of the receipt inputs.

    The hash changes when any of the five input fields changes.
    Serialisation uses json.dumps(sort_keys=True) for determinism.
    """
    import hashlib as _hashlib

    payload = json.dumps(
        {
            "steps": steps,
            "story_id": story_id,
            "attempt": attempt,
            "overall_result": overall_result,
            "phase_type": phase_type,
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

    receipt = {
        "receipt_hash": output.get("receipt_hash", ""),
        "story_id": story_id,
        "attempt": attempt,
        "timestamp": output.get("timestamp", datetime.now(timezone.utc).isoformat()),
        "phase_type": output.get("phase_type"),
        "overall_result": output.get("overall_result", "FAIL"),
        "steps": output.get("steps", []),
        "criteria_verified": output.get("criteria_verified", []),
        "production_violations": output.get("production_violations", 0),
        "drift_warnings": output.get("drift_warnings", 0),
        "receipt_version": "2",
    }

    receipt_file.write_text(json.dumps(receipt, indent=2), encoding="utf-8")
    return str(receipt_file)


def main() -> None:
    """Main entry point for the QA runner."""
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
    changed_files = _parse_changed_files(args.changed_files)
    test_dir = Path(args.test_dir) if args.test_dir else None
    checkpoint = args.checkpoint
    plan_path = Path(args.plan) if args.plan else None
    phase_type: str | None = args.phase_type
    # Normalize unknown phase_types to None so they run the default step set
    if phase_type is not None and phase_type not in VALID_PHASE_TYPES:
        phase_type = None

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

    # Startup warning: if project files (outside .claude/) are changed but
    # project_test is still a placeholder, surface a WARNING to stderr.
    # This does not fail the pipeline — it is informational only.
    if _has_outside_claude_files(changed_files):
        unconfigured = check_project_commands(config)
        if unconfigured:
            for key in unconfigured:
                sys.stderr.write(
                    f"WARNING: {key} not configured — host project code will not be"
                    f" tested by QA pipeline. Set {key} in .claude/workflow.json.\n"
                )
            audit_log(
                "qa_runner",
                "project_commands_unconfigured",
                f"Outside-.claude/ files changed but unconfigured: {unconfigured}",
            )

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
    output: dict = {  # type: ignore[no-redef]
        "story_id": args.story,
        "timestamp": timestamp,
        "phase_type": phase_type,
        "steps": step_results,
        "overall_result": overall,
        "criteria_verified": criteria_verified,
        "production_violations": production_violation_count,
        "drift_warnings": drift_warning_count,
    }

    # Compute receipt hash over the core fields
    receipt_hash = _compute_receipt_hash(
        step_results, args.story, 1, overall, phase_type
    )
    output["receipt_hash"] = receipt_hash

    # Write receipt file and record its path
    try:
        receipt_path = _write_receipt(output, args.story, 1)
        output["receipt_path"] = receipt_path
    except OSError:
        output["receipt_path"] = ""

    sys.stdout.write(json.dumps(output, indent=2) + "\n")
    if overall == "PASS":
        clear_marker()
    sys.exit(1 if overall == "FAIL" else 0)


if __name__ == "__main__":
    main()
