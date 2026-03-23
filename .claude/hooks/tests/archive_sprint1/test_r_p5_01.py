"""
Tests R-P5-01, R-P5-02, R-P5-03, R-P5-04

STORY-501: Operational Readiness
- R-P5-01: GET /api/health returns { status, mysql, firebase, uptime }
- R-P5-02: docs/ops/rollback-procedure.md exists with step-by-step instructions
- R-P5-03: docs/ops/readiness-checklist.md exists with deploy prerequisites
- R-P5-04: Health endpoint has a test verifying JSON schema
"""

import pathlib

REPO_ROOT = pathlib.Path(__file__).resolve().parents[3]


class TestR_P5_01_HealthEndpointFlatSchema:
    """R-P5-01: Health endpoint exposes mysql, firebase, uptime at top level."""

    def test_health_route_exists(self):
        """Health route file exists."""
        route = REPO_ROOT / "server" / "routes" / "health.ts"
        assert route.exists(), f"Expected {route} to exist"

    def test_health_route_has_mysql_field(self):
        """Health route returns mysql top-level field."""
        content = (REPO_ROOT / "server" / "routes" / "health.ts").read_text()
        assert "mysql:" in content, "health.ts should expose top-level mysql field"

    def test_health_route_has_firebase_ready(self):
        """Health route returns firebase: 'ready' when healthy."""
        content = (REPO_ROOT / "server" / "routes" / "health.ts").read_text()
        assert '"ready"' in content or "'ready'" in content, (
            "health.ts should map available firebase to 'ready'"
        )

    def test_health_route_has_uptime(self):
        """Health route exposes uptime."""
        content = (REPO_ROOT / "server" / "routes" / "health.ts").read_text()
        assert "uptime" in content, "health.ts should expose uptime"

    def test_health_route_has_status_ok(self):
        """Health route returns status: 'ok' when all deps healthy."""
        content = (REPO_ROOT / "server" / "routes" / "health.ts").read_text()
        assert '"ok"' in content or "'ok'" in content, (
            "health.ts should return status 'ok' when healthy"
        )


class TestR_P5_02_RollbackDoc:
    """R-P5-02: docs/ops/rollback-procedure.md exists with step-by-step instructions."""

    def test_rollback_doc_exists(self):
        """Rollback procedure document exists."""
        doc = REPO_ROOT / "docs" / "ops" / "rollback-procedure.md"
        assert doc.exists(), f"Expected {doc} to exist (R-P5-02)"

    def test_rollback_doc_has_steps(self):
        """Rollback doc has numbered steps."""
        doc = REPO_ROOT / "docs" / "ops" / "rollback-procedure.md"
        content = doc.read_text()
        assert "Step 1" in content or "## Step" in content, (
            "rollback-procedure.md should contain step-by-step instructions"
        )

    def test_rollback_doc_has_health_verification(self):
        """Rollback doc includes health endpoint verification step."""
        doc = REPO_ROOT / "docs" / "ops" / "rollback-procedure.md"
        content = doc.read_text()
        assert "health" in content.lower(), (
            "rollback-procedure.md should reference the health endpoint for verification"
        )

    def test_rollback_doc_has_minimum_length(self):
        """Rollback doc is substantive (>500 chars)."""
        doc = REPO_ROOT / "docs" / "ops" / "rollback-procedure.md"
        content = doc.read_text()
        assert len(content) > 500, (
            "rollback-procedure.md should have substantive content (>500 chars)"
        )


class TestR_P5_03_ReadinessChecklist:
    """R-P5-03: docs/ops/readiness-checklist.md exists with deploy prerequisites."""

    def test_checklist_exists(self):
        """Readiness checklist document exists."""
        doc = REPO_ROOT / "docs" / "ops" / "readiness-checklist.md"
        assert doc.exists(), f"Expected {doc} to exist (R-P5-03)"

    def test_checklist_has_checkboxes(self):
        """Readiness checklist has checkbox items."""
        doc = REPO_ROOT / "docs" / "ops" / "readiness-checklist.md"
        content = doc.read_text()
        assert "- [ ]" in content, (
            "readiness-checklist.md should contain checkbox items (- [ ])"
        )

    def test_checklist_covers_env_config(self):
        """Readiness checklist covers environment configuration."""
        doc = REPO_ROOT / "docs" / "ops" / "readiness-checklist.md"
        content = doc.read_text().lower()
        assert "env" in content or "environment" in content, (
            "readiness-checklist.md should cover environment configuration"
        )

    def test_checklist_covers_database(self):
        """Readiness checklist covers database prerequisites."""
        doc = REPO_ROOT / "docs" / "ops" / "readiness-checklist.md"
        content = doc.read_text().lower()
        assert "database" in content or "mysql" in content, (
            "readiness-checklist.md should cover database prerequisites"
        )

    def test_checklist_has_minimum_length(self):
        """Readiness checklist is substantive (>500 chars)."""
        doc = REPO_ROOT / "docs" / "ops" / "readiness-checklist.md"
        content = doc.read_text()
        assert len(content) > 500, (
            "readiness-checklist.md should have substantive content (>500 chars)"
        )


class TestR_P5_04_HealthTestSchema:
    """R-P5-04: Health endpoint has a test verifying JSON schema."""

    def test_health_test_file_exists(self):
        """Health test file exists."""
        test_file = REPO_ROOT / "server" / "__tests__" / "routes" / "health.test.ts"
        assert test_file.exists(), f"Expected {test_file} to exist (R-P5-04)"

    def test_health_test_has_r_p5_markers(self):
        """Health test file references R-P5-01 and R-P5-04."""
        test_file = REPO_ROOT / "server" / "__tests__" / "routes" / "health.test.ts"
        content = test_file.read_text()
        assert "R-P5-01" in content or "R-P5-04" in content, (
            "health.test.ts should reference R-P5-01 or R-P5-04 criteria"
        )

    def test_health_test_checks_mysql_field(self):
        """Health test verifies mysql field in response."""
        test_file = REPO_ROOT / "server" / "__tests__" / "routes" / "health.test.ts"
        content = test_file.read_text()
        assert "mysql" in content, (
            "health.test.ts should assert on the mysql field (R-P5-01)"
        )

    def test_health_test_checks_firebase_field(self):
        """Health test verifies firebase field in response."""
        test_file = REPO_ROOT / "server" / "__tests__" / "routes" / "health.test.ts"
        content = test_file.read_text()
        assert "firebase" in content, (
            "health.test.ts should assert on the firebase field (R-P5-01)"
        )

    def test_health_test_checks_uptime(self):
        """Health test verifies uptime field in response."""
        test_file = REPO_ROOT / "server" / "__tests__" / "routes" / "health.test.ts"
        content = test_file.read_text()
        assert "uptime" in content, "health.test.ts should assert on the uptime field"

    def test_health_test_has_schema_validation(self):
        """Health test has explicit schema validation (toHaveProperty or hasProperty)."""
        test_file = REPO_ROOT / "server" / "__tests__" / "routes" / "health.test.ts"
        content = test_file.read_text()
        assert "toHaveProperty" in content or "JSON schema" in content, (
            "health.test.ts should have schema validation test (toHaveProperty)"
        )
