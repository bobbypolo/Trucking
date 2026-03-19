"""
R-marker traceability for STORY-401 (Phase 4 services test TS fix).
Tests R-P4-01, R-P4-02, R-P4-03
"""
# Tests R-P4-01, R-P4-02, R-P4-03

import subprocess
import sys


REPO = "F:/Trucking/DisbatchMe"


def test_r_p4_01_no_ts_errors_in_services_tests():
    """R-P4-01: npx tsc --noEmit grep src/__tests__/services/ | wc -l returns 0"""
    result = subprocess.run(
        ["npx", "tsc", "--noEmit"],
        capture_output=True,
        text=True,
        cwd=REPO,
        shell=True,
    )
    output = result.stdout + result.stderr
    errors = [ln for ln in output.splitlines() if "src/__tests__/services/" in ln]
    assert len(errors) == 0, (
        f"Expected 0 TS errors in services tests, got {len(errors)}: {errors[:5]}"
    )


def test_r_p4_02_services_tests_pass():
    """R-P4-02: All fixed test files still pass when run via npx vitest run"""
    result = subprocess.run(
        "npx vitest run src/__tests__/services",
        capture_output=True,
        text=True,
        cwd=REPO,
        shell=True,
        timeout=120,
        encoding="utf-8",
        errors="replace",
    )
    output = result.stdout + result.stderr
    assert result.returncode == 0, (
        f"Services tests failed (exit {result.returncode}): {output[-2000:]}"
    )


def test_r_p4_03_no_as_any_added():
    """R-P4-03: No 'as any' casts added to silence errors"""
    result = subprocess.run(
        ["git", "diff", "417817d80482e983a3e4754d8ee5d116f0ef6404", "--",
         "src/__tests__/services/"],
        capture_output=True,
        text=True,
        cwd=REPO,
        shell=True,
    )
    diff = result.stdout
    added_as_any = [
        ln for ln in diff.splitlines()
        if ln.startswith("+") and "as any" in ln and not ln.startswith("+++")
    ]
    assert len(added_as_any) == 0, (
        f"New 'as any' casts found in services tests: {added_as_any[:5]}"
    )
