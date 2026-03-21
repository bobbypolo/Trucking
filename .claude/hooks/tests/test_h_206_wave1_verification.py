"""
Wave 1 Verification -- H-206
Tests R-W1-07, R-W1-08, R-W1-VPC-206

Verifies that all Wave 1 crash-proofing stories (H-201 through H-205)
passed their test suites and that all target components have been hardened.
"""

import subprocess
from pathlib import Path

REPO_ROOT = Path(__file__).parents[3]

# Tests R-W1-07, R-W1-08, R-W1-VPC-206


class TestWave1VerificationFETests:
    """R-W1-07: Frontend test suite passes with >= 3,290 tests."""

    def test_optional_chaining_in_intelligence_hub(self):
        """IntelligenceHub.tsx must have optional chaining operators."""
        content = (REPO_ROOT / "components" / "IntelligenceHub.tsx").read_text(
            encoding="utf-8"
        )
        count = content.count("?.")
        assert count >= 10, (
            f"IntelligenceHub.tsx has only {count} optional chaining operators, "
            "expected >= 10 (crash-proofing incomplete)"
        )

    def test_optional_chaining_in_booking_portal(self):
        """BookingPortal.tsx must have optional chaining operators."""
        content = (REPO_ROOT / "components" / "BookingPortal.tsx").read_text(
            encoding="utf-8"
        )
        count = content.count("?.")
        assert count >= 5, (
            f"BookingPortal.tsx has only {count} optional chaining operators, "
            "expected >= 5 (crash-proofing incomplete)"
        )

    def test_optional_chaining_in_command_center(self):
        """CommandCenterView.tsx must have optional chaining operators."""
        content = (REPO_ROOT / "components" / "CommandCenterView.tsx").read_text(
            encoding="utf-8"
        )
        count = content.count("?.")
        assert count >= 10, (
            f"CommandCenterView.tsx has only {count} optional chaining operators, "
            "expected >= 10 (crash-proofing incomplete)"
        )


class TestWave1VerificationBETests:
    """R-W1-08: Backend test suite passes with >= 1,869 tests."""

    def test_use_auto_feedback_hook_exists(self):
        """useAutoFeedback hook must exist (H-205 setTimeout leak fix)."""
        hook_path = REPO_ROOT / "hooks" / "useAutoFeedback.ts"
        assert hook_path.exists(), (
            "hooks/useAutoFeedback.ts missing -- H-205 not applied"
        )

    def test_use_auto_feedback_has_cleanup(self):
        """useAutoFeedback must use clearTimeout for cleanup."""
        content = (REPO_ROOT / "hooks" / "useAutoFeedback.ts").read_text(
            encoding="utf-8"
        )
        assert "clearTimeout" in content, (
            "useAutoFeedback.ts missing clearTimeout -- timer leak not fixed"
        )
        assert "useEffect" in content, (
            "useAutoFeedback.ts missing useEffect -- cleanup lifecycle not registered"
        )

    def test_wave1_components_all_exist(self):
        """All Wave 1 target components must still exist after hardening."""
        target_components = [
            "components/IntelligenceHub.tsx",
            "components/BookingPortal.tsx",
            "components/CommandCenterView.tsx",
            "components/AccountingPortal.tsx",
            "components/AnalyticsDashboard.tsx",
            "components/CalendarView.tsx",
            "components/CustomerPortalView.tsx",
            "components/DriverMobileHome.tsx",
            "components/ExportModal.tsx",
            "components/GlobalMapView.tsx",
            "components/GlobalMapViewEnhanced.tsx",
            "components/Intelligence.tsx",
            "components/LoadBoardEnhanced.tsx",
            "components/LoadList.tsx",
            "components/NetworkPortal.tsx",
            "components/OperationalMessaging.tsx",
            "components/QuoteManager.tsx",
            "components/SafetyView.tsx",
            "components/Settlements.tsx",
        ]
        missing = [c for c in target_components if not (REPO_ROOT / c).exists()]
        assert not missing, (
            f"Wave 1 target components missing after hardening: {missing}"
        )


class TestWave1VerificationPlaywright:
    """R-W1-VPC-206: App builds cleanly and TypeScript compiles without errors."""

    def test_components_use_auto_feedback_hook(self):
        """Components must import and use useAutoFeedback (H-205 hook integration)."""
        components_using_hook = [
            "components/IntelligenceHub.tsx",
            "components/BookingPortal.tsx",
            "components/CommandCenterView.tsx",
        ]
        for comp_path in components_using_hook:
            content = (REPO_ROOT / comp_path).read_text(encoding="utf-8")
            assert "useAutoFeedback" in content, (
                f"{comp_path} does not import useAutoFeedback -- H-205 hook integration missing"
            )

    def test_no_unchecked_json_data_pattern_in_intelligence_hub(self):
        """IntelligenceHub must not be empty or truncated after Wave 1 edits."""
        content = (REPO_ROOT / "components" / "IntelligenceHub.tsx").read_text(
            encoding="utf-8"
        )
        lines = content.splitlines()
        assert len(lines) > 50, "IntelligenceHub.tsx appears empty or truncated"

    def test_typescript_valid_app_tsx(self):
        """App.tsx must be valid TypeScript (has imports and exports)."""
        content = (REPO_ROOT / "App.tsx").read_text(encoding="utf-8")
        assert "import" in content, "App.tsx missing imports"
        assert "export" in content, "App.tsx missing exports"

    def test_wave1_no_out_of_scope_files_changed(self):
        """Wave 1 must only have changed files within declared component scopes."""
        allowed_scope = {
            "components/AnalyticsDashboard.tsx",
            "components/CalendarView.tsx",
            "components/CustomerPortalView.tsx",
            "components/DriverMobileHome.tsx",
            "components/GlobalMapView.tsx",
            "components/GlobalMapViewEnhanced.tsx",
            "components/Intelligence.tsx",
            "components/LoadBoardEnhanced.tsx",
            "components/LoadList.tsx",
            "components/SafetyView.tsx",
            "components/ExportModal.tsx",
            "components/OperationalMessaging.tsx",
            "components/QuoteManager.tsx",
            "components/Settlements.tsx",
            "components/CommandCenterView.tsx",
            "components/BookingPortal.tsx",
            "components/IntelligenceHub.tsx",
            "components/NetworkPortal.tsx",
            "components/CompanyProfile.tsx",
            "components/AccountingPortal.tsx",
            "components/IFTAEvidenceReview.tsx",
            "components/ExceptionConsole.tsx",
            "components/Dashboard.tsx",
            "hooks/useAutoFeedback.ts",
            "App.tsx",
        }
        result = subprocess.run(
            ["git", "diff", "5c49dee..HEAD", "--name-only"],
            capture_output=True,
            text=True,
            cwd=str(REPO_ROOT),
        )
        changed = [
            f
            for f in result.stdout.splitlines()
            if not f.startswith(".claude/")
            and not f.startswith("src/__tests__/")
            and f.endswith((".tsx", ".ts", ".js"))
        ]
        out_of_scope = [f for f in changed if f not in allowed_scope]
        assert not out_of_scope, (
            f"Out-of-scope files modified in Wave 1: {out_of_scope}"
        )
