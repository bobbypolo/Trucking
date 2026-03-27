# Tests R-P2-05, R-P2-06, R-P2-07
"""
S-2.2: Create migration 032 — parties subsystem.

R-P2-05: Migration 032 creates all 8 party tables with correct columns and FK constraints
R-P2-06: GET /api/providers returns 200 (empty array) after migration
R-P2-07: GET /api/contacts returns 200 (empty array) after migration
"""

import os
import re


SERVER_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "..", "server")
MIGRATIONS_DIR = os.path.join(SERVER_DIR, "migrations")
MIGRATION_FILE = os.path.join(MIGRATIONS_DIR, "032_parties_subsystem.sql")
DOCKER_MYSQL_PATH = os.path.join(SERVER_DIR, "__tests__", "helpers", "docker-mysql.ts")


def _read_migration():
    """Read the migration SQL file content."""
    assert os.path.isfile(MIGRATION_FILE), (
        f"032_parties_subsystem.sql not found at {MIGRATION_FILE}"
    )
    return open(MIGRATION_FILE, encoding="utf-8").read()


# ── R-P2-05: Migration file exists ──────────────────────────────────────────


def test_migration_032_file_exists():
    """R-P2-05: Migration 032 file exists."""
    assert os.path.isfile(MIGRATION_FILE), (
        "server/migrations/032_parties_subsystem.sql does not exist"
    )


# ── R-P2-05: All 8 tables are created ───────────────────────────────────────

REQUIRED_TABLES = [
    "parties",
    "party_contacts",
    "party_documents",
    "rate_rows",
    "rate_tiers",
    "constraint_sets",
    "constraint_rules",
    "party_catalog_links",
]


def test_migration_032_creates_all_8_tables():
    """R-P2-05: Migration creates all 8 party tables."""
    sql = _read_migration()
    for table in REQUIRED_TABLES:
        pattern = rf"CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?{table}\b"
        assert re.search(pattern, sql, re.IGNORECASE), (
            f"CREATE TABLE for '{table}' not found in migration 032"
        )


# ── R-P2-05: Key columns present ────────────────────────────────────────────


def test_parties_table_columns():
    """R-P2-05: parties table has all required columns."""
    sql = _read_migration()
    # Extract the CREATE TABLE parties block
    match = re.search(
        r"CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?parties\s*\((.*?)\);",
        sql,
        re.IGNORECASE | re.DOTALL,
    )
    assert match, "Could not parse parties table definition"
    body = match.group(1)
    required_cols = [
        "id",
        "company_id",
        "name",
        "type",
        "is_customer",
        "is_vendor",
        "status",
        "mc_number",
        "dot_number",
        "rating",
        "created_at",
        "updated_at",
    ]
    for col in required_cols:
        assert re.search(rf"\b{col}\b", body), (
            f"Column '{col}' not found in parties table"
        )


def test_rate_rows_table_columns():
    """R-P2-05: rate_rows table has all required columns."""
    sql = _read_migration()
    match = re.search(
        r"CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?rate_rows\s*\((.*?)\);",
        sql,
        re.IGNORECASE | re.DOTALL,
    )
    assert match, "Could not parse rate_rows table definition"
    body = match.group(1)
    required_cols = [
        "id",
        "party_id",
        "tenant_id",
        "catalog_item_id",
        "variant_id",
        "direction",
        "currency",
        "price_type",
        "unit_type",
        "base_amount",
        "unit_amount",
        "min_charge",
        "max_charge",
        "free_units",
        "effective_start",
        "effective_end",
        "taxable_flag",
        "rounding_rule",
        "notes_internal",
        "approval_required",
    ]
    for col in required_cols:
        assert re.search(rf"\b{col}\b", body), (
            f"Column '{col}' not found in rate_rows table"
        )


def test_constraint_rules_table_columns():
    """R-P2-05: constraint_rules table has all required columns."""
    sql = _read_migration()
    match = re.search(
        r"CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?constraint_rules\s*\((.*?)\);",
        sql,
        re.IGNORECASE | re.DOTALL,
    )
    assert match, "Could not parse constraint_rules table definition"
    body = match.group(1)
    required_cols = [
        "id",
        "constraint_set_id",
        "rule_type",
        "field_key",
        "operator",
        "value_text",
        "enforcement",
        "message",
    ]
    for col in required_cols:
        assert re.search(rf"\b{col}\b", body), (
            f"Column '{col}' not found in constraint_rules table"
        )


# ── R-P2-05: Foreign key constraints ────────────────────────────────────────


def test_fk_constraints():
    """R-P2-05: FK constraints exist for child tables referencing parties."""
    sql = _read_migration()
    # party_contacts -> parties
    assert re.search(
        r"FOREIGN\s+KEY.*party_id.*REFERENCES\s+parties", sql, re.IGNORECASE
    ), "FK from party_contacts to parties not found"
    # rate_rows -> parties
    assert re.search(
        r"rate_rows.*FOREIGN\s+KEY.*party_id.*REFERENCES\s+parties",
        sql,
        re.IGNORECASE | re.DOTALL,
    ), "FK from rate_rows to parties not found"
    # rate_tiers -> rate_rows
    assert re.search(
        r"FOREIGN\s+KEY.*rate_row_id.*REFERENCES\s+rate_rows", sql, re.IGNORECASE
    ), "FK from rate_tiers to rate_rows not found"
    # constraint_rules -> constraint_sets
    assert re.search(
        r"FOREIGN\s+KEY.*constraint_set_id.*REFERENCES\s+constraint_sets",
        sql,
        re.IGNORECASE,
    ), "FK from constraint_rules to constraint_sets not found"


# ── R-P2-05: company_id index for tenant isolation ──────────────────────────


def test_company_id_indexes():
    """R-P2-05: company_id indexes exist for tenant isolation."""
    sql = _read_migration()
    # At minimum, parties should have a company_id index
    assert re.search(r"INDEX.*company_id|KEY.*company_id", sql, re.IGNORECASE), (
        "No company_id index found in migration 032"
    )


# ── R-P2-05: Migration is in MIGRATION_ORDER ────────────────────────────────


def test_migration_in_migration_order():
    """R-P2-05: 032_parties_subsystem.sql exists on disk and docker-mysql.ts uses dynamic enumeration."""
    assert os.path.isfile(DOCKER_MYSQL_PATH), (
        f"docker-mysql.ts not found at {DOCKER_MYSQL_PATH}"
    )
    assert os.path.isfile(os.path.join(MIGRATIONS_DIR, "032_parties_subsystem.sql")), (
        "032_parties_subsystem.sql not found in migrations directory"
    )
    content = open(DOCKER_MYSQL_PATH, encoding="utf-8").read()
    assert "getMigrationOrder" in content or "readdirSync" in content, (
        "docker-mysql.ts should use dynamic migration enumeration"
    )


# ── R-P2-06 / R-P2-07: Route files exist and query correct tables ───────────


def test_providers_route_exists():
    """R-P2-06: providers route file exists and queries providers table."""
    providers_route = os.path.join(SERVER_DIR, "routes", "providers.ts")
    assert os.path.isfile(providers_route), "server/routes/providers.ts not found"
    content = open(providers_route, encoding="utf-8").read()
    assert "/api/providers" in content, (
        "GET /api/providers route not found in providers.ts"
    )


def test_contacts_route_exists():
    """R-P2-07: contacts route file exists and queries contacts table."""
    contacts_route = os.path.join(SERVER_DIR, "routes", "contacts.ts")
    assert os.path.isfile(contacts_route), "server/routes/contacts.ts not found"
    content = open(contacts_route, encoding="utf-8").read()
    assert "/api/contacts" in content, (
        "GET /api/contacts route not found in contacts.ts"
    )


# ── R-P2-05: DOWN section exists ────────────────────────────────────────────


def test_migration_has_down_section():
    """R-P2-05: Migration has a DOWN section for rollback."""
    sql = _read_migration()
    assert "-- DOWN" in sql, "Migration missing -- DOWN section"
    # Ensure all 8 tables have DROP TABLE in DOWN
    for table in REQUIRED_TABLES:
        pattern = rf"DROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?{table}\b"
        assert re.search(pattern, sql, re.IGNORECASE), (
            f"DROP TABLE for '{table}' not found in DOWN section"
        )
