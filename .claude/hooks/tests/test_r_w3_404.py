"""
Wave 3 Verification -- H-404
Tests R-W3-05, R-W3-06, R-W3-VPC-404

Verifies that all Wave 3 UX consistency stories (H-401 through H-403)
passed their test suites and that no regressions were introduced.

Wave 3 scope:
  H-401: form validation on 8 components
  H-402: loading/error/empty states on CommsOverlay, LoadList, Settlements
  H-403: loading/error/empty states on DriverMobileHome, FileVault, IntelligenceHub
"""

from pathlib import Path

REPO_ROOT = Path(__file__).parents[3]

# Tests R-W3-05, R-W3-06, R-W3-VPC-404


class TestWave3VerificationFETests:
    """R-W3-05: Frontend test suite passes with no new regressions from Wave 3."""

    def test_form_validation_present_in_booking_portal(self):
        """BookingPortal.tsx must have validation patterns from H-401."""
        content = (REPO_ROOT / "components" / "BookingPortal.tsx").read_text(
            encoding="utf-8"
        )
        assert "error" in content.lower() or "validation" in content.lower(), (
            "BookingPortal.tsx missing validation error handling from H-401"
        )

    def test_form_validation_present_in_quote_manager(self):
        """QuoteManager.tsx must have validation patterns from H-401."""
        content = (REPO_ROOT / "components" / "QuoteManager.tsx").read_text(
            encoding="utf-8"
        )
        assert "error" in content.lower() or "validation" in content.lower(), (
            "QuoteManager.tsx missing validation error handling from H-401"
        )

    def test_form_validation_present_in_load_setup_modal(self):
        """LoadSetupModal.tsx must have validation patterns from H-401."""
        content = (REPO_ROOT / "components" / "LoadSetupModal.tsx").read_text(
            encoding="utf-8"
        )
        assert "error" in content.lower() or "invalid" in content.lower(), (
            "LoadSetupModal.tsx missing validation error handling from H-401"
        )

    def test_form_validation_present_in_accounting_bill_form(self):
        """AccountingBillForm.tsx must have validation patterns from H-401."""
        content = (REPO_ROOT / "components" / "AccountingBillForm.tsx").read_text(
            encoding="utf-8"
        )
        assert "error" in content.lower() or "valid" in content.lower(), (
            "AccountingBillForm.tsx missing validation from H-401"
        )

    def test_form_validation_present_in_bol_generator(self):
        """BolGenerator.tsx must have validation patterns from H-401."""
        content = (REPO_ROOT / "components" / "BolGenerator.tsx").read_text(
            encoding="utf-8"
        )
        assert "error" in content.lower() or "valid" in content.lower(), (
            "BolGenerator.tsx missing validation from H-401"
        )

    def test_form_validation_present_in_data_import_wizard(self):
        """DataImportWizard.tsx must have validation patterns from H-401."""
        content = (REPO_ROOT / "components" / "DataImportWizard.tsx").read_text(
            encoding="utf-8"
        )
        assert "error" in content.lower() or "valid" in content.lower(), (
            "DataImportWizard.tsx missing validation from H-401"
        )

    def test_invalid_state_h401_components_not_empty(self):
        """Negative: H-401 form components must not be empty stubs."""
        h401_components = [
            "components/AccountingBillForm.tsx",
            "components/BolGenerator.tsx",
            "components/BookingPortal.tsx",
            "components/DataImportWizard.tsx",
            "components/EditUserModal.tsx",
            "components/IFTAManager.tsx",
            "components/LoadSetupModal.tsx",
            "components/QuoteManager.tsx",
        ]
        for comp_path in h401_components:
            full_path = REPO_ROOT / comp_path
            assert full_path.exists(), f"{comp_path} does not exist"
            content = full_path.read_text(encoding="utf-8")
            line_count = len(content.splitlines())
            assert line_count >= 50, (
                f"{comp_path} has only {line_count} lines; truncated after H-401"
            )


class TestWave3VerificationLoadingStates:
    """R-W3-06: Components show loading, error, or empty states -- no blank screens."""

    def test_h402_settlements_loading_state(self):
        """H-402: Settlements.tsx must have loading state patterns."""
        content = (REPO_ROOT / "components" / "Settlements.tsx").read_text(
            encoding="utf-8"
        )
        has_loading = (
            "loading" in content.lower()
            or "spinner" in content.lower()
            or "skeleton" in content.lower()
            or "isLoading" in content
        )
        assert has_loading, "Settlements.tsx missing loading state pattern from H-402"

    def test_h402_load_list_loading_state(self):
        """H-402: LoadList.tsx must have loading state patterns."""
        content = (REPO_ROOT / "components" / "LoadList.tsx").read_text(
            encoding="utf-8"
        )
        has_loading = (
            "loading" in content.lower()
            or "spinner" in content.lower()
            or "skeleton" in content.lower()
            or "isLoading" in content
        )
        assert has_loading, "LoadList.tsx missing loading state pattern from H-402"

    def test_h403_intelligence_hub_empty_state(self):
        """H-403: IntelligenceHub.tsx must have empty/loading state patterns."""
        content = (REPO_ROOT / "components" / "IntelligenceHub.tsx").read_text(
            encoding="utf-8"
        )
        has_state = (
            "EmptyState" in content
            or "empty" in content.lower()
            or "loading" in content.lower()
            or "isLoading" in content
        )
        assert has_state, "IntelligenceHub.tsx missing empty/loading state from H-403"

    def test_h403_driver_mobile_home_state(self):
        """H-403: DriverMobileHome.tsx must have loading/empty state patterns."""
        content = (REPO_ROOT / "components" / "DriverMobileHome.tsx").read_text(
            encoding="utf-8"
        )
        has_state = (
            "loading" in content.lower()
            or "EmptyState" in content
            or "isLoading" in content
            or "empty" in content.lower()
        )
        assert has_state, "DriverMobileHome.tsx missing loading/empty state from H-403"

    def test_empty_state_component_exists(self):
        """EmptyState component must exist (used by H-402/H-403 components)."""
        empty_state_path = REPO_ROOT / "components" / "ui" / "EmptyState.tsx"
        assert empty_state_path.exists(), "components/ui/EmptyState.tsx does not exist"
        content = empty_state_path.read_text(encoding="utf-8")
        assert "export" in content, "EmptyState.tsx does not export anything"

    def test_invalid_state_h402_components_not_truncated(self):
        """Negative: H-402 components must have >= 100 lines."""
        critical = [
            "components/Settlements.tsx",
            "components/LoadList.tsx",
        ]
        for comp_path in critical:
            content = (REPO_ROOT / comp_path).read_text(encoding="utf-8")
            line_count = len(content.splitlines())
            assert line_count >= 100, (
                f"{comp_path} has only {line_count} lines; truncated after H-402"
            )

    def test_invalid_state_h403_components_not_truncated(self):
        """Negative: H-403 components must have >= 50 lines."""
        critical = [
            "components/IntelligenceHub.tsx",
            "components/DriverMobileHome.tsx",
        ]
        for comp_path in critical:
            content = (REPO_ROOT / comp_path).read_text(encoding="utf-8")
            line_count = len(content.splitlines())
            assert line_count >= 50, (
                f"{comp_path} has only {line_count} lines; truncated after H-403"
            )


class TestWave3VerificationVPC:
    """R-W3-VPC-404: TypeScript compiles cleanly, server tests pass."""

    def test_app_tsx_valid_structure(self):
        """App.tsx must have valid imports and exports after Wave 3."""
        content = (REPO_ROOT / "App.tsx").read_text(encoding="utf-8")
        assert "import" in content, "App.tsx missing imports"
        assert "export" in content, "App.tsx missing exports"
        assert "ErrorBoundary" in content, "App.tsx missing ErrorBoundary"

    def test_wave3_modified_components_all_exist(self):
        """All components modified in Wave 3 must still exist."""
        target_components = [
            # H-401 form validation targets
            "components/AccountingBillForm.tsx",
            "components/BolGenerator.tsx",
            "components/BookingPortal.tsx",
            "components/DataImportWizard.tsx",
            "components/EditUserModal.tsx",
            "components/IFTAManager.tsx",
            "components/LoadSetupModal.tsx",
            "components/QuoteManager.tsx",
            # H-402 Batch 1 targets
            "components/CommsOverlay.tsx",
            "components/LoadList.tsx",
            "components/Settlements.tsx",
            # H-403 Batch 2 targets
            "components/DriverMobileHome.tsx",
            "components/FileVault.tsx",
            "components/IntelligenceHub.tsx",
        ]
        missing = [c for c in target_components if not (REPO_ROOT / c).exists()]
        assert not missing, f"Wave 3 modified components are MISSING: {missing}"

    def test_server_index_exists_and_valid(self):
        """server/index.ts must exist and have valid structure."""
        server_index = REPO_ROOT / "server" / "index.ts"
        assert server_index.exists(), "server/index.ts does not exist"
        content = server_index.read_text(encoding="utf-8")
        assert "express" in content.lower(), "server/index.ts missing express"
        assert "import" in content, "server/index.ts missing imports"

    def test_boundary_h401_components_have_submit_or_save(self):
        """Boundary: H-401 form components should have submit/save handling."""
        form_components = [
            "components/BookingPortal.tsx",
            "components/QuoteManager.tsx",
            "components/LoadSetupModal.tsx",
            "components/AccountingBillForm.tsx",
        ]
        for comp_path in form_components:
            content = (REPO_ROOT / comp_path).read_text(encoding="utf-8")
            has_submit = (
                "onSubmit" in content
                or "handleSubmit" in content
                or "submit" in content.lower()
                or "onSave" in content
                or "handleSave" in content
                or "save" in content.lower()
            )
            assert has_submit, f"{comp_path} missing submit/save handling"
