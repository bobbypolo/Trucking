"""Validate PLAN.md quality with deterministic checks.

CLI script that validates plan quality by checking for:
- Measurable verbs in Done When criteria (rejects vague-only criteria)
- R-PN-NN format IDs on all Done When items
- Non-empty Testing Strategy per phase
- No placeholder syntax in verification commands
- Test File column coverage in Changes tables
- Minimum 2 acceptance criteria per phase
- Negative/error criterion required for validation-related phases

Usage:
    python plan_validator.py --plan PATH [--strict]

Exit codes:
    0 = PASS (all checks passed)
    1 = FAIL (one or more checks failed)
    2 = Bad arguments or file not found
"""

import argparse
import json
import re
import shutil
import sys
from pathlib import Path

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

# Vague verbs that indicate unmeasurable criteria
_VAGUE_VERBS = frozenset(
    {"works", "handles", "supports", "manages", "ensures", "properly", "correctly"}
)

# Subjective adjectives that make criteria unmeasurable unless paired with
# a concrete condition (e.g., a number, comparison, or measurable verb).
_SUBJECTIVE_WORDS = frozenset(
    {
        "correct",
        "proper",
        "efficient",
        "fast",
        "reliable",
        "handling",
        "appropriate",
        "good",
        "nice",
        "clean",
        "robust",
        "optimal",
        "adequate",
        "reasonable",
        "sufficient",
    }
)

# Measurable verbs that indicate testable behavior
_MEASURABLE_VERBS = frozenset(
    {
        "rejects",
        "returns",
        "raises",
        "contains",
        "produces",
        "creates",
        "emits",
        "increments",
        "decrements",
        "appends",
        "writes",
        "reads",
        "validates",
        "outputs",
        "calls",
        "stores",
        "sets",
        "clears",
        "deletes",
        "removes",
        "updates",
        "exports",
        "imports",
        "passes",
        "fails",
        "exits",
        "logs",
        "sends",
        "receives",
        "matches",
        "includes",
        "excludes",
        "generates",
        "parses",
        "loads",
        "saves",
        "counts",
        "reports",
        "detects",
        "scans",
        "checks",
        "verifies",
        "accepts",
        "blocks",
        "merges",
        "runs",
    }
)

# R-PN-NN marker pattern for Done When items. Criteria may optionally include
# bracketed annotations such as [unit], [integration], or [backend] before the
# trailing colon.
_DONE_WHEN_R_ID_RE = re.compile(
    r"^-\s*(R-P\d+-\d{2}(?:-AC\d+)?)(?:\s+\[[^\]\n]+\])*\s*:"
)

# Accepted headings for acceptance-criteria blocks inside a phase.
_DONE_WHEN_HEADING_RE = re.compile(
    r"^(?:###\s*)?(?:done when|acceptance criteria(?:\s*\(r-markers\))?)\s*:?\s*$",
    re.IGNORECASE,
)

# Phase header pattern
_PHASE_HEADER_RE = re.compile(r"^##\s+Phase\s+\d+", re.MULTILINE)

# Placeholder patterns in verification commands
_PLACEHOLDER_RE = re.compile(
    r"\[.*?\]|(?<!\w)TBD(?!\w)|your_command_here", re.IGNORECASE
)

# Changes table row with Test File column (5+ columns)
_CHANGES_ROW_WITH_TEST_RE = re.compile(
    r"^\|\s*(?:CREATE|MODIFY)\s*\|"  # Action column
    r"\s*`?([^`|\n]+?)`?\s*\|"  # File column
    r"\s*[^|]*\|"  # Description column
    r"\s*`?([^`|\n]*?)`?\s*\|"  # Test File column
    r"\s*[^|]*\|",  # Test Type column
    re.MULTILINE,
)

# Changes table row without Test File column (3 columns only)
_CHANGES_ROW_NO_TEST_RE = re.compile(
    r"^\|\s*(?:CREATE|MODIFY)\s*\|"  # Action column
    r"\s*`?([^`|\n]+?)`?\s*\|"  # File column
    r"\s*[^|]*\|"  # Description column
    r"\s*$",
    re.MULTILINE,
)
# Changes table row capturing Action, File, Description (all non-exempt checks)
_CHANGES_ROW_ALL_COLS_RE = re.compile(
    r"^\|\s*(ADD|CREATE|MODIFY|DELETE)\s*\|"  # Action column (group 1)
    r"\s*`?([^`|\n]+?)`?\s*\|"  # File column (group 2)
    r"\s*([^|\n]*)\|"  # Description column (group 3)
    r"(?:\s*[^|\n]*\|){2}",  # Test File + Test Type columns
    re.MULTILINE,
)
# Backtick identifier pattern (also defined in _qa_lib, redefined locally for plan_validator)
_BACKTICK_IDENTIFIER_RE = re.compile(r"`([^`]+)`")

# Test file basename patterns (exempt from description identifier check)
_TEST_FILE_BASENAMES = re.compile(r"(?:^|/)(?:test_[^/]*|[^/]*_test\.py|conftest\.py)$")


# Untested Files table marker
_UNTESTED_FILES_RE = re.compile(r"###?\s+Untested\s+Files", re.IGNORECASE)

# Test file exclusion patterns (files that are tests themselves)
_TEST_FILE_PATTERNS = frozenset({"test_", "tests/", "N/A", "(self)"})


# ---------------------------------------------------------------------------
# Helper functions
# ---------------------------------------------------------------------------


def _split_plan_into_phases(content: str) -> list[tuple[str, str]]:
    """Split PLAN.md content into (header, body) tuples per phase.

    Args:
        content: Full PLAN.md text content.

    Returns:
        List of (phase_header, phase_body) tuples. The body extends
        from the header to the next phase header or end of file.
    """
    phases: list[tuple[str, str]] = []
    headers = list(_PHASE_HEADER_RE.finditer(content))

    for i, match in enumerate(headers):
        header_line = content[match.start() : content.index("\n", match.start())]
        start = match.end()
        end = headers[i + 1].start() if i + 1 < len(headers) else len(content)
        body = content[start:end]
        phases.append((header_line, body))

    return phases


def _extract_done_when_items(phase_body: str) -> list[str]:
    """Extract Done When bullet items from a phase body.

    Args:
        phase_body: Text content of a single plan phase.

    Returns:
        List of Done When line strings (including the R-PN-NN prefix if present).
    """
    items: list[str] = []
    in_done_when = False

    for line in phase_body.splitlines():
        stripped = line.strip()
        if _DONE_WHEN_HEADING_RE.match(stripped):
            in_done_when = True
            continue
        if in_done_when:
            if stripped.startswith("###") or stripped.startswith("## "):
                break
            if stripped.startswith("- "):
                items.append(stripped[2:].strip())
            elif stripped.startswith("```"):
                break

    return items


def _extract_verification_command(phase_body: str) -> str:
    """Extract the verification command from a phase body.

    Args:
        phase_body: Text content of a single plan phase.

    Returns:
        The verification command text, or empty string if not found.
    """
    in_verification = False
    in_code_block = False
    cmd_lines: list[str] = []

    for line in phase_body.splitlines():
        stripped = line.strip()
        if "verification command" in stripped.lower():
            in_verification = True
            continue
        if in_verification:
            if stripped.startswith("```") and not in_code_block:
                in_code_block = True
                continue
            if stripped.startswith("```") and in_code_block:
                break
            if in_code_block:
                cmd_lines.append(stripped)

    return "\n".join(cmd_lines).strip()


def _is_production_file(filepath: str) -> bool:
    """Check if a filepath represents a production (non-test) file.

    Args:
        filepath: File path string to check.

    Returns:
        True if the file is a production file (not a test or N/A marker).
    """
    lower = filepath.lower().strip()
    if not lower:
        return False
    for pattern in _TEST_FILE_PATTERNS:
        if pattern in lower:
            return False
    return True


# ---------------------------------------------------------------------------
# Check functions (the 5 _check_* helpers)
# ---------------------------------------------------------------------------

# Vague verbs that trigger FAIL when they are the first verb in a criterion.
_FIRST_VERB_VAGUE: frozenset[str] = frozenset(
    {
        "handles",
        "manages",
        "supports",
        "ensures",
        "allows",
        "provides",
        "enables",
        "improves",
        "updates",
        "maintains",
        "processes",
        "deals",
        "works",
    }
)

# Measurable verbs that are acceptable as the first verb in a criterion.
_FIRST_VERB_MEASURABLE: frozenset[str] = frozenset(
    {
        "returns",
        "raises",
        "creates",
        "writes",
        "reads",
        "deletes",
        "logs",
        "emits",
        "prints",
        "sets",
        "calls",
        "validates",
        "rejects",
        "accepts",
        "increments",
        "decrements",
        "produces",
        "generates",
        "checks",
        "verifies",
        "detects",
        "skips",
        "blocks",
        "marks",
        "clears",
    }
)

# Regex to strip leading R-PN-NN + optional bracket annotations from a
# criterion string.
_CRITERION_PREFIX_RE = re.compile(
    r"^R-P\d+-\d{2}(?:-AC\d+)?(?:\s+\[[^\]\n]+\])*\s*:\s*"
)

# Regex to extract the first lowercase word token from a string.
_FIRST_WORD_RE = re.compile(r"\b([a-z]+)\b")


def _check_vague_criteria(criterion_text: str) -> str:
    """Check whether a single criterion's first verb is vague or measurable.

    Strips any leading R-PN-NN: prefix, then extracts the first lowercase word
    token from the remaining text and classifies it as vague or measurable.

    Args:
        criterion_text: A criterion string, optionally prefixed with an R-marker
            (e.g. ``"R-P1-01: handles errors by returning error code"``).

    Returns:
        ``"FAIL"`` when the first verb is in the vague-verb list and NOT in the
        measurable-verb list. ``"PASS"`` otherwise (measurable first verb, or
        no recognisable verb found).
    """
    # Strip the R-marker prefix so we classify on the description only.
    body = _CRITERION_PREFIX_RE.sub("", criterion_text).strip()
    match = _FIRST_WORD_RE.search(body)
    if not match:
        return "PASS"
    first_word = match.group(1).lower()
    if first_word in _FIRST_VERB_VAGUE and first_word not in _FIRST_VERB_MEASURABLE:
        return "FAIL"
    return "PASS"


def _check_vague_criteria_phases(phases: list[tuple[str, str]]) -> dict:
    """Check that Done When criteria contain measurable verbs.

    Args:
        phases: List of (header, body) tuples from the plan.

    Returns:
        Check result dict with name, result, and evidence.
    """
    failing_criteria: list[str] = []

    for _header, body in phases:
        items = _extract_done_when_items(body)
        for item in items:
            words = set(re.findall(r"\b[a-z]+\b", item.lower()))
            has_vague = bool(words & _VAGUE_VERBS)
            has_measurable = bool(words & _MEASURABLE_VERBS)
            has_subjective = bool(words & _SUBJECTIVE_WORDS)
            if (has_vague or has_subjective) and not has_measurable:
                # Extract R-ID if present for reporting
                r_match = _DONE_WHEN_R_ID_RE.match(f"- {item}")
                r_id = r_match.group(1) if r_match else "unknown"
                failing_criteria.append(f"{r_id}: {item[:120]}")

    if failing_criteria:
        return {
            "name": "vague_criteria",
            "result": "FAIL",
            "evidence": "; ".join(failing_criteria),
        }
    return {
        "name": "vague_criteria",
        "result": "PASS",
        "evidence": "All criteria contain measurable verbs",
    }


def _check_r_id_format(phases: list[tuple[str, str]]) -> dict:
    """Check that all Done When items have R-PN-NN format IDs.

    Args:
        phases: List of (header, body) tuples from the plan.

    Returns:
        Check result dict with name, result, and evidence.
    """
    missing_ids: list[str] = []

    for header, body in phases:
        items = _extract_done_when_items(body)
        for item in items:
            r_match = _DONE_WHEN_R_ID_RE.match(f"- {item}")
            if not r_match:
                missing_ids.append(f"{header}: {item[:80]}")

    if missing_ids:
        return {
            "name": "r_id_format",
            "result": "FAIL",
            "evidence": f"Missing R-PN-NN IDs: {'; '.join(missing_ids)}",
        }
    return {
        "name": "r_id_format",
        "result": "PASS",
        "evidence": "All Done When items have R-PN-NN format IDs",
    }


def _check_testing_strategy(phases: list[tuple[str, str]]) -> dict:
    """Check that each phase has a non-empty Testing Strategy section.

    Args:
        phases: List of (header, body) tuples from the plan.

    Returns:
        Check result dict with name, result, and evidence.
    """
    missing_phases: list[str] = []

    for header, body in phases:
        if "### testing strategy" not in body.lower():
            missing_phases.append(header)
            continue
        # Check it has at least one table row (pipe-delimited line after header row)
        in_strategy = False
        has_content_row = False
        for line in body.splitlines():
            if "testing strategy" in line.lower() and line.strip().startswith("#"):
                in_strategy = True
                continue
            if in_strategy:
                stripped = line.strip()
                if stripped.startswith("###") or stripped.startswith("## "):
                    break
                if stripped.startswith("|") and "---" not in stripped:
                    # Skip header rows (contain column names like What, Type)
                    lower_line = stripped.lower()
                    if "what" not in lower_line and "type" not in lower_line:
                        has_content_row = True
                        break

        if not has_content_row:
            missing_phases.append(f"{header} (empty)")

    if missing_phases:
        return {
            "name": "testing_strategy",
            "result": "FAIL",
            "evidence": f"Missing or empty Testing Strategy: {'; '.join(missing_phases)}",
        }
    return {
        "name": "testing_strategy",
        "result": "PASS",
        "evidence": "All phases have non-empty Testing Strategy sections",
    }


def _check_verification_placeholders(phases: list[tuple[str, str]]) -> dict:
    """Check that verification commands do not contain placeholder syntax.

    Args:
        phases: List of (header, body) tuples from the plan.

    Returns:
        Check result dict with name, result, and evidence.
    """
    placeholder_phases: list[str] = []

    for header, body in phases:
        cmd = _extract_verification_command(body)
        if not cmd:
            continue
        if _PLACEHOLDER_RE.search(cmd):
            placeholder_phases.append(f"{header}: {cmd[:80]}")

    if placeholder_phases:
        return {
            "name": "placeholder_commands",
            "result": "FAIL",
            "evidence": f"Placeholder syntax found: {'; '.join(placeholder_phases)}",
        }
    return {
        "name": "placeholder_commands",
        "result": "PASS",
        "evidence": "No placeholder syntax in verification commands",
    }


def _check_test_file_coverage(phases: list[tuple[str, str]]) -> dict:
    """Check that production files in Changes tables have Test File entries.

    A phase passes if either:
    - All CREATE/MODIFY production files have a Test File column entry, OR
    - The phase has an Untested Files justification table.

    Args:
        phases: List of (header, body) tuples from the plan.

    Returns:
        Check result dict with name, result, and evidence.
    """
    uncovered_phases: list[str] = []

    for header, body in phases:
        has_untested_table = bool(_UNTESTED_FILES_RE.search(body))

        # Find Changes table rows with Test File column
        rows_with_test = _CHANGES_ROW_WITH_TEST_RE.findall(body)
        # Find Changes table rows without Test File column (3-column format)
        rows_no_test = _CHANGES_ROW_NO_TEST_RE.findall(body)

        if rows_no_test and not has_untested_table:
            # Has production file rows but no Test File column and no justification
            prod_files = [f for f in rows_no_test if _is_production_file(f)]
            if prod_files:
                uncovered_phases.append(
                    f"{header}: missing Test File column for {', '.join(prod_files[:3])}"
                )
            continue

        # Check rows that have Test File column but empty entries
        if rows_with_test:
            missing_test: list[str] = []
            for filepath, test_file in rows_with_test:
                if _is_production_file(filepath) and not test_file.strip():
                    missing_test.append(filepath.strip())
            if missing_test and not has_untested_table:
                uncovered_phases.append(
                    f"{header}: no test file for {', '.join(missing_test[:3])}"
                )

    if uncovered_phases:
        return {
            "name": "test_file_coverage",
            "result": "FAIL",
            "evidence": f"Production files without test coverage: {'; '.join(uncovered_phases)}",
        }
    return {
        "name": "test_file_coverage",
        "result": "PASS",
        "evidence": "All production files have test file entries or justification",
    }


# Assertion keywords that must appear in at least one Testing Strategy section
# to prove the plan includes concrete test blueprints, not just vague descriptions.
_ASSERTION_KEYWORDS = frozenset(
    {
        "assert ",
        "assert(",
        "assertEqual",
        "assertRaises",
        "assertIn",
        "assertIs",
        "assertIsNone",
        "assertIsNotNone",
        "assertTrue",
        "assertFalse",
        "assertGreater",
        "assertLess",
        "assertAlmostEqual",
        "assertNotEqual",
        "assertRegex",
        "pytest.raises",
        "expect(",
        "assert_called",
        "assert_called_with",
        "assert_called_once",
        "== ",
        "!= ",
        ">= ",
        "<= ",
    }
)


def _check_testing_strategy_assertions(phases: list[tuple[str, str]]) -> dict:
    """Check that Testing Strategy sections contain assertion blueprints.

    At least one assertion keyword must appear in the Testing Strategy text
    across all phases to ensure tests are not vacuous.

    Args:
        phases: List of (header, body) tuples from the plan.

    Returns:
        Check result dict with name, result, and evidence.
    """
    phases_missing: list[str] = []

    for header, body in phases:
        # Find the Testing Strategy section
        in_strategy = False
        strategy_text: list[str] = []
        for line in body.splitlines():
            if "testing strategy" in line.lower() and line.strip().startswith("#"):
                in_strategy = True
                continue
            if in_strategy:
                stripped = line.strip()
                if stripped.startswith("###") or stripped.startswith("## "):
                    break
                strategy_text.append(line)

        if not strategy_text:
            continue  # _check_testing_strategy already handles missing sections

        combined = "\n".join(strategy_text)
        has_assertion = any(kw in combined for kw in _ASSERTION_KEYWORDS)
        if not has_assertion:
            phases_missing.append(header)

    if phases_missing:
        return {
            "name": "testing_strategy_assertions",
            "result": "FAIL",
            "evidence": (
                f"No assertion blueprints in Testing Strategy: "
                f"{'; '.join(phases_missing)}. "
                f"Include explicit assertions (e.g., assertEqual, pytest.raises, assert x == y)."
            ),
        }
    return {
        "name": "testing_strategy_assertions",
        "result": "PASS",
        "evidence": "All Testing Strategy sections contain assertion blueprints",
    }


# Code block pattern for discovery evidence — matches ``` fenced blocks
_CODE_BLOCK_RE = re.compile(r"```[\s\S]*?```")

# Tool output indicators — at least one must appear inside code blocks
_TOOL_OUTPUT_INDICATORS = frozenset(
    {
        "grep ",
        "cat ",
        "rg ",
        "find ",
        "ls ",
        "head ",
        "git ",
        "python ",
        "$ ",
        ">>>",
        "Read(",
        "Glob(",
        "Grep(",
    }
)


def _check_discovery_evidence(content: str) -> dict:
    """Check that System Context contains code blocks proving tool discovery.

    The plan's System Context section must include at least one markdown
    fenced code block (```) containing tool output (grep, cat, etc.) to
    demonstrate the Architect performed real discovery.

    Args:
        content: Full PLAN.md text content.

    Returns:
        Check result dict with name, result, and evidence.
    """
    # Find System Context section
    system_context_start = None
    lines = content.splitlines()
    for i, line in enumerate(lines):
        if "system context" in line.lower() and line.strip().startswith("#"):
            system_context_start = i
            break

    if system_context_start is None:
        return {
            "name": "discovery_evidence",
            "result": "FAIL",
            "evidence": "No System Context section found in plan",
        }

    # Extract System Context body (until next ## header)
    sc_lines: list[str] = []
    for line in lines[system_context_start + 1 :]:
        if line.strip().startswith("## ") and "phase" in line.lower():
            break
        if line.strip().startswith("## "):
            break
        sc_lines.append(line)

    sc_text = "\n".join(sc_lines)

    # Check for code blocks
    code_blocks = _CODE_BLOCK_RE.findall(sc_text)
    if not code_blocks:
        return {
            "name": "discovery_evidence",
            "result": "FAIL",
            "evidence": (
                "System Context has no code blocks (```) — "
                "include raw tool output (grep, cat, Glob, etc.) "
                "to prove discovery was performed"
            ),
        }

    # Check that at least one code block contains tool output indicators
    has_tool_output = False
    for block in code_blocks:
        if any(indicator in block for indicator in _TOOL_OUTPUT_INDICATORS):
            has_tool_output = True
            break

    if not has_tool_output:
        return {
            "name": "discovery_evidence",
            "result": "FAIL",
            "evidence": (
                "System Context code blocks lack tool output indicators — "
                "include raw output from grep, cat, Glob, etc."
            ),
        }

    return {
        "name": "discovery_evidence",
        "result": "PASS",
        "evidence": f"System Context contains {len(code_blocks)} code block(s) with tool output",
    }


# Regex to extract Testing Strategy table rows (5-column: What | Type | Real/Mock | Justification | Test File)
_STRATEGY_ROW_RE = re.compile(
    r"^\|\s*([^|]+?)\s*\|"  # What
    r"\s*([^|]+?)\s*\|"  # Type
    r"\s*([^|]*?)\s*\|"  # Real / Mock column
    r"\s*([^|]*?)\s*\|"  # Justification
    r"\s*([^|]*?)\s*\|",  # Test File
    re.MULTILINE,
)

# Valid values for the Real/Mock column
_VALID_REAL_MOCK = frozenset({"real", "mock", "real + mock", "n/a"})


def _check_real_mock_column(phases: list[tuple[str, str]]) -> dict:
    """Check that Testing Strategy has a Real/Mock column with valid entries.

    Args:
        phases: List of (header, body) tuples from the plan.

    Returns:
        Check result dict with name, result, and evidence.
    """
    failing_phases: list[str] = []

    for header, body in phases:
        # Find the Testing Strategy section
        in_strategy = False
        strategy_lines: list[str] = []
        for line in body.splitlines():
            if "testing strategy" in line.lower() and line.strip().startswith("#"):
                in_strategy = True
                continue
            if in_strategy:
                stripped = line.strip()
                if stripped.startswith("###") or stripped.startswith("## "):
                    break
                strategy_lines.append(line)

        if not strategy_lines:
            continue

        # Check if header row contains "Real" or "Mock" column indicator
        has_real_mock_header = False
        for line in strategy_lines:
            lower = line.lower()
            if lower.strip().startswith("|") and ("real" in lower or "mock" in lower):
                has_real_mock_header = True
                break

        if not has_real_mock_header:
            failing_phases.append(f"{header}: no Real/Mock column in Testing Strategy")
            continue

        # Validate content rows have non-empty Real/Mock values
        for match in _STRATEGY_ROW_RE.finditer("\n".join(strategy_lines)):
            what_col = match.group(1).strip().lower()
            real_mock_col = match.group(3).strip().lower()
            # Skip header and separator rows
            if "what" in what_col or "---" in what_col:
                continue
            if not real_mock_col or real_mock_col == "---":
                failing_phases.append(
                    f"{header}: empty Real/Mock for '{match.group(1).strip()}'"
                )
            elif real_mock_col not in _VALID_REAL_MOCK:
                failing_phases.append(
                    f"{header}: invalid Real/Mock value '{match.group(3).strip()}'"
                    f" for '{match.group(1).strip()}' (expected: Real, Mock, Real + Mock, N/A)"
                )

    if failing_phases:
        return {
            "name": "real_mock_column",
            "result": "FAIL",
            "evidence": "; ".join(failing_phases),
        }
    return {
        "name": "real_mock_column",
        "result": "PASS",
        "evidence": "All Testing Strategy rows have valid Real/Mock entries",
    }


# ---------------------------------------------------------------------------
# Upgrade 6: Minimum criteria count and negative criterion checks
# ---------------------------------------------------------------------------

# Keywords that mark a phase as "validation-related" — triggering the
# negative-criterion requirement.
_VALIDATION_KEYWORDS = frozenset(
    {
        "validation",
        "validating",
        "validate",
        "filtering",
        "filter",
        "input handling",
        "error handling",
        "sanitiz",
        "sanitise",
    }
)

# Words that indicate a negative/error criterion is present.
_NEGATIVE_CRITERION_WORDS = frozenset(
    {
        "rejects",
        "raises",
        "returns error",
        "fails when",
        "invalid",
        "fail",
        "fails",
        "error",
        "exception",
        "illegal",
        "forbidden",
        "unauthorized",
        "denied",
    }
)


def _phase_is_validation_related(header: str, body: str) -> bool:
    """Return True if the phase appears to be validation-related.

    Checks the phase header and the Changes table description column for
    keywords that indicate the phase involves validation, filtering, or
    error/input handling.

    Args:
        header: Phase header line (e.g. ``"## Phase 2: Validate Input"``).
        body: Text body of the phase.

    Returns:
        True when at least one validation keyword is found in the header
        or Changes table rows.
    """
    combined_lower = (header + "\n" + body).lower()
    return any(kw in combined_lower for kw in _VALIDATION_KEYWORDS)


def _check_minimum_criteria_count(phases: list[tuple[str, str]]) -> dict:
    """Check that each phase has at least 2 Done When acceptance criteria.

    A phase with fewer than 2 R-PN-NN Done When items is considered
    insufficiently specified.

    Args:
        phases: List of (header, body) tuples from the plan.

    Returns:
        Check result dict with name, result, and evidence.
    """
    failing_phases: list[str] = []

    for header, body in phases:
        items = _extract_done_when_items(body)
        if len(items) < 2:
            failing_phases.append(
                f"{header}: has {len(items)} criterion/criteria (minimum 2 required)"
            )

    if failing_phases:
        return {
            "name": "minimum_criteria_count",
            "result": "FAIL",
            "evidence": (
                f"Phases with fewer than 2 acceptance criteria: "
                f"{'; '.join(failing_phases)}"
            ),
        }
    return {
        "name": "minimum_criteria_count",
        "result": "PASS",
        "evidence": "All phases have at least 2 acceptance criteria",
    }


def _check_negative_criterion_for_validation_phases(
    phases: list[tuple[str, str]],
) -> dict:
    """Check that validation-related phases include at least one negative criterion.

    If a phase's header or Changes table mentions validation, filtering,
    input handling, or error handling, at least one Done When criterion
    must use words like "rejects", "raises", "returns error", "fails when",
    or "invalid".

    Args:
        phases: List of (header, body) tuples from the plan.

    Returns:
        Check result dict with name, result, and evidence.
    """
    failing_phases: list[str] = []

    for header, body in phases:
        if not _phase_is_validation_related(header, body):
            continue

        items = _extract_done_when_items(body)
        has_negative = False
        for item in items:
            item_lower = item.lower()
            if any(neg in item_lower for neg in _NEGATIVE_CRITERION_WORDS):
                has_negative = True
                break

        if not has_negative:
            failing_phases.append(
                f"{header}: validation-related phase has no negative/error criterion "
                f"(add a criterion using 'rejects', 'raises', 'returns error', "
                f"'fails when', or 'invalid')"
            )

    if failing_phases:
        return {
            "name": "negative_criterion_for_validation",
            "result": "FAIL",
            "evidence": "; ".join(failing_phases),
        }
    return {
        "name": "negative_criterion_for_validation",
        "result": "PASS",
        "evidence": (
            "All validation-related phases have at least one negative/error criterion"
        ),
    }


# ---------------------------------------------------------------------------
# Upgrade 7: Criterion specificity scoring
# ---------------------------------------------------------------------------

# Patterns that signal a criterion has a concrete, measurable value.
# We match the stripped criterion body (R-marker prefix removed).

# Numbers — including decimals, negatives, and percentages.
_SPECIFICITY_NUMBER_RE = re.compile(r"\b\d[\d.,]*%?\b")

# Comparison operators.
_SPECIFICITY_OPERATOR_RE = re.compile(r"[=!<>]=|[<>](?!=)")

# Specific quantity phrases such as "exactly 3", "at least 2", "no more than 5".
_SPECIFICITY_QUANTITY_RE = re.compile(
    r"\b(?:exactly|at least|at most|no more than|fewer than|more than|up to)\s+\d",
    re.IGNORECASE,
)

# Named error/exception types (CamelCase words followed by "Error", "Exception",
# or common HTTP/exit code phrases).
_SPECIFICITY_NAMED_BEHAVIOR_RE = re.compile(
    r"\b(?:[A-Z][A-Za-z]*(?:Error|Exception|Warning))"  # e.g. ValueError
    r"|\bHTTP\s+\d{3}\b"  # e.g. HTTP 200
    r"|\bexit\s+code\s+\d+\b"  # e.g. exit code 0
    r"|\bempty\s+(?:list|dict|set|string|str|tuple|array)\b"  # e.g. empty list
    r"|\bNone\b"  # e.g. returns None
    r"|\bTrue\b|\bFalse\b",  # boolean literals
    re.IGNORECASE,
)

# File path / extension references (e.g. "qa_receipt.json", ".py").
# Uses an explicit allowlist of known file extensions to avoid false positives
# from abbreviations like "e.g." or "i.e." that also match word.word patterns.
_SPECIFICITY_FILE_RE = re.compile(
    r"\b\w+\.(?:py|js|ts|tsx|jsx|json|yaml|yml|md|txt|html|css|toml|cfg|ini|sh|sql|xml|csv)\b"
    r"|\.(?:py|json|yaml|yml|md|txt)\b"
)

# Backtick-quoted identifiers — code references like `foo()` or `bar.baz`.
_SPECIFICITY_BACKTICK_RE = re.compile(r"`[^`]+`")


def _check_criterion_specificity(criterion_text: str) -> str:
    """Check whether a single criterion contains at least one concrete value.

    Strips any leading R-PN-NN: prefix, then tests whether the remaining
    text contains any of: a number, a comparison operator, a quantity phrase
    (e.g. "exactly 3"), a named error type or specific behavior keyword
    (e.g. "ValueError", "HTTP 200", "exit code 0"), a file path reference,
    or a backtick-quoted code identifier.

    Args:
        criterion_text: A criterion string, optionally prefixed with an
            R-marker (e.g. ``"R-P1-01: returns 200 status code"``).

    Returns:
        ``"PASS"`` when at least one concrete value pattern is found.
        ``"WARN"`` when no concrete value is found (criterion is too vague).
    """
    body = _CRITERION_PREFIX_RE.sub("", criterion_text).strip()
    if not body:
        return "PASS"  # empty criterion; vague-criteria check handles absence

    if _SPECIFICITY_NUMBER_RE.search(body):
        return "PASS"
    if _SPECIFICITY_OPERATOR_RE.search(body):
        return "PASS"
    if _SPECIFICITY_QUANTITY_RE.search(body):
        return "PASS"
    if _SPECIFICITY_NAMED_BEHAVIOR_RE.search(body):
        return "PASS"
    if _SPECIFICITY_FILE_RE.search(body):
        return "PASS"
    if _SPECIFICITY_BACKTICK_RE.search(body):
        return "PASS"

    return "WARN"


def _check_specificity_phases(phases: list[tuple[str, str]]) -> dict:
    """Check that Done When criteria contain concrete, specific values.

    Criteria that pass the measurable-verb check but contain only a generic
    object (e.g. "returns result", "produces output") are flagged as warnings.
    This check always returns ``"WARN"`` or ``"PASS"`` — never ``"FAIL"`` —
    so it does not block plan approval but alerts the Architect to strengthen
    weak criteria.

    Args:
        phases: List of (header, body) tuples from the plan.

    Returns:
        Check result dict with name, result (``"PASS"`` or ``"WARN"``),
        and evidence.
    """
    weak_criteria: list[str] = []

    for _header, body in phases:
        items = _extract_done_when_items(body)
        for item in items:
            if _check_criterion_specificity(item) == "WARN":
                r_match = _DONE_WHEN_R_ID_RE.match(f"- {item}")
                r_id = r_match.group(1) if r_match else "unknown"
                weak_criteria.append(f"{r_id}: {item[:120]}")

    if weak_criteria:
        return {
            "name": "criterion_specificity",
            "result": "WARN",
            "evidence": (
                "Criteria lack concrete values (add numbers, comparison operators, "
                "named error types, file paths, or backtick identifiers): "
                + "; ".join(weak_criteria)
            ),
        }
    return {
        "name": "criterion_specificity",
        "result": "PASS",
        "evidence": "All criteria contain at least one concrete value",
    }


# ---------------------------------------------------------------------------
# Upgrade 8: Description identifier quality check
# ---------------------------------------------------------------------------


def _check_description_identifiers(phases: list[tuple[str, str]]) -> dict:
    """Check that ADD/MODIFY Changes table rows have backtick-delimited identifiers.

    For each phase, scans the Changes table for ADD/MODIFY rows. Each row's
    Description column must contain at least one backtick-delimited identifier
    (e.g. ``add `foo()` function``). Rows are exempt when:

    - Action is DELETE
    - File ends with ``.md`` or ``.json``
    - File matches test file patterns (``test_*``, ``*_test.py``, ``conftest.py``)

    Args:
        phases: List of (header, body) tuples from the plan.

    Returns:
        Check result dict with name, result, and evidence.
    """
    failing_rows: list[str] = []

    for _header, body in phases:
        for m in _CHANGES_ROW_ALL_COLS_RE.finditer(body):
            action = m.group(1).strip().upper()
            filepath_raw = m.group(2).strip().strip("`")
            description = m.group(3).strip()

            # Exempt DELETE actions
            if action == "DELETE":
                continue

            # Exempt .md and .json files
            if filepath_raw.endswith(".md") or filepath_raw.endswith(".json"):
                continue

            # Exempt test file patterns: test_*, *_test.py, conftest.py
            basename = filepath_raw.split("/")[-1].split("\\")[-1]
            if (
                basename.startswith("test_")
                or basename.endswith("_test.py")
                or basename == "conftest.py"
            ):
                continue

            # Check for at least one backtick identifier in description
            if not _BACKTICK_IDENTIFIER_RE.search(description):
                failing_rows.append(filepath_raw)

    if failing_rows:
        return {
            "name": "description_identifiers",
            "result": "FAIL",
            "evidence": (
                "Changes table rows missing backtick-delimited identifiers in "
                f"Description column: {'; '.join(failing_rows)}"
            ),
        }
    return {
        "name": "description_identifiers",
        "result": "PASS",
        "evidence": (
            "All non-exempt Changes table rows contain at least one backtick identifier"
        ),
    }


# ---------------------------------------------------------------------------
# Phase 4: Specificity Scoring, API Contracts Section, Layer Tags
# ---------------------------------------------------------------------------

# Concrete signals that contribute to specificity score (25 points each):
# 1. Has a concrete number  2. Has a quoted value  3. Has measurable verb + specific object
# 4. Specifies an error/boundary condition

# Signal 1: concrete number (digits, decimals, negatives, percentages)
_SCORE_NUMBER_RE = re.compile(r"\b\d[\d.,]*%?\b")

# Signal 2: quoted value (double or single quotes with content)
_SCORE_QUOTED_RE = re.compile(r'["\'][^"\']+["\']')

# Signal 3: backtick identifiers (specific function/module references)
_SCORE_BACKTICK_RE = re.compile(r"`[^`]+`")

# Signal 4: error/boundary condition keywords
_SCORE_ERROR_BOUNDARY_RE = re.compile(
    r"\b(?:raises?|rejects?|error|exception|invalid|boundary|edge|fail|forbidden"
    r"|unauthorized|denied|None|True|False|HTTP\s+\d{3}|exit\s+code)\b",
    re.IGNORECASE,
)

# Frontend file extensions (indicates a full-stack plan when both frontend + backend present)
_FRONTEND_EXTS: frozenset[str] = frozenset({".tsx", ".jsx", ".vue", ".svelte"})

# Backend file extensions
_BACKEND_EXTS: frozenset[str] = frozenset({".py", ".go", ".java", ".rb", ".rs", ".ts"})

# Layer tag pattern: [backend], [frontend], or [integration] after an R-marker
_LAYER_TAG_RE = re.compile(r"\[(?:backend|frontend|integration)\]", re.IGNORECASE)

# R-ID pattern in Done When lines (for layer tag extraction)
_DONE_WHEN_R_ITEM_RE = re.compile(
    r"^-\s+R-P\d+-\d{2}(?:-AC\d+)?(?:\s+\[[^\]\n]+\])*\s*:"
)

# Phase type directive pattern
_PHASE_TYPE_RE = re.compile(r"\*\*Phase\s+Type\*\*:?\s*`?(\w+)`?", re.IGNORECASE)

# Changes table row capturing the File column
_CHANGES_FILE_RE = re.compile(
    r"^\|\s*(?:ADD|CREATE|MODIFY|DELETE)\s*\|\s*`?([^`|\n]+?)`?\s*\|",
    re.MULTILINE,
)

# Minimum score for specificity check to pass (50 out of 100)
_SPECIFICITY_MIN_SCORE = 50


def _score_criterion(criterion_text: str) -> int:
    """Score a single criterion on the 4-signal scoring system (0-100).

    Each signal that is present contributes 25 points:
    1. Contains a concrete number
    2. Contains a quoted value (string literal)
    3. Contains a backtick identifier (specific code reference)
    4. Contains an error/boundary condition keyword

    Args:
        criterion_text: A criterion string (with or without R-marker prefix).

    Returns:
        Integer score from 0 to 100.
    """
    body = _CRITERION_PREFIX_RE.sub("", criterion_text).strip()
    score = 0
    if _SCORE_NUMBER_RE.search(body):
        score += 25
    if _SCORE_QUOTED_RE.search(body):
        score += 25
    if _SCORE_BACKTICK_RE.search(body):
        score += 25
    if _SCORE_ERROR_BOUNDARY_RE.search(body):
        score += 25
    return score


def _check_specificity_scoring(phases: list[tuple[str, str]]) -> dict:
    """Check that Done When criteria score >= 50 on the 4-signal specificity scoring system.

    Criteria scoring below 50 are flagged as FAIL. A score of 50 requires at least
    2 of the 4 specificity signals to be present.

    The 4 signals (25 pts each):
    1. Concrete number (e.g., ``200``, ``3``, ``85%``)
    2. Quoted string value (e.g., ``"token"``, ``'active'``)
    3. Backtick-quoted identifier (e.g., ````validate()````)
    4. Error/boundary keyword (e.g., ``raises``, ``ValueError``, ``invalid``)

    Args:
        phases: List of (header, body) tuples from the plan.

    Returns:
        Check result dict with name, result (``"PASS"`` or ``"FAIL"``), and evidence.
    """
    if not phases:
        return {
            "name": "specificity_scoring",
            "result": "PASS",
            "evidence": "No phases to score",
        }

    low_scores: list[str] = []

    for _header, body in phases:
        items = _extract_done_when_items(body)
        for item in items:
            score = _score_criterion(item)
            if score < _SPECIFICITY_MIN_SCORE:
                r_match = _DONE_WHEN_R_ID_RE.match(f"- {item}")
                r_id = r_match.group(1) if r_match else "unknown"
                low_scores.append(f"{r_id} (score={score}): {item[:100]}")

    if low_scores:
        return {
            "name": "specificity_scoring",
            "result": "FAIL",
            "evidence": (
                f"Criteria scoring below {_SPECIFICITY_MIN_SCORE}/100 "
                f"(need >= 2 of 4 signals: number, quoted value, backtick id, error/boundary): "
                + "; ".join(low_scores)
            ),
        }
    return {
        "name": "specificity_scoring",
        "result": "PASS",
        "evidence": "All criteria score >= 50 on the 4-signal specificity system",
    }


def _is_fullstack_plan(phases: list[tuple[str, str]], plan_content: str) -> bool:
    """Determine whether a plan involves both frontend and backend files.

    Args:
        phases: List of (header, body) tuples from the plan.
        plan_content: Full plan text (used for additional searching).

    Returns:
        True when the plan's Changes tables contain both frontend (.tsx/.jsx)
        and backend (.py/.ts etc.) file extensions.
    """
    has_frontend = False
    has_backend = False

    for _header, body in phases:
        for m in _CHANGES_FILE_RE.finditer(body):
            filepath = m.group(1).strip().strip("`")
            ext = "." + filepath.rsplit(".", 1)[-1] if "." in filepath else ""
            if ext in _FRONTEND_EXTS:
                has_frontend = True
            elif ext in _BACKEND_EXTS and ext != ".ts":
                has_backend = True
            elif ext == ".ts" and not filepath.endswith(".spec.ts"):
                has_backend = True

    return has_frontend and has_backend


def _check_api_contracts_section(
    phases: list[tuple[str, str]], plan_content: str
) -> dict:
    """Check that full-stack integration/e2e plans contain an ``### API Contracts`` section.

    Only applies to plans that contain both frontend (.tsx/.jsx) and backend (.py/.ts)
    files in their Changes tables. Plans with only backend or only frontend files
    are skipped. Foundation and module phase types are also skipped.

    Args:
        phases: List of (header, body) tuples from the plan.
        plan_content: Full plan text content.

    Returns:
        Check result dict with name, result, and evidence.
    """
    if not _is_fullstack_plan(phases, plan_content):
        return {
            "name": "api_contracts_section",
            "result": "SKIP",
            "evidence": "Not a full-stack plan — API Contracts check not applicable",
        }

    # Check if any phase is integration or e2e type
    has_integration_or_e2e = False
    for _header, body in phases:
        m = _PHASE_TYPE_RE.search(body)
        if m:
            phase_type = m.group(1).lower()
            if phase_type in ("integration", "e2e"):
                has_integration_or_e2e = True
                break

    if not has_integration_or_e2e:
        return {
            "name": "api_contracts_section",
            "result": "SKIP",
            "evidence": "No integration or e2e phase — API Contracts check not applicable",
        }

    # Check for ### API Contracts section with at least one table row
    api_contracts_re = re.compile(r"###\s+API\s+Contracts", re.IGNORECASE)
    if not api_contracts_re.search(plan_content):
        return {
            "name": "api_contracts_section",
            "result": "FAIL",
            "evidence": (
                "Full-stack plan with integration/e2e phase is missing an "
                "``### API Contracts`` section. Add a table documenting each "
                "endpoint's method, request schema, and response schema."
            ),
        }

    return {
        "name": "api_contracts_section",
        "result": "PASS",
        "evidence": "Full-stack plan has an API Contracts section",
    }


def _check_layer_tags(phases: list[tuple[str, str]], plan_content: str) -> dict:
    """Check that R-markers in full-stack plans carry layer tags.

    In plans that combine frontend and backend files, each Done When R-marker
    must include a ``[backend]``, ``[frontend]``, or ``[integration]`` tag
    directly after the R-ID to clarify which layer owns the criterion.

    Only applies to plans that contain both frontend (.tsx/.jsx) and backend
    (.py/.ts) files in their Changes tables.

    Args:
        phases: List of (header, body) tuples from the plan.
        plan_content: Full plan text content.

    Returns:
        Check result dict with name, result, and evidence.
    """
    if not _is_fullstack_plan(phases, plan_content):
        return {
            "name": "layer_tags",
            "result": "SKIP",
            "evidence": "Not a full-stack plan — layer tag check not applicable",
        }

    missing_tags: list[str] = []

    for _header, body in phases:
        items = _extract_done_when_items(body)
        for item in items:
            r_match = _DONE_WHEN_R_ID_RE.match(f"- {item}")
            if r_match and not _LAYER_TAG_RE.search(item):
                r_id = r_match.group(1)
                missing_tags.append(f"{r_id}: {item[:80]}")

    if missing_tags:
        return {
            "name": "layer_tags",
            "result": "FAIL",
            "evidence": (
                "Full-stack plan R-markers missing layer tag "
                "([backend] / [frontend] / [integration]): " + "; ".join(missing_tags)
            ),
        }
    return {
        "name": "layer_tags",
        "result": "PASS",
        "evidence": "All R-markers in full-stack plan have layer tags",
    }


# ---------------------------------------------------------------------------
# Phase 6: Feasibility checks (file existence, executability, sequencing)
# ---------------------------------------------------------------------------

# Regex to capture MODIFY rows: | MODIFY | `path` | ... |
_MODIFY_ROW_FILE_RE = re.compile(
    r"^\|\s*MODIFY\s*\|\s*`?([^`|\n]+?)`?\s*\|",
    re.MULTILINE,
)

# Regex to capture CREATE rows: | CREATE | `path` | ... |
_CREATE_ROW_FILE_RE = re.compile(
    r"^\|\s*CREATE\s*\|\s*`?([^`|\n]+?)`?\s*\|",
    re.MULTILINE,
)


def _check_modify_file_existence(phases: list[tuple[str, str]]) -> dict:
    """Check that every MODIFY file in Changes tables exists on disk.

    Files listed as MODIFY are expected to already exist; a plan that
    references a missing MODIFY target is unrecoverable at build time.

    Args:
        phases: List of (header, body) tuples from the plan.

    Returns:
        Check result dict with name, result (PASS/FAIL), and details list.
    """
    missing: list[str] = []

    for _header, body in phases:
        for match in _MODIFY_ROW_FILE_RE.finditer(body):
            filepath = match.group(1).strip()
            if not filepath or filepath.lower() in {"n/a", "(self)"}:
                continue
            if not Path(filepath).is_file():
                missing.append(f"MODIFY file not found: {filepath}")

    if missing:
        return {
            "name": "modify_file_existence",
            "result": "FAIL",
            "evidence": "; ".join(missing),
            "details": missing,
        }
    return {
        "name": "modify_file_existence",
        "result": "PASS",
        "evidence": "All MODIFY files exist on disk",
        "details": [],
    }


def _check_verification_command_executability(phases: list[tuple[str, str]]) -> dict:
    """Check that each phase's Verification Command uses an executable on PATH.

    Extracts the first token of each phase's verification command and runs
    shutil.which() on it. Returns FAIL if any executable is not found.

    Args:
        phases: List of (header, body) tuples from the plan.

    Returns:
        Check result dict with name, result (PASS/FAIL), and details list.
    """
    missing: list[str] = []

    for header, body in phases:
        cmd = _extract_verification_command(body)
        if not cmd:
            continue
        first_line = cmd.splitlines()[0].strip()
        if not first_line:
            continue
        # Extract the first token (the executable)
        executable = first_line.split()[0]
        if not executable:
            continue
        if shutil.which(executable) is None:
            missing.append(
                f"Verification executable not found: {executable} (in {header})"
            )

    if missing:
        return {
            "name": "verification_executability",
            "result": "FAIL",
            "evidence": "; ".join(missing),
            "details": missing,
        }
    return {
        "name": "verification_executability",
        "result": "PASS",
        "evidence": "All verification command executables found on PATH",
        "details": [],
    }


def _check_cross_phase_sequencing(phases: list[tuple[str, str]]) -> dict:
    """Check that MODIFY actions do not precede the CREATE of the same file.

    If phase N has a MODIFY on a file that is only CREATEd in phase N+k
    (k > 0), the implementation order is wrong. Returns WARN with details.

    Args:
        phases: List of (header, body) tuples in phase order.

    Returns:
        Check result dict with name, result (PASS/WARN), and details list.
    """
    # Build maps: file -> earliest phase index where it appears as CREATE
    create_phase: dict[str, int] = {}
    modify_actions: list[tuple[str, int, str]] = []  # (file, phase_idx, header)

    for idx, (header, body) in enumerate(phases):
        for match in _CREATE_ROW_FILE_RE.finditer(body):
            filepath = match.group(1).strip()
            if filepath and filepath.lower() not in {"n/a", "(self)"}:
                # Record earliest CREATE phase
                if filepath not in create_phase:
                    create_phase[filepath] = idx

        for match in _MODIFY_ROW_FILE_RE.finditer(body):
            filepath = match.group(1).strip()
            if filepath and filepath.lower() not in {"n/a", "(self)"}:
                modify_actions.append((filepath, idx, header))

    warnings: list[str] = []
    for filepath, modify_idx, _header in modify_actions:
        create_idx = create_phase.get(filepath)
        if create_idx is not None and create_idx > modify_idx:
            warnings.append(
                f"Phase {modify_idx + 1} modifies `{filepath}` but a later phase "
                f"(Phase {create_idx + 1}) creates it"
            )

    if warnings:
        return {
            "name": "cross_phase_sequencing",
            "result": "WARN",
            "evidence": "; ".join(warnings),
            "details": warnings,
        }
    return {
        "name": "cross_phase_sequencing",
        "result": "PASS",
        "evidence": "No cross-phase sequencing violations found",
        "details": [],
    }


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def validate_plan_quality(plan_path: Path) -> dict:
    """Validate PLAN.md quality with deterministic checks.

    Runs the following checks on each phase:
    - Measurable verb check (rejects vague-only criteria)
    - R-PN-NN format on all Done When items
    - Non-empty Testing Strategy per phase
    - Real/Mock column validation in Testing Strategy
    - No placeholder syntax in verification commands
    - Test File column coverage in Changes tables
    - Minimum 2 acceptance criteria per phase
    - Negative/error criterion required for validation-related phases

    Args:
        plan_path: Path to the PLAN.md file.

    Returns:
        Dict with keys:
        - result: "PASS", "FAIL", or "SKIP"
        - checks: list of dicts with name, result, evidence
        - reason: (only when result is "SKIP") explanation string

        Returns {"result": "SKIP", "reason": str} when the file
        does not exist or cannot be read.
    """
    if not plan_path.is_file():
        return {"result": "SKIP", "reason": f"File not found: {plan_path}"}

    try:
        content = plan_path.read_text(encoding="utf-8")
    except (OSError, UnicodeDecodeError, ValueError):
        return {"result": "SKIP", "reason": f"Cannot read file: {plan_path}"}

    phases = _split_plan_into_phases(content)
    if not phases:
        return {
            "result": "SKIP",
            "reason": "No phases found in plan",
        }

    checks = [
        _check_vague_criteria_phases(phases),
        _check_r_id_format(phases),
        _check_testing_strategy(phases),
        _check_testing_strategy_assertions(phases),
        _check_real_mock_column(phases),
        _check_verification_placeholders(phases),
        _check_test_file_coverage(phases),
        _check_discovery_evidence(content),
        _check_minimum_criteria_count(phases),
        _check_negative_criterion_for_validation_phases(phases),
        _check_specificity_phases(phases),
        _check_description_identifiers(phases),
        _check_specificity_scoring(phases),
        _check_api_contracts_section(phases, content),
        _check_layer_tags(phases, content),
        _check_modify_file_existence(phases),
        _check_verification_command_executability(phases),
        _check_cross_phase_sequencing(phases),
    ]

    overall = "FAIL" if any(c["result"] == "FAIL" for c in checks) else "PASS"

    return {"result": overall, "checks": checks}


def validate_plan(plan_path: Path) -> dict:
    """Validate a PLAN.md file and return structured results.

    This is a convenience wrapper around validate_plan_quality() that
    provides the function signature expected by tests and CLI.

    Args:
        plan_path: Path to the PLAN.md file.

    Returns:
        Dict with keys: result ("PASS"/"FAIL"/"SKIP"),
        checks (list of per-check dicts), and optionally reason.
    """
    return validate_plan_quality(plan_path)


def main() -> None:
    """CLI entry point for plan validation."""
    parser = argparse.ArgumentParser(
        description="Validate PLAN.md quality with deterministic checks"
    )
    parser.add_argument(
        "--plan",
        type=Path,
        required=True,
        help="Path to the PLAN.md file to validate",
    )
    args = parser.parse_args()

    if not args.plan.is_file():
        sys.stderr.write(f"Error: Plan file not found: {args.plan}\n")
        sys.exit(2)

    result = validate_plan(args.plan)
    json.dump(result, sys.stdout, indent=2)
    sys.stdout.write("\n")

    if result.get("result") == "FAIL":
        sys.exit(1)
    elif result.get("result") == "SKIP":
        sys.exit(2)
    else:
        sys.exit(0)


if __name__ == "__main__":
    main()
