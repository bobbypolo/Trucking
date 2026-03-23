# Tests R-P2-01, R-P2-02, R-P2-03, R-P2-04
"""
Verify schema conflict resolution for S-2.1:
- R-P2-01: 5 duplicate CREATE TABLE statements removed from 001_baseline.sql
- R-P2-02: ALTER TABLE messages ADD COLUMN company_id removed from 003_operational_entities.sql
- R-P2-03: MIGRATION_ORDER array in docker-mysql.ts includes all migrations through 032
- R-P2-04: Server tests pass with clean migration order (verified by gate cmd)
"""
import os
import re
import pytest

SERVER_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "..", "server")
MIGRATIONS_DIR = os.path.join(SERVER_DIR, "migrations")
DOCKER_MYSQL_PATH = os.path.join(
    SERVER_DIR, "__tests__", "helpers", "docker-mysql.ts"
)


def read_file(path: str) -> str:
    with open(path, "r", encoding="utf-8") as f:
        return f.read()


class TestRP201DuplicateCreateTables:
    """R-P2-01: 5 duplicate CREATE TABLE statements removed from 001_baseline.sql"""

    def setup_method(self):
        self.baseline = read_file(
            os.path.join(MIGRATIONS_DIR, "001_baseline.sql")
        )

    def test_no_quotes_create_table(self):
        """quotes CREATE TABLE must not appear in 001_baseline.sql"""
        pattern = r"CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?quotes\s*\("
        matches = re.findall(pattern, self.baseline, re.IGNORECASE)
        assert len(matches) == 0, (
            f"Found {len(matches)} CREATE TABLE quotes in 001_baseline.sql"
        )

    def test_no_leads_create_table(self):
        """leads CREATE TABLE must not appear in 001_baseline.sql"""
        pattern = r"CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?leads\s*\("
        matches = re.findall(pattern, self.baseline, re.IGNORECASE)
        assert len(matches) == 0, (
            f"Found {len(matches)} CREATE TABLE leads in 001_baseline.sql"
        )

    def test_no_bookings_create_table(self):
        """bookings CREATE TABLE must not appear in 001_baseline.sql"""
        pattern = r"CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?bookings\s*\("
        matches = re.findall(pattern, self.baseline, re.IGNORECASE)
        assert len(matches) == 0, (
            f"Found {len(matches)} CREATE TABLE bookings in 001_baseline.sql"
        )

    def test_no_messages_create_table(self):
        """messages CREATE TABLE must not appear in 001_baseline.sql"""
        pattern = r"CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?messages\s*\("
        matches = re.findall(pattern, self.baseline, re.IGNORECASE)
        assert len(matches) == 0, (
            f"Found {len(matches)} CREATE TABLE messages in 001_baseline.sql"
        )

    def test_no_work_items_create_table(self):
        """work_items CREATE TABLE must not appear in 001_baseline.sql"""
        pattern = r"CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?work_items\s*\("
        matches = re.findall(pattern, self.baseline, re.IGNORECASE)
        assert len(matches) == 0, (
            f"Found {len(matches)} CREATE TABLE work_items in 001_baseline.sql"
        )

    def test_no_duplicate_indexes_for_removed_tables(self):
        """Indexes referencing removed tables should also be removed from 001"""
        removed_indexes = [
            "idx_quote_company",
            "idx_quote_lead",
            "idx_booking_quote",
            "idx_workitem_company",
            "idx_workitem_status",
        ]
        for idx_name in removed_indexes:
            pattern = rf"CREATE\s+INDEX\s+{idx_name}\b"
            matches = re.findall(pattern, self.baseline, re.IGNORECASE)
            assert len(matches) == 0, (
                f"Found CREATE INDEX {idx_name} in 001_baseline.sql "
                f"(should be removed with its table)"
            )

    def test_baseline_still_has_core_tables(self):
        """Core tables that should remain in 001 are still present"""
        core_tables = [
            "companies",
            "users",
            "customers",
            "equipment",
            "loads",
            "load_legs",
            "expenses",
        ]
        for table in core_tables:
            pattern = rf"CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?{table}\s*\("
            matches = re.findall(pattern, self.baseline, re.IGNORECASE)
            assert len(matches) == 1, (
                f"Expected 1 CREATE TABLE {table} in 001_baseline.sql, "
                f"found {len(matches)}"
            )


class TestRP202AlterTableMessages:
    """R-P2-02: ALTER TABLE messages ADD COLUMN company_id removed from 003"""

    def setup_method(self):
        self.content = read_file(
            os.path.join(MIGRATIONS_DIR, "003_operational_entities.sql")
        )

    def test_no_alter_table_messages(self):
        """ALTER TABLE messages ADD COLUMN company_id must not appear in 003"""
        pattern = r"ALTER\s+TABLE\s+messages\s+ADD\s+COLUMN\s+company_id"
        matches = re.findall(pattern, self.content, re.IGNORECASE)
        assert len(matches) == 0, (
            "Found ALTER TABLE messages ADD COLUMN company_id in "
            "003_operational_entities.sql"
        )

    def test_no_messages_fk_constraint(self):
        """FK constraint for messages.company_id must not appear in 003"""
        pattern = r"ADD\s+CONSTRAINT\s+fk_messages_company"
        matches = re.findall(pattern, self.content, re.IGNORECASE)
        assert len(matches) == 0, (
            "Found fk_messages_company constraint in 003_operational_entities.sql"
        )

    def test_no_messages_update_backfill(self):
        """UPDATE messages backfill must not appear in 003"""
        pattern = r"UPDATE\s+messages\s+m"
        matches = re.findall(pattern, self.content, re.IGNORECASE)
        assert len(matches) == 0, (
            "Found UPDATE messages backfill in 003_operational_entities.sql"
        )

    def test_no_messages_index(self):
        """Index on messages.company_id must not appear in 003"""
        pattern = r"CREATE\s+INDEX\s+idx_messages_company_id"
        matches = re.findall(pattern, self.content, re.IGNORECASE)
        assert len(matches) == 0, (
            "Found idx_messages_company_id in 003_operational_entities.sql"
        )

    def test_incidents_alter_still_present(self):
        """ALTER TABLE incidents should still be present in 003"""
        pattern = r"ALTER\s+TABLE\s+incidents\s+ADD\s+COLUMN\s+company_id"
        matches = re.findall(pattern, self.content, re.IGNORECASE)
        assert len(matches) == 1, (
            "ALTER TABLE incidents ADD COLUMN company_id should remain in 003"
        )

    def test_call_sessions_still_present(self):
        """call_sessions CREATE TABLE should still be present in 003"""
        pattern = r"CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?call_sessions\s*\("
        matches = re.findall(pattern, self.content, re.IGNORECASE)
        assert len(matches) == 1, (
            "CREATE TABLE call_sessions should remain in 003"
        )


class TestRP203MigrationOrder:
    """R-P2-03: MIGRATION_ORDER in docker-mysql.ts updated through 032"""

    def setup_method(self):
        self.content = read_file(DOCKER_MYSQL_PATH)

    def test_migration_order_includes_024_through_031(self):
        """MIGRATION_ORDER must include migrations 024 through 031"""
        expected = [
            "024_safety_domain.sql",
            "025_vault_docs.sql",
            "026_notification_jobs.sql",
            "027_add_subscription_tier.sql",
            "028_stripe_subscriptions.sql",
            "029_quickbooks_tokens.sql",
            "030_gps_positions.sql",
            "031_stripe_webhook_events.sql",
        ]
        for migration in expected:
            assert migration in self.content, (
                f"{migration} not found in MIGRATION_ORDER in docker-mysql.ts"
            )

    def test_migration_order_includes_032(self):
        """MIGRATION_ORDER must include migration 032"""
        assert "032_parties_subsystem.sql" in self.content, (
            "032_parties_subsystem.sql not found in MIGRATION_ORDER"
        )

    def test_migration_order_is_sequential(self):
        """Migration files in MIGRATION_ORDER should be in numeric order"""
        # Extract all migration filenames from the MIGRATION_ORDER array
        pattern = r'"(\d{3}_[^"]+\.sql)"'
        migrations = re.findall(pattern, self.content)
        numbers = [int(m[:3]) for m in migrations]
        # Verify sorted (allowing duplicates like 002_ and 003_)
        for i in range(1, len(numbers)):
            assert numbers[i] >= numbers[i - 1], (
                f"Migration order not sequential: {migrations[i-1]} > {migrations[i]}"
            )

    def test_original_migrations_still_present(self):
        """Original migrations 001-023 should still be in the order"""
        assert "001_baseline.sql" in self.content
        assert "023_add_loads_deleted_at.sql" in self.content
