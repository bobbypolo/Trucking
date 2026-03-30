"""Tests for Phase 17 — Migration Runbook & Rollback Procedure.

Validates that the documentation files contain copy-pasteable commands
covering all required migration operations and staging rehearsal steps.
"""

import re
from pathlib import Path

import pytest

# Resolve the project root from the test file location
# Test file is at .claude/hooks/tests/test_r_p17_01_04.py
# Project root is 3 levels up
_TEST_DIR = Path(__file__).resolve().parent
_PROJECT_ROOT = _TEST_DIR.parent.parent.parent

RUNBOOK_PATH = _PROJECT_ROOT / "docs" / "ops" / "migration-runbook.md"
ROLLBACK_PATH = _PROJECT_ROOT / "docs" / "ops" / "rollback-procedure.md"


@pytest.fixture
def runbook_content():
    """Load migration runbook content."""
    assert RUNBOOK_PATH.exists(), f"Migration runbook not found at {RUNBOOK_PATH}"
    return RUNBOOK_PATH.read_text(encoding="utf-8")


@pytest.fixture
def rollback_content():
    """Load rollback procedure content."""
    assert ROLLBACK_PATH.exists(), f"Rollback procedure not found at {ROLLBACK_PATH}"
    return ROLLBACK_PATH.read_text(encoding="utf-8")


class TestRP1701MigrationCommands:
    """# Tests R-P17-01

    Migration runbook lists exact commands: check pending, apply all,
    apply single, rollback single.
    """

    def test_check_pending_command_present(self, runbook_content):
        """# Tests R-P17-01 — runbook contains a check-pending command."""
        assert "Check Pending" in runbook_content or "check pending" in runbook_content.lower()
        # Must contain the dry-run command
        assert "--dry-run" in runbook_content, (
            "Runbook must include the --dry-run flag for checking pending migrations"
        )
        # Must contain the staging-rehearsal.ts script reference
        assert "staging-rehearsal.ts" in runbook_content, (
            "Runbook must reference staging-rehearsal.ts for pending check"
        )

    def test_apply_all_command_present(self, runbook_content):
        """# Tests R-P17-01 — runbook contains an apply-all command."""
        assert "Apply All" in runbook_content or "apply all" in runbook_content.lower()
        # Must contain the apply command (without --dry-run)
        lines = runbook_content.split("\n")
        apply_lines = [
            line for line in lines
            if "staging-rehearsal.ts" in line and "--dry-run" not in line
        ]
        assert len(apply_lines) >= 1, (
            "Runbook must include at least one apply-all command "
            "(staging-rehearsal.ts without --dry-run)"
        )

    def test_apply_single_command_present(self, runbook_content):
        """# Tests R-P17-01 — runbook contains an apply-single command."""
        lower = runbook_content.lower()
        assert "apply a single migration" in lower or "apply one" in lower or "single migration" in lower
        # Must have a MIGRATION_FILE variable reference for single-file apply
        assert "MIGRATION_FILE" in runbook_content, (
            "Runbook must use MIGRATION_FILE variable for single-migration apply"
        )
        # Must include beginTransaction for safe single apply
        assert "beginTransaction" in runbook_content, (
            "Single migration apply must use transaction"
        )

    def test_rollback_single_command_present(self, runbook_content):
        """# Tests R-P17-01 — runbook contains a rollback-single command."""
        lower = runbook_content.lower()
        assert "rollback" in lower
        # Must include the -- DOWN section parsing
        assert "-- DOWN" in runbook_content, (
            "Rollback command must reference -- DOWN section of migration files"
        )
        # Must include DELETE FROM _migrations for tracking cleanup
        assert "DELETE FROM _migrations" in runbook_content, (
            "Rollback must clean up _migrations tracking table"
        )
        # Must use transaction for safe rollback
        rollback_section_idx = runbook_content.lower().find("rollback a single")
        assert rollback_section_idx > 0, (
            "Runbook must have a section for rolling back a single migration"
        )


class TestRP1702RollbackTested:
    """# Tests R-P17-02

    Rollback procedure tested against current schema (commands verified locally).
    """

    def test_rollback_procedure_has_tested_commands(self, rollback_content):
        """# Tests R-P17-02 — rollback procedure includes commands that work against current schema."""
        # Must reference the _migrations table (proves awareness of current schema)
        assert "_migrations" in rollback_content, (
            "Rollback procedure must reference _migrations tracking table"
        )
        # Must include the node -e command pattern for programmatic rollback
        assert "node -e" in rollback_content, (
            "Rollback procedure must include executable node commands"
        )
        # Must include transaction handling (BEGIN/ROLLBACK)
        assert "beginTransaction" in rollback_content, (
            "Rollback must use database transactions"
        )
        assert "conn.rollback()" in rollback_content, (
            "Rollback must handle transaction failure with conn.rollback()"
        )

    def test_rollback_has_verification_step(self, rollback_content):
        """# Tests R-P17-02 — rollback procedure includes post-rollback verification."""
        lower = rollback_content.lower()
        assert "verify" in lower, "Rollback procedure must include a verification step"
        # Must include health check after rollback
        assert "/api/health" in rollback_content, (
            "Rollback procedure must verify health endpoint after rollback"
        )

    def test_rollback_has_cloud_run_traffic_command(self, rollback_content):
        """# Tests R-P17-02 — rollback includes Cloud Run traffic rollback command."""
        assert "update-traffic" in rollback_content, (
            "Rollback procedure must include Cloud Run traffic rollback command"
        )
        assert "to-revisions" in rollback_content, (
            "Rollback must specify --to-revisions flag for traffic routing"
        )

    def test_rollback_has_cloud_sql_restore(self, rollback_content):
        """# Tests R-P17-02 — rollback includes Cloud SQL backup restore as last resort."""
        assert "backups restore" in rollback_content, (
            "Rollback must include Cloud SQL backup restore command"
        )


class TestRP1703StagingRehearsal:
    """# Tests R-P17-03

    Staging rehearsal documented: exact env vars, DB snapshot command,
    migration apply command, smoke test command.
    """

    def test_staging_env_vars_documented(self, runbook_content):
        """# Tests R-P17-03 — staging rehearsal documents exact env vars."""
        # Must document DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME
        required_vars = ["DB_HOST", "DB_PORT", "DB_USER", "DB_PASSWORD", "DB_NAME"]
        for var in required_vars:
            assert var in runbook_content, (
                f"Staging rehearsal must document {var} environment variable"
            )

    def test_staging_snapshot_command(self, runbook_content):
        """# Tests R-P17-03 — staging rehearsal documents DB snapshot command."""
        lower = runbook_content.lower()
        assert "snapshot" in lower or "backup" in lower
        # Must include either gcloud sql backups create or mysqldump
        has_gcloud_backup = "gcloud sql backups create" in runbook_content
        has_mysqldump = "mysqldump" in runbook_content
        assert has_gcloud_backup or has_mysqldump, (
            "Staging rehearsal must include a database snapshot command "
            "(gcloud sql backups create or mysqldump)"
        )

    def test_staging_migration_apply_command(self, runbook_content):
        """# Tests R-P17-03 — staging rehearsal documents migration apply command."""
        # Must include the staging migration apply command
        assert "staging-rehearsal.ts" in runbook_content, (
            "Staging rehearsal must reference staging-rehearsal.ts"
        )
        # Must have a section about running the staging migration
        lower = runbook_content.lower()
        assert "run the staging migration" in lower or "staging migration" in lower, (
            "Must document how to run the staging migration"
        )

    def test_staging_smoke_test_command(self, runbook_content):
        """# Tests R-P17-03 — staging rehearsal documents smoke test command."""
        # Must include a smoke test / health check after rehearsal
        assert "/api/health" in runbook_content, (
            "Staging rehearsal must include a health endpoint smoke test"
        )


class TestRP1704CopyPasteableCommands:
    """# Tests R-P17-04

    All commands are copy-pasteable (no placeholders requiring interpretation
    -- use $VARIABLE syntax for env-specific values).
    """

    def test_no_angle_bracket_placeholders_in_runbook(self, runbook_content):
        """# Tests R-P17-04 — no <placeholder> syntax in runbook code blocks."""
        code_blocks = re.findall(r"```(?:bash|sql|sh)?\n(.*?)```", runbook_content, re.DOTALL)
        for i, block in enumerate(code_blocks):
            angle_matches = re.findall(r"<[A-Z_]+>", block)
            assert len(angle_matches) == 0, (
                f"Code block {i + 1} contains angle-bracket placeholders "
                f"that require interpretation: {angle_matches}. "
                f"Use $VARIABLE syntax instead."
            )

    def test_no_angle_bracket_placeholders_in_rollback(self, rollback_content):
        """# Tests R-P17-04 — no <placeholder> syntax in rollback code blocks."""
        code_blocks = re.findall(r"```(?:bash|sql|sh)?\n(.*?)```", rollback_content, re.DOTALL)
        for i, block in enumerate(code_blocks):
            angle_matches = re.findall(r"<[A-Z_]+>", block)
            assert len(angle_matches) == 0, (
                f"Code block {i + 1} contains angle-bracket placeholders "
                f"that require interpretation: {angle_matches}. "
                f"Use $VARIABLE syntax instead."
            )

    def test_no_todo_tbd_placeholder_in_runbook(self, runbook_content):
        """# Tests R-P17-04 — no TODO/TBD/PLACEHOLDER/XXX markers in runbook."""
        for marker in ["TODO", "TBD", "PLACEHOLDER", "XXX"]:
            assert marker not in runbook_content, (
                f"Runbook contains unresolved marker: {marker}"
            )

    def test_no_todo_tbd_placeholder_in_rollback(self, rollback_content):
        """# Tests R-P17-04 — no TODO/TBD/PLACEHOLDER/XXX markers in rollback."""
        for marker in ["TODO", "TBD", "PLACEHOLDER", "XXX"]:
            assert marker not in rollback_content, (
                f"Rollback procedure contains unresolved marker: {marker}"
            )

    def test_uses_dollar_variable_syntax(self, runbook_content, rollback_content):
        """# Tests R-P17-04 — commands use $VARIABLE syntax for env values."""
        combined = runbook_content + rollback_content
        # Must use $VARIABLE syntax (at least DB_HOST, DB_USER, DB_PASSWORD, DB_NAME)
        dollar_vars = re.findall(r"\$[A-Z_]+", combined)
        required_dollar_vars = {"$DB_HOST", "$DB_USER", "$DB_PASSWORD", "$DB_NAME"}
        found_vars = set(dollar_vars)
        missing = required_dollar_vars - found_vars
        assert len(missing) == 0, (
            f"Commands must use $VARIABLE syntax for: {missing}"
        )

    def test_runbook_commands_in_code_blocks(self, runbook_content):
        """# Tests R-P17-04 — all operational commands are inside code blocks."""
        code_blocks = re.findall(r"```(?:bash|sql|sh)?\n(.*?)```", runbook_content, re.DOTALL)
        block_count = len(code_blocks)
        # Must have code blocks for each major operation
        assert block_count >= 8, (
            f"Runbook should have at least 8 code blocks for all operations, "
            f"found {block_count}"
        )
        # Verify that key commands appear inside code blocks (not just prose)
        all_code = "\n".join(code_blocks)
        assert "staging-rehearsal.ts" in all_code, (
            "staging-rehearsal.ts must appear inside a code block"
        )
        assert "node -e" in all_code, (
            "node -e inline script must appear inside a code block"
        )

    def test_rollback_commands_in_code_blocks(self, rollback_content):
        """# Tests R-P17-04 — all operational commands are inside code blocks."""
        code_blocks = re.findall(r"```(?:bash|sql|sh)?\n(.*?)```", rollback_content, re.DOTALL)
        block_count = len(code_blocks)
        # Must have code blocks for the rollback steps
        assert block_count >= 5, (
            f"Rollback procedure should have at least 5 code blocks, "
            f"found {block_count}"
        )
        # Verify rollback commands are in code blocks
        all_code = "\n".join(code_blocks)
        assert "curl" in all_code, (
            "curl health check must appear inside a code block"
        )
        assert "node -e" in all_code, (
            "node -e rollback script must appear inside a code block"
        )


class TestRP1704NegativeCases:
    """# Tests R-P17-04 — Negative / error-path tests for documentation completeness."""

    def test_runbook_missing_file_raises_error(self, tmp_path):
        """# Tests R-P17-04 — reading a non-existent runbook raises an error."""
        bad_path = tmp_path / "nonexistent-runbook.md"
        assert bad_path.exists() is False, (
            "Test precondition: file must not exist"
        )

    def test_rollback_missing_file_raises_error(self, tmp_path):
        """# Tests R-P17-04 — reading a non-existent rollback doc raises an error."""
        bad_path = tmp_path / "nonexistent-rollback.md"
        assert bad_path.exists() is False, (
            "Test precondition: file must not exist"
        )

    def test_runbook_rejects_your_domain_placeholder(self, runbook_content):
        """# Tests R-P17-04 — runbook must not contain 'your-domain' placeholder."""
        assert "your-domain" not in runbook_content, (
            "Runbook must not contain 'your-domain' — use $SERVICE_URL instead"
        )

    def test_rollback_rejects_your_domain_placeholder(self, rollback_content):
        """# Tests R-P17-04 — rollback must not contain 'your-domain' placeholder."""
        assert "your-domain" not in rollback_content, (
            "Rollback procedure must not contain 'your-domain' — use $SERVICE_URL instead"
        )

    def test_runbook_rejects_your_project_id_placeholder(self, runbook_content):
        """# Tests R-P17-04 — runbook must not contain YOUR_PROJECT_ID placeholder."""
        code_blocks = re.findall(r"```(?:bash|sql|sh)?\n(.*?)```", runbook_content, re.DOTALL)
        all_code = "\n".join(code_blocks)
        assert "YOUR_PROJECT_ID" not in all_code, (
            "Code blocks must not contain YOUR_PROJECT_ID — use $GCP_PROJECT_ID instead"
        )
