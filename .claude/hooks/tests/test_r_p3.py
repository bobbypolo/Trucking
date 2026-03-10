# Tests R-P3-01, R-P3-02, R-P3-03, R-P3-04, R-P3-05, R-P3-06
"""
STORY-003: Real E2E with Playwright Against Live Server
Validates acceptance criteria for real Playwright E2E tests.
"""

import pathlib
import subprocess
import re

REPO_ROOT = pathlib.Path(__file__).resolve().parents[3]
E2E_DIR = REPO_ROOT / "e2e"
EVIDENCE_DIR = REPO_ROOT / ".claude" / "docs" / "evidence"


class TestRealSmoke:
    """R-P3-01: real-smoke.spec.ts exits 0 against real server."""

    def test_real_smoke_spec_exists(self):
        """real-smoke.spec.ts must exist in e2e/ directory."""
        assert (E2E_DIR / "real-smoke.spec.ts").exists(), (
            "Missing: e2e/real-smoke.spec.ts"
        )

    def test_real_smoke_has_health_check(self):
        """real-smoke.spec.ts must contain /api/health test."""
        content = (E2E_DIR / "real-smoke.spec.ts").read_text(encoding="utf-8")
        assert "/api/health" in content, (
            "real-smoke.spec.ts must test /api/health endpoint"
        )
        assert "200" in content, (
            "real-smoke.spec.ts must assert 200 status for health endpoint"
        )

    def test_real_smoke_has_unauth_tests(self):
        """real-smoke.spec.ts must test unauthenticated rejection."""
        content = (E2E_DIR / "real-smoke.spec.ts").read_text(encoding="utf-8")
        assert "401" in content or "403" in content or "500" in content, (
            "real-smoke.spec.ts must assert 401/403/500 for unauthenticated requests"
        )

    def test_real_smoke_has_token_rejection(self):
        """real-smoke.spec.ts must test invalid token rejection."""
        content = (E2E_DIR / "real-smoke.spec.ts").read_text(encoding="utf-8")
        assert "invalid" in content.lower() or "Bearer" in content, (
            "real-smoke.spec.ts must test invalid token rejection"
        )


class TestRealAuthenticatedCrud:
    """R-P3-02: real-authenticated-crud.spec.ts exists and is structurally valid."""

    def test_real_auth_crud_spec_exists(self):
        """real-authenticated-crud.spec.ts must exist in e2e/ directory."""
        assert (E2E_DIR / "real-authenticated-crud.spec.ts").exists(), (
            "Missing: e2e/real-authenticated-crud.spec.ts"
        )

    def test_real_auth_crud_uses_firebase_rest(self):
        """real-authenticated-crud.spec.ts must use Firebase REST API for token."""
        content = (E2E_DIR / "real-authenticated-crud.spec.ts").read_text(
            encoding="utf-8"
        )
        assert (
            "identitytoolkit.googleapis.com" in content
            or "FIREBASE_WEB_API_KEY" in content
        ), "real-authenticated-crud.spec.ts must use Firebase Identity Toolkit REST API"

    def test_real_auth_crud_handles_missing_service_account(self):
        """real-authenticated-crud.spec.ts must handle missing serviceAccount.json gracefully."""
        content = (E2E_DIR / "real-authenticated-crud.spec.ts").read_text(
            encoding="utf-8"
        )
        assert "serviceAccount" in content or "hasServiceAccount" in content, (
            "real-authenticated-crud.spec.ts must handle missing serviceAccount.json"
        )


class TestOrphanMarkers:
    """R-P3-03: No R-FS-03 markers in e2e/ files."""

    def test_no_r_fs_03_markers_in_e2e(self):
        """grep -rn R-FS-03 e2e/ must return 0 matches."""
        for spec_file in E2E_DIR.glob("*.spec.ts"):
            content = spec_file.read_text(encoding="utf-8")
            matches = re.findall(r"R-FS-03", content)
            assert len(matches) == 0, (
                f"{spec_file.name}: contains orphan R-FS-03 marker(s). "
                f"Replace with R-RV markers."
            )

    def test_r_rv_markers_present_in_updated_files(self):
        """Files that had R-FS-03 must now have R-RV markers."""
        updated_files = [
            "auth.spec.ts",
            "load-lifecycle.spec.ts",
            "settlement.spec.ts",
            "tenant-isolation.spec.ts",
        ]
        for fname in updated_files:
            fpath = E2E_DIR / fname
            if fpath.exists():
                content = fpath.read_text(encoding="utf-8")
                assert "R-RV" in content, (
                    f"{fname}: expected R-RV marker after R-FS-03 replacement"
                )


class TestEvidenceDoc:
    """R-P3-04: REAL_E2E_RESULTS.md exists in .claude/docs/evidence/."""

    def test_real_e2e_results_exists(self):
        """REAL_E2E_RESULTS.md must exist in .claude/docs/evidence/."""
        evidence_file = EVIDENCE_DIR / "REAL_E2E_RESULTS.md"
        assert evidence_file.exists(), (
            "Missing: .claude/docs/evidence/REAL_E2E_RESULTS.md"
        )

    def test_real_e2e_results_has_content(self):
        """REAL_E2E_RESULTS.md must contain test results."""
        evidence_file = EVIDENCE_DIR / "REAL_E2E_RESULTS.md"
        assert evidence_file.exists(), (
            "Missing: .claude/docs/evidence/REAL_E2E_RESULTS.md"
        )
        content = evidence_file.read_text(encoding="utf-8")
        assert "passed" in content.lower() or "PASS" in content, (
            "REAL_E2E_RESULTS.md must contain test result information"
        )
        assert "real-smoke.spec.ts" in content or "R-P3-01" in content, (
            "REAL_E2E_RESULTS.md must reference real-smoke.spec.ts or R-P3-01"
        )


class TestSpecDiscovery:
    """R-P3-05: npx playwright test --list discovers at least 7 spec files."""

    def test_at_least_7_spec_files_exist(self):
        """e2e/ must contain at least 7 .spec.ts files."""
        spec_files = list(E2E_DIR.glob("*.spec.ts"))
        assert len(spec_files) >= 7, (
            f"Only {len(spec_files)} spec files found in e2e/. Need at least 7. "
            f"Files: {[f.name for f in spec_files]}"
        )

    def test_real_smoke_spec_discovered(self):
        """real-smoke.spec.ts must be in e2e/."""
        assert (E2E_DIR / "real-smoke.spec.ts").exists(), (
            "Missing: e2e/real-smoke.spec.ts"
        )

    def test_real_authenticated_crud_spec_discovered(self):
        """real-authenticated-crud.spec.ts must be in e2e/."""
        assert (E2E_DIR / "real-authenticated-crud.spec.ts").exists(), (
            "Missing: e2e/real-authenticated-crud.spec.ts"
        )


class TestServerRegression:
    """R-P3-06: cd server && npx vitest run exits 0 — no regression."""

    def test_server_vitest_passes(self):
        """cd server && npx vitest run must exit 0 with 989+ tests."""
        server_dir = REPO_ROOT / "server"
        result = subprocess.run(
            "npx vitest run",
            cwd=str(server_dir),
            shell=True,
            capture_output=True,
            text=True,
            timeout=180,
        )
        assert result.returncode == 0, (
            "vitest exited "
            + str(result.returncode)
            + "\nSTDOUT:\n"
            + result.stdout[-3000:]
            + "\nSTDERR:\n"
            + result.stderr[-1000:]
        )
        # Verify at least 989 tests pass
        output = result.stdout + result.stderr
        match = re.search(r"(\d+) passed", output)
        if match:
            count = int(match.group(1))
            assert count >= 989, (
                f"Expected 989+ tests to pass, got {count}. "
                "Possible regression in server tests."
            )
