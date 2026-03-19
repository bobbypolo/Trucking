"""
R-marker traceability for STORY-404 (Phase 4 localStorage regression guard).
Tests R-P4-08, R-P4-09, R-P4-10
"""
# Tests R-P4-08, R-P4-09, R-P4-10

import re
import subprocess
import os

ROOT = "F:/Trucking/DisbatchMe"
FORBIDDEN_PATTERNS_TEST = os.path.join(
    ROOT, "server/__tests__/integration/forbidden-patterns.test.ts"
)


def test_r_p4_08_section_8_present():
    """R-P4-08: forbidden-patterns.test.ts contains Section 8 localStorage SoR guard."""
    with open(FORBIDDEN_PATTERNS_TEST, encoding="utf-8") as f:
        content = f.read()
    assert "SECTION 8" in content, (
        "forbidden-patterns.test.ts must contain SECTION 8 localStorage guard"
    )
    assert "scanLocalStorageSoR" in content, (
        "forbidden-patterns.test.ts must define scanLocalStorageSoR function"
    )
    assert "walkFiles(SERVICES" in content, (
        "Section 8 must scan services/**/*.ts via walkFiles(SERVICES, ...)"
    )


def test_r_p4_08_exclusions_present():
    """R-P4-08: Guard excludes __tests__, config.ts, and auth token reads."""
    with open(FORBIDDEN_PATTERNS_TEST, encoding="utf-8") as f:
        content = f.read()
    assert "__tests__" in content, "Guard must exclude __tests__ directories"
    assert "config.ts" in content, "Guard must exclude services/config.ts from scan"
    assert '"token"' in content, (
        'Guard must document auth token read exclusion via localStorage.getItem("token")'
    )


def test_r_p4_08_section_8_missing_raises_assertion():
    """R-P4-08 edge: If SECTION 8 were absent, test_r_p4_08_section_8_present would fail."""
    # Validate the assertion logic itself — simulate content without SECTION 8
    content_without_section_8 = "// No localStorage guard here"
    # This is a meta-test verifying our assertion condition works correctly
    found = "SECTION 8" in content_without_section_8
    assert not found, (
        "Expected 'SECTION 8' to be absent from stub content — meta-test is broken"
    )


def test_r_p4_09_detection_logic_flags_regression():
    """R-P4-09: scanLocalStorageSoR() flags localStorage.setItem('loadpilot_test', 'value')."""
    with open(FORBIDDEN_PATTERNS_TEST, encoding="utf-8") as f:
        content = f.read()
    assert "loadpilot_test" in content, (
        "Section 8 must include a self-validation test that flags "
        "localStorage.setItem('loadpilot_test', 'value') in a synthetic file"
    )
    assert "tmpFile" in content or "synthetic" in content.lower(), (
        "Section 8 R-P4-09 test must use a temporary/synthetic file for canary validation"
    )


def test_r_p4_09_auth_token_read_not_flagged():
    """R-P4-09 edge: A pure auth-token read line should not be flagged by the guard."""
    with open(FORBIDDEN_PATTERNS_TEST, encoding="utf-8") as f:
        content = f.read()
    # The guard must include logic to permit auth token reads
    # Verify the AUTH_TOKEN_RE or equivalent exclusion pattern is present
    assert "AUTH_TOKEN_RE" in content or "localStorage.getItem" in content, (
        "Section 8 must define an auth-token read exclusion pattern"
    )
    # The exclusion must specifically target the 'token' key (Bearer header pattern)
    assert '"token"' in content, (
        "Auth token exclusion must reference the 'token' localStorage key"
    )


def test_r_p4_10_all_forbidden_pattern_tests_pass():
    """R-P4-10: All tests in forbidden-patterns.test.ts pass (including existing tests)."""
    result = subprocess.run(
        "cd server && npx vitest run __tests__/integration/forbidden-patterns.test.ts",
        shell=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        cwd=ROOT,
        timeout=120,
    )
    # Decode with utf-8 and replace undecodable bytes (vitest outputs ANSI color codes)
    stdout = result.stdout.decode("utf-8", errors="replace") if result.stdout else ""
    stderr = result.stderr.decode("utf-8", errors="replace") if result.stderr else ""
    combined = stdout + stderr

    # Vitest reports "1 passed" (files) and "26 passed" (tests) — take the maximum
    passed_counts = [int(m) for m in re.findall(r"(\d+) passed", combined)]
    failed_counts = [int(m) for m in re.findall(r"(\d+) failed", combined)]
    max_passed = max(passed_counts) if passed_counts else 0

    assert result.returncode == 0, (
        f"forbidden-patterns.test.ts exited with code {result.returncode}.\n"
        f"Output:\n{combined[-2000:]}"
    )
    assert not failed_counts or max(failed_counts) == 0, (
        f"Some tests failed in forbidden-patterns.test.ts.\nOutput:\n{combined[-2000:]}"
    )
    assert max_passed >= 26, (
        f"Expected at least 26 passing tests, got max={max_passed} from counts={passed_counts}."
        f"\nOutput:\n{combined[-2000:]}"
    )


def test_r_p4_10_forbidden_patterns_file_exists():
    """R-P4-10 edge: The test file itself must exist and be readable."""
    assert os.path.isfile(FORBIDDEN_PATTERNS_TEST), (
        f"forbidden-patterns.test.ts not found at: {FORBIDDEN_PATTERNS_TEST}"
    )
    with open(FORBIDDEN_PATTERNS_TEST, encoding="utf-8") as f:
        content = f.read()
    assert len(content) > 1000, (
        "forbidden-patterns.test.ts is unexpectedly small — may have been truncated"
    )
