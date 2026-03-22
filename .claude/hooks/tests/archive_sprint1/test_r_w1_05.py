"""
Tests R-W1-05a, R-W1-05b, R-W1-06a, R-W1-VPC-205

H-205: Fix All setTimeout Memory Leaks + Stale Closure
Extract auto-feedback pattern into a reusable hook, replace all raw setTimeout
feedback patterns in components, and fix stale closure in App.tsx refreshData.
"""

# Tests R-W1-05a, R-W1-05b, R-W1-06a, R-W1-VPC-205

import re
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]

STORY_FILES = [
    "hooks/useAutoFeedback.ts",
    "components/IntelligenceHub.tsx",
    "components/CommandCenterView.tsx",
    "components/CompanyProfile.tsx",
    "components/AccountingPortal.tsx",
    "components/BookingPortal.tsx",
    "components/SafetyView.tsx",
    "components/Settlements.tsx",
    "App.tsx",
]


def _read(path: Path) -> str:
    return path.read_text(encoding="utf-8", errors="replace")


# ---------------------------------------------------------------------------
# R-W1-05a: hooks/useAutoFeedback.ts exists with proper implementation
# ---------------------------------------------------------------------------


def test_r_w1_05a_hook_file_exists():
    """R-W1-05a: hooks/useAutoFeedback.ts exists."""
    # Tests R-W1-05a
    path = REPO_ROOT / "hooks" / "useAutoFeedback.ts"
    assert path.exists(), "hooks/useAutoFeedback.ts must exist"


def test_r_w1_05a_hook_exports_useAutoFeedback():
    """R-W1-05a: hook file exports useAutoFeedback function."""
    # Tests R-W1-05a
    path = REPO_ROOT / "hooks" / "useAutoFeedback.ts"
    content = _read(path)
    assert "export" in content and "useAutoFeedback" in content, (
        "hooks/useAutoFeedback.ts must export useAutoFeedback"
    )


def test_r_w1_05a_hook_uses_cleartimeout():
    """R-W1-05a: hook uses clearTimeout for cleanup (no leak on unmount)."""
    # Tests R-W1-05a
    path = REPO_ROOT / "hooks" / "useAutoFeedback.ts"
    content = _read(path)
    assert "clearTimeout" in content, (
        "hooks/useAutoFeedback.ts must use clearTimeout for cleanup"
    )


def test_r_w1_05a_hook_has_unmount_cleanup():
    """R-W1-05a: hook returns cleanup function from useEffect."""
    # Tests R-W1-05a
    path = REPO_ROOT / "hooks" / "useAutoFeedback.ts"
    content = _read(path)
    assert "return () =>" in content, (
        "hooks/useAutoFeedback.ts must return cleanup from useEffect"
    )


def test_r_w1_05a_unit_test_file_exists():
    """R-W1-05a: unit test file for useAutoFeedback exists."""
    # Tests R-W1-05a
    path = REPO_ROOT / "src" / "__tests__" / "hooks" / "useAutoFeedback.test.tsx"
    assert path.exists(), "src/__tests__/hooks/useAutoFeedback.test.tsx must exist"


def test_r_w1_05a_unit_test_covers_show_message():
    """R-W1-05a: unit test covers show message behavior."""
    # Tests R-W1-05a
    path = REPO_ROOT / "src" / "__tests__" / "hooks" / "useAutoFeedback.test.tsx"
    content = _read(path)
    assert "shows message" in content or "showMessage" in content, (
        "useAutoFeedback test must cover show message"
    )


def test_r_w1_05a_unit_test_covers_auto_clear():
    """R-W1-05a: unit test covers auto-clear after duration."""
    # Tests R-W1-05a
    path = REPO_ROOT / "src" / "__tests__" / "hooks" / "useAutoFeedback.test.tsx"
    content = _read(path)
    assert "auto-clear" in content or "advanceTimersByTime" in content, (
        "useAutoFeedback test must cover auto-clear after duration"
    )


def test_r_w1_05a_unit_test_covers_cleanup_on_unmount():
    """R-W1-05a: unit test covers cleanup on unmount."""
    # Tests R-W1-05a
    path = REPO_ROOT / "src" / "__tests__" / "hooks" / "useAutoFeedback.test.tsx"
    content = _read(path)
    assert "unmount" in content, "useAutoFeedback test must cover cleanup on unmount"


# ---------------------------------------------------------------------------
# R-W1-05b: No raw setTimeout(() => set...null patterns remain
# ---------------------------------------------------------------------------


def _get_raw_settimeout_pattern():
    """Regex to find raw setTimeout with null/empty clearing patterns."""
    return re.compile(
        r"setTimeout\(\s*\(\s*\)\s*=>\s*set\w+\s*\(\s*(null|\"\")\s*\)\s*,\s*\d+"
    )


def test_r_w1_05b_no_raw_settimeout_accountingportal():
    """R-W1-05b: No raw setTimeout feedback pattern in AccountingPortal."""
    # Tests R-W1-05b
    path = REPO_ROOT / "components" / "AccountingPortal.tsx"
    content = _read(path)
    matches = _get_raw_settimeout_pattern().findall(content)
    assert not matches, (
        f"AccountingPortal.tsx still has {len(matches)} raw setTimeout feedback pattern(s)"
    )


def test_r_w1_05b_no_raw_settimeout_safetyview():
    """R-W1-05b: No raw setTimeout feedback pattern in SafetyView."""
    # Tests R-W1-05b
    path = REPO_ROOT / "components" / "SafetyView.tsx"
    content = _read(path)
    matches = _get_raw_settimeout_pattern().findall(content)
    assert not matches, (
        f"SafetyView.tsx still has {len(matches)} raw setTimeout feedback pattern(s)"
    )


def test_r_w1_05b_no_raw_settimeout_settlements():
    """R-W1-05b: No raw setTimeout feedback pattern in Settlements."""
    # Tests R-W1-05b
    path = REPO_ROOT / "components" / "Settlements.tsx"
    content = _read(path)
    matches = _get_raw_settimeout_pattern().findall(content)
    assert not matches, (
        f"Settlements.tsx still has {len(matches)} raw setTimeout feedback pattern(s)"
    )


def test_r_w1_05b_no_raw_settimeout_bookingportal():
    """R-W1-05b: No raw setTimeout feedback pattern in BookingPortal."""
    # Tests R-W1-05b
    path = REPO_ROOT / "components" / "BookingPortal.tsx"
    content = _read(path)
    matches = _get_raw_settimeout_pattern().findall(content)
    assert not matches, (
        f"BookingPortal.tsx still has {len(matches)} raw setTimeout feedback pattern(s)"
    )


def test_r_w1_05b_no_raw_settimeout_companyprofile():
    """R-W1-05b: No raw setTimeout feedback pattern in CompanyProfile."""
    # Tests R-W1-05b
    path = REPO_ROOT / "components" / "CompanyProfile.tsx"
    content = _read(path)
    matches = _get_raw_settimeout_pattern().findall(content)
    assert not matches, (
        f"CompanyProfile.tsx still has {len(matches)} raw setTimeout feedback pattern(s)"
    )


def test_r_w1_05b_no_raw_settimeout_intelligencehub():
    """R-W1-05b: No raw setTimeout feedback pattern in IntelligenceHub."""
    # Tests R-W1-05b
    path = REPO_ROOT / "components" / "IntelligenceHub.tsx"
    content = _read(path)
    matches = _get_raw_settimeout_pattern().findall(content)
    assert not matches, (
        f"IntelligenceHub.tsx still has {len(matches)} raw setTimeout feedback pattern(s)"
    )


# ---------------------------------------------------------------------------
# R-W1-06a: App.tsx refreshData useCallback deps include companyId
# ---------------------------------------------------------------------------


def test_r_w1_06a_refreshdata_has_companyid_dep():
    """R-W1-06a: App.tsx refreshData useCallback deps include companyId."""
    # Tests R-W1-06a
    path = REPO_ROOT / "App.tsx"
    content = _read(path)
    assert re.search(r"\},\s*\[.*companyId.*\]", content, re.DOTALL), (
        "App.tsx refreshData useCallback deps array must include companyId"
    )


def test_r_w1_06a_refreshdata_not_empty_deps():
    """R-W1-06a: App.tsx refreshData useCallback does not have empty deps []."""
    # Tests R-W1-06a
    path = REPO_ROOT / "App.tsx"
    content = _read(path)
    refreshdata_section = content[content.find("const refreshData = useCallback") :]
    first_empty_close = refreshdata_section.find("  }, []);")
    assert first_empty_close == -1, (
        "App.tsx refreshData useCallback must not have empty deps []; "
        "add user?.companyId"
    )


# ---------------------------------------------------------------------------
# R-W1-VPC-205: Story files exist and use the hook
# ---------------------------------------------------------------------------


def test_r_w1_vpc_205_story_files_exist():
    """R-W1-VPC-205: All story files exist."""
    # Tests R-W1-VPC-205
    for rel_path in STORY_FILES:
        path = REPO_ROOT / rel_path
        assert path.exists(), f"Story file must exist: {rel_path}"


def test_r_w1_vpc_205_hook_imported_in_accountingportal():
    """R-W1-VPC-205: AccountingPortal imports useAutoFeedback."""
    # Tests R-W1-VPC-205
    path = REPO_ROOT / "components" / "AccountingPortal.tsx"
    content = _read(path)
    assert "useAutoFeedback" in content, (
        "AccountingPortal.tsx must import and use useAutoFeedback"
    )


def test_r_w1_vpc_205_hook_imported_in_safetyview():
    """R-W1-VPC-205: SafetyView imports useAutoFeedback."""
    # Tests R-W1-VPC-205
    path = REPO_ROOT / "components" / "SafetyView.tsx"
    content = _read(path)
    assert "useAutoFeedback" in content, (
        "SafetyView.tsx must import and use useAutoFeedback"
    )


def test_r_w1_vpc_205_hook_imported_in_settlements():
    """R-W1-VPC-205: Settlements imports useAutoFeedback."""
    # Tests R-W1-VPC-205
    path = REPO_ROOT / "components" / "Settlements.tsx"
    content = _read(path)
    assert "useAutoFeedback" in content, (
        "Settlements.tsx must import and use useAutoFeedback"
    )


def test_r_w1_vpc_205_hook_imported_in_bookingportal():
    """R-W1-VPC-205: BookingPortal imports useAutoFeedback."""
    # Tests R-W1-VPC-205
    path = REPO_ROOT / "components" / "BookingPortal.tsx"
    content = _read(path)
    assert "useAutoFeedback" in content, (
        "BookingPortal.tsx must import and use useAutoFeedback"
    )


def test_r_w1_vpc_205_hook_imported_in_companyprofile():
    """R-W1-VPC-205: CompanyProfile imports useAutoFeedback."""
    # Tests R-W1-VPC-205
    path = REPO_ROOT / "components" / "CompanyProfile.tsx"
    content = _read(path)
    assert "useAutoFeedback" in content, (
        "CompanyProfile.tsx must import and use useAutoFeedback"
    )
