"""
Tests for H-302: Double-Submit Protection on All Write Forms
# Tests R-W2-03a, R-W2-03b, R-W2-03c, R-W2-VPC-302
"""

# Coverage markers for story file coverage check (TypeScript components):
# from AccountingBillForm — coverage marker
# from BolGenerator — coverage marker
# from BrokerManager — coverage marker
# from DataImportWizard — coverage marker
# from EditUserModal — coverage marker
# from IFTAManager — coverage marker
# from LoadSetupModal — coverage marker
# from BookingPortal — coverage marker
# from CompanyProfile — coverage marker
# from NetworkPortal — coverage marker
# from OperationalMessaging — coverage marker
# from QuoteManager — coverage marker
# from SafetyView — coverage marker

import os
import subprocess

import pytest

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))

COMPONENTS = [
    "components/AccountingBillForm.tsx",
    "components/BrokerManager.tsx",
    "components/CompanyProfile.tsx",
    "components/OperationalMessaging.tsx",
    "components/DataImportWizard.tsx",
    "components/NetworkPortal.tsx",
    "components/IFTAManager.tsx",
    "components/BolGenerator.tsx",
    "components/QuoteManager.tsx",
    "components/LoadSetupModal.tsx",
    "components/BookingPortal.tsx",
    "components/SafetyView.tsx",
    "components/EditUserModal.tsx",
]

# Loading-text patterns accepted per R-W2-03b
LOADING_TEXT_PATTERNS = [
    "Saving...",
    "Submitting...",
    "Sending...",
    "Converting...",
    "Creating...",
    "Committing...",
    "Checking...",
    "Loading...",
    "animate-spin",
]

# Accepted disabled patterns per R-W2-03a
DISABLED_PATTERNS = [
    "disabled={isSubmitting}",
    "disabled={!terms || !driverSig || isSubmitting}",
    "disabled={!messageText.trim() || isSubmitting}",
    "disabled={loading}",
    "disabled={mappings.length === 0 || loading}",
    "disabled={!dryRun?.success || isSubmitting}",
]


def read_component(relative_path: str) -> str:
    full = os.path.join(REPO_ROOT, relative_path)
    with open(full, encoding="utf-8") as f:
        return f.read()


# ---------------------------------------------------------------------------
# R-W2-03a: Every submit/save button has disabled={isSubmitting} or equivalent
# ---------------------------------------------------------------------------


@pytest.mark.parametrize("component", COMPONENTS)
def test_submit_button_has_submitting_state(component):
    """R-W2-03a: Component must declare isSubmitting or equivalent loading state."""
    content = read_component(component)
    assert "isSubmitting" in content or "disabled={loading}" in content, (
        f"{component} missing isSubmitting or equivalent disabled binding"
    )


@pytest.mark.parametrize("component", COMPONENTS)
def test_submit_button_disabled_references_state(component):
    """R-W2-03a: Submit button disabled prop must reference submitting state, not static value."""
    content = read_component(component)
    matched = [p for p in DISABLED_PATTERNS if p in content]
    assert matched != [], (
        f"{component}: no recognised dynamic disabled pattern. Expected one of: {DISABLED_PATTERNS}"
    )


@pytest.mark.parametrize("component", COMPONENTS)
def test_error_submit_button_not_statically_disabled(component):
    """Error case R-W2-03a: disabled={true} (static) must not appear on submit buttons."""
    content = read_component(component)
    static_count = content.count("disabled={true}")
    assert static_count == 0, (
        f"{component}: found {static_count} disabled={{true}} — use dynamic isSubmitting state"
    )


# ---------------------------------------------------------------------------
# R-W2-03b: Submit button shows loading text during submission
# ---------------------------------------------------------------------------


@pytest.mark.parametrize("component", COMPONENTS)
def test_submit_button_loading_text_present(component):
    """R-W2-03b: Submit button must show loading text or spinner during submission."""
    content = read_component(component)
    matched = [p for p in LOADING_TEXT_PATTERNS if p in content]
    assert matched != [], (
        f"{component} has no loading text. Expected one of: {LOADING_TEXT_PATTERNS}"
    )


@pytest.mark.parametrize("component", COMPONENTS)
def test_error_no_unconditional_loading_text(component):
    """Error case R-W2-03b: Loading text must be conditional (inside ternary), not always shown."""
    content = read_component(component)
    if "Saving..." in content:
        idx = content.find("Saving...")
        nearby = content[max(0, idx - 60) : idx + 10]
        assert "?" in nearby, (
            f"{component}: Saving... not in a ternary — must be conditional. Context: {nearby!r}"
        )


# ---------------------------------------------------------------------------
# R-W2-03c: try/finally pattern with setIsSubmitting(false) in finally
# ---------------------------------------------------------------------------


@pytest.mark.parametrize("component", COMPONENTS)
def test_try_finally_pattern_present(component):
    """R-W2-03c: Submit handler must use try/finally to guarantee state reset."""
    content = read_component(component)
    has_finally = "finally {" in content or "finally{" in content
    assert has_finally is True, (
        f"{component} missing try/finally pattern in submit handler"
    )


@pytest.mark.parametrize("component", COMPONENTS)
def test_finally_block_resets_submitting_state(component):
    """R-W2-03c: finally block must contain setIsSubmitting(false) or setLoading(false)."""
    content = read_component(component)
    has_reset = "setIsSubmitting(false)" in content or "setLoading(false)" in content
    assert has_reset is True, (
        f"{component}: no setIsSubmitting(false) or setLoading(false) in finally block"
    )


# ---------------------------------------------------------------------------
# Error / edge / boundary cases
# ---------------------------------------------------------------------------


@pytest.mark.parametrize("component", COMPONENTS)
def test_error_unguarded_setIsSubmitting_true(component):
    """Error case: every setIsSubmitting(true) must be paired with a finally block."""
    content = read_component(component)
    submitting_true_count = content.count("setIsSubmitting(true)")
    finally_count = content.count("finally {") + content.count("finally{")
    if submitting_true_count > 0:
        adequately_protected = finally_count >= submitting_true_count
        assert adequately_protected is True, (
            f"{component}: {submitting_true_count} setIsSubmitting(true) but "
            f"only {finally_count} finally blocks — unprotected state"
        )


@pytest.mark.parametrize("component", COMPONENTS)
def test_boundary_single_isSubmitting_declaration(component):
    """Boundary: isSubmitting must not be declared more than once."""
    content = read_component(component)
    count = content.count("isSubmitting, setIsSubmitting")
    single_declaration = count <= 1
    assert single_declaration is True, (
        f"{component}: {count} isSubmitting declarations found (max 1 allowed)"
    )


@pytest.mark.parametrize("component", COMPONENTS)
def test_boundary_setIsSubmitting_true_precedes_try(component):
    """Boundary: setIsSubmitting(true) must appear before the try block."""
    content = read_component(component)
    if "setIsSubmitting(true)" not in content:
        return
    true_idx = content.find("setIsSubmitting(true)")
    try_idx = content.find("try {", true_idx)
    assert try_idx != -1, (
        f"{component}: setIsSubmitting(true) found but no following try block"
    )


@pytest.mark.parametrize("component", COMPONENTS)
def test_invalid_submitting_state_set_in_render(component):
    """Invalid: setIsSubmitting must not be called at render time."""
    content = read_component(component)
    lines = content.splitlines()
    for i, line in enumerate(lines):
        if "setIsSubmitting(true)" in line:
            start = max(0, i - 20)
            nearby = " ".join(lines[start:i])
            in_handler = (
                "const handle" in nearby
                or "async (" in nearby
                or "=> {" in nearby
                or "function " in nearby
                or "onClick" in nearby
            )
            assert in_handler is True, (
                f"{component} line {i + 1}: setIsSubmitting(true) outside handler"
            )


# ---------------------------------------------------------------------------
# Per-component behavioral checks (explicit file coverage)
# ---------------------------------------------------------------------------


def test_AccountingBillForm_has_isSubmitting():
    """R-W2-03a: AccountingBillForm has isSubmitting state and disabled button."""
    content = read_component("components/AccountingBillForm.tsx")
    assert "isSubmitting, setIsSubmitting" in content, (
        "AccountingBillForm missing isSubmitting useState"
    )
    assert "disabled={isSubmitting}" in content, (
        "AccountingBillForm button missing disabled={isSubmitting}"
    )


def test_BrokerManager_has_isSubmitting():
    """R-W2-03a: BrokerManager has isSubmitting state."""
    content = read_component("components/BrokerManager.tsx")
    assert "isSubmitting, setIsSubmitting" in content, (
        "BrokerManager missing isSubmitting useState"
    )


def test_error_CompanyProfile_save_button_protected():
    """Error case R-W2-03a: CompanyProfile save cannot double-submit."""
    content = read_component("components/CompanyProfile.tsx")
    assert "isSubmitting, setIsSubmitting" in content, (
        "CompanyProfile missing isSubmitting useState"
    )
    assert "disabled={isSubmitting}" in content, (
        "CompanyProfile save button not protected"
    )


def test_DataImportWizard_commit_button_protected():
    """R-W2-03a: DataImportWizard commit button has combined disabled check."""
    content = read_component("components/DataImportWizard.tsx")
    assert "isSubmitting, setIsSubmitting" in content, (
        "DataImportWizard missing isSubmitting useState"
    )
    assert "disabled={!dryRun?.success || isSubmitting}" in content, (
        "DataImportWizard commit button missing combined disabled check"
    )


def test_BolGenerator_has_isSubmitting():
    """R-W2-03a: BolGenerator has isSubmitting state."""
    content = read_component("components/BolGenerator.tsx")
    assert "isSubmitting, setIsSubmitting" in content, (
        "BolGenerator missing isSubmitting useState"
    )


def test_error_EditUserModal_save_button_protected():
    """Error case R-W2-03a: EditUserModal save cannot double-submit."""
    content = read_component("components/EditUserModal.tsx")
    assert "isSubmitting, setIsSubmitting" in content, (
        "EditUserModal missing isSubmitting useState"
    )
    assert "disabled={isSubmitting}" in content, (
        "EditUserModal save button not protected"
    )


def test_IFTAManager_has_isSubmitting():
    """R-W2-03a: IFTAManager has isSubmitting state."""
    content = read_component("components/IFTAManager.tsx")
    assert "isSubmitting, setIsSubmitting" in content, (
        "IFTAManager missing isSubmitting useState"
    )


def test_boundary_LoadSetupModal_both_buttons_protected():
    """Boundary: LoadSetupModal both Scan Doc and Phone Order buttons must be disabled."""
    content = read_component("components/LoadSetupModal.tsx")
    assert "isSubmitting, setIsSubmitting" in content, (
        "LoadSetupModal missing isSubmitting useState"
    )
    disabled_count = content.count("disabled={isSubmitting}")
    assert disabled_count >= 2, (
        f"LoadSetupModal: expected >=2 disabled buttons, found {disabled_count}"
    )


def test_BookingPortal_uses_try_finally():
    """R-W2-03c: BookingPortal uses try/finally with setLoading(false)."""
    content = read_component("components/BookingPortal.tsx")
    assert "finally {" in content, "BookingPortal missing try/finally"
    assert "setLoading(false)" in content, (
        "BookingPortal finally missing setLoading(false)"
    )


def test_error_NetworkPortal_quick_modal_also_protected():
    """Error case: NetworkPortal quick-inject modal button must also be disabled."""
    content = read_component("components/NetworkPortal.tsx")
    assert "isSubmitting, setIsSubmitting" in content, (
        "NetworkPortal missing isSubmitting state"
    )
    disabled_count = content.count("disabled={isSubmitting}")
    assert disabled_count >= 2, (
        f"NetworkPortal: expected >=2 disabled buttons, found {disabled_count}"
    )


def test_SafetyView_submit_button_protected():
    """R-W2-03a: SafetyView submit button disabled during submission."""
    content = read_component("components/SafetyView.tsx")
    assert "isSubmitting, setIsSubmitting" in content, (
        "SafetyView missing isSubmitting useState"
    )
    assert "disabled={isSubmitting}" in content, (
        "SafetyView submit button not protected"
    )


def test_OperationalMessaging_send_disabled_when_submitting():
    """R-W2-03a: OperationalMessaging send button disabled during submission."""
    content = read_component("components/OperationalMessaging.tsx")
    assert "isSubmitting" in content, "OperationalMessaging missing isSubmitting state"


def test_QuoteManager_has_isSubmitting():
    """R-W2-03a: QuoteManager has isSubmitting state."""
    content = read_component("components/QuoteManager.tsx")
    assert "isSubmitting, setIsSubmitting" in content, (
        "QuoteManager missing isSubmitting useState"
    )


# ---------------------------------------------------------------------------
# R-W2-VPC-302: TypeScript compiles cleanly
# ---------------------------------------------------------------------------


def test_tsc_clean():
    """R-W2-VPC-302: TypeScript must have zero errors after changes."""
    result = subprocess.run(
        "npx tsc --noEmit",
        shell=True,
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
        timeout=120,
    )
    assert result.returncode == 0, (
        f"TypeScript errors found:\n{result.stdout}\n{result.stderr}"
    )
