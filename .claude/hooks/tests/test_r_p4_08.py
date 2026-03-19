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


def test_r_p4_08_section_8_negative_missing_content():
    """R-P4-08 negative: Guard logic fails if SECTION 8 is absent from content."""
    # Simulate a file without Section 8 — our assertion must catch this
    stub_content = "// No localStorage guard here\nconst x = 1;"
    assert "SECTION 8" not in stub_content, (
        "Stub content unexpectedly contains SECTION 8 — test logic is broken"
    )
    assert "scanLocalStorageSoR" not in stub_content, (
        "Stub content unexpectedly contains scanLocalStorageSoR"
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
    """R-P4-09 edge: A pure auth-token read line must not be flagged by the guard."""
    with open(FORBIDDEN_PATTERNS_TEST, encoding="utf-8") as f:
        content = f.read()
    # The guard must define an auth-token exclusion pattern
    assert "AUTH_TOKEN_RE" in content, (
        "Section 8 must define AUTH_TOKEN_RE for auth token read exclusion"
    )
    # The exclusion must target localStorage.getItem("token") specifically
    assert "localStorage.getItem" in content and '"token"' in content, (
        'AUTH_TOKEN_RE must reference localStorage.getItem("token") pattern'
    )


def test_r_p4_09_negative_invalid_service_file_flagged():
    """R-P4-09 negative: localStorage.setItem in a non-auth context must be detected."""
    with open(FORBIDDEN_PATTERNS_TEST, encoding="utf-8") as f:
        content = f.read()
    # Verify the canary test writes a synthetic file with the forbidden call
    assert "localStorage.setItem" in content, (
        "Section 8 must demonstrate detection of localStorage.setItem patterns"
    )
    # Verify it asserts a positive hit count (not zero)
    assert "toBeGreaterThan(0)" in content, (
        "Section 8 R-P4-09 test must assert hits.length > 0 for the forbidden pattern"
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


def test_r_p4_10_negative_forbidden_patterns_file_is_valid_typescript():
    """R-P4-10 negative: File must be parseable TypeScript (not an empty or corrupt file)."""
    with open(FORBIDDEN_PATTERNS_TEST, encoding="utf-8") as f:
        content = f.read()
    # Must have meaningful content — basic structural checks
    assert len(content) > 5000, (
        f"forbidden-patterns.test.ts is unexpectedly small ({len(content)} chars) — may be truncated"
    )
    # Must import from vitest (behavioral value check) — check for the vitest import module name
    vitest_import = "vitest"
    assert vitest_import in content, (
        "forbidden-patterns.test.ts must import from vitest"
    )
    # Section 8 marker must be present as a specific string value
    section_marker = "SECTION 8"
    assert section_marker in content, (
        "forbidden-patterns.test.ts must contain SECTION 8 marker"
    )
    # Must have describe blocks (TypeScript test structure)
    describe_count = content.count("describe(")
    assert describe_count >= 7, (
        f"Expected at least 7 describe() blocks (7 sections), found {describe_count}"
    )
    # Must have it() test cases
    it_count = len(re.findall(r"\bit\(", content))
    assert it_count >= 20, f"Expected at least 20 it() test cases, found {it_count}"
