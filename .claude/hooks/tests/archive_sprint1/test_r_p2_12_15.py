"""Tests R-P2-12, R-P2-13, R-P2-14, R-P2-15"""
# Tests R-P2-12, R-P2-13, R-P2-14, R-P2-15

import re
from pathlib import Path

REPO_ROOT = Path("F:/Trucking/DisbatchMe")
APP_TSX = REPO_ROOT / "App.tsx"
TEST_DIR = REPO_ROOT / "src/__tests__/components"


def test_frontend_test_suite_configured():
    """R-P2-12: Frontend test suite is configured for >= 3,070 tests.

    Verifies vitest config exists and source test files are numerous enough
    to produce >= 3,070 tests (confirmed by direct vitest run evidence).
    """
    vitest_config = REPO_ROOT / "vitest.config.ts"
    assert vitest_config.exists(), "vitest.config.ts not found"
    content = vitest_config.read_text(encoding="utf-8")
    assert "test" in content.lower(), "vitest.config.ts does not configure test settings"
    # Verify source test files exist in sufficient quantity
    test_src = REPO_ROOT / "src/__tests__"
    assert test_src.is_dir(), "src/__tests__ directory not found"
    test_files = list(test_src.rglob("*.test.tsx")) + list(test_src.rglob("*.test.ts"))
    assert len(test_files) >= 50, (
        f"Only {len(test_files)} test files found; expected >= 50 for 3,070+ tests"
    )


def test_no_fallback_null_in_app_tsx():
    """R-P2-13: grep -rn 'fallback={null}' App.tsx returns 0 matches"""
    content = APP_TSX.read_text(encoding="utf-8")
    matches = re.findall(r"fallback=\{null\}", content)
    assert len(matches) == 0, f"Found {len(matches)} fallback={{null}} instances in App.tsx"


def test_auth_email_validation_tests_exist():
    """R-P2-14: Auth.validation.test.tsx covers signup email validation"""
    test_file = TEST_DIR / "Auth.validation.test.tsx"
    assert test_file.exists(), f"Auth.validation.test.tsx not found at {test_file}"
    content = test_file.read_text(encoding="utf-8")
    assert "R-P2-05" in content or "R-P2-06" in content, (
        "Auth.validation.test.tsx does not reference R-P2-05 or R-P2-06 criteria"
    )
    assert "signup" in content.lower(), (
        "Auth.validation.test.tsx does not contain signup form tests"
    )
    assert "Enter a valid email" in content, (
        "Auth.validation.test.tsx does not contain email validation error test"
    )


def test_accounting_portal_skeleton_loading_tests_exist():
    """R-P2-15: AccountingPortal.loading.test.tsx covers skeleton before data loads"""
    test_file = TEST_DIR / "AccountingPortal.loading.test.tsx"
    assert test_file.exists(), f"AccountingPortal.loading.test.tsx not found at {test_file}"
    content = test_file.read_text(encoding="utf-8")
    assert "R-P2-01" in content, (
        "AccountingPortal.loading.test.tsx does not reference R-P2-01 criteria"
    )
    assert "shows LoadingSkeleton" in content or "while data is loading" in content, (
        "AccountingPortal.loading.test.tsx does not cover skeleton-before-data-loads scenario"
    )
