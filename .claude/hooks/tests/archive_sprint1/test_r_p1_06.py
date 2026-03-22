# Tests R-P1-06, R-P1-07
"""
QA traceability tests for S-103: QuickBooks OAuth token storage migration.

R-P1-06: Migration 029 creates quickbooks_tokens table with UNIQUE constraint on company_id
R-P1-07: DOWN migration drops table cleanly
"""
import os
import pytest

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
MIGRATION_PATH = os.path.join(REPO_ROOT, "server", "migrations", "029_quickbooks_tokens.sql")


def _read_migration() -> str:
    with open(MIGRATION_PATH, "r", encoding="utf-8") as f:
        return f.read()


class TestRP106MigrationCreatesTable:
    """R-P1-06: Migration 029 creates quickbooks_tokens table with UNIQUE constraint."""

    def test_migration_file_exists(self):
        assert os.path.isfile(MIGRATION_PATH), "029_quickbooks_tokens.sql must exist"

    def test_has_up_section(self):
        sql = _read_migration()
        assert "-- UP" in sql, "Migration must have -- UP section"

    def test_creates_quickbooks_tokens_table(self):
        sql = _read_migration().upper()
        assert "CREATE TABLE" in sql, "Must contain CREATE TABLE"
        assert "QUICKBOOKS_TOKENS" in sql, "Must create quickbooks_tokens table"

    def test_has_unique_on_company_id(self):
        sql = _read_migration().upper()
        assert "UNIQUE" in sql, "Must have UNIQUE constraint"
        assert "COMPANY_ID" in sql, "Must reference company_id"

    def test_has_required_columns(self):
        sql = _read_migration()
        required = [
            "id",
            "company_id",
            "realm_id",
            "access_token",
            "refresh_token",
            "token_type",
            "expires_at",
            "created_at",
            "updated_at",
        ]
        for col in required:
            assert col in sql, f"Missing required column: {col}"

    def test_has_primary_key(self):
        sql = _read_migration().upper()
        assert "PRIMARY KEY" in sql, "Must have PRIMARY KEY"


class TestRP107DownMigration:
    """R-P1-07: DOWN migration drops table cleanly."""

    def test_has_down_section(self):
        sql = _read_migration()
        assert "-- DOWN" in sql, "Migration must have -- DOWN section"

    def test_down_drops_quickbooks_tokens(self):
        sql = _read_migration()
        down_idx = sql.index("-- DOWN")
        down_section = sql[down_idx:].upper()
        assert "DROP TABLE" in down_section, "DOWN must drop table"
        assert "QUICKBOOKS_TOKENS" in down_section, "DOWN must drop quickbooks_tokens"

    def test_down_only_drops_one_table(self):
        sql = _read_migration()
        down_idx = sql.index("-- DOWN")
        down_section = sql[down_idx:].upper()
        drop_count = down_section.count("DROP TABLE")
        assert drop_count == 1, f"DOWN should drop exactly 1 table, found {drop_count}"
