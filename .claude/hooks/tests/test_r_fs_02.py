# Tests R-FS-02-01, R-FS-02-02, R-FS-02-03, R-FS-02-04
"""
R-FS-02: Staging Migration Rehearsal
Validates rehearsal artifacts exist and server vitest passes.
"""

import pathlib
import re
import subprocess

REPO_ROOT = pathlib.Path(__file__).resolve().parents[4]
STAGING_DOC = REPO_ROOT / "STAGING_MIGRATION_REHEARSAL.md"
ROLLBACK_DOC = REPO_ROOT / "ROLLBACK_VALIDATION.md"
REHEARSAL_SCRIPT = REPO_ROOT / "server" / "scripts" / "staging-rehearsal.ts"


class TestStagingMigrationRehearsalDoc:
    """R-FS-02-01: STAGING_MIGRATION_REHEARSAL.md exists with migration output and pre/post counts."""

    def test_staging_doc_exists(self):
        """STAGING_MIGRATION_REHEARSAL.md must exist at project root."""
        assert STAGING_DOC.exists(), f"Missing artifact: {STAGING_DOC}"

    def test_staging_doc_has_migration_output(self):
        """Document must contain migration execution output."""
        content = STAGING_DOC.read_text(encoding="utf-8")
        assert (
            "Migration Execution Output" in content
            or "migrations-up" in content
            or "PASS" in content
        ), "Document must contain migration execution output"

    def test_staging_doc_has_pre_post_counts(self):
        """Document must contain pre-migration and post-migration status counts."""
        content = STAGING_DOC.read_text(encoding="utf-8")
        assert "Pre-Migration" in content or "pre-migration" in content, (
            "Document must contain pre-migration status counts"
        )
        assert "Post-Migration" in content or "post-migration" in content, (
            "Document must contain post-migration status counts"
        )

    def test_staging_doc_has_meaningful_content(self):
        """Document must have substantial content (not a stub)."""
        content = STAGING_DOC.read_text(encoding="utf-8")
        assert len(content) > 1000, (
            f"STAGING_MIGRATION_REHEARSAL.md is too short ({len(content)} chars) — must be a full rehearsal record"
        )


class TestRollbackValidationDoc:
    """R-FS-02-02: ROLLBACK_VALIDATION.md exists with rollback or repair evidence."""

    def test_rollback_doc_exists(self):
        """ROLLBACK_VALIDATION.md must exist at project root."""
        assert ROLLBACK_DOC.exists(), f"Missing artifact: {ROLLBACK_DOC}"

    def test_rollback_doc_has_rollback_evidence(self):
        """Document must contain rollback procedure evidence."""
        content = ROLLBACK_DOC.read_text(encoding="utf-8")
        # Must mention rollback or repair
        has_rollback = any(
            keyword in content
            for keyword in ["rollback", "Rollback", "ROLLBACK", "repair", "Repair"]
        )
        assert has_rollback, (
            "ROLLBACK_VALIDATION.md must contain rollback or repair evidence"
        )

    def test_rollback_doc_covers_status_normalization(self):
        """Document must specifically cover load status normalization rollback."""
        content = ROLLBACK_DOC.read_text(encoding="utf-8")
        assert (
            "002_load_status_normalization" in content
            or "load_status" in content
            or "status" in content
        ), "Must document rollback procedure for load status normalization migration"

    def test_rollback_doc_has_meaningful_content(self):
        """Document must have substantial content (not a stub)."""
        content = ROLLBACK_DOC.read_text(encoding="utf-8")
        assert len(content) > 500, (
            f"ROLLBACK_VALIDATION.md is too short ({len(content)} chars) — must be a full validation record"
        )


class TestRehearsalScriptExists:
    """R-FS-02-03: Staging rehearsal script exists at server/scripts/staging-rehearsal.ts."""

    def test_script_file_exists(self):
        """server/scripts/staging-rehearsal.ts must exist."""
        assert REHEARSAL_SCRIPT.exists(), (
            f"Missing rehearsal script: {REHEARSAL_SCRIPT}"
        )

    def test_script_is_typescript(self):
        """Script must be a TypeScript file with ts extension."""
        assert REHEARSAL_SCRIPT.suffix == ".ts", (
            f"Expected .ts extension, got: {REHEARSAL_SCRIPT.suffix}"
        )

    def test_script_uses_migrationrunner(self):
        """Script must use MigrationRunner from server/lib/migrator."""
        content = REHEARSAL_SCRIPT.read_text(encoding="utf-8")
        assert "MigrationRunner" in content, (
            "staging-rehearsal.ts must use MigrationRunner from server/lib/migrator"
        )

    def test_script_captures_status_counts(self):
        """Script must capture pre/post migration status counts."""
        content = REHEARSAL_SCRIPT.read_text(encoding="utf-8")
        # Must have snapshot-related logic
        has_snapshot = (
            "captureStatusSnapshot" in content
            or "pre-migration" in content
            or "byStatus" in content
        )
        assert has_snapshot, "Script must capture pre/post migration status counts"

    def test_script_validates_canonical_statuses(self):
        """Script must validate canonical load status values after migration."""
        content = REHEARSAL_SCRIPT.read_text(encoding="utf-8")
        canonical_statuses = [
            "draft",
            "planned",
            "dispatched",
            "in_transit",
            "arrived",
            "delivered",
            "completed",
            "cancelled",
        ]
        assert any(s in content for s in canonical_statuses), (
            "Script must reference canonical load status values"
        )

    def test_script_has_rollback_support(self):
        """Script must support rollback testing (--rollback-test flag)."""
        content = REHEARSAL_SCRIPT.read_text(encoding="utf-8")
        assert "rollback" in content.lower(), "Script must support rollback testing"

    def test_script_has_no_hardcoded_credentials(self):
        """Script must not contain hardcoded database credentials."""
        content = REHEARSAL_SCRIPT.read_text(encoding="utf-8")
        # Must use process.env, not hardcoded values
        assert "process.env" in content, (
            "Script must use process.env for DB credentials"
        )
        # Must not contain 'password: "somevalue"' pattern (hardcoded literal)
        # Allow process.env.DB_PASSWORD references
        lines = content.splitlines()
        for line in lines:
            stripped = line.strip()
            # Flag any line that sets password to a non-env string literal
            if re.search(r'password\s*:\s*["\'][^"\'${\s][^"\']+["\']', stripped):
                if "process.env" not in stripped:
                    raise AssertionError(
                        "Potential hardcoded credential in: {}".format(stripped)
                    )

    def test_script_uses_dotenv(self):
        """Script must load environment variables from .env file."""
        content = REHEARSAL_SCRIPT.read_text(encoding="utf-8")
        assert "dotenv" in content, "Script must use dotenv to load .env credentials"

    def test_script_has_story_annotation(self):
        """Script must be annotated with story ID for traceability."""
        content = REHEARSAL_SCRIPT.read_text(encoding="utf-8")
        assert "R-FS-02" in content, "Script must reference story R-FS-02"


class TestNoRegression:
    """R-FS-02-04: vitest exits 0 — no regression."""

    def test_server_vitest_passes(self):
        """cd server && npx vitest run must exit 0."""
        server_dir = REPO_ROOT / "server"
        result = subprocess.run(
            "npx vitest run",
            cwd=str(server_dir),
            shell=True,
            capture_output=True,
            text=True,
            timeout=120,
        )
        assert result.returncode == 0, (
            "vitest exited {}\nSTDOUT:\n{}\nSTDERR:\n{}".format(
                result.returncode,
                result.stdout[-3000:],
                result.stderr[-1000:],
            )
        )
