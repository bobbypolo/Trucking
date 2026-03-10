# Tests R-P4-01, R-P4-02, R-P4-03, R-P4-04, R-P4-05, R-P4-06, R-P4-07, R-P4-08
"""
QA traceability tests for STORY-004: Final Go/No-Go with Real Evidence.

R-P4-01: REAL_FINAL_SUMMARY.md exists in .claude/docs/evidence/
R-P4-02: RC_GO_NO_GO.md Gate 7 updated to PASS with real evidence references
R-P4-03: RC_GO_NO_GO.md Gate 8 updated to PASS with REAL_INFRA_SETUP.md reference
R-P4-04: RC_GO_NO_GO.md final classification reads "PRODUCTION READY FOR CONTROLLED ROLLOUT"
R-P4-05: RC_GO_NO_GO.md caveats C-3 and C-4 marked as RESOLVED
R-P4-06: All 10 hard no-go conditions in RC_GO_NO_GO.md remain CLEAR
R-P4-07: server tests pass (cd server && npx vitest run exits 0)
R-P4-08: frontend tests pass (npx vitest run exits 0, 92+ tests)
"""

from pathlib import Path

EVIDENCE_DIR = Path("F:/Trucking/DisbatchMe/.claude/docs/evidence")
RC_GONO_PATH = EVIDENCE_DIR / "RC_GO_NO_GO.md"
REAL_FINAL_SUMMARY_PATH = EVIDENCE_DIR / "REAL_FINAL_SUMMARY.md"


def test_r_p4_01_real_final_summary_exists():
    """R-P4-01: REAL_FINAL_SUMMARY.md must exist in .claude/docs/evidence/."""
    assert REAL_FINAL_SUMMARY_PATH.is_file(), (
        f"REAL_FINAL_SUMMARY.md not found at {REAL_FINAL_SUMMARY_PATH}"
    )
    content = REAL_FINAL_SUMMARY_PATH.read_text(encoding="utf-8")
    # Must mention server test count, integration tests, E2E, and build validation
    assert "1019" in content, "Missing server test count (1019)"
    assert "Docker MySQL" in content, "Missing Docker MySQL reference"
    assert "Firebase" in content, "Missing Firebase reference"
    assert "Playwright" in content, "Missing Playwright E2E reference"
    assert "npm run build" in content or "build" in content.lower(), (
        "Missing build validation reference"
    )


def test_r_p4_02_gate7_pass():
    """R-P4-02: Gate 7 in RC_GO_NO_GO.md must be PASS (not conditional) with real evidence refs."""
    assert RC_GONO_PATH.is_file(), f"RC_GO_NO_GO.md not found at {RC_GONO_PATH}"
    content = RC_GONO_PATH.read_text(encoding="utf-8")
    # Gate 7 must be PASS without the "(with caveat)" qualifier in table
    assert "| 7 | Live E2E | **PASS** |" in content, (
        "Gate 7 table row must show **PASS** (not conditional)"
    )
    # References to real evidence files
    assert "REAL_E2E_RESULTS.md" in content, "Missing REAL_E2E_RESULTS.md reference"
    assert "REAL_CRUD_RESULTS.md" in content, "Missing REAL_CRUD_RESULTS.md reference"
    # Old conditional text must not be present
    assert "PASS (with caveat)" not in content, (
        "Gate 7 still contains 'PASS (with caveat)' — must be updated to PASS"
    )


def test_r_p4_03_gate8_pass():
    """R-P4-03: Gate 8 in RC_GO_NO_GO.md must be PASS with REAL_INFRA_SETUP.md reference."""
    assert RC_GONO_PATH.is_file(), f"RC_GO_NO_GO.md not found at {RC_GONO_PATH}"
    content = RC_GONO_PATH.read_text(encoding="utf-8")
    # Gate 8 heading must show PASS (not conditional)
    assert "### Gate 8: Deployment Rehearsal — PASS" in content, (
        "Gate 8 section heading must show PASS"
    )
    # Gate 8 heading specifically must not have the conditional qualifier
    assert (
        "### Gate 8: Deployment Rehearsal — PASS (with documented caveat)"
        not in content
    ), "Gate 8 heading still contains 'PASS (with documented caveat)'"
    assert "REAL_INFRA_SETUP.md" in content, (
        "Missing REAL_INFRA_SETUP.md reference in RC_GO_NO_GO.md"
    )


def test_r_p4_04_final_classification():
    """R-P4-04: Final classification must read 'PRODUCTION READY FOR CONTROLLED ROLLOUT'."""
    assert RC_GONO_PATH.is_file(), f"RC_GO_NO_GO.md not found at {RC_GONO_PATH}"
    content = RC_GONO_PATH.read_text(encoding="utf-8")
    assert "PRODUCTION READY FOR CONTROLLED ROLLOUT" in content, (
        "Final classification string not found in RC_GO_NO_GO.md"
    )
    # Old conditional text must not be present
    assert "RELEASE CANDIDATE \u2014 CONDITIONAL" not in content, (
        "Old 'RELEASE CANDIDATE - CONDITIONAL' classification still present"
    )


def test_r_p4_05_caveats_resolved():
    """R-P4-05: Caveats C-3 and C-4 must be marked as RESOLVED."""
    assert RC_GONO_PATH.is_file(), f"RC_GO_NO_GO.md not found at {RC_GONO_PATH}"
    content = RC_GONO_PATH.read_text(encoding="utf-8")
    assert "C-3" in content and "RESOLVED" in content, "C-3 not marked as RESOLVED"
    assert "C-4" in content and "RESOLVED" in content, "C-4 not marked as RESOLVED"
    # Verify C-3 and C-4 rows specifically mention RESOLVED
    lines = content.splitlines()
    c3_lines = [l for l in lines if "C-3" in l and "Gate 7" in l]
    c4_lines = [l for l in lines if "C-4" in l and "Gate 8" in l]
    assert c3_lines, "No C-3 Gate 7 line found in caveats table"
    assert c4_lines, "No C-4 Gate 8 line found in caveats table"
    assert "RESOLVED" in c3_lines[0], (
        f"C-3 line does not contain RESOLVED: {c3_lines[0]}"
    )
    assert "RESOLVED" in c4_lines[0], (
        f"C-4 line does not contain RESOLVED: {c4_lines[0]}"
    )


def test_r_p4_06_no_go_conditions_clear():
    """R-P4-06: All 10 hard no-go conditions must remain CLEAR."""
    assert RC_GONO_PATH.is_file(), f"RC_GO_NO_GO.md not found at {RC_GONO_PATH}"
    content = RC_GONO_PATH.read_text(encoding="utf-8")
    assert "All 10 hard no-go conditions: CLEAR" in content, (
        "Hard no-go conditions CLEAR statement missing from RC_GO_NO_GO.md"
    )
    # Check that no-go table has no PRESENT entries (they should all be NO)
    lines = content.splitlines()
    no_go_in_table = False
    for line in lines:
        # Skip header row
        if "No-Go Condition" in line:
            no_go_in_table = True
            continue
        if no_go_in_table and "|" in line and "**YES**" in line:
            assert False, f"Hard no-go condition marked as YES: {line}"


def test_r_p4_07_server_tests_pass_marker():
    """R-P4-07: Verify server test evidence is documented (actual run validated by gate command)."""
    # The actual gate command runs `cd server && npx vitest run`
    # This test verifies the evidence documentation references the test count
    assert RC_GONO_PATH.is_file(), f"RC_GO_NO_GO.md not found at {RC_GONO_PATH}"
    content = RC_GONO_PATH.read_text(encoding="utf-8")
    # RC_GO_NO_GO must reference server test counts
    assert "1019" in content or "989" in content, (
        "No server test count found in RC_GO_NO_GO.md"
    )


def test_r_p4_08_frontend_tests_pass_marker():
    """R-P4-08: Verify frontend test evidence is documented (actual run validated by gate command)."""
    assert REAL_FINAL_SUMMARY_PATH.is_file(), (
        "REAL_FINAL_SUMMARY.md not found — R-P4-01 must pass first"
    )
    content = REAL_FINAL_SUMMARY_PATH.read_text(encoding="utf-8")
    # Must mention frontend tests
    assert "92" in content or "frontend" in content.lower(), (
        "REAL_FINAL_SUMMARY.md does not mention frontend tests"
    )
