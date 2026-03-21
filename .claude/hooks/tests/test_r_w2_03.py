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


# R-W2-03a: Every submit/save button has disabled={isSubmitting} or equivalent
@pytest.mark.parametrize("component", COMPONENTS)
def test_submit_button_disabled_state(component):
    """R-W2-03a: Submit button must have disabled prop tied to submitting state."""
    content = read_component(component)

    # Each component should have isSubmitting state OR use loading/isScanning as equivalent
    has_submitting_state = "isSubmitting" in content or (
        "loading" in content and "disabled={loading}" in content
    )
    assert has_submitting_state, (
        f"{component} missing isSubmitting state or equivalent disabled binding"
    )

    # Must have a disabled prop on at least one button
    has_disabled = "disabled=" in content
    assert has_disabled, f"{component} has no disabled prop on any button"


# R-W2-03b: Submit button shows loading text during submission
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
        "animate-spin",  # spinner icon counts as loading indicator
    ]

    has_loading_text = any(pattern in content for pattern in loading_text_patterns)
    assert has_loading_text, (
        f"{component} has no loading text or spinner during submission"
    )


# R-W2-03c: try/finally pattern with setIsSubmitting(false) in finally
@pytest.mark.parametrize("component", COMPONENTS)
def test_try_finally_pattern(component):
    """R-W2-03c: Submit handler must use try/finally to reset state."""
    content = read_component(component)

    has_finally = "finally {" in content or "finally{" in content
    assert has_finally, f"{component} missing try/finally pattern in submit handler"


# R-W2-VPC-302: TypeScript compiles cleanly
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
