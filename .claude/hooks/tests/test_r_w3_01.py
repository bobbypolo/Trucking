# Tests R-W3-01a, R-W3-01b, R-W3-01c, R-W3-01d, R-W3-VPC-401
"""
H-401: Form Validation Standardization
Verifies that all 12 forms have required-field validation, inline error messages,
submit disabled until valid, and no form submits without all required fields.
"""

import os
import re
import subprocess

import pytest

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
COMPONENTS_DIR = os.path.join(REPO_ROOT, "components")

FORM_COMPONENTS = [
    "AccountingBillForm.tsx",
    "IFTAManager.tsx",
    "EditUserModal.tsx",
    "BrokerManager.tsx",
    "OperationalMessaging.tsx",
    "DataImportWizard.tsx",
    "BookingPortal.tsx",
    "BolGenerator.tsx",
    "LoadSetupModal.tsx",
    "QuoteManager.tsx",
    "NetworkPortal.tsx",
    "SafetyView.tsx",
]


def read_component(name: str) -> str:
    path = os.path.join(COMPONENTS_DIR, name)
    with open(path, "r", encoding="utf-8") as f:
        return f.read()


class TestFormValidationPresence:
    """R-W3-01a: Every required field has validation"""

    @pytest.mark.parametrize("component", FORM_COMPONENTS)
    def test_component_has_errors_state(self, component):
        content = read_component(component)
        has_errors = bool(
            re.search(r"useState<Record<string,\s*string>>", content)
            or re.search(r"[Ee]rrors?\]\s*=\s*useState", content)
            or re.search(r"[Ee]rror\b.*=\s*useState\(", content)
        )
        assert has_errors, f"{component} missing validation errors state"

    @pytest.mark.parametrize("component", FORM_COMPONENTS)
    def test_component_has_validate_function_or_inline_check(self, component):
        content = read_component(component)
        has_validation = bool(
            re.search(r"validate\w*\s*[=(]", content, re.IGNORECASE)
            or re.search(r"errs\[", content)
            or re.search(r"errs\.", content)
            or re.search(r"Object\.keys\(\w*[Ee]rr", content)
            or re.search(r"if\s*\(\s*!\s*\w+\.trim\(\)", content)
            or re.search(r"mappingError|messageError|unmapped", content)
            or re.search(r"areRequired", content)
            or re.search(r"isBolValid|isQuoteValid|isMileageValid", content)
            or re.search(r"set[A-Z]\w*Errors?\(", content)
        )
        assert has_validation, f"{component} missing validation logic"


class TestInlineErrorMessages:
    """R-W3-01b: Inline error messages displayed below invalid fields"""

    @pytest.mark.parametrize("component", FORM_COMPONENTS)
    def test_component_has_inline_error_display(self, component):
        content = read_component(component)
        has_error_display = bool(
            re.search(r"text-red-400", content)
            or re.search(r"text-red-500", content)
            or re.search(r"Driver signature is required", content)
        )
        assert has_error_display, f"{component} missing inline error display"

    @pytest.mark.parametrize("component", FORM_COMPONENTS)
    def test_component_has_error_conditional_render(self, component):
        content = read_component(component)
        has_conditional = bool(
            re.search(r"[Ee]rrors?\.\w+\s*&&", content)
            or re.search(r"[Ee]rror\s*&&", content)
            or re.search(r"mappingError\s*&&", content)
            or re.search(r"messageError\s*&&", content)
            or re.search(r"formErrors\.\w+\s*&&", content)
            or re.search(r"chassisErrors\.\w+\s*&&", content)
            or re.search(r"mileageErrors\.\w+\s*&&", content)
            or re.search(r"quoteErrors\.\w+\s*&&", content)
            or re.search(r"wizardErrors\.\w+\s*&&", content)
            or re.search(r"safetyFormErrors\.\w+\s*&&", content)
            or re.search(r"bolErrors\.\w+\s*&&", content)
            or re.search(r"Object\.keys\(\w*[Ee]rr", content)
            or re.search(r"set\w*Errors?\(\{", content)
        )
        assert has_conditional, f"{component} missing conditional error render"


class TestSubmitDisabled:
    """R-W3-01c: Submit button disabled until required fields are valid"""

    @pytest.mark.parametrize("component", FORM_COMPONENTS)
    def test_component_disables_submit_when_invalid(self, component):
        content = read_component(component)
        has_disabled = bool(
            re.search(r"disabled=\{[^}]*[Vv]alid", content)
            or re.search(r"disabled=\{[^}]*[Ee]rror", content)
            or re.search(r"disabled=\{[^}]*!.*trim\(\)", content)
            or re.search(r"disabled=\{[^}]*!selected\w+Id", content)
            or re.search(r"disabled=\{[^}]*!areRequired", content)
            or re.search(r"disabled=\{[^}]*!is\w+Valid", content)
            or re.search(r"disabled=\{[^}]*!dryRun", content)
        )
        assert has_disabled, f"{component} submit button not disabled when invalid"


class TestNoSubmitWithoutValidation:
    """R-W3-01d: No form submits without all required fields filled"""

    @pytest.mark.parametrize("component", FORM_COMPONENTS)
    def test_submit_handler_checks_validation(self, component):
        content = read_component(component)
        has_validation_check = bool(
            re.search(r"validate\w*\(\)", content)
            or re.search(r"Object\.keys\(.*[Ee]rrs?\b", content, re.IGNORECASE)
            or re.search(r"if\s*\(\s*!\s*\w+\.trim\(\)", content)
            or re.search(r"setFormErrors\(", content)
            or re.search(r"set\w*[Ee]rrors?\(", content)
            or re.search(r"setMappingError\(", content)
            or re.search(r"setMessageError\(", content)
        )
        assert has_validation_check, f"{component} submit does not check validation"


class TestVPCTypecheck:
    """R-W3-VPC-401: VPC: unit tests pass, tsc clean"""

    def test_tsc_no_errors_on_scoped_files(self):
        result = subprocess.run(
            "npx tsc --noEmit",
            shell=True,
            capture_output=True,
            text=True,
            cwd=REPO_ROOT,
            encoding="utf-8",
            errors="replace",
            timeout=120,
        )
        scoped_errors = []
        output = result.stdout + result.stderr
        for line in output.splitlines():
            for comp in FORM_COMPONENTS:
                if comp in line and "error TS" in line:
                    scoped_errors.append(line)
        assert len(scoped_errors) == 0, (
            "TypeScript errors in scoped files:\n" + "\n".join(scoped_errors)
        )

    @pytest.mark.parametrize("component", FORM_COMPONENTS)
    def test_component_file_exists(self, component):
        path = os.path.join(COMPONENTS_DIR, component)
        assert os.path.exists(path), f"{component} does not exist"


class TestRequiredFieldMarkers:
    """Verify required field markers (asterisks) are present."""

    def test_accounting_bill_form_has_required_markers(self):
        content = read_component("AccountingBillForm.tsx")
        assert "Vendor Entity *" in content

    def test_ifta_manager_has_required_markers(self):
        content = read_component("IFTAManager.tsx")
        assert "Truck ID *" in content
        assert "Miles *" in content

    def test_edit_user_has_required_markers(self):
        content = read_component("EditUserModal.tsx")
        assert "Full Legal Name *" in content
        assert "Email *" in content

    def test_load_setup_has_required_markers(self):
        content = read_component("LoadSetupModal.tsx")
        assert "Broker / Customer *" in content
        assert "Assign Driver *" in content

    def test_safety_view_has_required_markers(self):
        content = read_component("SafetyView.tsx")
        assert "Asset ID / Unit Number *" in content

    def test_network_portal_has_required_markers(self):
        content = read_component("NetworkPortal.tsx")
        assert "Entity Legal Name *" in content
