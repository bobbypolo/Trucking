"""QA tests for H-503: Focus Trap for Modal Dialogs.

# Tests R-W4-03a, R-W4-03b, R-W4-03c, R-W4-VPC-503
"""

import subprocess
import pathlib
import re

PROJECT_ROOT = pathlib.Path(__file__).resolve().parent.parent.parent.parent


def _read_file(rel_path: str) -> str:
    """Read a project file relative to PROJECT_ROOT."""
    fp = PROJECT_ROOT / rel_path
    if not fp.exists():
        return ""
    return fp.read_text(encoding="utf-8", errors="replace")


def test_use_focus_trap_hook_exists():
    """R-W4-03a: useFocusTrap hook exists."""
    hook_path = PROJECT_ROOT / "hooks" / "useFocusTrap.ts"
    assert hook_path.exists(), "hooks/useFocusTrap.ts must exist"
    content = hook_path.read_text(encoding="utf-8")
    assert "export function useFocusTrap" in content, (
        "useFocusTrap must be an exported function"
    )
    assert "Escape" in content, "Hook must handle Escape key"
    assert "Tab" in content, "Hook must handle Tab key"


def test_use_focus_trap_has_unit_tests():
    """R-W4-03a, R-W4-03c: useFocusTrap hook has unit tests."""
    test_path = PROJECT_ROOT / "src" / "__tests__" / "hooks" / "useFocusTrap.test.tsx"
    assert test_path.exists(), "useFocusTrap unit test file must exist"
    content = test_path.read_text(encoding="utf-8")
    assert "useFocusTrap" in content, "Test file must import useFocusTrap"
    assert "Tab" in content, "Tests must cover Tab key behavior"
    assert "Escape" in content, "Tests must cover Escape key behavior"
    assert "Shift" in content, "Tests must cover Shift+Tab behavior"


def test_modals_use_focus_trap():
    """R-W4-03b: All modal dialogs use useFocusTrap."""
    modals = [
        "components/ui/ConfirmDialog.tsx",
        "components/ui/InputDialog.tsx",
        "components/EditUserModal.tsx",
        "components/LoadSetupModal.tsx",
        "components/ExportModal.tsx",
        "components/ui/SessionExpiredModal.tsx",
    ]
    for modal_path in modals:
        content = _read_file(modal_path)
        assert content, f"{modal_path} must exist and be non-empty"
        assert "useFocusTrap" in content, (
            f"{modal_path} must import and use useFocusTrap"
        )


def test_escape_closes_modal():
    """R-W4-03c: Escape key closes modal and returns focus to trigger."""
    hook_content = _read_file("hooks/useFocusTrap.ts")
    escape_pattern = re.compile(r"event\.key\s*===?\s*.Escape.")
    assert escape_pattern.search(hook_content), (
        "useFocusTrap must check for Escape key"
    )
    assert "onClose" in hook_content, (
        "useFocusTrap must call onClose on Escape"
    )
    assert "previously" in hook_content.lower() or "previous" in hook_content.lower(), (
        "useFocusTrap must save and restore previous focus"
    )


def test_vpc_503_unit_tests_pass():
    """R-W4-VPC-503: VPC - unit tests pass."""
    result = subprocess.run(
        "npx vitest run src/__tests__/hooks/useFocusTrap",
        shell=True,
        capture_output=True,
        text=True,
        cwd=str(PROJECT_ROOT),
        timeout=60,
        encoding="utf-8",
        errors="replace",
    )
    assert result.returncode == 0, (
        f"useFocusTrap unit tests must pass. stderr: {result.stderr[-500:]}"
    )


def test_vpc_503_tsc_clean():
    """R-W4-VPC-503: VPC - tsc clean for changed files."""
    result = subprocess.run(
        "npx tsc --noEmit",
        shell=True,
        capture_output=True,
        text=True,
        cwd=str(PROJECT_ROOT),
        timeout=120,
        encoding="utf-8",
        errors="replace",
    )
    output = result.stdout + result.stderr
    our_files = [
        "useFocusTrap.ts",
        "ConfirmDialog.tsx",
        "InputDialog.tsx",
        "EditUserModal.tsx",
        "LoadSetupModal.tsx",
        "ExportModal.tsx",
        "SessionExpiredModal.tsx",
    ]
    errors_in_our_files = []
    for line in output.splitlines():
        for f in our_files:
            if f in line and "error TS" in line:
                errors_in_our_files.append(line)
    assert not errors_in_our_files, (
        f"TypeScript errors in our files: {errors_in_our_files}"
    )
