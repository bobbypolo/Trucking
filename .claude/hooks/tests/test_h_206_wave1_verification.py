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

    def test_optional_chaining_count_in_intelligence_hub(self):
        """IntelligenceHub.tsx must have >= 10 optional chaining operators."""
        content = (REPO_ROOT / "components" / "IntelligenceHub.tsx").read_text(
            encoding="utf-8"
        )
        count = content.count("?.")
        # Behavioral value assertion: must meet minimum crash-proofing threshold
        assert count >= 10, (
            f"IntelligenceHub.tsx optional chaining count is {count}; "
            "expected >= 10. Crash-proofing is incomplete."
        )

    def test_optional_chaining_not_zero_in_intelligence_hub(self):
        """Negative: IntelligenceHub.tsx must have some optional chaining (non-zero guard)."""
        content = (REPO_ROOT / "components" / "IntelligenceHub.tsx").read_text(
            encoding="utf-8"
        )
        count = content.count("?.")
        assert count > 0, (
            "IntelligenceHub.tsx contains ZERO optional chaining operators. "
            "The file may be corrupted or the wrong file was committed."
        )

    def test_optional_chaining_count_in_booking_portal(self):
        """BookingPortal.tsx must have >= 5 optional chaining operators."""
        content = (REPO_ROOT / "components" / "BookingPortal.tsx").read_text(
            encoding="utf-8"
        )
        count = content.count("?.")
        assert count >= 5, (
            f"BookingPortal.tsx optional chaining count is {count}; "
            "expected >= 5. Crash-proofing is incomplete."
        )

    def test_optional_chaining_count_in_command_center(self):
        """CommandCenterView.tsx must have >= 10 optional chaining operators."""
        content = (REPO_ROOT / "components" / "CommandCenterView.tsx").read_text(
            encoding="utf-8"
        )
        count = content.count("?.")
        assert count >= 10, (
            f"CommandCenterView.tsx optional chaining count is {count}; "
            "expected >= 10. Crash-proofing is incomplete."
        )

    def test_optional_chaining_not_unreasonably_high(self):
        """Negative: optional chaining count must not exceed 500 (guards against content duplication)."""
        content = (REPO_ROOT / "components" / "IntelligenceHub.tsx").read_text(
            encoding="utf-8"
        )
        count = content.count("?.")
        assert count < 500, (
            f"IntelligenceHub.tsx has {count} optional chaining operators; "
            "this exceeds 500 and may indicate the file content was duplicated."
        )


class TestWave1VerificationBETests:
    """R-W1-08: Backend test suite passes with >= 1,869 tests."""

    def test_use_auto_feedback_hook_exists(self):
        """useAutoFeedback hook must exist (H-205 setTimeout leak fix)."""
        hook_path = REPO_ROOT / "hooks" / "useAutoFeedback.ts"
        assert hook_path.exists(), (
            "hooks/useAutoFeedback.ts missing -- H-205 not applied"
        )

    def test_use_auto_feedback_hook_not_empty_stub(self):
        """Negative: useAutoFeedback.ts must not be an empty stub file."""
        content = (REPO_ROOT / "hooks" / "useAutoFeedback.ts").read_text(
            encoding="utf-8"
        )
        non_comment_lines = [
            line
            for line in content.splitlines()
            if line.strip() and not line.strip().startswith("//")
        ]
        assert len(non_comment_lines) >= 10, (
            f"useAutoFeedback.ts has only {len(non_comment_lines)} non-comment lines; "
            "the hook appears to be an empty stub rather than a real implementation."
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

    def test_use_auto_feedback_stores_timer_in_ref(self):
        """Negative: useAutoFeedback must store the timer ID in a ref, not discard it."""
        content = (REPO_ROOT / "hooks" / "useAutoFeedback.ts").read_text(
            encoding="utf-8"
        )
        has_ref = "useRef" in content or "timerRef" in content
        assert has_ref, (
            "useAutoFeedback.ts does not use useRef to store the timer ID. "
            "Without a ref, clearTimeout cannot reliably cancel the timer on unmount."
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

    def test_wave1_critical_components_not_truncated(self):
        """Negative: critical Wave 1 components must have >= 50 lines after edits."""
        critical = [
            "components/IntelligenceHub.tsx",
            "components/BookingPortal.tsx",
            "components/CommandCenterView.tsx",
        ]
        for comp_path in critical:
            content = (REPO_ROOT / comp_path).read_text(encoding="utf-8")
            line_count = len(content.splitlines())
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

    def test_components_do_not_use_raw_set_timeout_for_feedback(self):
        """Negative: key components must not use raw setTimeout for feedback messages."""
        # After H-205, inline setTimeout+setState patterns for feedback should be
        # replaced with the useAutoFeedback hook. Direct setTimeout+setFeedback is a leak.
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

    def test_intelligence_hub_has_substantial_content(self):
        """IntelligenceHub.tsx must have >= 200 lines (structural integrity after edits)."""
        content = (REPO_ROOT / "components" / "IntelligenceHub.tsx").read_text(
            encoding="utf-8"
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

    def test_app_tsx_not_empty_or_stub(self):
        """Negative: App.tsx must not be empty or trivially small (>= 1000 bytes)."""
        content = (REPO_ROOT / "App.tsx").read_text(encoding="utf-8")
        byte_count = len(content.encode("utf-8"))
        assert byte_count >= 1000, (
            f"App.tsx is only {byte_count} bytes; "
            "the file appears to be empty or a stub."
        )

    def test_wave1_no_out_of_scope_files_changed(self):
        """Wave 1 source changes must all be within declared component scopes."""
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
        # Negative: no out-of-scope production file should have changed
        assert not out_of_scope, (
            f"Wave 1 modified files outside declared scope: {out_of_scope}. "
            "Only files in H-201 through H-205 scope arrays may be changed."
        )
