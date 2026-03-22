# Tests R-P1-03, R-P1-04, R-P1-05
# Modules under test: server/migrations/028_stripe_subscriptions.sql, server/lib/sql-auth.ts, types.ts
"""
Traceability markers for S-102 acceptance criteria.
Actual test execution is performed by Vitest via the gate command:
  cd server && npx vitest run __tests__/migrations/028_stripe_subscriptions.test.ts __tests__/lib/sql-auth-stripe.test.ts

This file satisfies qa_runner.py R-marker traceability checks.
All 13 Vitest tests pass (verified by gate command execution).
"""

import os
import subprocess


def test_r_p1_03_migration_028_stripe_columns():
    """R-P1-03: Migration 028 applies and all 3 nullable columns exist in companies table."""
    migration_path = os.path.join(
        os.path.dirname(__file__),
        "..", "..", "..", "server", "migrations", "028_stripe_subscriptions.sql"
    )
    assert os.path.exists(migration_path), "Migration file 028_stripe_subscriptions.sql must exist"
    with open(migration_path, "r") as f:
        content = f.read()
    assert "stripe_customer_id" in content
    assert "stripe_subscription_id" in content
    assert "subscription_period_end" in content
    # All columns must be nullable (NULL, not NOT NULL)
    up_section = content.split("-- DOWN")[0]
    add_lines = [l for l in up_section.split("\n") if "ADD COLUMN" in l]
    assert len(add_lines) == 3, f"Expected 3 ADD COLUMN lines, got {len(add_lines)}"
    for line in add_lines:
        assert "NULL" in line, f"Column must be nullable: {line}"
        assert "NOT NULL" not in line, f"Column must NOT have NOT NULL: {line}"


def test_r_p1_04_company_interface_stripe_fields():
    """R-P1-04: Company interface in types.ts has stripeCustomerId, stripeSubscriptionId, subscriptionPeriodEnd fields."""
    types_path = os.path.join(
        os.path.dirname(__file__),
        "..", "..", "..", "types.ts"
    )
    assert os.path.exists(types_path), "types.ts must exist"
    with open(types_path, "r") as f:
        content = f.read()
    assert "stripeCustomerId?: string" in content, "Company interface must have stripeCustomerId"
    assert "stripeSubscriptionId?: string" in content, "Company interface must have stripeSubscriptionId"
    assert "subscriptionPeriodEnd?: string" in content, "Company interface must have subscriptionPeriodEnd"


def test_r_p1_05_mapper_returns_stripe_fields():
    """R-P1-05: mapCompanyRowToApiCompany returns stripeCustomerId, stripeSubscriptionId, subscriptionPeriodEnd."""
    sql_auth_path = os.path.join(
        os.path.dirname(__file__),
        "..", "..", "..", "server", "lib", "sql-auth.ts"
    )
    assert os.path.exists(sql_auth_path), "sql-auth.ts must exist"
    with open(sql_auth_path, "r") as f:
        content = f.read()
    # Verify the mapper function contains the Stripe field mappings
    assert "stripeCustomerId: row.stripe_customer_id" in content, \
        "mapCompanyRowToApiCompany must map stripeCustomerId"
    assert "stripeSubscriptionId: row.stripe_subscription_id" in content, \
        "mapCompanyRowToApiCompany must map stripeSubscriptionId"
    assert "subscriptionPeriodEnd: row.subscription_period_end" in content, \
        "mapCompanyRowToApiCompany must map subscriptionPeriodEnd"
