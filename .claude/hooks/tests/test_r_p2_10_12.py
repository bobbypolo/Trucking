# Tests R-P2-10, R-P2-11, R-P2-12
"""
S-2.4 acceptance criteria tests:
  R-P2-10: GET /api/dashboard/cards returns 200 with valid auth -- no more 500
  R-P2-11: Dispatch events route accessible from frontend path -- no more 404
  R-P2-12: Equipment route accessible with tenant-scoped path -- no more 404
"""
import subprocess
import json
import re


def _run_vitest(test_path: str) -> subprocess.CompletedProcess:
    """Run a single vitest test file and return the result."""
    return subprocess.run(
        f'cd /d "F:\\Trucking\\DisbatchMe\\server" && npx vitest run {test_path} --reporter=verbose',
        shell=True,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        timeout=120,
    )


def test_r_p2_10_dashboard_cards_route_exists():
    """R-P2-10: The dashboard cards route test file must exist and pass."""
    result = _run_vitest("__tests__/routes/dashboard-cards.test.ts")
    assert result.returncode == 0, (
        f"dashboard-cards.test.ts failed:\nSTDOUT:\n{result.stdout[-2000:]}\nSTDERR:\n{result.stderr[-2000:]}"
    )


def test_r_p2_11_dispatch_events_tenant_scoped():
    """R-P2-11: Dispatch events route test for tenant-scoped alias must pass."""
    result = _run_vitest("__tests__/routes/dispatch-events-alias.test.ts")
    assert result.returncode == 0, (
        f"dispatch-events-alias.test.ts failed:\nSTDOUT:\n{result.stdout[-2000:]}\nSTDERR:\n{result.stderr[-2000:]}"
    )


def test_r_p2_12_equipment_tenant_scoped():
    """R-P2-12: Equipment tenant-scoped route test must pass."""
    result = _run_vitest("__tests__/routes/equipment-tenant-scoped.test.ts")
    assert result.returncode == 0, (
        f"equipment-tenant-scoped.test.ts failed:\nSTDOUT:\n{result.stdout[-2000:]}\nSTDERR:\n{result.stderr[-2000:]}"
    )


def test_r_p2_10_dashboard_cards_no_company_id_in_query():
    """R-P2-10: The dashboard_card query must NOT reference company_id column."""
    with open(
        "F:/Trucking/DisbatchMe/server/routes/dispatch.ts", encoding="utf-8"
    ) as f:
        content = f.read()
    # Find the dashboard/cards route handler
    match = re.search(
        r'/api/dashboard/cards.*?(?=router\.|export\s)', content, re.DOTALL
    )
    assert match, "Could not find /api/dashboard/cards route in dispatch.ts"
    route_block = match.group(0)
    assert "company_id" not in route_block, (
        "dashboard_card query still references company_id -- the table has no such column"
    )


def test_r_p2_11_dispatch_events_alias_route_exists():
    """R-P2-11: A tenant-scoped GET dispatch events route alias must exist in dispatch.ts."""
    with open(
        "F:/Trucking/DisbatchMe/server/routes/dispatch.ts", encoding="utf-8"
    ) as f:
        content = f.read()
    # Must have a GET route that doesn't require companyId param for dispatch events
    # Either /api/dispatch/events or a GET on /api/dispatch-events (no param)
    has_alias = bool(re.search(r'router\.get\(\s*"/api/dispatch/events"', content))
    has_tenant_get = bool(
        re.search(r'router\.get\(\s*"/api/dispatch-events"\s*,', content)
    )
    assert has_alias or has_tenant_get, (
        "No tenant-scoped GET dispatch events alias route found in dispatch.ts"
    )


def test_r_p2_12_equipment_tenant_scoped_route_exists():
    """R-P2-12: A tenant-scoped GET /api/equipment route (no param) must exist."""
    with open(
        "F:/Trucking/DisbatchMe/server/routes/equipment.ts", encoding="utf-8"
    ) as f:
        content = f.read()
    # Must have GET /api/equipment that uses tenantId from auth, not URL param
    # The route must be a GET handler registered before the /:companyId route
    assert re.search(
        r'router\.get\(\s*"/api/equipment"\s*,', content
    ), "No tenant-scoped GET /api/equipment route found in equipment.ts"
