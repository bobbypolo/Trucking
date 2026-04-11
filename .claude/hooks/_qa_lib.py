"""QA engine: test-quality scanning, R-marker validation, story coverage, plan sync, verification logs.

Consumers: qa_runner.py, test_quality.py, /verify, /audit, /cleanup, ralph-worker.
"""

import hashlib
import json
import re
import shutil
import subprocess
from dataclasses import dataclass
from enum import Enum
from pathlib import Path

from _lib import (  # noqa: F401
    CODE_EXTENSIONS,
    PROJECT_ROOT,
    audit_log,
    load_workflow_config,
)

# ── Regex Patterns and Constants ──────────────────────────────────────────────

_TEST_FUNC_RE = re.compile(r"^[ \t]*(?:async\s+)?def\s+(test_\w+)\s*\(", re.MULTILINE)
_ASSERT_RE = re.compile(
    r"\bassert\b|\bassertEqual\b|\bassertTrue\b|\bassertRaises\b"
    r"|\bexpect\b|\bshould\b|\bverify\b|\.assert_called|\.assert_not_called"
    r"|\bpytest\.raises\b|\bAssertionError\b"
)
_SELF_MOCK_RE = re.compile(r"""(?:patch|mock\.patch)\s*\(\s*['"]([^'"]+)['"]\s*\)""")
# Count all mock/patch usages in a test body (decorators, context managers, assignments)
_MOCK_USAGE_RE = re.compile(
    r"\bpatch\s*\(|\bMagicMock\s*\(|\bMock\s*\(|\bcreate_autospec\s*\(|\bpatch\.object\s*\("
)
_MOCK_ASSERT_RE = re.compile(
    r"\.assert_called|\bassert_called_once\b|\bassert_called_with\b"
    r"|\bassert_any_call\b|\bassert_has_calls\b|\.assert_not_called"
)

# Weak assertion patterns: assertions that prove almost nothing.
# Matches: assert x is not None, assert x (bare truthiness), assertTrue(result),
#          assert isinstance(x, T), assert len(x) > 0, assert callable(x),
#          assert hasattr(x, "attr")
# Does NOT match: assertEqual, assert x == value, assertRaises, assert x in y
_WEAK_ASSERT_RE = re.compile(
    r"\bassert\s+\w+\s+is\s+not\s+None\b"  # assert x is not None
    r"|\bassert\s+\w+\s*$"  # assert x (bare truthiness, end of line)
    r"|\bassertTrue\s*\(\s*\w+\s*\)"  # assertTrue(result) with no comparison
    r"|\bassert\s+isinstance\s*\("  # assert isinstance(x, T)
    r"|\bassert\s+len\s*\([^)]*\)\s*>\s*0"  # assert len(x) > 0
    r"|\bassert\s+callable\s*\("  # assert callable(x)
    r"|\bassert\s+hasattr\s*\("  # assert hasattr(x, "attr")
)
# Strong assertion patterns that should NOT be flagged as weak.
_STRONG_ASSERT_RE = re.compile(
    r"\bassertEqual\b"
    r"|\bassertRaises\b"
    r"|\bassert\s+\w+(?:\.\w+)*\s*==\s*"  # assert x == value / assert obj.attr == value
    r"|\bassert\s+\w+(?:\.\w+)*\s*!=\s*"  # assert x != value / assert obj.attr != value
    r"|\bassert\s+\w+\s*>\s*"  # assert x > value
    r"|\bassert\s+\w+\s*<\s*"  # assert x < value
    r"|\bassert\s+\w+\s*>=\s*"  # assert x >= value
    r"|\bassert\s+\w+\s*<=\s*"  # assert x <= value
    r"|\bassert\s+\w+(?:\.\w+)*\s+in\s+"  # assert x in y / assert obj.attr in y
    r"|\bassert\s+\w+(?:\.\w+)*\s+not\s+in\s+"  # assert x not in y
    r"|\bassert\s+\w+(?:\.\w+)*\s+is\s+(?!not\s+None\b)\w"  # assert x is y (excludes is not None)
    # Function call equality (with nested parens): assert len(x) == 64, assert set(x.keys()) == {...}
    # Uses [!=]= (only == and !=) to avoid overriding weak patterns like assert len(x) > 0
    r"|\bassert\s+\w+\s*\([^)]*(?:\([^)]*\)[^)]*)*\)\s*[!=]=\s*"
    # Subscript equality: assert result[0] == "value", assert output["key"] == val
    r"|\bassert\s+\w+\s*\[[^\]]*\]\s*[!=]=\s*"
    # Subscript membership: assert output["key"] in (...), assert step["result"] in (...)
    r"|\bassert\s+\w+\s*\[[^\]]*\]\s+in\s+"
    # String/literal in collection: assert "key" in output
    r'|\bassert\s+["\'][^"\']+["\']\s+in\s+'
    # pytest.raises as assertion
    r"|\bpytest\.raises\s*\("
    # assert all(...) / assert any(...) — aggregate checks
    r"|\bassert\s+all\s*\("
    r"|\bassert\s+any\s*\("
    # raise AssertionError pattern (try/except assertion style)
    r"|\braise\s+AssertionError\b"
    # negated function/method calls: assert not func(args) (proves specific absence behavior)
    r"|\bassert\s+not\s+\w[\w.]*\s*\("
)

# Keywords in test function names that indicate negative/error/edge testing.
_NEGATIVE_TEST_KEYWORDS: frozenset[str] = frozenset(
    {
        "invalid",
        "error",
        "fail",
        "reject",
        "edge",
        "boundary",
        "malformed",
        "negative",
    }
)

# Keywords in criterion text that indicate validation behavior.
_VALIDATION_KEYWORDS: frozenset[str] = frozenset(
    {
        "validate",
        "reject",
        "filter",
        "boundary",
        "limit",
        "invalid",
        "error",
    }
)

# Behavioral assertion patterns: assertions that check a specific value or outcome.
# Matches: assertEqual, assert x == val, assert x != val, assert x in y,
#          pytest.raises, assertRaises.
# Does NOT match: assert isinstance(), assert x is not None, assert len(x) > 0,
#                 assertTrue(x) — these are structural/existence checks only.
#
# re.DOTALL is set so that ``.`` matches newlines. This lets the regex recognise
# Python's natural multi-line assertion style::
#
#     assert (
#         computed_value()
#         == expected_value
#     )
#
# without treating the wrapped form as a missing behavioural assertion. The
# ``.+?`` alternatives are already non-greedy, so DOTALL does not over-match
# across unrelated statements in a function body.
_BEHAVIORAL_ASSERT_RE = re.compile(
    r"\bassertEqual\s*\("  # assertEqual(a, b)
    r"|\bassertRaises\s*\("  # assertRaises(Exc, ...) / self.assertRaises(...)
    r"|\bpytest\.raises\s*\("  # pytest.raises(Exc)
    r"|\bassert\s+.+?(?:==|!=)\s*"  # assert <expr> == val / assert <expr> != val (equality)
    # in/not in with variable, subscript, or string literal
    # String literals may start with non-word chars (e.g., "--flag", "key=val") so use [^"']+ not \w
    r"|(?:\bassert\s+(?:\w[\w.\[\]()]*|[\"'][^\"']+[\"'])\s+(?:not\s+)?in\s+)"
    # Subscript in: assert obj["key"] in set / assert result[0] in valid  (quotes inside brackets)
    r"|\bassert\s+\w+\s*\[[^\]]*\]\s+(?:not\s+)?in\s+"
    # Constructor/function-result in: assert Path("x") in result / assert func(arg) in collection
    r"|\bassert\s+\w+\s*\([^)]*\)\s+(?:not\s+)?in\s+"
    # Negated variable: assert not var / assert not var, "message" (checks specific falsy outcome)
    r"|\bassert\s+not\s+\w+\s*(?:,|$)"
    # negated function/method calls: assert not func(args) (proves specific absence behavior)
    r"|\bassert\s+not\s+\w[\w.]*\s*\("
    # Specific boolean: assert expr is True / assert expr is False / assert expr is None
    # Matches any assert statement ending with specific value comparisons (behavioral result checks)
    r"|\bassert\s+.+?\s+is\s+(?:True|False|None)\b",
    re.DOTALL,
)

# Regex to extract public function definitions from a Python source file.
_PUBLIC_FUNC_RE = re.compile(r"^def\s+([a-zA-Z]\w*)\s*\(", re.MULTILINE)

# ── Test Quality Scanning ──────────────────────────────────────────────────────

# Calls to skip when counting real (non-mock) dependencies in heavy-mock detection.
# Excludes mock infrastructure, built-ins, and common method calls that are not
# real external dependencies.
_SKIP_CALLS: frozenset[str] = frozenset(
    {
        # Mock-related
        "patch",
        "MagicMock",
        "Mock",
        "create_autospec",
        # Assert-related
        "assert",
        "assertEqual",
        "assertTrue",
        "assertFalse",
        "assertRaises",
        "assertIn",
        "assertIsNone",
        # Built-in functions (not real dependencies)
        "len",
        "str",
        "int",
        "float",
        "bool",
        "list",
        "dict",
        "set",
        "tuple",
        "type",
        "isinstance",
        "print",
        "range",
        "enumerate",
        "zip",
        "map",
        "filter",
        "sorted",
        "reversed",
        "min",
        "max",
        "sum",
        "any",
        "all",
        "abs",
        "round",
        "hash",
        "id",
        "repr",
        "format",
        "super",
        "next",
        "iter",
        # Common method calls (not dependencies)
        "append",
        "extend",
        "update",
        "get",
        "items",
        "keys",
        "values",
        "join",
        "split",
        "strip",
        "replace",
        # Mock attribute access
        "return_value",
        "side_effect",
        "assert_called",
        "assert_called_once",
        "assert_called_with",
    }
)


def _parse_test_func_bodies(content: str) -> dict[str, str]:
    """Parse test function bodies from a Python source string.

    Handles both module-level functions (indent=0) and class methods (indent>0).
    Correctly skips multi-line signatures before starting body-end detection.
    Tracks triple-quoted string context to avoid false body termination when
    heredoc-style strings contain unindented lines (indent 0).

    Returns:
        Dict mapping test function name to its full source text (including def line).
    """
    if not content:
        return {}

    lines = content.splitlines()
    func_bodies: dict[str, str] = {}
    current_func: str | None = None
    current_lines: list[str] = []
    current_indent: int = 0
    in_signature: bool = False
    in_triple_quote: bool = False

    for line in lines:
        # Track triple-quoted string boundaries (""" or ''').
        # An odd count of triple-quote delimiters toggles the state.
        tq_count = line.count('"""') + line.count("'''")

        if in_triple_quote:
            # Inside multi-line string — collect line, don't interpret
            if current_func is not None:
                current_lines.append(line)
            if tq_count % 2 == 1:
                in_triple_quote = False
            continue

        # Check if this line opens a triple-quote without closing it
        if tq_count % 2 == 1:
            in_triple_quote = True

        match = re.match(r"^([ \t]*)(?:async\s+)?def\s+(test_\w+)\s*\(", line)
        if match:
            if current_func is not None:
                func_bodies[current_func] = "\n".join(current_lines)
            current_func = match.group(2)
            current_indent = len(match.group(1).expandtabs(4))
            current_lines = [line]
            # Check if signature closes on same line (single-line def)
            # Signature ends when we see ')' followed by ':' (with optional return type)
            no_comment = line.split("#")[0]
            in_signature = not (
                ")" in no_comment and ":" in no_comment.rsplit(")", 1)[-1]
            )
        elif in_signature:
            # Still inside multi-line function signature -- wait for ')...:'
            current_lines.append(line)
            no_comment = line.split("#")[0]
            if ")" in no_comment and ":" in no_comment.rsplit(")", 1)[-1]:
                in_signature = False
        elif current_func is not None:
            # End of function: a non-blank line at same or lesser indent
            stripped = line.rstrip()
            if stripped:
                line_indent = len(line) - len(line.lstrip())
                line_indent = len(line[:line_indent].expandtabs(4))
                if line_indent <= current_indent and not stripped.startswith("#"):
                    func_bodies[current_func] = "\n".join(current_lines)
                    current_func = None
                    current_lines = []
                else:
                    current_lines.append(line)
            else:
                current_lines.append(line)

    if current_func is not None:
        func_bodies[current_func] = "\n".join(current_lines)

    return func_bodies


def _check_assertion_free(body: str) -> bool:
    """Return True if the test function body contains no assertion patterns."""
    return not bool(_ASSERT_RE.search(body))


def _check_self_mock(func_name: str, body: str) -> bool:
    """Return True if the test mocks the function it claims to test.

    Skipped when the body contains a ``# noqa: self-mock`` pragma, which
    marks legitimate side-effect observation (not a self-mock violation).
    """
    if "# noqa: self-mock" in body:
        return False
    patched = _SELF_MOCK_RE.findall(body)
    test_suffix = func_name.replace("test_", "", 1)
    for patch_target in patched:
        target_func = patch_target.rsplit(".", 1)[-1]
        if target_func == test_suffix or target_func in func_name:
            return True
    return False


def _check_mock_only(body: str) -> bool:
    """Return True if the test only has mock assertions and no real value assertions."""
    has_mock_assert = bool(_MOCK_ASSERT_RE.search(body))
    has_real_assert = bool(
        re.search(r"\bassert\s+\w|\bassert\s*\(|\bassertEqual\b", body)
    )
    return has_mock_assert and not has_real_assert


def _check_heavy_mock(body: str, func_name: str, threshold: float) -> bool:
    """Return True if >threshold fraction of dependencies in the test body are mocked.

    Only evaluated when mock_count >= 3 (avoids false positives on lightly mocked tests).
    Uses module-level ``_SKIP_CALLS`` to exclude built-ins and mock infrastructure
    when counting real (non-mock) call sites.
    """
    mock_count = len(_MOCK_USAGE_RE.findall(body))
    if mock_count < 3:
        return False
    all_calls = re.findall(r"\b(\w+)\s*\(", body)
    real_calls = [c for c in all_calls if c not in _SKIP_CALLS and c != func_name]
    total_deps = mock_count + len(real_calls)
    return total_deps > 0 and (mock_count / total_deps) > threshold


def _check_weak_assertions(body: str) -> bool:
    """Return True if the body contains only weak (truthiness/existence) assertions.

    Returns False for assertion-free tests (those are flagged by _check_assertion_free).
    Returns False when at least one strong (value-comparing) assertion is present.
    """
    if not body or not _ASSERT_RE.search(body):
        return False
    has_weak = bool(_WEAK_ASSERT_RE.search(body))
    has_strong = bool(_STRONG_ASSERT_RE.search(body))
    return has_weak and not has_strong


def scan_test_quality(filepath: Path, config: dict | None = None) -> dict:
    """Analyze a test file for quality anti-patterns."""
    file_str = str(filepath)

    try:
        content = filepath.read_text(encoding="utf-8")
    except (OSError, UnicodeDecodeError, ValueError):
        return {"file": file_str, "tests_found": 0, "quality_score": "SKIP"}

    test_names = _TEST_FUNC_RE.findall(content)
    if not test_names:
        return {
            "file": file_str,
            "tests_found": 0,
            "assertion_free_tests": [],
            "self_mock_tests": [],
            "mock_only_tests": [],
            "weak_assertion_tests": [],
            "happy_path_only": True,
            "negative_test_count": 0,
            "negative_test_pct": 0,
            "negative_test_names": [],
            "quality_score": "PASS",
        }

    func_bodies = _parse_test_func_bodies(content)

    # Read heavy-mock threshold once from config, pass to per-test checker.
    heavy_mock_threshold = (
        float((config or {}).get("qa_runner", {}).get("heavy_mock_threshold_pct", 80))
        / 100.0
    )

    assertion_free: list[str] = []
    self_mock: list[str] = []
    mock_only: list[str] = []
    weak_assertion: list[str] = []
    heavy_mock: list[str] = []
    behavioral_assertion_missing: list[str] = []

    for func_name in test_names:
        body = func_bodies.get(func_name, "")

        if _check_assertion_free(body):
            assertion_free.append(func_name)

        if _check_self_mock(func_name, body):
            self_mock.append(func_name)

        if _check_mock_only(body):
            mock_only.append(func_name)

        if _check_heavy_mock(body, func_name, heavy_mock_threshold):
            heavy_mock.append(func_name)

        if _check_weak_assertions(body):
            weak_assertion.append(func_name)

        # Check behavioral assertions: test has assertions but none check a specific value.
        # Skip assertion-free tests (already flagged separately).
        # Skip functions with a "noqa: behavioral" pragma in body.
        if body and _ASSERT_RE.search(body):
            if "# noqa: behavioral" not in body:
                if not _BEHAVIORAL_ASSERT_RE.search(body):
                    behavioral_assertion_missing.append(func_name)

    # Happy-path-only detection: check if ANY test name contains a negative keyword.
    negative_test_names_found: list[str] = [
        name
        for name in test_names
        if any(keyword in name.lower() for keyword in _NEGATIVE_TEST_KEYWORDS)
    ]
    negative_test_count = len(negative_test_names_found)
    total_tests = len(test_names)
    negative_test_pct = (
        round((negative_test_count / total_tests) * 100) if total_tests > 0 else 0
    )
    happy_path_only = negative_test_count == 0

    has_issues = bool(
        assertion_free
        or self_mock
        or mock_only
        or weak_assertion
        or heavy_mock
        or behavioral_assertion_missing
    )
    quality_score = "FAIL" if has_issues else "PASS"

    return {
        "file": file_str,
        "tests_found": total_tests,
        "assertion_free_tests": assertion_free,
        "self_mock_tests": self_mock,
        "mock_only_tests": mock_only,
        "weak_assertion_tests": weak_assertion,
        "heavy_mock_tests": heavy_mock,
        "behavioral_assertion_missing": behavioral_assertion_missing,
        "happy_path_only": happy_path_only,
        "negative_test_count": negative_test_count,
        "negative_test_pct": negative_test_pct,
        "negative_test_names": negative_test_names_found,
        "quality_score": quality_score,
    }


def check_negative_tests(criterion_text: str, test_names: list[str]) -> dict:
    """Check whether a validation criterion has negative/error/edge tests."""
    criterion_lower = criterion_text.lower()
    needs_negative = any(kw in criterion_lower for kw in _VALIDATION_KEYWORDS)

    if not needs_negative:
        return {
            "needs_negative": False,
            "has_negative": False,
            "result": "PASS",
        }

    # Check if any test name contains a negative keyword
    has_negative = any(
        keyword in name.lower()
        for name in test_names
        for keyword in _NEGATIVE_TEST_KEYWORDS
    )

    return {
        "needs_negative": True,
        "has_negative": has_negative,
        "result": "PASS" if has_negative else "WARN",
    }


def check_complexity(
    changed_files: list[Path],
    config: dict,
    checkpoint: str | None = None,
) -> dict:
    """Check cyclomatic complexity of changed Python source files using radon.

    Returns a dict with keys:
        result: "SKIP" | "PASS" | "WARN" | "FAIL"
        reason: str (present when result is SKIP)
        high_complexity: list of dicts with keys file, func, complexity, grade
    """
    if not shutil.which("radon"):
        return {"result": "SKIP", "reason": "radon not installed"}

    complexity_cfg = config.get("complexity", {})
    warn_threshold: int = int(complexity_cfg.get("warn_threshold", 10))
    fail_threshold: int = int(complexity_cfg.get("fail_threshold", 25))

    # Filter to Python production files only (skip tests and non-Python)
    py_files = [
        f
        for f in changed_files
        if f.suffix == ".py"
        and not f.name.startswith("test_")
        and not f.name.endswith("_test.py")
        and f.is_file()
    ]

    if not py_files:
        return {"result": "SKIP", "reason": "no Python source files to analyse"}

    high_complexity: list[dict] = []
    failed: list[dict] = []

    for py_file in py_files:
        try:
            proc = subprocess.run(
                ["radon", "cc", "-j", str(py_file)],
                capture_output=True,
                text=True,
                timeout=30,
            )
        except (OSError, subprocess.TimeoutExpired):
            continue

        if proc.returncode != 0 or not proc.stdout.strip():
            continue

        try:
            data = json.loads(proc.stdout)
        except json.JSONDecodeError:
            continue

        # radon cc -j returns {filepath: [block, ...]}
        for _filepath, blocks in data.items():
            if not isinstance(blocks, list):
                continue
            for block in blocks:
                complexity_val = block.get("complexity", 0)
                grade = block.get("rank", "A")
                name = block.get("name", "<unknown>")
                if complexity_val > warn_threshold:
                    entry = {
                        "file": str(py_file),
                        "func": name,
                        "complexity": complexity_val,
                        "grade": grade,
                    }
                    if complexity_val > fail_threshold:
                        failed.append(entry)
                    else:
                        high_complexity.append(entry)

    if checkpoint is not None:
        diff_added = extract_diff_added_identifiers(checkpoint, changed_files)
        high_complexity = [
            e
            for e in high_complexity
            if e["func"] in diff_added.get(Path(e["file"]).as_posix(), [])
        ]
        failed = [
            e
            for e in failed
            if e["func"] in diff_added.get(Path(e["file"]).as_posix(), [])
        ]

    all_flagged = failed + high_complexity
    if failed:
        return {"result": "FAIL", "high_complexity": all_flagged}
    if high_complexity:
        return {"result": "WARN", "high_complexity": all_flagged}
    return {"result": "PASS", "high_complexity": []}


def check_public_api_coverage(test_file: Path, prod_file: Path) -> dict:
    """Check how many public functions in prod_file are referenced in test_file."""
    empty_result: dict = {
        "total_public": 0,
        "covered": 0,
        "uncovered": [],
        "coverage_pct": 0.0,
    }

    try:
        prod_content = prod_file.read_text(encoding="utf-8")
    except (OSError, UnicodeDecodeError, ValueError):
        return dict(empty_result)

    try:
        test_content = test_file.read_text(encoding="utf-8")
    except (OSError, UnicodeDecodeError, ValueError):
        return dict(empty_result)

    # Extract public function names (not starting with underscore)
    public_funcs = _PUBLIC_FUNC_RE.findall(prod_content)
    if not public_funcs:
        return dict(empty_result)

    total_public = len(public_funcs)
    covered_funcs: list[str] = []
    uncovered_funcs: list[str] = []

    for func_name in public_funcs:
        if func_name in test_content:
            covered_funcs.append(func_name)
        else:
            uncovered_funcs.append(func_name)

    covered_count = len(covered_funcs)
    coverage_pct = (covered_count / total_public) * 100.0 if total_public > 0 else 0.0

    return {
        "total_public": total_public,
        "covered": covered_count,
        "uncovered": uncovered_funcs,
        "coverage_pct": coverage_pct,
    }


_DEFAULT_PUBLIC_API_COVERAGE_THRESHOLD = 90.0


def check_diff_public_api_coverage(
    changed_files: list[Path],
    test_dir: Path,
    config: dict | None = None,
) -> dict:
    """Check that new/modified public functions in changed_files appear in test files.

    Filters changed_files to production Python files, extracts public function names
    via _PUBLIC_FUNC_RE, and checks each name appears in at least one test file under
    test_dir via string-in-file search.

    Returns a dict with keys:
        result       – "PASS", "FAIL", or "SKIP"
        coverage_pct – float percentage (covered / total_public * 100)
        total_public – int count of public functions found
        covered      – int count of public functions found in test files
        uncovered    – list[str] of uncovered function names
        threshold    – float threshold used for comparison

    Returns {"result": "SKIP"} when no production files exist in changed_files,
    test_dir is missing, or no public functions are found.
    """
    _skip: dict = {"result": "SKIP"}

    # Validate test_dir early
    if not test_dir.is_dir():
        return _skip

    # Filter to production Python files only
    prod_files: list[Path] = []
    for f in changed_files:
        if f.suffix != ".py":
            continue
        name_lower = f.name.lower()
        if name_lower.startswith("test_") or name_lower.endswith("_test.py"):
            continue
        if name_lower == "conftest.py":
            continue
        prod_files.append(f)

    if not prod_files:
        return _skip

    # Collect all public function names from changed production files
    public_funcs: list[str] = []
    for prod_file in prod_files:
        try:
            content = prod_file.read_text(encoding="utf-8")
        except (OSError, UnicodeDecodeError, ValueError):
            continue
        public_funcs.extend(_PUBLIC_FUNC_RE.findall(content))

    if not public_funcs:
        return _skip

    # Read all test file contents from test_dir
    test_contents: list[str] = []
    for test_file in sorted(test_dir.rglob("test_*.py")):
        try:
            test_contents.append(test_file.read_text(encoding="utf-8"))
        except (OSError, UnicodeDecodeError, ValueError):
            continue

    # Check each public function name against test file content
    covered_funcs: list[str] = []
    uncovered_funcs: list[str] = []
    for func_name in public_funcs:
        found = any(func_name in tc for tc in test_contents)
        if found:
            covered_funcs.append(func_name)
        else:
            uncovered_funcs.append(func_name)

    total_public = len(public_funcs)
    covered_count = len(covered_funcs)
    coverage_pct = (covered_count / total_public) * 100.0

    threshold = float(
        (config or {})
        .get("qa_runner", {})
        .get("min_public_api_coverage_pct", _DEFAULT_PUBLIC_API_COVERAGE_THRESHOLD)
    )

    result = "PASS" if coverage_pct >= threshold else "FAIL"
    return {
        "result": result,
        "coverage_pct": coverage_pct,
        "total_public": total_public,
        "covered": covered_count,
        "uncovered": uncovered_funcs,
        "threshold": threshold,
    }


def verify_production_calls(
    test_files: list[Path],
    source_files: list[Path],
    min_coverage_pct: float = 80.0,
) -> dict:
    """Check that tests call at least min_coverage_pct of public functions in source files.

    Returns:
        dict with keys: result ("PASS"/"FAIL"/"SKIP"), coverage_pct (float),
        total_functions (int), tested_functions (int), untested_functions (list[str]).
    Returns SKIP if no source files, no public functions found, or test_files is empty.
    """
    _skip: dict = {
        "result": "SKIP",
        "coverage_pct": 0.0,
        "total_functions": 0,
        "tested_functions": 0,
        "untested_functions": [],
    }

    if not source_files:
        return _skip

    # Collect all public function names from source files
    public_funcs: list[str] = []
    for src in source_files:
        try:
            content = src.read_text(encoding="utf-8")
        except (OSError, UnicodeDecodeError, ValueError):
            continue
        public_funcs.extend(_PUBLIC_FUNC_RE.findall(content))

    if not public_funcs:
        return _skip

    # Read all test file contents
    test_contents: list[str] = []
    for tf in test_files:
        try:
            test_contents.append(tf.read_text(encoding="utf-8"))
        except (OSError, UnicodeDecodeError, ValueError):
            continue

    # Count which public functions appear in any test file
    tested: list[str] = []
    untested: list[str] = []
    for func_name in public_funcs:
        if any(
            re.search(r"\b" + re.escape(func_name) + r"\s*\(", tc)
            for tc in test_contents
        ):
            tested.append(func_name)
        else:
            untested.append(func_name)

    total = len(public_funcs)
    covered = len(tested)
    coverage_pct = (covered / total) * 100.0 if total > 0 else 0.0
    result = "PASS" if coverage_pct >= min_coverage_pct else "FAIL"

    return {
        "result": result,
        "coverage_pct": coverage_pct,
        "total_functions": total,
        "tested_functions": covered,
        "untested_functions": untested,
    }


def _validate_r_marker_assertion_quality(
    test_dir: Path, criterion_id: str, test_file_path: str
) -> tuple[str, str]:
    """Check that the test linked to criterion_id has strong (non-weak) assertions.

    Locates the test file at test_dir / basename(test_file_path), finds the test
    function(s) containing criterion_id in their docstring, and verifies they have
    at least one strong assertion (not just weak truthiness/existence checks).

    Returns:
        ("PASS", reason) when test is found and has strong assertions.
        ("FAIL", reason) when test is missing, has no assertions, or only weak assertions.
    """
    # Resolve test file path: use basename in test_dir
    candidate = Path(test_file_path)
    resolved = test_dir / candidate.name
    if not resolved.is_file():
        # Try the path as given (in case it's relative to test_dir)
        alt = test_dir / test_file_path
        if alt.is_file():
            resolved = alt
        else:
            return "FAIL", f"Test file not found: {test_file_path}"

    try:
        content = resolved.read_text(encoding="utf-8")
    except (OSError, UnicodeDecodeError, ValueError):
        return "FAIL", f"Cannot read test file: {test_file_path}"

    # Find test functions that reference criterion_id in their body/docstring
    func_bodies = _parse_test_func_bodies(content)
    matching: list[str] = []
    for func_name, body in func_bodies.items():
        if criterion_id in body:
            matching.append(func_name)

    if not matching:
        return (
            "FAIL",
            f"No test function found referencing {criterion_id} in {test_file_path}",
        )

    # Check each matching test — all must have strong assertions
    failures: list[str] = []
    for func_name in matching:
        body = func_bodies[func_name]
        if _check_assertion_free(body):
            failures.append(f"{func_name}: no assertions")
        elif _check_weak_assertions(body):
            failures.append(f"{func_name}: only weak assertions")

    if failures:
        return "FAIL", "; ".join(failures)

    return (
        "PASS",
        f"All {len(matching)} test(s) for {criterion_id} have strong assertions",
    )


_COVERAGE_FLOOR = 80.0


def check_story_file_coverage(
    changed_files: list[Path], test_dir: Path, config: dict | None = None
) -> dict:
    """Check that changed production files have corresponding test files."""
    if not test_dir.is_dir():
        return {
            "result": "SKIP",
            "coverage_pct": 0.0,
            "tested": 0,
            "total_prod": 0,
            "untested": [],
        }

    # Filter to production code files only (exclude test files and non-code)
    prod_files: list[Path] = []
    for f in changed_files:
        if f.suffix not in CODE_EXTENSIONS:
            continue
        name_lower = f.name.lower()
        if name_lower.startswith("test_") or name_lower.endswith("_test.py"):
            continue
        if name_lower == "conftest.py":
            continue
        prod_files.append(f)

    if not prod_files:
        return {
            "result": "SKIP",
            "coverage_pct": 0.0,
            "tested": 0,
            "total_prod": 0,
            "untested": [],
        }

    # Collect all test files and their contents for import-based detection
    test_file_stems: set[str] = set()
    test_file_contents: dict[str, str] = {}
    for tf in sorted(test_dir.rglob("test_*.py")):
        # Extract the module name from test_<module>.py
        stem = tf.stem
        if stem.startswith("test_"):
            module_stem = stem[5:]  # Remove "test_" prefix
            test_file_stems.add(module_stem)
        try:
            test_file_contents[str(tf)] = tf.read_text(encoding="utf-8")
        except (OSError, UnicodeDecodeError, ValueError):
            continue  # Skip unreadable test files

    tested: list[str] = []
    untested: list[str] = []

    for pf in prod_files:
        module_stem = pf.stem  # e.g., "module_a" from "module_a.py"
        is_covered = False

        # Check 1: naming convention (test_{module}.py exists)
        if module_stem in test_file_stems:
            is_covered = True

        # Check 2: import-based detection (word-boundary-aware)
        if not is_covered:
            _import_re = re.compile(
                rf"(?:^|\b)import\s+{re.escape(module_stem)}\b"
                rf"|(?:^|\b)from\s+{re.escape(module_stem)}\b",
                re.MULTILINE,
            )
            for _, content in test_file_contents.items():
                if _import_re.search(content):
                    is_covered = True
                    break

        if is_covered:
            tested.append(str(pf))
        else:
            untested.append(str(pf))

    total_prod = len(prod_files)
    tested_count = len(tested)
    coverage_pct = (tested_count / total_prod) * 100.0 if total_prod > 0 else 0.0

    floor = float(
        (config or {}).get("qa_runner", {}).get("coverage_floor_pct", _COVERAGE_FLOOR)
    )
    result = "PASS" if coverage_pct >= floor else "FAIL"

    return {
        "result": result,
        "coverage_pct": coverage_pct,
        "tested": tested_count,
        "total_prod": total_prod,
        "untested": untested,
    }


# ── Phase 4: Tautological Detection + Assertion Density ──────────────────────

# Matches assertion expressions that compare against a numeric literal.
# Group 1: the literal value being compared against.
_ASSERT_LITERAL_RE = re.compile(
    r"\bassert\s+\w[\w.()\[\]]*\s*==\s*(-?\d+(?:\.\d+)?)\b"
    r"|\bassert\s+\w[\w.()\[\]]*\s*==\s*\"([^\"]+)\""
    r"|\bassert\s+\w[\w.()\[\]]*\s*==\s*'([^']+)'",
)

# Matches hardcoded return value literals in production functions.
# Group 1/2: the literal returned.
_RETURN_LITERAL_RE = re.compile(
    r"\breturn\s+(-?\d+(?:\.\d+)?)\b"
    r"|\breturn\s+\"([^\"]+)\""
    r"|\breturn\s+'([^']+)'",
)


def detect_tautological_assertions(
    test_file: "Path", source_file: "Path"
) -> list[dict]:
    """Detect tautological assertions where tests assert literal values matching production hardcoded returns.

    A tautological assertion is one that asserts a literal value (e.g., ``assert result == 42``)
    that exactly matches a hardcoded return value in the paired production function
    (e.g., ``return 42``). Such assertions pass trivially and do not catch regressions.

    Args:
        test_file: Path to the test file to inspect.
        source_file: Path to the paired production source file.

    Returns:
        List of dicts with keys ``test_func``, ``assertion``, ``issue``.
        Returns empty list if either file is unreadable or no matches are found.
    """
    try:
        test_content = test_file.read_text(encoding="utf-8")
        source_content = source_file.read_text(encoding="utf-8")
    except (OSError, UnicodeDecodeError, ValueError):
        return []

    # Extract all literal values returned from production functions.
    source_literals: set[str] = set()
    for m in _RETURN_LITERAL_RE.finditer(source_content):
        for grp in m.groups():
            if grp is not None:
                source_literals.add(grp)

    if not source_literals:
        return []

    # For each test function, check if any assertion literal matches a source return literal.
    func_bodies = _parse_test_func_bodies(test_content)
    results: list[dict] = []
    for func_name, body in func_bodies.items():
        for m in _ASSERT_LITERAL_RE.finditer(body):
            for grp in m.groups():
                if grp is not None and grp in source_literals:
                    results.append(
                        {
                            "test_func": func_name,
                            "assertion": m.group(0).strip(),
                            "issue": (
                                f"Tautological assertion: test asserts literal {grp!r}"
                                f" which matches hardcoded return value in production code."
                                f" This assertion cannot catch regressions if the implementation changes."
                            ),
                        }
                    )
    return results


def check_assertion_density(test_file: "Path", min_per_lines: int = 8) -> dict:
    """Check whether a test file has sufficient behavioral assertion density.

    Requires at least 1 behavioral assertion per ``min_per_lines`` lines of test code.
    A test file that is mostly setup/teardown with few actual assertions may have low
    signal-to-noise ratio.

    Args:
        test_file: Path to the test file to inspect.
        min_per_lines: Maximum allowed lines per behavioral assertion (default 8).
            A density of 1 assertion per 8 lines means: if a test file has 80 lines
            and fewer than 10 behavioral assertions, it FAIL.

    Returns:
        dict with keys:
        - ``result``: ``"PASS"`` / ``"FAIL"`` / ``"SKIP"``
        - ``name``: ``"assertion_density"``
        - ``test_lines``: number of non-blank, non-comment lines
        - ``assertion_count``: number of behavioral assertions found
        - ``density``: assertions per line ratio (assertion_count / test_lines)
    """
    try:
        content = test_file.read_text(encoding="utf-8")
    except (OSError, UnicodeDecodeError, ValueError):
        return {
            "result": "SKIP",
            "name": "assertion_density",
            "test_lines": 0,
            "assertion_count": 0,
            "density": 0.0,
        }

    lines = content.splitlines()
    # Count non-blank, non-comment lines as test lines
    test_lines = sum(
        1 for line in lines if line.strip() and not line.strip().startswith("#")
    )

    # Count behavioral assertions using the existing regex
    assertion_count = len(_BEHAVIORAL_ASSERT_RE.findall(content))

    if test_lines == 0:
        return {
            "result": "SKIP",
            "name": "assertion_density",
            "test_lines": 0,
            "assertion_count": 0,
            "density": 0.0,
        }

    density = assertion_count / test_lines

    # Need at least 1 assertion per min_per_lines lines → density >= 1/min_per_lines
    min_density = 1.0 / min_per_lines
    result = "PASS" if density >= min_density else "FAIL"

    return {
        "result": result,
        "name": "assertion_density",
        "test_lines": test_lines,
        "assertion_count": assertion_count,
        "density": density,
    }


# ── TDD Order Check ───────────────────────────────────────────────────────────

# Files matching these patterns are considered production source files.
_PROD_FILE_SUFFIXES: frozenset[str] = frozenset(CODE_EXTENSIONS)


def _is_test_file(filename: str) -> bool:
    """Return True if the filename looks like a test file."""
    name = Path(filename).name.lower()
    return (
        name.startswith("test_") or name.endswith("_test.py") or name == "conftest.py"
    )


def _is_prod_file(filename: str) -> bool:
    """Return True if the filename is a trackable production source file."""
    p = Path(filename)
    return p.suffix in _PROD_FILE_SUFFIXES and not _is_test_file(filename)


def _corresponding_test_names(prod_filename: str) -> list[str]:
    """Return candidate test file names for a given production file.

    For ``module.py`` the candidates are ``test_module.py`` and ``module_test.py``.
    For ``src/module.ts`` the candidates are ``test_module.ts`` and ``module.test.ts``.
    """
    p = Path(prod_filename)
    stem = p.stem
    suffix = p.suffix
    return [
        f"test_{stem}{suffix}",
        f"{stem}_test{suffix}",
        # Common JS/TS convention
        f"{stem}.test{suffix}",
        f"{stem}.spec{suffix}",
    ]


def check_tdd_order(
    changed_files: list[str | Path],
    checkpoint: str | None,
) -> dict:
    """Check whether new production files were committed after their test counterparts.

    Uses ``git log --diff-filter=A --name-only`` to obtain the order in which
    files were first added within the range ``[checkpoint]..HEAD``.  For each
    newly added production file, if a corresponding test file was added in a
    *later* commit, a violation is recorded.

    This is a WARN-level signal only — TDD ordering is a best-practice
    indicator, not a hard gate.

    Args:
        changed_files: Iterable of file paths that changed in the current run.
            Only files present in the git log output are evaluated.
        checkpoint: Git ref (hash/tag/branch) used as the lower boundary of the
            log range.  If ``None``, the check is skipped gracefully.

    Returns:
        A dict with keys:
            ``result``     — ``"PASS"``, ``"WARN"``, or ``"SKIP"``
            ``violations`` — list of human-readable violation strings
    """
    if checkpoint is None:
        return {"result": "SKIP", "violations": []}

    # Run: git log --diff-filter=A --name-only --format=%H <checkpoint>..HEAD
    try:
        proc = subprocess.run(
            [
                "git",
                "log",
                "--diff-filter=A",
                "--name-only",
                "--format=%H",
                f"{checkpoint}..HEAD",
            ],
            capture_output=True,
            text=True,
            timeout=30,
        )
        log_output = proc.stdout
    except OSError:
        return {"result": "SKIP", "violations": []}

    # Parse output: each block is a commit hash followed by file names, separated
    # by blank lines.
    # Build a mapping: filename -> first commit index where file was added
    # (lower index = earlier in history, i.e. index 0 = oldest commit shown).
    file_to_commit_idx: dict[str, int] = {}
    commit_idx = -1
    for line in log_output.splitlines():
        stripped = line.strip()
        if not stripped:
            continue
        # A 4-40 hex-char token marks a new commit header.
        # Git can abbreviate hashes to as few as 4 chars; full SHA-1 is 40.
        # We detect it by matching only hex characters (no path separators or dots).
        if re.fullmatch(r"[0-9a-f]{4,40}", stripped):
            commit_idx += 1
        else:
            if commit_idx >= 0:
                # Normalise to forward slashes for cross-platform consistency
                norm = stripped.replace("\\", "/")
                file_to_commit_idx[norm] = commit_idx

    violations: list[str] = []

    for raw_file in changed_files:
        filename = str(raw_file).replace("\\", "/")
        if not _is_prod_file(filename):
            continue

        prod_basename = Path(filename).name
        prod_commit = file_to_commit_idx.get(filename) or file_to_commit_idx.get(
            prod_basename
        )
        if prod_commit is None:
            # File was not newly added in this range — skip (could be a modification)
            continue

        # Find the earliest commit index of any corresponding test file
        candidates = _corresponding_test_names(filename)
        test_commit: int | None = None
        for candidate in candidates:
            candidate_basename = Path(candidate).name
            for key, idx in file_to_commit_idx.items():
                if Path(key).name == candidate_basename:
                    if test_commit is None or idx < test_commit:
                        test_commit = idx
                    break

        if test_commit is None:
            # No corresponding test file was added in this range — skip
            # (may be pre-existing test, or tests not yet written)
            continue

        if test_commit > prod_commit:
            violations.append(
                f"{prod_basename} added before its test file "
                f"(impl in commit-position {prod_commit}, "
                f"test in commit-position {test_commit})"
            )

    result = "WARN" if violations else "PASS"
    return {"result": result, "violations": violations}


# ── Scope Enforcement ─────────────────────────────────────────────────────────


def check_scope_compliance(story: dict | None, changed_files: list[Path]) -> dict:
    """Validate all changed file paths fall within the story's scope directories.

    Args:
        story: Story dict from prd.json (must have ``scope`` key with list of
               directory path prefixes). ``None`` skips the check.
        changed_files: List of changed file paths.

    Returns:
        dict with keys:
            result: "PASS" | "FAIL" | "SKIP"
            violations: list[str] — out-of-scope file paths
            scope: list[str] — the story's scope array
    """
    if story is None:
        return {"result": "SKIP", "violations": [], "scope": []}

    scope = story.get("scope", [])
    if not scope or not isinstance(scope, list):
        return {"result": "SKIP", "violations": [], "scope": []}

    exempt_names = {"__init__.py", "conftest.py"}
    # Test files are always in-scope (natural output of TDD implementation)
    _scope_exempt_prefixes = ("test_",)
    _scope_exempt_dirs = ("tests/", "test/", ".claude/hooks/tests/")
    _scope_exempt_extensions = (".md",)  # Documentation changes always allowed
    # Normalize scope entries to forward slashes. Entries that look like files
    # (have a dot in the last path component and no trailing slash) are treated
    # as exact-match entries; directory entries get a trailing slash to prevent
    # partial name matches (e.g., '.claude/hooks' vs '.claude/hooks_extra/foo.py').
    scope_dirs: list[str] = []  # prefix-match entries (directories)
    scope_files: set[str] = set()  # exact-match entries (files)
    for s in scope:
        s_n = s.replace("\\", "/")
        # Heuristic: a scope entry is a file if its basename contains a dot and
        # it does not already end with '/'.  Everything else is a directory prefix.
        basename = s_n.rstrip("/").rsplit("/", 1)[-1]
        if "." in basename and not s_n.endswith("/"):
            scope_files.add(s_n)
        else:
            if not s_n.endswith("/"):
                s_n += "/"
            scope_dirs.append(s_n)

    violations: list[str] = []
    for f in changed_files:
        p = Path(f)
        if p.name in exempt_names:
            continue
        file_posix = p.as_posix()
        # Auto-exempt test files, test directories, and documentation
        if (
            any(p.name.startswith(pfx) for pfx in _scope_exempt_prefixes)
            or any(file_posix.startswith(d) for d in _scope_exempt_dirs)
            or p.suffix in _scope_exempt_extensions
        ):
            continue
        in_dir = any(file_posix.startswith(s) for s in scope_dirs)
        exact_match = file_posix in scope_files
        if not (in_dir or exact_match):
            violations.append(file_posix)

    result = "FAIL" if violations else "PASS"
    return {"result": result, "violations": violations, "scope": list(scope)}


# ── R-Marker Validation ───────────────────────────────────────────────────────

VERIFICATION_LOG_PATH = (
    Path(__file__).resolve().parent.parent / "docs" / "verification-log.jsonl"
)

_R_MARKER_RE = re.compile(
    r"#\s*Tests?\s+(R-P\d+-\d{2}(?:-AC\d+)?(?:\s*,\s*R-P\d+-\d{2}(?:-AC\d+)?)*)"
)


def _validate_testfile_coverage(
    story: dict,
    expected_ids: set[str],
    project_root: Path,
) -> tuple[set[str], set[str], list[str]]:
    """Resolve testFile-based coverage for criteria in *story*.

    For each criterion that has a non-null ``testFile`` value, check whether
    the referenced path exists.  Directories are counted as covered immediately.
    Files are verified to contain at least one test function and (when they
    already have R-markers) a marker for the specific criterion.

    Returns:
        testfile_covered  – set of criterion IDs satisfied by testFile resolution
        testfile_missing  – set of criterion IDs whose testFile path was not found
        empty_test_files  – list of path strings whose testFile existed but had
                            no test functions
    """
    _TEST_CONTENT_RE = re.compile(
        r"(?:def\s+test_"  # Python: def test_...
        r"|(?:^|\s)it\s*\("  # JS/TS: it(
        r"|(?:^|\s)describe\s*\("  # JS/TS: describe(
        r"|(?:^|\s)test\s*\("  # JS/TS: test(
        r"|func\s+Test"  # Go: func Test...
        r")",
        re.MULTILINE,
    )
    _ID_RE_LOCAL = re.compile(r"R-P\d+-\d{2}(?:-AC\d+)?")
    testfile_covered: set[str] = set()
    testfile_missing: set[str] = set()
    empty_test_files: list[str] = []

    for criterion in story.get("acceptanceCriteria", []):
        cid = criterion.get("id", "")
        if not cid:
            continue
        test_file_val = criterion.get("testFile")
        if test_file_val is not None:
            resolved = project_root / test_file_val
            if resolved.is_dir():
                testfile_covered.add(cid)
            elif resolved.is_file():
                # Verify the file contains at least one test function
                try:
                    head = resolved.read_bytes()[:2000].decode(
                        "utf-8", errors="replace"
                    )
                except OSError:
                    head = ""
                if _TEST_CONTENT_RE.search(head):
                    # Check if file has R-markers; if so, require one for
                    # this specific criterion (avoids 14 criteria all
                    # "covered" by one unrelated test).  Files that predate
                    # the R-marker convention (no markers at all) are still
                    # counted as covered for backward compatibility.
                    try:
                        full_content = resolved.read_text(
                            encoding="utf-8", errors="replace"
                        )
                    except OSError:
                        full_content = head
                    if _R_MARKER_RE.search(full_content):
                        # File has markers — verify one claims this criterion
                        found_ids: set[str] = set()
                        for group in _R_MARKER_RE.findall(full_content):
                            found_ids.update(_ID_RE_LOCAL.findall(group))
                        if cid in found_ids:
                            testfile_covered.add(cid)
                        else:
                            audit_log(
                                "validate_r_markers",
                                "testfile_no_marker",
                                f"testFile {resolved} exists but has no R-marker for {cid}",
                            )
                            # Falls through to normal R-marker scan pool
                    else:
                        # No R-markers in file — backward compat, count as covered
                        testfile_covered.add(cid)
                else:
                    empty_test_files.append(str(resolved))
                    audit_log(
                        "validate_r_markers",
                        "empty_test_file",
                        f"testFile exists but contains no test functions: {resolved} (criterion {cid})",
                    )
            else:
                testfile_missing.add(cid)

    return testfile_covered, testfile_missing, empty_test_files


def _scan_r_markers_in_tests(test_dir: Path) -> set[str]:
    """Scan all ``test_*.py`` files under *test_dir* for R-marker IDs.

    Returns the set of all R-PN-NN (and R-PN-NN-ACN) marker IDs found.
    """
    _ID_RE = re.compile(r"R-P\d+-\d{2}(?:-AC\d+)?")
    found_markers: set[str] = set()
    for test_file in test_dir.rglob("test_*.py"):
        try:
            content = test_file.read_text(encoding="utf-8")
        except (OSError, UnicodeDecodeError):
            continue
        for group in _R_MARKER_RE.findall(content):
            found_markers.update(_ID_RE.findall(group))
    return found_markers


def _validate_marker_quality(
    test_dir: Path,
    story: dict,
    criterion_map: dict[str, str],
) -> list[dict]:
    """Check R-marker-tagged tests for quality issues.

    For each test function that carries an R-marker, cross-reference with
    ``scan_test_quality`` and verify that backtick-identified functions from
    the criterion text are called in the test body.

    Returns a list of dicts with keys ``id``, ``test_func``, and ``issues``.
    An empty list means no quality issues were found.
    """
    _ID_RE_CV = re.compile(r"R-P\d+-\d{2}(?:-AC\d+)?")
    weak_r_markers: list[dict] = []

    if not criterion_map:
        return weak_r_markers

    for test_file in test_dir.rglob("test_*.py"):
        try:
            tf_content = test_file.read_text(encoding="utf-8")
        except (OSError, UnicodeDecodeError):
            continue

        # Only process files that have R-markers
        if not _R_MARKER_RE.search(tf_content):
            continue

        tf_bodies = _parse_test_func_bodies(tf_content)
        if not tf_bodies:
            continue

        tf_quality = scan_test_quality(test_file)

        # For each R-marker in this file, find its test function
        for func_name, func_body in tf_bodies.items():
            marker_groups = _R_MARKER_RE.findall(func_body)
            if not marker_groups:
                continue
            marker_ids: set[str] = set()
            for group in marker_groups:
                marker_ids.update(_ID_RE_CV.findall(group))

            for mid in marker_ids:
                if mid not in criterion_map:
                    continue
                issues_for_marker: list[str] = []

                # Check backtick identifiers from criterion
                ctext = criterion_map[mid]
                identifiers = _BACKTICK_IDENTIFIER_RE.findall(ctext)
                if identifiers and not any(ident in func_body for ident in identifiers):
                    issues_for_marker.append("criterion identifier not called in test")

                # Cross-reference with scan_test_quality
                if func_name in tf_quality.get("behavioral_assertion_missing", []):
                    issues_for_marker.append("test lacks behavioral assertions")
                if func_name in tf_quality.get("mock_only_tests", []):
                    issues_for_marker.append("test uses mock-only assertions")

                if issues_for_marker:
                    weak_r_markers.append(
                        {
                            "id": mid,
                            "test_func": func_name,
                            "issues": issues_for_marker,
                        }
                    )

    return weak_r_markers


def validate_r_markers(
    test_dir: Path,
    prd_path: Path,
    story: dict | None = None,
) -> dict:
    """Validate R-PN-NN markers in test files against prd.json criteria."""
    if not test_dir.is_dir():
        return {"result": "SKIP", "reason": f"test_dir not found: {test_dir}"}

    if not prd_path.is_file():
        return {"result": "SKIP", "reason": f"prd_path not found: {prd_path}"}

    # Extract expected marker IDs from prd.json
    try:
        prd_data = json.loads(prd_path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError, ValueError):
        return {"result": "SKIP", "reason": f"Cannot parse prd.json: {prd_path}"}

    expected_ids: set[str] = set()
    manual_ids: set[str] = set()
    for s in prd_data.get("stories", []):
        for criterion in s.get("acceptanceCriteria", []):
            cid = criterion.get("id", "")
            if cid:
                expected_ids.add(cid)
                if criterion.get("testType") == "manual":
                    manual_ids.add(cid)

    # -- testFile-based coverage (when story is provided) --
    testfile_covered: set[str] = set()
    testfile_missing: set[str] = set()
    empty_test_files: list[str] = []
    if story is not None:
        testfile_covered, testfile_missing, empty_test_files = (
            _validate_testfile_coverage(story, expected_ids, PROJECT_ROOT)
        )

    # -- R-marker scan (for criteria not handled by testFile) --
    found_markers = _scan_r_markers_in_tests(test_dir)

    # Merge testFile coverage into marker results
    all_covered = found_markers | testfile_covered
    markers_valid = sorted(all_covered & expected_ids)
    # When story-scoped, orphan markers from other stories are expected and
    # must not be reported. Orphan detection only makes sense in full-repo
    # mode (e.g., /cleanup strip_orphan_markers).
    if story is not None:
        orphan_markers: list[str] = []
    else:
        orphan_markers = sorted(found_markers - expected_ids)
    # Exclude manual criteria from missing
    testable_ids = expected_ids - manual_ids
    # Exclude testFile-covered criteria from the marker-scan requirement
    need_markers = testable_ids - testfile_covered
    # testfile_missing entries that also appear in found_markers are satisfied by
    # the R-marker scan (file was missing/wrong path, but marker exists in test dir)
    testfile_truly_missing = testfile_missing - found_markers
    missing_markers = sorted((need_markers - found_markers) | testfile_truly_missing)

    result = "PASS" if not missing_markers else "FAIL"

    # -- Content validation: check R-marker-tagged tests for quality --
    weak_r_markers: list[dict] = []
    if story is not None:
        criterion_map: dict[str, str] = {
            criterion.get("id", ""): criterion.get("criterion", "")
            for criterion in story.get("acceptanceCriteria", [])
            if criterion.get("id", "") and criterion.get("criterion", "")
        }
        weak_r_markers = _validate_marker_quality(test_dir, story, criterion_map)

    return {
        "markers_found": sorted(found_markers),
        "markers_valid": markers_valid,
        "orphan_markers": orphan_markers,
        "missing_markers": missing_markers,
        "manual_criteria": sorted(manual_ids),
        "empty_test_files": empty_test_files,
        "weak_r_markers": weak_r_markers,
        "result": result,
    }


# ── Verification Log Helpers ──────────────────────────────────────────────────

VERIFICATION_ENTRY_REQUIRED_KEYS: frozenset[str] = frozenset(
    {"story_id", "timestamp", "overall_result", "attempt"}
)

_VALID_OVERALL_RESULTS: frozenset[str] = frozenset({"PASS", "FAIL", "SKIP"})


def validate_verification_entry(entry: dict) -> list[str]:
    """Validate a verification log entry against required schema.

    Returns a list of warning strings. Empty list means valid entry.
    Advisory only -- does not block writes.
    """
    warnings: list[str] = []

    # Check required keys
    for key in sorted(VERIFICATION_ENTRY_REQUIRED_KEYS):
        if key not in entry:
            warnings.append(f"Missing required key: {key}")

    # Check overall_result value if present
    overall = entry.get("overall_result")
    if overall is not None and overall not in _VALID_OVERALL_RESULTS:
        warnings.append(
            f"Invalid overall_result: {overall!r} (must be one of {sorted(_VALID_OVERALL_RESULTS)})"
        )

    return warnings


def _locked_append(file_path: Path, data: str, timeout_ms: int = 500) -> None:
    """Append data to file with platform-specific non-blocking file locking.

    Uses non-blocking lock modes (``fcntl.LOCK_EX | fcntl.LOCK_NB`` on Unix,
    ``msvcrt.LK_NBLCK`` on Windows) so lock attempts return immediately
    rather than blocking indefinitely.  This is consistent with the
    ``_acquire_state_lock()`` pattern in ``_lib.py``.

    Parameters
    ----------
    file_path : Path
        Target file to append *data* to.
    data : str
        Content to append.
    timeout_ms : int
        Maximum wall-clock time (milliseconds) to spend retrying the lock
        before falling back to an unlocked append.  Default 500 ms.

    Retries up to 3 times on PermissionError/OSError with 10 ms, 20 ms
    backoff, but stops early if *timeout_ms* is exceeded.  Falls back to a
    bare unlocked append so writes never block permanently.

    Lock is always released in a finally block to prevent deadlocks.
    """
    import sys
    import time

    deadline = time.time() + timeout_ms / 1000.0

    for attempt in range(3):
        if time.time() > deadline:
            break
        try:
            with file_path.open("a", encoding="utf-8") as fh:
                fd = fh.fileno()
                try:
                    if sys.platform == "win32":
                        import msvcrt

                        # Byte-0 sentinel: lock byte 0 as mutex (non-blocking)
                        fh.seek(0)
                        msvcrt.locking(fd, msvcrt.LK_NBLCK, 1)
                        try:
                            # Append mode: writes always go to end
                            fh.write(data)
                            fh.flush()
                        finally:
                            fh.seek(0)
                            msvcrt.locking(fd, msvcrt.LK_UNLCK, 1)
                    else:
                        import fcntl

                        fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
                        try:
                            fh.write(data)
                            fh.flush()
                        finally:
                            fcntl.flock(fd, fcntl.LOCK_UN)
                    return  # Success
                except (PermissionError, OSError):
                    pass  # Will retry
        except (PermissionError, OSError):
            pass  # Will retry
        if attempt < 2:
            time.sleep(0.01 * (attempt + 1))  # 10ms, 20ms

    # Fallback: bare unlocked append (degrade gracefully)
    audit_log(
        "_locked_append",
        "lock_fallback",
        f"All 3 lock attempts failed for {file_path}, falling back to unlocked append",
    )
    with file_path.open("a", encoding="utf-8") as fh:
        fh.write(data)
        fh.flush()


def append_verification_entry(log_path: Path, entry: dict) -> None:
    """Append a single JSON object as a new line to a JSONL verification log."""
    try:
        log_path.parent.mkdir(parents=True, exist_ok=True)
        line = json.dumps(entry, separators=(",", ":"))
        _locked_append(log_path, line + "\n")
    except (OSError, TypeError, ValueError) as exc:
        audit_log(
            "append_verification_entry",
            "write_failed",
            f"{type(exc).__name__}: {exc} (entry lost: {entry.get('story_id', '?')})",
        )


def read_verification_log(log_path: Path, plan_hash: str | None = None) -> dict:
    """Read a JSONL verification log, skipping corrupt lines.

    Args:
        log_path: Path to the JSONL verification log file.
        plan_hash: Optional plan hash to filter entries. When provided, only
            entries whose ``plan_hash`` field matches are returned.  Entries
            without a ``plan_hash`` field are excluded when a filter is active.
            When ``None`` (default), all entries are returned for backward
            compatibility.

            Sentinel cross-hash coverage: when a ``type == "plan_replacement"``
            entry is present with ``new_plan_hash == plan_hash``, entries whose
            ``plan_hash`` matches the sentinel's ``old_plan_hash`` are also
            included in ``entries`` (they count as covered under the new plan).

    Returns:
        On success: {"entries": [dict, ...], "sentinels": [dict, ...], "parse_errors": int}
        On missing file: {"result": "SKIP", "reason": "..."}
    """
    if not log_path.is_file():
        return {"result": "SKIP", "reason": f"File not found: {log_path}"}

    all_parsed: list[dict] = []
    parse_errors = 0

    try:
        text = log_path.read_text(encoding="utf-8")
    except (OSError, UnicodeDecodeError):
        return {"result": "SKIP", "reason": f"Cannot read file: {log_path}"}

    for line in text.splitlines():
        stripped = line.strip()
        if not stripped:
            continue
        try:
            entry = json.loads(stripped)
        except (json.JSONDecodeError, ValueError):
            parse_errors += 1
            continue
        all_parsed.append(entry)

    # Separate sentinel entries from regular entries
    sentinels: list[dict] = [
        e for e in all_parsed if e.get("type") == "plan_replacement"
    ]
    regular: list[dict] = [e for e in all_parsed if e.get("type") != "plan_replacement"]

    if plan_hash is None:
        # No filter: return all regular entries (backward compatible)
        return {
            "entries": regular,
            "sentinels": sentinels,
            "parse_errors": parse_errors,
        }

    # Build set of old hashes covered by sentinels that link to plan_hash
    covered_old_hashes: set[str] = {
        s["old_plan_hash"]
        for s in sentinels
        if s.get("new_plan_hash") == plan_hash and "old_plan_hash" in s
    }

    entries: list[dict] = []
    for entry in regular:
        entry_hash = entry.get("plan_hash")
        if entry_hash == plan_hash or entry_hash in covered_old_hashes:
            entries.append(entry)

    return {"entries": entries, "sentinels": sentinels, "parse_errors": parse_errors}


# ── Plan Utilities ────────────────────────────────────────────────────────────

_PLAN_CRITERIA_RE = re.compile(
    r"^\s*-\s+`?(R-[A-Z][A-Z0-9]*-\d{2}(?:-AC\d+)?)`?(?:\s+\[[^\]\r\n]+\])*\s*[: ]",
    re.MULTILINE,
)


def extract_plan_r_markers(plan_path: Path) -> set[str]:
    """Extract R-PN-NN markers from bullet-format criteria lines in a PLAN.md file.

    Matches criteria bullets formatted as ``- R-Pn-nn: ...`` and
    ``- R-Pn-nn [annotation]: ...``. Markers appearing in tables, prose, or
    other contexts are ignored.
    """
    try:
        content = plan_path.read_text(encoding="utf-8")
    except (OSError, UnicodeDecodeError, ValueError):
        return set()

    return set(_PLAN_CRITERIA_RE.findall(content))


# Regex to capture full bullet-format R-marker lines for hashing
_PLAN_CRITERIA_LINE_RE = re.compile(
    r"^\s*-\s+`?R-[A-Z][A-Z0-9]*-\d{2}(?:-AC\d+)?`?(?:\s+\[[^\]\r\n]+\])*\s*[: ].*$",
    re.MULTILINE,
)


def compute_plan_hash(plan_path: Path) -> str:
    """Compute a normalized hash of PLAN.md based on criteria bullet lines only.

    Extracts only ``- R-Pn-nn: ...`` / ``- R-Pn-nn [annotation]: ...`` bullet
    lines, strips whitespace, sorts them, and returns the SHA-256 hex digest.
    This makes the hash
    insensitive to formatting, prose, table content, or whitespace changes
    that don't affect the acceptance criteria contract.

    Returns empty string on read errors.
    """
    try:
        content = plan_path.read_text(encoding="utf-8")
    except (OSError, UnicodeDecodeError, ValueError):
        return ""

    lines = _PLAN_CRITERIA_LINE_RE.findall(content)
    normalized = "\n".join(sorted(line.strip() for line in lines))
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()


def check_plan_prd_sync(plan_path: Path, prd_path: Path) -> dict:
    """Check whether PLAN.md and prd.json R-markers are in sync.

    Fails closed when prd.json cannot be read or parsed:
    - OSError / missing file → in_sync=False, error_kind="parse_error"
    - Invalid JSON → in_sync=False, error_kind="parse_error"
    - Missing required schema keys (version, stories, plan_hash, planRef) →
      in_sync=False, error_kind="schema_error"
    """
    plan_markers = extract_plan_r_markers(plan_path)

    # --- Parse prd.json with fail-closed error handling ---
    try:
        raw = prd_path.read_text(encoding="utf-8")
    except (OSError, ValueError):
        return {
            "in_sync": False,
            "plan_markers": sorted(plan_markers),
            "prd_markers": [],
            "added": [],
            "removed": [],
            "plan_hash": "",
            "error_kind": "parse_error",
            "error_detail": f"Cannot read prd.json: {prd_path}",
        }

    try:
        prd_data = json.loads(raw)
    except (json.JSONDecodeError, ValueError) as exc:
        return {
            "in_sync": False,
            "plan_markers": sorted(plan_markers),
            "prd_markers": [],
            "added": [],
            "removed": [],
            "plan_hash": "",
            "error_kind": "parse_error",
            "error_detail": str(exc),
        }

    # --- Schema validation: prd.json must be a JSON object (dict) ---
    # A non-dict root (list, string, null, number) means the file structure
    # is fundamentally invalid — fail closed rather than silently treating
    # all markers as missing or added.
    if not isinstance(prd_data, dict):
        return {
            "in_sync": False,
            "plan_markers": sorted(plan_markers),
            "prd_markers": [],
            "added": [],
            "removed": [],
            "plan_hash": "",
            "error_kind": "schema_error",
            "error_detail": (
                f"prd.json root must be a JSON object, got {type(prd_data).__name__}"
            ),
        }

    # --- Extract markers ---
    prd_markers: set[str] = set()
    for story in prd_data.get("stories", []):
        for criterion in story.get("acceptanceCriteria", []):
            cid = criterion.get("id", "")
            if cid:
                prd_markers.add(cid)
    # Union with legacyMarkerIds for backward compatibility
    for legacy_id in prd_data.get("legacyMarkerIds", []):
        if legacy_id:
            prd_markers.add(legacy_id)

    # Compute normalized plan hash (R-marker lines only)
    plan_hash = compute_plan_hash(plan_path)

    added = sorted(plan_markers - prd_markers)
    removed = sorted(prd_markers - plan_markers)

    return {
        "in_sync": len(added) == 0 and len(removed) == 0,
        "plan_markers": sorted(plan_markers),
        "prd_markers": sorted(prd_markers),
        "added": added,
        "removed": removed,
        "plan_hash": plan_hash,
    }


_PLAN_CHANGES_RE = re.compile(
    r"^\|\s*(?:ADD|MODIFY|CREATE|DELETE)\s*\|\s*`?([^`|\s]+?)`?\s*\|",
    re.MULTILINE,
)

# Extract the Test File column (column 4) from Changes tables: action | file | desc | testfile | type |
_PLAN_TEST_FILE_RE = re.compile(
    r"^\|\s*(?:ADD|MODIFY|CREATE|DELETE)\s*\|[^|]+\|[^|]+\|\s*`?([^`|\s]+\.py)`?\s*\|",
    re.MULTILINE,
)

# Capture file path (column 2) and description text (column 3) from Changes table rows.
# Format: | ACTION | FILE | DESCRIPTION | ... |
_PLAN_CHANGES_WITH_DESC_RE = re.compile(
    r"^\|\s*(?:ADD|MODIFY|CREATE|DELETE)\s*\|\s*`?([^`|\s]+?)`?\s*\|\s*([^|]+?)\s*\|",
    re.MULTILINE,
)

# Extract backtick-delimited identifiers from description text (e.g., "`foo`" → "foo").
_BACKTICK_IDENTIFIER_RE = re.compile(r"`([^`]+)`")

# Match a Phase section header such as "## Phase 1" or "## Phase 2 — Title"
_PHASE_HEADER_RE = re.compile(r"^##\s+Phase\s+(\d+)\b", re.MULTILINE)


def _extract_phase_section(content: str, phase: int) -> str:
    """Return the substring of content that belongs to the given phase.

    Scans for '## Phase N' headers and returns everything from that header up
    to (but not including) the next '## Phase' header, or the end of file.
    Returns an empty string when the requested phase is not found.
    """
    matches = list(_PHASE_HEADER_RE.finditer(content))
    for i, m in enumerate(matches):
        if int(m.group(1)) == phase:
            start = m.start()
            end = matches[i + 1].start() if i + 1 < len(matches) else len(content)
            return content[start:end]
    return ""


def parse_plan_changes(plan_path: Path, phase: int | None = None) -> set[str]:
    """Extract file paths from PLAN.md Changes tables.

    Includes both the primary File column and the Test File column so that
    test files listed in the Changes table are not flagged as unexpected by
    the plan conformance check.

    Args:
        plan_path: Path to PLAN.md.
        phase: When provided, restrict results to Changes tables that appear
               inside the ``## Phase N`` section with matching number.  When
               ``None`` (default) all phases are searched — backward-compatible
               with existing callers.

    Returns:
        Set of file path strings found in the matching Changes tables.
    """
    try:
        content = plan_path.read_text(encoding="utf-8")
    except (OSError, UnicodeDecodeError, ValueError):
        return set()

    if phase is not None:
        content = _extract_phase_section(content, phase)

    primary = {m.group(1).strip() for m in _PLAN_CHANGES_RE.finditer(content)}
    test_files = {m.group(1).strip() for m in _PLAN_TEST_FILE_RE.finditer(content)}
    return primary | test_files


def parse_plan_changes_with_actions(
    plan_path: Path, phase: int | None = None
) -> dict[str, str]:
    """Extract file-to-action mapping from PLAN.md Changes tables.

    Returns a dict mapping file path string to its action verb
    (ADD, CREATE, MODIFY, DELETE) as found in the Changes table.

    Args:
        plan_path: Path to PLAN.md.
        phase: When provided, restrict to the ``## Phase N`` section.

    Returns:
        Dict mapping file path string to action verb (uppercased).
        Empty dict on read error, missing plan, or no Changes tables.
    """
    try:
        content = plan_path.read_text(encoding="utf-8")
    except (OSError, UnicodeDecodeError, ValueError):
        return {}

    if phase is not None:
        content = _extract_phase_section(content, phase)

    result: dict[str, str] = {}
    for m in re.finditer(
        r"^\|\s*(ADD|MODIFY|CREATE|DELETE)\s*\|\s*`?([^`|\s]+?)`?\s*\|",
        content,
        re.MULTILINE,
    ):
        action = m.group(1).strip().upper()
        file_path = m.group(2).strip()
        result[file_path] = action
    return result


def parse_plan_changes_with_descriptions(
    plan_path: Path, phase: int | None = None
) -> dict[str, str]:
    """Extract file-to-description mapping from PLAN.md Changes tables.

    Args:
        plan_path: Path to PLAN.md.
        phase: When provided, restrict to the ``## Phase N`` section.

    Returns:
        Dict mapping file path string to description text.
        Empty dict on read error, missing plan, or no Changes tables.
    """
    try:
        content = plan_path.read_text(encoding="utf-8")
    except (OSError, UnicodeDecodeError, ValueError):
        return {}

    if phase is not None:
        content = _extract_phase_section(content, phase)

    result: dict[str, str] = {}
    for m in _PLAN_CHANGES_WITH_DESC_RE.finditer(content):
        file_path = m.group(1).strip()
        description = m.group(2).strip()
        result[file_path] = description
    return result


# ── PRD Schema Validation ─────────────────────────────────────────────────────

_VALID_COMPLEXITY_VALUES: frozenset[str] = frozenset({"simple", "medium", "complex"})

# Default complexity thresholds: score <= simple_max → simple,
# simple_max < score <= medium_max → medium, score > medium_max → complex.
_DEFAULT_COMPLEXITY_THRESHOLDS: dict = {
    "simple": {"max_score": 6, "maxTurns": 100},
    "medium": {"max_score": 12, "maxTurns": 150},
    "complex": {"maxTurns": 200},
}


def validate_prd_story_schema(story: dict) -> list[str]:
    """Validate a prd.json story object against the v2.2 schema.

    Checks that optional fields dependsOn, parallelGroup, scope, component,
    complexity, and maxTurns, when present, have the correct types. Missing
    fields are valid (backward-compatible with v2.0 -- consumers use .get()
    to obtain defaults).

    Returns a list of validation error strings. Empty list means valid.
    """
    errors: list[str] = []

    # dependsOn: optional field; when present must be a list of strings
    if "dependsOn" in story:
        depends_on = story["dependsOn"]
        if not isinstance(depends_on, list):
            errors.append(
                f"dependsOn must be a list of strings, got {type(depends_on).__name__}"
            )
        else:
            for i, item in enumerate(depends_on):
                if not isinstance(item, str):
                    errors.append(
                        f"dependsOn[{i}] must be a string, got {type(item).__name__}"
                    )

    # parallelGroup: optional field; when present must be an int or None
    if "parallelGroup" in story:
        pg = story["parallelGroup"]
        if pg is not None and not isinstance(pg, int):
            errors.append(
                f"parallelGroup must be an integer or null, got {type(pg).__name__}"
            )

    # scope: optional field (v2.2); when present must be a list of strings
    if "scope" in story:
        scope = story["scope"]
        if not isinstance(scope, list):
            errors.append(
                f"scope must be a list of strings, got {type(scope).__name__}"
            )
        else:
            for i, item in enumerate(scope):
                if not isinstance(item, str):
                    errors.append(
                        f"scope[{i}] must be a string, got {type(item).__name__}"
                    )

    # component: optional field (v2.2); when present must be a string
    if "component" in story:
        component = story["component"]
        if not isinstance(component, str):
            errors.append(f"component must be a string, got {type(component).__name__}")

    # complexity: optional field (v2.2); when present must be one of simple/medium/complex
    if "complexity" in story:
        complexity = story["complexity"]
        if complexity not in _VALID_COMPLEXITY_VALUES:
            errors.append(
                f"complexity must be one of {sorted(_VALID_COMPLEXITY_VALUES)}, got {complexity!r}"
            )

    # maxTurns: optional field (v2.2); when present must be a positive integer
    if "maxTurns" in story:
        max_turns = story["maxTurns"]
        if not isinstance(max_turns, int) or isinstance(max_turns, bool):
            errors.append(
                f"maxTurns must be a positive integer, got {type(max_turns).__name__}"
            )
        elif max_turns <= 0:
            errors.append(f"maxTurns must be a positive integer, got {max_turns}")

    # acceptanceCriteria: each criterion must have a non-empty id
    for i, criterion in enumerate(story.get("acceptanceCriteria", [])):
        cid = criterion.get("id", "")
        if not cid:
            errors.append(f"acceptanceCriteria[{i}] has empty or missing id")

    return errors


# ── Frontend Extension Detection ──────────────────────────────────────────────

FRONTEND_EXTENSIONS: frozenset[str] = frozenset(
    {".tsx", ".jsx", ".vue", ".svelte", ".html", ".css", ".scss"}
)


def has_frontend_files(file_paths: list) -> bool:
    """Return True if any file path has a frontend extension.

    Args:
        file_paths: List of file paths (str or Path objects).

    Returns:
        True if any path has a suffix in FRONTEND_EXTENSIONS. Never raises.
    """
    for f in file_paths:
        if Path(f).suffix in FRONTEND_EXTENSIONS:
            return True
    return False


# ── Story Promotion ───────────────────────────────────────────────────────────


class PromotionStatus(str, Enum):
    """Stable serializable enum for promotion gate outcome."""

    ALLOWED = "ALLOWED"
    BLOCKED = "BLOCKED"


class PromotionFailureReason(str, Enum):
    """Stable serializable enum for why promotion was blocked."""

    RECEIPT_NOT_FOUND = "RECEIPT_NOT_FOUND"
    RECEIPT_PARSE_ERROR = "RECEIPT_PARSE_ERROR"
    RECEIPT_NOT_PASSED = "RECEIPT_NOT_PASSED"
    REVIEWER_REJECTED = "REVIEWER_REJECTED"
    REVIEWER_RESULT_INVALID = "REVIEWER_RESULT_INVALID"
    RECEIPT_HASH_MISMATCH = "RECEIPT_HASH_MISMATCH"
    CRITERIA_NOT_COVERED = "CRITERIA_NOT_COVERED"
    REQUIRED_STEPS_SKIPPED = "REQUIRED_STEPS_SKIPPED"
    DRIFT_THRESHOLD_EXCEEDED = "DRIFT_THRESHOLD_EXCEEDED"
    FRONTEND_NOT_VERIFIED = "FRONTEND_NOT_VERIFIED"
    ENVIRONMENT_CHECKS_FAILED = "ENVIRONMENT_CHECKS_FAILED"


@dataclass
class PromotionInputs:
    """Inputs for the promotion gate evaluation."""

    receipt_path: Path
    reviewer_result: str
    story: dict | None = None
    frontend_verified: bool | None = None


@dataclass
class PromotionDecision:
    """Result of the promotion gate evaluation."""

    allowed: bool
    reason: str
    status: PromotionStatus
    failure_reason: PromotionFailureReason | None = None
    receipt_drift_count: int = 0


def _parse_reviewer_result_block(reviewer_output: str) -> tuple[str | None, str]:
    """Return the explicit REVIEWER_RESULT status and normalized reviewer text.

    Accepts either the full reviewer output or a single `REVIEWER_RESULT: ...`
    line. Bare PASS/WARN/FAIL strings are rejected so promotion does not depend
    on an implied reviewer signal.
    """
    if not isinstance(reviewer_output, str):
        return None, ""
    normalized = reviewer_output.strip()
    if not normalized:
        return None, ""
    match = re.search(r"^\s*REVIEWER_RESULT:\s*(PASS|WARN|FAIL)\s*$", normalized, re.M)
    if match is None:
        return None, normalized
    return match.group(1), normalized


def _count_reviewer_drift_warnings(reviewer_output: str) -> int | None:
    """Extract a drift warning count from qa-reviewer output when possible."""
    if not reviewer_output:
        return None
    summary_match = re.search(
        r"(\d+)\s+potential\s+requirement\s+drift", reviewer_output, re.I
    )
    if summary_match:
        return int(summary_match.group(1))
    list_match = re.search(r"drift_warnings:\s*\[(.*?)\]", reviewer_output, re.S | re.I)
    if list_match is None:
        return None
    payload = list_match.group(1).strip()
    if not payload:
        return 0
    return len([item for item in payload.split(",") if item.strip()])


# Steps that must not be SKIP in a valid receipt. Only includes steps whose
# runner defaults are required=True. Steps 2 (type_check), 4 (integration),
# 5 (regression), 6-9 can legitimately SKIP when unconfigured or no source files.
# Step 12 (production scan) is merged into step 6 and always returns SKIP.
_ALWAYS_REQUIRED_STEP_NUMS = {1, 3, 10, 11}


def _check_criteria_coverage(
    inputs: "PromotionInputs",
    receipt_data: dict,
) -> "PromotionDecision | None":
    """Check 5: Criteria coverage — returns BLOCKED decision or None."""
    if inputs.story is None:
        return None
    criteria_verified = receipt_data.get("criteria_verified")
    if criteria_verified is None:
        return None
    required_ids = {
        ac["id"]
        for ac in inputs.story.get("acceptanceCriteria", [])
        if isinstance(ac, dict) and "id" in ac
    }
    verified_ids = (
        set(criteria_verified) if isinstance(criteria_verified, list) else set()
    )
    missing = required_ids - verified_ids
    if not missing:
        return None
    return PromotionDecision(
        allowed=False,
        reason=f"Criteria not covered: {sorted(missing)}",
        status=PromotionStatus.BLOCKED,
        failure_reason=PromotionFailureReason.CRITERIA_NOT_COVERED,
    )


def _check_required_steps(receipt_data: dict) -> "PromotionDecision | None":
    """Check 6: Required steps not skipped — returns BLOCKED decision or None."""
    steps = receipt_data.get("steps")
    if not steps or not isinstance(steps, list):
        return None
    skipped_required = [
        step.get("step")
        for step in steps
        if isinstance(step, dict)
        and step.get("step") in _ALWAYS_REQUIRED_STEP_NUMS
        and step.get("result", "") == "SKIP"
    ]
    if not skipped_required:
        return None
    return PromotionDecision(
        allowed=False,
        reason=f"Required steps skipped: {skipped_required}",
        status=PromotionStatus.BLOCKED,
        failure_reason=PromotionFailureReason.REQUIRED_STEPS_SKIPPED,
    )


def _check_frontend_gate(
    receipt_data: dict,
    frontend_verified: bool | None,
    frontend_gate_severity: str,
    receipt_drift_count: int,
) -> "PromotionDecision | None":
    """Evaluate Check 3d: frontend verification gate.

    Returns:
        None when the gate is disabled or skipped (no frontend files).
        PromotionDecision(allowed=False) when severity="fail" and not verified.
        PromotionDecision(allowed=True, reason=<warning>) when severity="warn".
    """
    if frontend_gate_severity == "disabled":
        return None
    changed_files_list = receipt_data.get("changed_files", [])
    if not has_frontend_files(changed_files_list):
        return None
    if frontend_verified is True:
        return None
    if frontend_gate_severity == "fail":
        return PromotionDecision(
            allowed=False,
            reason="Frontend files changed but browser verification not performed",
            status=PromotionStatus.BLOCKED,
            failure_reason=PromotionFailureReason.FRONTEND_NOT_VERIFIED,
            receipt_drift_count=receipt_drift_count,
        )
    # "warn" or any unrecognized value — soft enforcement
    return PromotionDecision(
        allowed=True,
        reason=(
            "Frontend files changed but browser verification not performed "
            "(warn mode — set ralph.frontend_verification to 'fail' to enforce)"
        ),
        status=PromotionStatus.ALLOWED,
        failure_reason=None,
        receipt_drift_count=receipt_drift_count,
    )


def _recompute_receipt_hash(receipt_data: dict) -> str:
    """Recompute SHA-256 over canonical receipt fields for integrity check."""
    story_result = receipt_data.get(
        "story_result", receipt_data.get("overall_result", "")
    )
    payload = json.dumps(
        {
            "steps": receipt_data.get("steps", []),
            "story_id": receipt_data.get("story_id", ""),
            "attempt": receipt_data.get("attempt", 0),
            "overall_result": receipt_data.get("overall_result", ""),
            "phase_type": receipt_data.get("phase_type"),
            "story_result": story_result,
        },
        sort_keys=True,
        separators=(",", ":"),
    )
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def evaluate_promotion(
    inputs: PromotionInputs,
    drift_threshold: int = 3,
    frontend_gate_severity: str = "warn",
) -> PromotionDecision:
    """Evaluate the story promotion gate — pure function, no side effects.

    Args:
        inputs: PromotionInputs with receipt_path, reviewer_result, and
                optional story dict for criteria coverage checking.
                Set inputs.frontend_verified=True when browser verification
                was performed.
        drift_threshold: Maximum tolerated drift warning count before a
                WARN reviewer result is treated as FAIL. Set to 0 to
                disable drift-based blocking entirely. Default: 3.
        frontend_gate_severity: Controls Check 3d (frontend verification gate).
                "warn" (default): allow but include warning in reason.
                "fail": block promotion when frontend files present and not verified.
                "disabled": skip Check 3d entirely.

    Returns:
        PromotionDecision with allowed=True when all checks pass:
        1. Receipt file exists and parses as JSON
        2. overall_result == "PASS"
        3. reviewer_result contains an explicit REVIEWER_RESULT block
        3a. reviewer_result != "FAIL"
        3b. reviewer WARN with drift count >= drift_threshold treated as FAIL
        3c. Receipt drift count >= drift_threshold treated as FAIL
        3d. Frontend files changed but browser verification not performed
        4. Receipt hash integrity (when receipt_hash field present)
        5. Criteria coverage (when story provided and criteria_verified present)
        6. No required steps skipped (when steps field present)

        Checks 4-6 are only enforced when the receipt contains the
        relevant fields, maintaining backward compatibility with minimal
        receipts.

    INVARIANT: PromotionDecision.reason is human-readable only — no
    downstream code may branch on its text. Use .allowed, .status, or
    .failure_reason for programmatic decisions.
    """
    if not inputs.receipt_path.is_file():
        return PromotionDecision(
            allowed=False,
            reason=f"Receipt not found: {inputs.receipt_path}",
            status=PromotionStatus.BLOCKED,
            failure_reason=PromotionFailureReason.RECEIPT_NOT_FOUND,
        )

    try:
        receipt_data = json.loads(inputs.receipt_path.read_text(encoding="utf-8"))
    except (OSError, UnicodeDecodeError, json.JSONDecodeError, ValueError) as exc:
        return PromotionDecision(
            allowed=False,
            reason=f"Cannot read/parse receipt: {exc}",
            status=PromotionStatus.BLOCKED,
            failure_reason=PromotionFailureReason.RECEIPT_PARSE_ERROR,
        )

    # Check 2: story_result (with fallback to overall_result for backward compat)
    promotion_result = receipt_data.get(
        "story_result", receipt_data.get("overall_result")
    )
    if promotion_result != "PASS":
        return PromotionDecision(
            allowed=False,
            reason=f"Receipt story_result is {promotion_result!r} (expected 'PASS')",
            status=PromotionStatus.BLOCKED,
            failure_reason=PromotionFailureReason.RECEIPT_NOT_PASSED,
        )

    # Check 2b: overall_result — blocks when environment checks introduced new failures.
    # Pre-existing failures are excluded by qa_runner's baseline mechanism, so
    # overall_result="FAIL" here means new failures were introduced by this story.
    # Absent overall_result key (old receipts) is backward-compatible — skip check.
    overall_result = receipt_data.get("overall_result")
    if overall_result is not None and overall_result != "PASS":
        return PromotionDecision(
            allowed=False,
            reason=f"Receipt overall_result is {overall_result!r} — environment checks failed",
            status=PromotionStatus.BLOCKED,
            failure_reason=PromotionFailureReason.ENVIRONMENT_CHECKS_FAILED,
        )

    reviewer_status, reviewer_output = _parse_reviewer_result_block(
        inputs.reviewer_result
    )
    if reviewer_status is None:
        return PromotionDecision(
            allowed=False,
            reason="qa-reviewer output missing or malformed REVIEWER_RESULT block",
            status=PromotionStatus.BLOCKED,
            failure_reason=PromotionFailureReason.REVIEWER_RESULT_INVALID,
        )

    if reviewer_status == "FAIL":
        return PromotionDecision(
            allowed=False,
            reason="qa-reviewer returned FAIL — promotion blocked",
            status=PromotionStatus.BLOCKED,
            failure_reason=PromotionFailureReason.REVIEWER_REJECTED,
        )

    # Check 3b: WARN with excessive drift warnings treated as FAIL
    if reviewer_status == "WARN" and drift_threshold > 0:
        drift_count = _count_reviewer_drift_warnings(reviewer_output)
        if drift_count is not None and drift_count >= drift_threshold:
            return PromotionDecision(
                allowed=False,
                reason=(
                    f"Reviewer reported {drift_count} drift warnings "
                    f"(threshold: {drift_threshold})"
                ),
                status=PromotionStatus.BLOCKED,
                failure_reason=PromotionFailureReason.REVIEWER_REJECTED,
            )

    # Check 3c: Receipt-based drift enforcement (fires regardless of reviewer_result)
    receipt_drift_count = extract_drift_warnings_from_receipt(receipt_data)
    if drift_threshold > 0 and receipt_drift_count >= drift_threshold:
        return PromotionDecision(
            allowed=False,
            reason=(
                f"Receipt drift warnings ({receipt_drift_count}) >= "
                f"threshold ({drift_threshold})"
            ),
            status=PromotionStatus.BLOCKED,
            failure_reason=PromotionFailureReason.DRIFT_THRESHOLD_EXCEEDED,
            receipt_drift_count=receipt_drift_count,
        )

    # Check 3d: Frontend verification gate
    _frontend_result = _check_frontend_gate(
        receipt_data,
        inputs.frontend_verified,
        frontend_gate_severity,
        receipt_drift_count,
    )
    if _frontend_result is not None and not _frontend_result.allowed:
        return _frontend_result
    _frontend_warning_reason: str = _frontend_result.reason if _frontend_result else ""

    # Check 4: Receipt hash integrity (only when receipt contains receipt_hash)
    stored_hash = receipt_data.get("receipt_hash")
    if stored_hash:
        computed_hash = _recompute_receipt_hash(receipt_data)
        if computed_hash != stored_hash:
            return PromotionDecision(
                allowed=False,
                reason=(
                    f"Receipt hash mismatch: stored {stored_hash[:12]}... "
                    f"vs computed {computed_hash[:12]}..."
                ),
                status=PromotionStatus.BLOCKED,
                failure_reason=PromotionFailureReason.RECEIPT_HASH_MISMATCH,
            )

    # Check 5: Criteria coverage (only when story provided and receipt has criteria_verified)
    _criteria_block = _check_criteria_coverage(inputs, receipt_data)
    if _criteria_block is not None:
        return _criteria_block

    # Check 6: Required steps not skipped (only when receipt has steps)
    _steps_block = _check_required_steps(receipt_data)
    if _steps_block is not None:
        return _steps_block

    return PromotionDecision(
        allowed=True,
        reason=_frontend_warning_reason,
        status=PromotionStatus.ALLOWED,
        failure_reason=None,
        receipt_drift_count=receipt_drift_count,
    )


def validate_story_promotion(
    receipt_path: Path,
    reviewer_result: str,
    story: dict | None = None,
    drift_threshold: int = 3,
    frontend_verified: bool | None = None,
    frontend_gate_severity: str = "warn",
) -> tuple[bool, str]:
    """Backward-compatible alias for evaluate_promotion().

    Args:
        receipt_path: Path to the QA receipt JSON file.
        reviewer_result: String result from qa-reviewer agent — "PASS", "WARN", or "FAIL".
        story: Optional story dict for criteria coverage checking.
        drift_threshold: Maximum tolerated drift warning count before a
                WARN reviewer result is treated as FAIL. Set to 0 to
                disable drift-based blocking entirely. Default: 3.
        frontend_verified: Whether browser verification was performed for this story.
                None (default) means unknown — treated as not verified.
        frontend_gate_severity: Severity for Check 3d. "warn" (default), "fail",
                or "disabled". Forwarded to evaluate_promotion().

    Returns:
        (True, '') when promotion is allowed.
        (False, reason_str) otherwise.
    """
    decision = evaluate_promotion(
        PromotionInputs(
            receipt_path,
            reviewer_result,
            story=story,
            frontend_verified=frontend_verified,
        ),
        drift_threshold=drift_threshold,
        frontend_gate_severity=frontend_gate_severity,
    )
    return decision.allowed, decision.reason


def estimate_story_complexity(
    story: dict,
    thresholds: dict | None = None,
    cross_package: bool = False,
) -> dict:
    """Estimate the complexity of a story based on scope and acceptance criteria.

    Scoring algorithm:
    - Base score = len(scope) + len(acceptanceCriteria)
    - If cross_package is True or len(unique top-level dirs) > 2: add 3

    Classification (using thresholds or defaults):
    - score <= simple.max_score → "simple"
    - simple.max_score < score <= medium.max_score → "medium"
    - score > medium.max_score → "complex"

    Args:
        story: Story dict with optional 'scope' and 'acceptanceCriteria' lists.
        thresholds: Optional complexity_thresholds config from workflow.json.
            Defaults to _DEFAULT_COMPLEXITY_THRESHOLDS if None.
        cross_package: Explicit cross-package flag. If True, adds +3 to score.

    Returns:
        Dict with keys: complexity (str), maxTurns (int), score (int).
        Returns {"complexity": "medium", "maxTurns": 150, "score": 0} on error.
    """
    t = thresholds if thresholds is not None else _DEFAULT_COMPLEXITY_THRESHOLDS

    try:
        scope: list = story.get("scope", []) or []
        criteria: list = story.get("acceptanceCriteria", []) or []

        scope_count = len(scope)
        criteria_count = len(criteria)

        # Cross-package detection: more than 2 unique top-level directories
        # in scope list counts as cross-package unless caller already set it.
        top_dirs: set[str] = set()
        for s in scope:
            if isinstance(s, str):
                # Extract the first path component
                top = s.strip("/").split("/")[0]
                if top:
                    top_dirs.add(top)

        is_cross_package = cross_package or len(top_dirs) > 2

        score = scope_count + criteria_count + (3 if is_cross_package else 0)

        simple_max: int = t.get("simple", {}).get("max_score", 6)
        medium_max: int = t.get("medium", {}).get("max_score", 12)

        if score <= simple_max:
            complexity = "simple"
            max_turns: int = t.get("simple", {}).get("maxTurns", 100)
        elif score <= medium_max:
            complexity = "medium"
            max_turns = t.get("medium", {}).get("maxTurns", 150)
        else:
            complexity = "complex"
            max_turns = t.get("complex", {}).get("maxTurns", 200)

        return {"complexity": complexity, "maxTurns": max_turns, "score": score}

    except (AttributeError, TypeError, ValueError):
        return {"complexity": "medium", "maxTurns": 150, "score": 0}


def extract_diff_added_identifiers(
    checkpoint: str | None,
    changed_files: list[Path],
) -> dict[str, list[str]]:
    """Extract public function names found only in added diff lines since checkpoint.

    For each production Python file in *changed_files*, runs
    ``git diff -U0 <checkpoint>..HEAD -- <file>`` and collects only lines
    starting with ``+`` (added lines).  ``_PUBLIC_FUNC_RE`` is applied to
    those lines to extract newly-added public function names.

    This is the core of the diff-scoped identifier check (Sub-check 1b) —
    it ensures that only *new* functions trigger the unplanned-identifier
    warning, not pre-existing ones.

    Args:
        checkpoint: Git ref (hash/tag/branch) used as the lower boundary.
            If ``None``, returns ``{}`` immediately without calling git
            (SKIP fallback per design).
        changed_files: Iterable of file paths to inspect.  Non-Python files,
            test files, and conftest.py are silently skipped.

    Returns:
        A ``dict`` mapping file path (POSIX string) to a list of public
        function names found only in added diff lines.  Files with no
        added public functions are omitted from the result.  Returns ``{}``
        when *checkpoint* is ``None`` or when any git invocation fails
        (``OSError`` or non-zero exit code).
    """
    if checkpoint is None:
        return {}

    result: dict[str, list[str]] = {}

    for f in changed_files:
        p = Path(f)

        # Skip non-Python files
        if p.suffix != ".py":
            continue

        # Skip test files and conftest
        name_lower = p.name.lower()
        if name_lower.startswith("test_") or name_lower.endswith("_test.py"):
            continue
        if name_lower == "conftest.py":
            continue

        try:
            proc = subprocess.run(
                ["git", "diff", "-U0", f"{checkpoint}..HEAD", "--", str(p)],
                capture_output=True,
                text=True,
                timeout=30,
            )
        except OSError:
            return {}

        if proc.returncode != 0:
            return {}

        # Collect only added lines (lines starting with '+' but not '+++')
        added_funcs: list[str] = []
        for line in proc.stdout.splitlines():
            if line.startswith("+") and not line.startswith("+++"):
                # Strip the leading '+' before applying regex
                added_content = line[1:]
                added_funcs.extend(_PUBLIC_FUNC_RE.findall(added_content))

        if added_funcs:
            result[p.as_posix()] = added_funcs

    return result


def extract_drift_warnings_from_receipt(receipt_data: dict) -> int:
    """Extract drift warning count from a QA receipt.

    For v2 receipts (receipt_version >= "2"), reads the ``drift_warnings``
    field directly.  For v1 receipts or when the field is absent, falls back
    to scanning step evidence strings for ``"Warnings:"`` patterns and
    counting semicolon-delimited items within each match.

    Returns a non-negative int; 0 when no warnings found or receipt is empty.
    """
    if not receipt_data:
        return 0

    # v2 fast path: direct field
    dw = receipt_data.get("drift_warnings")
    if isinstance(dw, int):
        return max(dw, 0)

    # v1 fallback: scan step evidence for "Warnings:" patterns
    steps = receipt_data.get("steps")
    if not isinstance(steps, list):
        return 0

    total = 0
    for step in steps:
        if not isinstance(step, dict):
            continue
        evidence = step.get("evidence", "")
        if not isinstance(evidence, str):
            continue
        # Find all "Warnings: item1; item2; item3" segments
        for match in re.finditer(r"Warnings:\s*(.+?)(?:\s*\|\s*|$)", evidence):
            segment = match.group(1).strip()
            if segment:
                total += len([s for s in segment.split(";") if s.strip()])
    return total


def validate_dependency_receipt(
    story_id: str, receipts_base_dir: Path | None = None
) -> dict:
    """Validate the QA receipt for a dependency story.

    Checks: receipt file exists (finds highest attempt number), JSON parses,
    ``overall_result == "PASS"``, ``receipt_hash`` integrity via
    ``_recompute_receipt_hash()``.

    Returns ``{"valid": bool, "reason": str, "receipt_path": str}``.
    Never raises — all errors return ``valid: False`` with reason.
    """
    if receipts_base_dir is None:
        receipts_base_dir = Path(".claude/runtime/receipts")

    story_dir = receipts_base_dir / story_id
    if not story_dir.is_dir():
        return {
            "valid": False,
            "reason": f"No receipt directory for {story_id}",
            "receipt_path": "",
        }

    # Find highest attempt directory
    attempt_dirs = sorted(
        [
            d
            for d in story_dir.iterdir()
            if d.is_dir() and d.name.startswith("attempt-")
        ],
        key=lambda d: (
            int(d.name.split("-", 1)[1]) if d.name.split("-", 1)[1].isdigit() else 0
        ),
    )
    if not attempt_dirs:
        return {
            "valid": False,
            "reason": f"No attempt directories for {story_id}",
            "receipt_path": "",
        }

    receipt_file = attempt_dirs[-1] / "qa-receipt.json"
    if not receipt_file.is_file():
        return {
            "valid": False,
            "reason": f"Receipt file not found: {receipt_file}",
            "receipt_path": str(receipt_file),
        }

    try:
        receipt_data = json.loads(receipt_file.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError, UnicodeDecodeError, ValueError) as exc:
        return {
            "valid": False,
            "reason": f"Cannot parse receipt: {exc}",
            "receipt_path": str(receipt_file),
        }

    if receipt_data.get("overall_result") != "PASS":
        return {
            "valid": False,
            "reason": f"Receipt overall_result is {receipt_data.get('overall_result')!r}",
            "receipt_path": str(receipt_file),
        }

    stored_hash = receipt_data.get("receipt_hash")
    if stored_hash:
        computed = _recompute_receipt_hash(receipt_data)
        if computed != stored_hash:
            return {
                "valid": False,
                "reason": (
                    f"Receipt hash mismatch: stored {stored_hash[:12]}... "
                    f"vs computed {computed[:12]}..."
                ),
                "receipt_path": str(receipt_file),
            }

    return {
        "valid": True,
        "reason": "",
        "receipt_path": str(receipt_file),
    }


# ── Phase 3: Server Lifecycle + Auto-Detection + Negative Test File Enforcement ─


def _auto_detect_project_commands(project_root: "Path") -> dict[str, str]:
    """Detect project test/frontend commands from recognized project files.

    Checks for:
    - package.json with scripts.test -> project_test: "npm test"
    - playwright.config.ts or playwright.config.js -> project_frontend_test: "npx playwright test"

    Args:
        project_root: Path to the project root directory to inspect.

    Returns:
        Dict mapping command keys to detected command strings.
        Returns empty dict when no recognized project files exist.
    """
    import json as _json

    result: dict[str, str] = {}

    # Check package.json for scripts.test
    pkg_json = project_root / "package.json"
    if pkg_json.exists() and pkg_json.is_file():
        try:
            data = _json.loads(pkg_json.read_text(encoding="utf-8"))
            scripts = data.get("scripts", {})
            if isinstance(scripts, dict) and scripts.get("test"):
                result["project_test"] = "npm test"
        except (ValueError, OSError, AttributeError):
            pass  # package.json parse failure — skip project detection

    # Check for Playwright config
    playwright_configs = [
        project_root / "playwright.config.ts",
        project_root / "playwright.config.js",
    ]
    for cfg in playwright_configs:
        if cfg.exists() and cfg.is_file():
            result["project_frontend_test"] = "npx playwright test"
            break

    return result


def apply_auto_detected_project_commands(
    workflow_path: "Path",
    project_root: "Path",
) -> dict[str, object]:
    """Backfill host-project command placeholders from detected project files.

    Existing non-placeholder values are preserved. Self-hosted configs are left
    untouched because their ADE self-test commands are intentional.
    """
    _default = {
        "applied": {},
        "detected": {},
        "project_mode": "",
        "updated": False,
    }
    try:
        if not workflow_path.is_file():
            return _default
        workflow = json.loads(workflow_path.read_text(encoding="utf-8"))
        if not isinstance(workflow, dict):
            return _default
        project_mode = workflow.get("project_mode", "")
        _default["project_mode"] = str(project_mode)
        if project_mode != "host_project":
            return _default
        commands = workflow.get("commands", {})
        if not isinstance(commands, dict):
            return _default

        detected = _auto_detect_project_commands(project_root)
        _default["detected"] = detected
        applied: dict[str, str] = {}
        for key, value in detected.items():
            existing = str(commands.get(key, "")).strip()
            if existing and not existing.upper().startswith("TODO"):
                continue
            commands[key] = value
            applied[key] = value

        if not applied:
            return _default

        workflow["commands"] = commands
        workflow_path.write_text(
            json.dumps(workflow, indent=2) + "\n", encoding="utf-8"
        )
        _default["applied"] = applied
        _default["updated"] = True
        return _default
    except (OSError, ValueError, TypeError, json.JSONDecodeError):
        return _default


def _mock_audit_negative_tests_file(
    test_files: "list[Path]",
    config: "dict | None" = None,
    min_tests_for_enforcement: int = 5,
) -> list[str]:
    """Check per-file negative test ratio enforcement.

    For each test file, counts tests with negative/error/edge keywords in their
    names. Returns FAIL issues when the percentage is below the configured
    threshold.

    Args:
        test_files: List of test file Paths to check.
        config: Workflow config dict; reads qa_runner.negative_test_min_pct.
        min_tests_for_enforcement: Files with fewer tests than this are skipped
            (default 5 — avoids flagging tiny unit test files).

    Returns:
        List of issue strings. Empty list means PASS.
    """
    import re as _re

    _qa_cfg = (config or {}).get("qa_runner", {})
    min_pct: int = int(_qa_cfg.get("negative_test_min_pct", 10))
    issues: list[str] = []

    for tf in test_files:
        try:
            content = tf.read_text(encoding="utf-8")
        except (OSError, UnicodeDecodeError):
            continue

        all_names = _re.findall(
            r"^[ \t]*(?:async\s+)?def\s+(test_\w+)\s*\(",
            content,
            _re.MULTILINE,
        )
        total = len(all_names)
        if total < min_tests_for_enforcement:
            continue

        negative_count = sum(
            1
            for name in all_names
            if any(kw in name.lower() for kw in _NEGATIVE_TEST_KEYWORDS)
        )
        pct = negative_count / total * 100
        if pct < min_pct:
            issues.append(
                f"{tf.name}: only {negative_count}/{total} tests ({pct:.0f}%) have"
                f" negative/error/edge keywords (min {min_pct}%)"
            )

    return issues
