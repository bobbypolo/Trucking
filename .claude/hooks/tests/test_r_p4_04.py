# Tests R-P4-04, R-P4-05, R-P4-06
"""
C-2 acceptance criteria traceability for qa_runner.

R-P4-04: Hardcoded values removed from AccountingPortal.tsx — values computed from real data or API
R-P4-05: AccountingPortal buttons wired — View All Loads navigates, More options show toast
R-P4-06: RETIRED — Rules Engine / Automation tab removed from AccountingPortal entirely

Actual test implementation is in:
  src/__tests__/components/AccountingPortal.remediation.test.tsx
"""

import subprocess
import json


def test_r_p4_04_hardcoded_values_removed():
    """R-P4-04: All 10 hardcoded values removed from AccountingPortal.tsx."""
    result = subprocess.run(
        [
            "npx",
            "vitest",
            "run",
            "--reporter=json",
            "src/__tests__/components/AccountingPortal.remediation.test.tsx",
        ],
        capture_output=True,
        text=True,
        cwd="F:/Trucking/DisbatchMe",
        shell=True,
        timeout=120,
    )
    data = json.loads(result.stdout)
    tests = data.get("testResults", [{}])[0].get("assertionResults", [])
    p04_tests = [t for t in tests if "R-P4-04" in t.get("fullName", "")]
    passed = [t for t in p04_tests if t.get("status") == "passed"]
    assert len(p04_tests) >= 4, f"Expected >= 4 R-P4-04 tests, found {len(p04_tests)}"
    assert len(passed) == len(p04_tests), (
        f"Not all R-P4-04 tests passed: {len(passed)}/{len(p04_tests)}"
    )


def test_r_p4_05_buttons_wired():
    """R-P4-05: 3 AccountingPortal buttons wired."""
    result = subprocess.run(
        [
            "npx",
            "vitest",
            "run",
            "--reporter=json",
            "src/__tests__/components/AccountingPortal.remediation.test.tsx",
        ],
        capture_output=True,
        text=True,
        cwd="F:/Trucking/DisbatchMe",
        shell=True,
        timeout=120,
    )
    data = json.loads(result.stdout)
    tests = data.get("testResults", [{}])[0].get("assertionResults", [])
    p05_tests = [t for t in tests if "R-P4-05" in t.get("fullName", "")]
    passed = [t for t in p05_tests if t.get("status") == "passed"]
    assert len(p05_tests) >= 2, f"Expected >= 2 R-P4-05 tests, found {len(p05_tests)}"
    assert len(passed) == len(p05_tests), (
        f"Not all R-P4-05 tests passed: {len(passed)}/{len(p05_tests)}"
    )


def test_r_p4_06_settimeout_removed():
    """R-P4-06: RETIRED — Rules Engine/Automation tab completely removed from AccountingPortal."""
    # The Automation/Rules Engine tab was removed entirely during the
    # 10-agent remediation. The setTimeout mock-matching test is no longer
    # applicable because the feature surface no longer exists.
    pass
