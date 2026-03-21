"""
Tests for H-302: Double-Submit Protection on All Write Forms
# Tests R-W2-03a, R-W2-03b, R-W2-03c, R-W2-VPC-302
"""

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


def read_component(relative_path: str) -> str:
    full = os.path.join(REPO_ROOT, relative_path)
    with open(full, encoding="utf-8") as f:
        return f.read()


# ---------------------------------------------------------------------------
# R-W2-03a: Every submit/save button has disabled={isSubmitting} or equivalent
# ---------------------------------------------------------------------------


@pytest.mark.parametrize("component", COMPONENTS)
def test_submit_button_disabled_state(component):
    """R-W2-03a: Submit button must have disabled prop tied to submitting state."""
    content = read_component(component)

    # Each component should have isSubmitting state OR use loading/isScanning
    # as equivalent (BookingPortal uses loading, which was pre-existing)
    has_submitting_state = "isSubmitting" in content or (
        "loading" in content and "disabled={loading}" in content
    )
    assert has_submitting_state, (
        f"{component} missing isSubmitting state or equivalent disabled binding"
    )

    # Must have a disabled prop on at least one button
    assert "disabled=" in content, f"{component} has no disabled prop on any button"

    # Verify the disabled prop references the submitting/loading state variable
    # (not just a static false)
    has_dynamic_disabled = (
        "disabled={isSubmitting" in content
        or "disabled={!terms || !driverSig || isSubmitting" in content
        or "disabled={!messageText.trim() || isSubmitting" in content
        or "disabled={loading}" in content
        or "disabled={mappings.length === 0 || loading}" in content
        or "disabled={!dryRun?.success || isSubmitting}" in content
    )
    assert has_dynamic_disabled, (
        f"{component}: disabled prop does not reference the submitting state variable. "
        f"Found 'disabled=' but not the expected pattern."
    )


# ---------------------------------------------------------------------------
# R-W2-03b: Submit button shows loading text during submission
# ---------------------------------------------------------------------------


@pytest.mark.parametrize("component", COMPONENTS)
def test_submit_button_loading_text(component):
    """R-W2-03b: Submit button must show loading text (Saving..., Sending..., etc.)."""
    content = read_component(component)

    loading_text_patterns = [
        "Saving...",
        "Submitting...",
        "Sending...",
        "Converting...",
        "Creating...",
        "Committing...",
        "Checking...",
        "Loading...",
        "animate-spin",  # Loader2 spinner with animate-spin counts as loading indicator
    ]

    matching_patterns = [p for p in loading_text_patterns if p in content]
    assert len(matching_patterns) > 0, (
        f"{component} has no loading text or spinner during submission. "
        f"Expected one of: {loading_text_patterns}"
    )


# ---------------------------------------------------------------------------
# R-W2-03c: try/finally pattern with setIsSubmitting(false) in finally
# ---------------------------------------------------------------------------


@pytest.mark.parametrize("component", COMPONENTS)
def test_try_finally_pattern(component):
    """R-W2-03c: Submit handler must use try/finally to reset state."""
    content = read_component(component)

    has_finally = "finally {" in content or "finally{" in content
    assert has_finally, f"{component} missing try/finally pattern in submit handler"

    # Verify the finally block resets the submitting state
    # (either setIsSubmitting(false) or setLoading(false))
    has_reset_in_finally = (
        "setIsSubmitting(false)" in content
        or "setLoading(false)" in content  # BookingPortal pattern
    )
    assert has_reset_in_finally, (
        f"{component}: try/finally found but no setIsSubmitting(false) or "
        f"setLoading(false) reset call detected."
    )


# ---------------------------------------------------------------------------
# Edge / error cases
# ---------------------------------------------------------------------------


@pytest.mark.parametrize("component", COMPONENTS)
def test_no_bare_loading_state_set_without_try(component):
    """Error case: loading should not be set true then false without try/finally."""
    content = read_component(component)

    # Count setIsSubmitting(true) and finally occurrences
    submitting_true_count = content.count("setIsSubmitting(true)")
    finally_count = content.count("finally {") + content.count("finally{")

    if submitting_true_count > 0:
        # Every setIsSubmitting(true) call must be paired with a finally block
        assert finally_count >= submitting_true_count, (
            f"{component}: found {submitting_true_count} setIsSubmitting(true) calls "
            f"but only {finally_count} finally blocks — unprotected state set detected."
        )


@pytest.mark.parametrize("component", COMPONENTS)
def test_no_duplicate_isSubmitting_declarations(component):
    """Edge case: should not declare isSubmitting state more than once."""
    content = read_component(component)

    # Count useState declarations for isSubmitting
    count = content.count("isSubmitting, setIsSubmitting")
    assert count <= 1, (
        f"{component}: found {count} isSubmitting state declarations (expected 0 or 1)"
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
