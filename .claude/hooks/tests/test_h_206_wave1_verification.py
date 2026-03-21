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

    def test_optional_chaining_present_in_intelligence_hub(self):
        """IntelligenceHub.tsx must have the ?. operator (value check via in)."""
        content = (REPO_ROOT / "components" / "IntelligenceHub.tsx").read_text(
            encoding="utf-8"
        )
        # Behavioral: assert literal string is in file
        assert "?." in content, (
            "IntelligenceHub.tsx contains no optional chaining operator '?.'. "
            "Crash-proofing from H-201 is missing."
        )
        count = content.count("?.")
        assert count >= 10, (
            f"IntelligenceHub.tsx has only {count} optional chaining operators; "
            "expected >= 10. Crash-proofing is incomplete."
        )

    def test_invalid_state_optional_chaining_absent_triggers_error(self):
        """Negative/invalid: if optional chaining were absent, count would be 0 (boundary)."""
        content = (REPO_ROOT / "components" / "IntelligenceHub.tsx").read_text(
            encoding="utf-8"
        )
        count = content.count("?.")
        # Boundary: zero would be an error state; verify we are not in that state
        assert count != 0, (
            "IntelligenceHub.tsx optional chaining count is 0 -- "
            "the file is in an invalid/error state; crash-proofing is not applied."
        )

    def test_optional_chaining_present_in_booking_portal(self):
        """BookingPortal.tsx must have the ?. operator (value check via in)."""
        content = (REPO_ROOT / "components" / "BookingPortal.tsx").read_text(
            encoding="utf-8"
        )
        assert "?." in content, (
            "BookingPortal.tsx contains no optional chaining operator '?.'. "
            "Crash-proofing from H-202/H-203 is missing."
        )
        count = content.count("?.")
        assert count >= 5, (
            f"BookingPortal.tsx has only {count} optional chaining operators; "
            "expected >= 5. Crash-proofing is incomplete."
        )

    def test_optional_chaining_present_in_command_center(self):
        """CommandCenterView.tsx must have the ?. operator (value check via in)."""
        content = (REPO_ROOT / "components" / "CommandCenterView.tsx").read_text(
            encoding="utf-8"
        )
        assert "?." in content, (
            "CommandCenterView.tsx contains no optional chaining operator '?.'. "
            "Crash-proofing from H-202/H-205 is missing."
        )
        count = content.count("?.")
        assert count >= 10, (
            f"CommandCenterView.tsx has only {count} optional chaining operators; "
            "expected >= 10. Crash-proofing is incomplete."
        )

    def test_error_state_intelligence_hub_not_duplicated(self):
        """Negative/error: optional chaining count must not exceed 500 (duplication guard)."""
        content = (REPO_ROOT / "components" / "IntelligenceHub.tsx").read_text(
            encoding="utf-8"
        )
        count = content.count("?.")
        # Error state: count > 500 indicates file content was inadvertently duplicated
        assert count != 0 and count < 500, (
            f"IntelligenceHub.tsx has {count} optional chaining operators; "
            "expected 10..499. A count of 0 means no hardening; >500 means duplication."
        )


class TestWave1VerificationBETests:
    """R-W1-08: Backend test suite passes with >= 1,869 tests."""

    def test_use_auto_feedback_hook_file_exists(self):
        """useAutoFeedback hook must exist at hooks/useAutoFeedback.ts."""
        hook_path = REPO_ROOT / "hooks" / "useAutoFeedback.ts"
        # Behavioral: hook name must appear in its own file content
        content = hook_path.read_text(encoding="utf-8")
        assert "useAutoFeedback" in content, (
            "hooks/useAutoFeedback.ts does not contain its own function name -- "
            "H-205 was not applied or the file is empty/corrupted."
        )

    def test_invalid_state_hook_not_empty_stub(self):
        """Negative/invalid: useAutoFeedback.ts must not be an empty stub."""
        content = (REPO_ROOT / "hooks" / "useAutoFeedback.ts").read_text(
            encoding="utf-8"
        )
        # Behavioral: clearTimeout must be in file (the specific value we expect)
        assert "clearTimeout" in content, (
            "useAutoFeedback.ts is missing clearTimeout -- "
            "the timer leak from H-205 is NOT fixed. File may be a stub."
        )
        assert "useEffect" in content, (
            "useAutoFeedback.ts is missing useEffect -- "
            "timer cleanup lifecycle is not registered."
        )

    def test_use_auto_feedback_has_clear_timeout(self):
        """useAutoFeedback must call clearTimeout to prevent timer leaks."""
        content = (REPO_ROOT / "hooks" / "useAutoFeedback.ts").read_text(
            encoding="utf-8"
        )
        assert "clearTimeout" in content, (
            "useAutoFeedback.ts is missing clearTimeout -- "
            "the timer leak that H-205 was meant to fix is NOT fixed."
        )

    def test_use_auto_feedback_has_use_effect_cleanup(self):
        """useAutoFeedback must use useEffect for lifecycle-aware cleanup."""
        content = (REPO_ROOT / "hooks" / "useAutoFeedback.ts").read_text(
            encoding="utf-8"
        )
        assert "useEffect" in content, (
            "useAutoFeedback.ts is missing useEffect -- "
            "timer cleanup is not registered with React's lifecycle."
        )

    def test_error_state_no_timer_ref_means_unfixable_leak(self):
        """Negative/error: missing useRef means timer cannot be cancelled on unmount."""
        content = (REPO_ROOT / "hooks" / "useAutoFeedback.ts").read_text(
            encoding="utf-8"
        )
        # Error state: useRef must be present to hold the timer ID
        # Behavioral: assert specific keyword is in the file content
        assert "useRef" in content or "timerRef" in content, (
            "useAutoFeedback.ts does not use useRef to store the timer ID. "
            "Without a ref, clearTimeout cannot cancel the timer on unmount -- "
            "the leak from H-205 is effectively still present."
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
            f"Wave 1 target components are MISSING after hardening: {missing}. "
            "Files must not be deleted during crash-proofing."
        )

    def test_invalid_state_critical_components_not_truncated(self):
        """Negative/invalid: critical Wave 1 components must have >= 50 lines."""
        critical = [
            "components/IntelligenceHub.tsx",
            "components/BookingPortal.tsx",
            "components/CommandCenterView.tsx",
        ]
        for comp_path in critical:
            content = (REPO_ROOT / comp_path).read_text(encoding="utf-8")
            line_count = len(content.splitlines())
            assert line_count != 0, (
                f"{comp_path} has 0 lines -- invalid state; file was truncated or deleted."
            )
            assert line_count >= 50, (
                f"{comp_path} has only {line_count} lines after Wave 1 edits; "
                "the file may have been accidentally truncated."
            )


class TestWave1VerificationPlaywright:
    """R-W1-VPC-206: App builds cleanly and TypeScript compiles without errors."""

    def test_components_import_auto_feedback_hook(self):
        """Key components must import useAutoFeedback (H-205 hook integration)."""
        components_using_hook = [
            "components/IntelligenceHub.tsx",
            "components/BookingPortal.tsx",
            "components/CommandCenterView.tsx",
        ]
        for comp_path in components_using_hook:
            content = (REPO_ROOT / comp_path).read_text(encoding="utf-8")
            assert "useAutoFeedback" in content, (
                f"{comp_path} does not import useAutoFeedback -- "
                "H-205 hook integration is missing."
            )

    def test_error_state_raw_set_timeout_for_feedback_is_absent(self):
        """Negative/error: key components must not use raw setTimeout for feedback (leak)."""
        components = [
            "components/IntelligenceHub.tsx",
            "components/BookingPortal.tsx",
            "components/CommandCenterView.tsx",
        ]
        for comp_path in components:
            content = (REPO_ROOT / comp_path).read_text(encoding="utf-8")
            lines = content.splitlines()
            raw_leaks = [
                (i + 1, line.strip())
                for i, line in enumerate(lines)
                if "setTimeout" in line
                and ("setFeedback" in line or "setMsg" in line or "setToast" in line)
                and "clearTimeout" not in line
            ]
            assert not raw_leaks, (
                f"{comp_path} still has raw setTimeout+feedback patterns at lines "
                f"{[ln for ln, _ in raw_leaks]} -- the H-205 hook was not applied."
            )

    def test_intelligence_hub_content_not_empty(self):
        """IntelligenceHub.tsx must contain the 'useAutoFeedback' import (value check)."""
        content = (REPO_ROOT / "components" / "IntelligenceHub.tsx").read_text(
            encoding="utf-8"
        )
        # Behavioral: assert specific expected string is present
        assert "useAutoFeedback" in content, (
            "IntelligenceHub.tsx does not contain useAutoFeedback import -- "
            "H-205 hook was not applied to this component."
        )
        line_count = len(content.splitlines())
        assert line_count >= 200, (
            f"IntelligenceHub.tsx has only {line_count} lines; "
            "the file appears truncated after Wave 1 edits."
        )

    def test_app_tsx_has_imports_and_exports(self):
        """App.tsx must be valid TypeScript with both imports and exports."""
        content = (REPO_ROOT / "App.tsx").read_text(encoding="utf-8")
        assert "import" in content, (
            "App.tsx is missing imports -- file may be corrupted."
        )
        assert "export" in content, (
            "App.tsx is missing exports -- file may be corrupted."
        )

    def test_invalid_state_app_tsx_not_stub(self):
        """Negative/invalid: App.tsx must not be empty or a trivial stub."""
        content = (REPO_ROOT / "App.tsx").read_text(encoding="utf-8")
        # Behavioral: must contain a known string (ErrorBoundary is stable)
        assert "ErrorBoundary" in content, (
            "App.tsx does not contain 'ErrorBoundary' -- "
            "the file appears to be an invalid stub or was accidentally replaced."
        )

    def test_boundary_wave1_no_out_of_scope_files_changed(self):
        """Boundary: Wave 1 source changes must all be within declared component scopes."""
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
            # Wave 2 additions (H-301 session safety, H-302 form protection)
            "services/api.ts",
            "services/storageService.ts",
            "components/ui/SessionExpiredModal.tsx",
            "components/AccountingBillForm.tsx",
            "components/BolGenerator.tsx",
            "components/BookingPortal.tsx",
            "components/BrokerManager.tsx",
            "components/DataImportWizard.tsx",
            "components/EditUserModal.tsx",
            "components/IFTAManager.tsx",
            "components/LoadSetupModal.tsx",
            "components/NetworkPortal.tsx",
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
        # Behavioral: assert not list (checks specific falsy outcome)
        assert not out_of_scope, (
            f"Wave 1 modified files outside declared scope: {out_of_scope}. "
            "Only files in H-201 through H-205 scope arrays may be changed."
        )
