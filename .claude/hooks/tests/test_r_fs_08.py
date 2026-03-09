# Tests R-FS-08-01, R-FS-08-02, R-FS-08-03, R-FS-08-04
"""
R-FS-08 -- RC1 Evidence Pack and Go/No-Go

Verifies all 7 required evidence artifacts exist at repo root and that
RC1_GO_NO_GO.md contains explicit answers to all 6 release questions.
"""

import os
import pytest

REPO_ROOT = os.environ.get(
    "REPO_ROOT",
    os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..")),
)


def _artifact(name: str) -> str:
    return os.path.join(REPO_ROOT, name)


# R-FS-08-01: E2E_RESULTS.md exists
def test_e2e_results_exists():
    path = _artifact("E2E_RESULTS.md")
    assert os.path.exists(path), f"E2E_RESULTS.md not found at {path}"
    assert os.path.getsize(path) > 100, "E2E_RESULTS.md is empty or too small"


def test_e2e_results_has_spec_summary():
    path = _artifact("E2E_RESULTS.md")
    with open(path, encoding="utf-8") as f:
        content = f.read()
    assert "spec" in content.lower(), "E2E_RESULTS.md must reference spec files"
    assert "auth" in content.lower(), "E2E_RESULTS.md must mention auth spec"
    assert "settlement" in content.lower(), (
        "E2E_RESULTS.md must mention settlement spec"
    )


# R-FS-08-02: RC1_GO_NO_GO.md exists with explicit answers to all 6 questions
def test_rc1_go_no_go_exists():
    path = _artifact("RC1_GO_NO_GO.md")
    assert os.path.exists(path), f"RC1_GO_NO_GO.md not found at {path}"
    assert os.path.getsize(path) > 100, "RC1_GO_NO_GO.md is empty or too small"


def test_rc1_go_no_go_has_all_6_questions():
    path = _artifact("RC1_GO_NO_GO.md")
    with open(path, encoding="utf-8") as f:
        content = f.read()
    # All 6 release questions must be explicitly answered
    assert "Question 1" in content, "RC1_GO_NO_GO.md missing Question 1"
    assert "Question 2" in content, "RC1_GO_NO_GO.md missing Question 2"
    assert "Question 3" in content, "RC1_GO_NO_GO.md missing Question 3"
    assert "Question 4" in content, "RC1_GO_NO_GO.md missing Question 4"
    assert "Question 5" in content, "RC1_GO_NO_GO.md missing Question 5"
    assert "Question 6" in content, "RC1_GO_NO_GO.md missing Question 6"


def test_rc1_go_no_go_has_decision():
    path = _artifact("RC1_GO_NO_GO.md")
    with open(path, encoding="utf-8") as f:
        content = f.read()
    # Must contain an explicit go/no-go decision
    has_go = "GO" in content
    assert has_go, "RC1_GO_NO_GO.md must contain an explicit GO/NO-GO decision"


# R-FS-08-03: All 7 required evidence artifacts exist
REQUIRED_ARTIFACTS = [
    "ROUTE_OWNERSHIP_AUDIT.md",
    "STAGING_MIGRATION_REHEARSAL.md",
    "ROLLBACK_VALIDATION.md",
    "E2E_RESULTS.md",
    "LOCALSTORAGE_RELEASE_AUDIT.md",
    "SECURITY_RELEASE_CHECKLIST.md",
    "RC1_GO_NO_GO.md",
]


@pytest.mark.parametrize("artifact", REQUIRED_ARTIFACTS)
def test_required_artifact_exists(artifact):
    path = _artifact(artifact)
    assert os.path.exists(path), (
        f"Required artifact missing: {artifact} (looked at {path})"
    )
    assert os.path.getsize(path) > 50, f"Artifact is empty: {artifact}"


# R-FS-08-04: Unresolved blockers listed with owner and risk in RC1_GO_NO_GO.md
def test_rc1_go_no_go_has_blockers_with_owner():
    path = _artifact("RC1_GO_NO_GO.md")
    with open(path, encoding="utf-8") as f:
        content = f.read()
    # Must have a blockers section
    has_blockers = "Blocker" in content or "blocker" in content
    assert has_blockers, "RC1_GO_NO_GO.md must list unresolved blockers"
    # Must have owner attribution
    has_owner = "Owner" in content or "owner" in content
    assert has_owner, "RC1_GO_NO_GO.md blockers must have owner attribution"
    # Must have risk assessment
    has_risk = "Risk" in content or "risk" in content
    assert has_risk, "RC1_GO_NO_GO.md blockers must have risk assessment"
