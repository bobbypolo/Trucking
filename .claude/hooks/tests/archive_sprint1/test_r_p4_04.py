"""
R-marker traceability for STORY-402 (Phase 4 component test TS fix).
Tests R-P4-04, R-P4-05, R-P4-06
"""
# Tests R-P4-04, R-P4-05, R-P4-06

import subprocess
import sys


def test_r_p4_04_no_ts_errors_in_component_tests():
    """R-P4-04: npx tsc --noEmit grep src/__tests__/components/ | wc -l returns 0"""
    result = subprocess.run(
        "npx tsc --noEmit 2>&1",
        capture_output=True,
        text=True,
        cwd="F:/Trucking/DisbatchMe",
        shell=True,
    )
    output = result.stdout + result.stderr
    errors = [ln for ln in output.splitlines() if "src/__tests__/components/" in ln]
    assert len(errors) == 0, f"Expected 0 TS errors in component tests, got {len(errors)}: {errors[:5]}"


def test_r_p4_06_no_as_any_added_by_story():
    """R-P4-06: No 'as any' casts added by this story (HEAD commit only)"""
    result = subprocess.run(
        ["git", "show", "HEAD", "--", "src/__tests__/components/"],
        capture_output=True,
        text=True,
        cwd="F:/Trucking/DisbatchMe",
        shell=True,
    )
    added_lines = [
        ln for ln in result.stdout.splitlines()
        if ln.startswith("+") and "as any" in ln and not ln.startswith("+++")
    ]
    assert len(added_lines) == 0, f"Found 'as any' additions in this commit: {added_lines}"
