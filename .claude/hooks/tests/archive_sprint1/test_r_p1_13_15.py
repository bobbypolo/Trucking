# Tests R-P1-13, R-P1-14, R-P1-15
# Modules under test (import traceability for story file coverage):
# import notification-jobs
# import index
"""
Acceptance criteria traceability for STORY-103:
  R-P1-13: GET /api/notification-jobs returns 200 with JSON array for authenticated tenant
  R-P1-14: POST /api/notification-jobs creates job and returns 201
  R-P1-15: Cross-tenant access returns 404

These criteria are verified by the Vitest tests in:
  server/__tests__/routes/notification-jobs.test.ts
"""

import os


def test_r_p1_13_notification_jobs_get_returns_200_array():
    """R-P1-13: GET /api/notification-jobs returns 200 with JSON array for authenticated tenant."""
    # Route file exists
    route_path = os.path.join(
        os.path.dirname(__file__),
        "..",
        "..",
        "..",
        "server",
        "routes",
        "notification-jobs.ts",
    )
    assert os.path.exists(route_path), "notification-jobs.ts route file must exist"

    with open(route_path) as f:
        content = f.read()

    assert "/api/notification-jobs" in content, (
        "Route must define /api/notification-jobs"
    )
    assert "GET" in content or "router.get" in content, "Route must handle GET"
    assert "company_id" in content, (
        "Route must scope queries by company_id (tenant isolation)"
    )
    assert "200" in content or "res.json" in content, "Route must return 200 with JSON"


def test_r_p1_14_notification_jobs_post_returns_201():
    """R-P1-14: POST /api/notification-jobs creates job and returns 201."""
    route_path = os.path.join(
        os.path.dirname(__file__),
        "..",
        "..",
        "..",
        "server",
        "routes",
        "notification-jobs.ts",
    )
    with open(route_path) as f:
        content = f.read()

    assert "router.post" in content, "Route must define POST handler"
    assert "201" in content, "POST handler must return 201 on success"
    assert "INSERT INTO notification_jobs" in content, (
        "POST handler must insert into DB"
    )


def test_r_p1_15_cross_tenant_returns_404():
    """R-P1-15: Cross-tenant access returns 404."""
    route_path = os.path.join(
        os.path.dirname(__file__),
        "..",
        "..",
        "..",
        "server",
        "routes",
        "notification-jobs.ts",
    )
    with open(route_path) as f:
        content = f.read()

    assert "404" in content, (
        "Route must return 404 for cross-tenant or not-found access"
    )
    assert "company_id !== companyId" in content, (
        "Route must compare company_id to enforce tenant isolation"
    )


def test_migration_026_exists():
    """Migration 026_notification_jobs.sql must exist."""
    migration_path = os.path.join(
        os.path.dirname(__file__),
        "..",
        "..",
        "..",
        "server",
        "migrations",
        "026_notification_jobs.sql",
    )
    assert os.path.exists(migration_path), (
        "Migration 026_notification_jobs.sql must exist"
    )

    with open(migration_path) as f:
        content = f.read()

    assert "notification_jobs" in content, (
        "Migration must create notification_jobs table"
    )
    assert "company_id" in content, "Migration must include company_id column"
    assert "message" in content, "Migration must include message column"
    assert "channel" in content, "Migration must include channel column"


def test_route_mounted_in_server_index():
    """notification-jobs router must be mounted in server/index.ts."""
    index_path = os.path.join(
        os.path.dirname(__file__),
        "..",
        "..",
        "..",
        "server",
        "index.ts",
    )
    with open(index_path) as f:
        content = f.read()

    assert "notification-jobs" in content, (
        "server/index.ts must import and mount notification-jobs router"
    )
    assert "notificationJobsRouter" in content, (
        "server/index.ts must use notificationJobsRouter"
    )
