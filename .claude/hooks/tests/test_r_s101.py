# Tests R-P1-01, R-P1-02
# Covers: from sql-auth (server/lib/sql-auth.ts)
"""
S-101: Add subscription_tier column + wire through sql-auth.ts mapper.

R-P1-01: Migration 027 applies without error and column exists with default Records Vault
R-P1-02: mapCompanyRowToApiCompany returns subscriptionTier field, null defaults to Records Vault
"""

import os
import re
import subprocess


def test_migration_027_file_exists():
    """R-P1-01: Migration file 027_add_subscription_tier.sql exists."""
    migration_path = os.path.join(
        os.path.dirname(__file__),
        "..", "..", "..", "server", "migrations", "027_add_subscription_tier.sql"
    )
    assert os.path.isfile(migration_path), (
        f"Migration file not found at {migration_path}"
    )


def test_migration_027_has_correct_sql():
    """R-P1-01: Migration SQL contains ALTER TABLE with subscription_tier column and correct default."""
    migration_path = os.path.join(
        os.path.dirname(__file__),
        "..", "..", "..", "server", "migrations", "027_add_subscription_tier.sql"
    )
    content = open(migration_path, encoding="utf-8").read()

    # Must have UP and DOWN markers
    assert "-- UP" in content, "Missing -- UP marker"
    assert "-- DOWN" in content, "Missing -- DOWN marker"

    # Must add subscription_tier column
    assert "subscription_tier" in content, "Missing subscription_tier column"
    assert "VARCHAR" in content.upper(), "Missing VARCHAR type"
    assert "Records Vault" in content, "Missing default 'Records Vault'"


def test_migration_027_has_down_migration():
    """R-P1-01: Migration has a DOWN section that drops the column."""
    migration_path = os.path.join(
        os.path.dirname(__file__),
        "..", "..", "..", "server", "migrations", "027_add_subscription_tier.sql"
    )
    content = open(migration_path, encoding="utf-8").read()
    down_section = content.split("-- DOWN")[1] if "-- DOWN" in content else ""

    assert "DROP COLUMN" in down_section.upper() or "DROP COLUMN" in down_section, (
        "DOWN migration must drop subscription_tier column"
    )


def test_sql_auth_has_subscription_tier_in_interface():
    """R-P1-02: SqlCompanyRow interface includes subscription_tier field."""
    sql_auth_path = os.path.join(
        os.path.dirname(__file__),
        "..", "..", "..", "server", "lib", "sql-auth.ts"
    )
    content = open(sql_auth_path, encoding="utf-8").read()

    # Find the SqlCompanyRow interface block
    assert "subscription_tier" in content, (
        "subscription_tier not found in sql-auth.ts"
    )
    # Should be optional nullable string
    pattern = r"subscription_tier\??\s*:\s*string\s*\|\s*null"
    assert re.search(pattern, content), (
        "subscription_tier must be typed as 'string | null' in SqlCompanyRow"
    )


def test_sql_auth_mapper_has_subscription_tier():
    """R-P1-02: mapCompanyRowToApiCompany maps subscription_tier with Records Vault default."""
    sql_auth_path = os.path.join(
        os.path.dirname(__file__),
        "..", "..", "..", "server", "lib", "sql-auth.ts"
    )
    content = open(sql_auth_path, encoding="utf-8").read()

    # Find the mapCompanyRowToApiCompany function
    assert "subscriptionTier" in content, (
        "subscriptionTier camelCase mapping not found in sql-auth.ts"
    )

    # Verify the default value
    assert 'row.subscription_tier ?? "Records Vault"' in content, (
        "subscription_tier must default to 'Records Vault' when null"
    )


def test_sql_auth_mapper_has_both_cases():
    """R-P1-02: Both snake_case and camelCase mappings exist for subscription_tier."""
    sql_auth_path = os.path.join(
        os.path.dirname(__file__),
        "..", "..", "..", "server", "lib", "sql-auth.ts"
    )
    content = open(sql_auth_path, encoding="utf-8").read()

    # Must have both snake_case and camelCase in the mapper
    assert "subscription_tier:" in content, "Missing snake_case subscription_tier mapping"
    assert "subscriptionTier:" in content, "Missing camelCase subscriptionTier mapping"


def test_vitest_subscription_tier_tests_pass():
    """R-P1-02: Vitest unit tests for subscription_tier mapper pass."""
    result = subprocess.run(
        "npx vitest run __tests__/lib/sql-auth-subscription-tier.test.ts",
        shell=True,
        capture_output=True,
        text=True,
        cwd=os.path.join(
            os.path.dirname(__file__),
            "..", "..", "..", "server"
        ),
        encoding="utf-8",
        errors="replace",
        timeout=120,
    )
    assert result.returncode == 0, (
        f"Vitest subscription_tier tests failed:\n{result.stdout[-2000:]}\n{result.stderr[-2000:]}"
    )
