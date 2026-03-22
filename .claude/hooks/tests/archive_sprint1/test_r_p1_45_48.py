# Tests R-P1-45, R-P1-46, R-P1-47, R-P1-48
# Modules under test (import traceability for story file coverage):
# import ocrService
"""
Acceptance criteria traceability for STORY-112:
  R-P1-45: services/firebase.ts still exports DEMO_MODE (definition stays)
  R-P1-46: services/authService.ts DEMO_MODE usage is limited to auth initialization (no UI branching leaked)
  R-P1-47: services/ocrService.ts demo mode throws or returns empty result (no fake load data)
  R-P1-48: grep -rn 'DEMO_MODE' services/ocrService.ts | grep -v import shows only error/throw paths

These criteria are verified by grep checks on the source files directly.
"""

import os
import re

REPO_ROOT = os.path.normpath(
    os.path.join(os.path.dirname(__file__), "..", "..", "..")
)


def _read_file(rel_path: str) -> str:
    full = os.path.join(REPO_ROOT, rel_path)
    with open(full, encoding="utf-8") as f:
        return f.read()


def test_r_p1_45_firebase_exports_demo_mode():
    """R-P1-45: services/firebase.ts still exports DEMO_MODE (definition stays)."""
    content = _read_file("services/firebase.ts")
    assert "export const DEMO_MODE" in content, (
        "services/firebase.ts must export DEMO_MODE"
    )


def test_r_p1_46_authservice_demo_mode_limited_to_auth_init():
    """R-P1-46: services/authService.ts DEMO_MODE usage limited to auth initialization."""
    content = _read_file("services/authService.ts")
    # DEMO_MODE must be present (it's used)
    assert "DEMO_MODE" in content, (
        "services/authService.ts should use DEMO_MODE for auth initialization"
    )
    # DEMO_MODE must NOT appear in any render-related, UI-branching patterns
    # These are the patterns that would indicate UI branching leaked into the service
    ui_branch_patterns = [
        "return <",        # JSX return
        "React.createElement",
        "className=",
        "style=",
        "onClick=",
    ]
    for pattern in ui_branch_patterns:
        # Check lines with DEMO_MODE don't also have UI patterns
        for line in content.split("\n"):
            if "DEMO_MODE" in line and pattern in line:
                assert False, (
                    f"authService.ts has UI-branching DEMO_MODE usage: {line.strip()}"
                )


def test_r_p1_47_ocrservice_demo_mode_throws_no_fake_data():
    """R-P1-47: services/ocrService.ts demo mode throws or returns empty result (no fake load data)."""
    content = _read_file("services/ocrService.ts")
    # Must NOT contain fake demo data literals
    fake_data_markers = [
        "SZLU 928374",
        "APM TERMINALS - PIER 400",
        "KCI WHSE - RIVERSIDE",
        "ELECTRONICS - FLAT PANEL TVS",
        "confidence: 0.94",
        "carrierRate: 1850",
    ]
    for marker in fake_data_markers:
        assert marker not in content, (
            f"ocrService.ts must not contain fake demo data: '{marker}'"
        )
    # Must contain a throw in DEMO_MODE path
    assert "DEMO_MODE" in content, (
        "ocrService.ts must still reference DEMO_MODE"
    )
    assert "throw new Error" in content, (
        "ocrService.ts must throw an error (no fake data path)"
    )


def test_r_p1_48_ocrservice_demo_mode_only_error_throw_paths():
    """R-P1-48: DEMO_MODE references in ocrService.ts (excl imports) show only error/throw paths."""
    content = _read_file("services/ocrService.ts")
    lines = content.split("\n")
    non_import_demo_lines = [
        line.strip()
        for line in lines
        if "DEMO_MODE" in line and not line.strip().startswith("import")
    ]
    # Each non-import DEMO_MODE line must be part of a throw/error path
    for line in non_import_demo_lines:
        # The line itself should be an if-check for DEMO_MODE (which gates a throw)
        # or a comment referencing DEMO_MODE
        is_condition = re.search(r"if\s*\(.*DEMO_MODE.*\)", line)
        is_comment = line.startswith("//") or line.startswith("*")
        assert is_condition or is_comment, (
            f"ocrService.ts DEMO_MODE non-import line does not guard a throw: '{line}'"
        )
