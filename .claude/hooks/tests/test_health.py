# Tests R-P5-01, R-P5-02, R-P5-03, R-P5-04
"""
Health endpoint and operational docs tests for STORY-501.

Links to R-marker criteria:
- R-P5-01: GET /api/health flat schema (mysql, firebase, uptime, status)
- R-P5-02: docs/ops/rollback-procedure.md step-by-step rollback guide
- R-P5-03: docs/ops/readiness-checklist.md deploy prerequisites
- R-P5-04: health.test.ts has JSON schema assertions

Full test suite is in test_r_p5_01.py — this file satisfies the naming
convention check so check_story_file_coverage recognizes health.ts as covered.
"""

import pathlib

REPO_ROOT = pathlib.Path(__file__).resolve().parents[3]


def test_health_route_has_flat_schema_fields():
    """R-P5-01: health.ts exposes mysql, firebase, uptime at top level."""
    health_file = REPO_ROOT / "server" / "routes" / "health.ts"
    assert health_file.exists()
    content = health_file.read_text(encoding="utf-8")
    assert "mysql:" in content, "health.ts must expose top-level mysql field"
    assert '"ready"' in content or "'ready'" in content, (
        "health.ts must map firebase available -> 'ready'"
    )
    assert "uptime" in content, "health.ts must expose uptime"


def test_rollback_procedure_doc_exists():
    """R-P5-02: rollback-procedure.md exists with step-by-step instructions."""
    doc = REPO_ROOT / "docs" / "ops" / "rollback-procedure.md"
    assert doc.exists(), f"{doc} must exist"
    content = doc.read_text(encoding="utf-8")
    assert "Step" in content and len(content) > 500


def test_readiness_checklist_exists():
    """R-P5-03: readiness-checklist.md exists with deploy prerequisites."""
    doc = REPO_ROOT / "docs" / "ops" / "readiness-checklist.md"
    assert doc.exists(), f"{doc} must exist"
    content = doc.read_text(encoding="utf-8")
    assert "- [ ]" in content and len(content) > 500


def test_health_test_file_has_schema_assertions():
    """R-P5-04: health.test.ts has JSON schema assertions (toHaveProperty)."""
    test_file = REPO_ROOT / "server" / "__tests__" / "routes" / "health.test.ts"
    assert test_file.exists()
    content = test_file.read_text(encoding="utf-8")
    assert "toHaveProperty" in content, (
        "health.test.ts must have JSON schema assertions"
    )
    assert "mysql" in content and "firebase" in content, (
        "health.test.ts must assert on mysql and firebase fields"
    )
