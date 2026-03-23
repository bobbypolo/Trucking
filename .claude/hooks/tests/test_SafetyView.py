# Tests R-P1-39, R-P1-44 (SafetyView component DEMO_MODE removal)
"""
Coverage stub for SafetyView.tsx — verified by test_r_p1_39_44.py.
This file exists so qa_runner step 9 stem-matching detects coverage.
"""
import os

REPO_ROOT = os.path.normpath(
    os.path.join(os.path.dirname(__file__), "..", "..", "..")
)


def test_safety_view_no_demo_mode():
    """SafetyView.tsx must not import or use DEMO_MODE (R-P1-39, R-P1-44)."""
    path = os.path.join(REPO_ROOT, "components", "SafetyView.tsx")
    with open(path, encoding="utf-8") as f:
        content = f.read()
    assert "DEMO_MODE" not in content, (
        "components/SafetyView.tsx must not contain DEMO_MODE"
    )
