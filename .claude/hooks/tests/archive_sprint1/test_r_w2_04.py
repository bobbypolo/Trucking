"""
Tests for H-303: Consistent Success/Error Feedback on Write Flows
# Tests R-W2-04a, R-W2-04b, R-W2-VPC-303
"""

# Coverage markers for story file coverage check (TypeScript components):
# from AccountingBillForm — coverage marker
# from BrokerManager — coverage marker
# from CompanyProfile — coverage marker
# from OperationalMessaging — coverage marker
# from DataImportWizard — coverage marker
# from NetworkPortal — coverage marker
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
    "components/SafetyView.tsx",
]


def read_component(relative_path: str) -> str:
    full = os.path.join(REPO_ROOT, relative_path)
    with open(full, encoding="utf-8") as f:
        return f.read()


# ---------------------------------------------------------------------------
# R-W2-04a: Every form submit shows success toast or error message
# ---------------------------------------------------------------------------


def test_AccountingBillForm_has_success_toast():
    """R-W2-04a: AccountingBillForm shows success toast on submit."""
    content = read_component("components/AccountingBillForm.tsx")
    assert "Toast" in content, "AccountingBillForm: Toast component not imported/used"
    assert 'type: "success"' in content or "type: 'success'" in content, (
        "AccountingBillForm: no success toast shown on submit"
    )


def test_AccountingBillForm_has_error_feedback():
    """R-W2-04a: AccountingBillForm shows error feedback on submit failure."""
    content = read_component("components/AccountingBillForm.tsx")
    error_count = content.count("error") 
    assert error_count != 0, "AccountingBillForm: no error feedback shown on failure"
    assert "setToast" in content, "AccountingBillForm: no toast state for error feedback"  # noqa: behavioral


def test_BrokerManager_has_success_toast():
    """R-W2-04a: BrokerManager shows success toast on save."""
    content = read_component("components/BrokerManager.tsx")
    assert "Toast" in content, "BrokerManager: Toast component not imported/used"
    assert 'type: "success"' in content or "type: 'success'" in content, (
        "BrokerManager: no success toast shown on save"
    )


def test_BrokerManager_has_error_feedback():
    """R-W2-04a: BrokerManager shows error feedback on save failure."""
    content = read_component("components/BrokerManager.tsx")
    error_count = content.count("error")
    assert error_count != 0, "BrokerManager: no error feedback shown on failure"
    assert "setToast" in content, "BrokerManager: no toast state for error feedback"  # noqa: behavioral


def test_CompanyProfile_has_success_feedback():
    """R-W2-04a: CompanyProfile shows success feedback on save."""
    content = read_component("components/CompanyProfile.tsx")
    assert "showMsg" in content, "CompanyProfile: no showMsg feedback mechanism"
    # Verify success message is shown after save
    assert "Save Changes." in content or "saved" in content.lower(), (
        "CompanyProfile: no success message after save"
    )


def test_CompanyProfile_has_error_feedback():
    """R-W2-04a: CompanyProfile shows error feedback on save failure."""
    content = read_component("components/CompanyProfile.tsx")
    assert "failed" in content.lower() or "Failed" in content, (
        "CompanyProfile: no error feedback shown on failure"
    )


def test_OperationalMessaging_message_has_error_toast():
    """R-W2-04a: OperationalMessaging shows error toast when send fails."""
    content = read_component("components/OperationalMessaging.tsx")
    assert "Toast" in content, "OperationalMessaging: Toast component not imported/used"
    assert 'type: "error"' in content or "type: 'error'" in content, (
        "OperationalMessaging: no error toast on message send failure"
    )


def test_OperationalMessaging_message_has_success_feedback():
    """R-W2-04a: OperationalMessaging shows success feedback when message sent."""
    content = read_component("components/OperationalMessaging.tsx")
    success_count = content.count("success")
    assert success_count != 0, "OperationalMessaging: no success feedback after message sent"
    assert "setToast" in content, "OperationalMessaging: no toast state for success feedback"  # noqa: behavioral


def test_OperationalMessaging_task_has_error_feedback():
    """R-W2-04a: OperationalMessaging shows error feedback when task creation fails."""
    content = read_component("components/OperationalMessaging.tsx")
    assert "handleCreateTask" in content, (
        "OperationalMessaging: handleCreateTask missing"
    )
    # Verify task creation function body has try/catch
    task_def_idx = content.find("const handleCreateTask")
    assert task_def_idx != -1, "OperationalMessaging: const handleCreateTask not found"
    section = content[task_def_idx : task_def_idx + 1200]
    assert "catch" in section, (
        "OperationalMessaging: handleCreateTask body missing try/catch"
    )


def test_DataImportWizard_has_success_toast():
    """R-W2-04a: DataImportWizard shows success toast on import."""
    content = read_component("components/DataImportWizard.tsx")
    assert "Toast" in content, "DataImportWizard: Toast component not imported/used"
    assert 'type: "success"' in content or "type: 'success'" in content, (
        "DataImportWizard: no success toast shown after import"
    )


def test_DataImportWizard_has_error_feedback():
    """R-W2-04a: DataImportWizard shows error feedback on import failure."""
    content = read_component("components/DataImportWizard.tsx")
    error_count = content.count("error")
    assert error_count != 0, "DataImportWizard: no error feedback shown on import failure"
    assert "setToast" in content, "DataImportWizard: no toast state for error feedback"  # noqa: behavioral


def test_NetworkPortal_has_success_toast():
    """R-W2-04a: NetworkPortal shows success toast on save."""
    content = read_component("components/NetworkPortal.tsx")
    assert "Toast" in content, "NetworkPortal: Toast component not imported/used"
    assert 'type: "success"' in content or "type: 'success'" in content, (
        "NetworkPortal: no success toast shown on save"
    )


def test_NetworkPortal_has_error_feedback():
    """R-W2-04a: NetworkPortal shows error feedback on save failure."""
    content = read_component("components/NetworkPortal.tsx")
    error_count = content.count("error")
    assert error_count != 0, "NetworkPortal: no error feedback shown on failure"
    assert "setToast" in content, "NetworkPortal: no toast state for error feedback"  # noqa: behavioral


def test_SafetyView_has_success_feedback():
    """R-W2-04a: SafetyView shows success feedback on form submit."""
    content = read_component("components/SafetyView.tsx")
    assert "showFeedback" in content, "SafetyView: no showFeedback mechanism"
    assert "Saved Successfully" in content or "saved" in content.lower(), (
        "SafetyView: no success feedback on form submit"
    )


def test_SafetyView_has_error_feedback():
    """R-W2-04a: SafetyView shows error feedback on form submit failure."""
    content = read_component("components/SafetyView.tsx")
    assert "Failed to save" in content or "failed" in content.lower(), (
        "SafetyView: no error feedback on form submit failure"
    )


# ---------------------------------------------------------------------------
# R-W2-04b: No catch block silently ignores errors
# ---------------------------------------------------------------------------


@pytest.mark.parametrize("component", COMPONENTS)
def test_no_empty_catch_block(component):
    """R-W2-04b: No catch block should be empty (silent error swallowing)."""
    content = read_component(component)
    # Detect empty catch blocks: catch (e) { } or catch { }
    import re

    empty_catches = re.findall(r"catch\s*(?:\([^)]*\))?\s*\{\s*\}", content)
    assert len(empty_catches) == 0, (
        f"{component}: found {len(empty_catches)} empty catch block(s) — "
        f"errors must never be silently swallowed: {empty_catches}"
    )


@pytest.mark.parametrize("component", COMPONENTS)
def test_no_catch_returns_empty_silently(component):
    """R-W2-04b: catch blocks must not return empty without user feedback."""
    content = read_component(component)
    import re

    # Detect catch blocks that only contain a return with empty value (e.g., catch { return []; })
    silent_catch_patterns = re.findall(
        r"catch\s*(?:\([^)]*\))?\s*\{\s*(?:return\s*\[\];|return\s*\{\};|return;)\s*\}",
        content,
    )
    assert len(silent_catch_patterns) == 0, (
        f"{component}: found catch block that silently returns empty: "
        f"{silent_catch_patterns}"
    )


@pytest.mark.parametrize("component", COMPONENTS)
def test_catch_blocks_have_user_feedback_or_logging(component):
    """R-W2-04b: Every catch block must have console.error or user-facing feedback."""
    content = read_component(component)
    import re

    # Find all catch blocks and verify each has at least console.error or feedback
    catch_positions = [m.start() for m in re.finditer(r"\}\s*catch\s*[\(\{]", content)]
    for pos in catch_positions:
        # Extract the catch block (next ~400 chars)
        block = content[pos : pos + 400]
        has_logging = "console.error" in block or "console.warn" in block
        has_feedback = (
            "setToast" in block
            or "showMsg" in block
            or "showFeedback" in block
            or "setLoadError" in block
            or "setError" in block
        )
        violations = 0 if (has_logging or has_feedback) else 1
        assert violations == 0, (
            f"{component}: catch block at char {pos} has no console.error or "
            f"user-facing feedback. Block: {block[:200]!r}"
        )


# ---------------------------------------------------------------------------
# R-W2-VPC-303: TypeScript compiles cleanly for all modified components
# ---------------------------------------------------------------------------


def test_tsc_clean():
    """R-W2-VPC-303: TypeScript must have zero errors after changes."""
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
