# Tests R-P1-39, R-P1-40, R-P1-41, R-P1-42, R-P1-43, R-P1-44
# Modules under test (import traceability for story file coverage):
# import SafetyView
# import Settlements
# import App
"""
Acceptance criteria traceability for STORY-111:
  R-P1-39: DEMO_MODE not present in components/SafetyView.tsx
  R-P1-40: DEMO_MODE not present in components/Settlements.tsx
  R-P1-41: DEMO_MODE not present in App.tsx
  R-P1-42: seedIncidents not present in App.tsx (import and call removed)
  R-P1-43: Settlements deductions come from API/service layer, not hardcoded array
  R-P1-44: DEMO_MODE not present in any components/*.tsx file

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


def test_r_p1_39_no_demo_mode_in_safety_view():
    """R-P1-39: DEMO_MODE not present in components/SafetyView.tsx."""
    content = _read_file("components/SafetyView.tsx")
    assert "DEMO_MODE" not in content, (
        "components/SafetyView.tsx must not contain DEMO_MODE"
    )


def test_r_p1_40_no_demo_mode_in_settlements():
    """R-P1-40: DEMO_MODE not present in components/Settlements.tsx."""
    content = _read_file("components/Settlements.tsx")
    assert "DEMO_MODE" not in content, (
        "components/Settlements.tsx must not contain DEMO_MODE"
    )


def test_r_p1_41_no_demo_mode_in_app():
    """R-P1-41: DEMO_MODE not present in App.tsx."""
    content = _read_file("App.tsx")
    assert "DEMO_MODE" not in content, (
        "App.tsx must not contain DEMO_MODE"
    )


def test_r_p1_42_no_seed_incidents_in_app():
    """R-P1-42: seedIncidents import and call removed from App.tsx."""
    content = _read_file("App.tsx")
    assert "seedIncidents" not in content, (
        "App.tsx must not reference seedIncidents"
    )


def test_r_p1_43_settlements_deductions_from_service_not_hardcoded():
    """R-P1-43: Settlements deductions come from API/service layer, not hardcoded array."""
    content = _read_file("components/Settlements.tsx")
    # Must NOT have a hardcoded deductions array with demo insurance/ELD items
    assert "Occupational Accident Insurance" not in content, (
        "Settlements.tsx must not contain hardcoded demo deduction items"
    )
    assert "ELD / Dashcam Subscription" not in content, (
        "Settlements.tsx must not contain hardcoded demo deduction items"
    )
    assert "Fuel Advance (Settlement Offset)" not in content, (
        "Settlements.tsx must not contain hardcoded demo deduction items"
    )
    # Must still have deductions variable (from service layer pattern)
    assert "deductions" in content, (
        "Settlements.tsx must reference deductions (from service layer)"
    )


def test_r_p1_44_no_demo_mode_in_any_components_tsx():
    """R-P1-44: DEMO_MODE not present in any components/*.tsx file."""
    components_dir = os.path.join(REPO_ROOT, "components")
    violations = []
    for fname in os.listdir(components_dir):
        if fname.endswith(".tsx"):
            fpath = os.path.join(components_dir, fname)
            with open(fpath, encoding="utf-8") as f:
                content = f.read()
            if "DEMO_MODE" in content:
                violations.append(fname)
    assert not violations, (
        f"DEMO_MODE found in these component files: {violations}"
    )
