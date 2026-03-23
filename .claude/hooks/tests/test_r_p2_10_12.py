# Tests R-P2-10, R-P2-11, R-P2-12
"""
S-2.4 acceptance criteria tests:
  R-P2-10: GET /api/dashboard/cards returns 200 with valid auth -- no more 500
  R-P2-11: Dispatch events route accessible from frontend path -- no more 404
  R-P2-12: Equipment route accessible with tenant-scoped path -- no more 404

Covers: server/routes/dispatch.ts, server/routes/equipment.ts
"""
import subprocess
import re


DISPATCH_TS = "F:/Trucking/DisbatchMe/server/routes/dispatch.ts"
EQUIPMENT_TS = "F:/Trucking/DisbatchMe/server/routes/equipment.ts"


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


def _read_file(path: str) -> str:
    with open(path, encoding="utf-8") as f:
        return f.read()


# ── R-P2-10: Dashboard cards fix ─────────────────────────────────────────────

def test_r_p2_10_dashboard_cards_route_exists():
    """R-P2-10: The dashboard cards route test file must exist and pass."""
    result = _run_vitest("__tests__/routes/dashboard-cards.test.ts")
    assert result.returncode == 0, (
        f"dashboard-cards.test.ts failed:\nSTDOUT:\n{result.stdout[-2000:]}\nSTDERR:\n{result.stderr[-2000:]}"
    )


def test_r_p2_10_dashboard_cards_no_company_id_in_query():
    """R-P2-10: The dashboard_card query must NOT reference company_id column."""
    content = _read_file(DISPATCH_TS)
    match = re.search(
        r'/api/dashboard/cards.*?(?=router\.|export\s)', content, re.DOTALL
    )
    assert match, "Could not find /api/dashboard/cards route in dispatch.ts"
    route_block = match.group(0)
    assert "company_id" not in route_block, (
        "dashboard_card query still references company_id -- the table has no such column"
    )


def test_r_p2_10_dashboard_cards_query_has_order_by():
    """R-P2-10: The dashboard_card query should ORDER BY sort_order."""
    content = _read_file(DISPATCH_TS)
    match = re.search(
        r'/api/dashboard/cards.*?(?=router\.|export\s)', content, re.DOTALL
    )
    assert match, "Could not find /api/dashboard/cards route"
    route_block = match.group(0).lower()
    assert "order by" in route_block, "Dashboard cards query missing ORDER BY clause"
    assert "sort_order" in route_block, "Dashboard cards query should order by sort_order"


def test_r_p2_10_dashboard_cards_route_requires_auth():
    """R-P2-10: Dashboard cards route must require authentication."""
    content = _read_file(DISPATCH_TS)
    match = re.search(
        r'"/api/dashboard/cards".*?async', content, re.DOTALL
    )
    assert match, "Could not find dashboard cards route definition"
    middleware_block = match.group(0)
    assert "requireAuth" in middleware_block, (
        "Dashboard cards route missing requireAuth middleware"
    )


# ── R-P2-11: Dispatch events alias ──────────────────────────────────────────

def test_r_p2_11_dispatch_events_tenant_scoped():
    """R-P2-11: Dispatch events route test for tenant-scoped alias must pass."""
    result = _run_vitest("__tests__/routes/dispatch-events-alias.test.ts")
    assert result.returncode == 0, (
        f"dispatch-events-alias.test.ts failed:\nSTDOUT:\n{result.stdout[-2000:]}\nSTDERR:\n{result.stderr[-2000:]}"
    )


def test_r_p2_11_dispatch_events_alias_route_exists():
    """R-P2-11: A tenant-scoped GET dispatch events route alias must exist in dispatch.ts."""
    content = _read_file(DISPATCH_TS)
    has_alias = bool(re.search(r'router\.get\(\s*"/api/dispatch/events"', content))
    has_tenant_get = bool(
        re.search(r'router\.get\(\s*"/api/dispatch-events"\s*,', content)
    )
    assert has_alias or has_tenant_get, (
        "No tenant-scoped GET dispatch events alias route found in dispatch.ts"
    )


def test_r_p2_11_dispatch_events_alias_uses_tenant_id():
    """R-P2-11: The alias route must use tenantId from auth, not URL param."""
    content = _read_file(DISPATCH_TS)
    match = re.search(
        r'"/api/dispatch/events".*?(?=router\.|export\s)', content, re.DOTALL
    )
    assert match, "Could not find /api/dispatch/events route"
    route_block = match.group(0)
    assert "tenantId" in route_block or "user.tenantId" in route_block, (
        "Dispatch events alias route should use tenantId from auth token"
    )
    assert ":companyId" not in route_block.split("\n")[0], (
        "Alias route should NOT have :companyId URL param"
    )


def test_r_p2_11_original_dispatch_events_route_preserved():
    """R-P2-11 negative: Original /api/dispatch-events/:companyId route must still exist."""
    content = _read_file(DISPATCH_TS)
    assert re.search(
        r'"/api/dispatch-events/:companyId"', content
    ), "Original dispatch-events/:companyId route was accidentally removed"


# ── R-P2-12: Equipment tenant-scoped ────────────────────────────────────────

def test_r_p2_12_equipment_tenant_scoped():
    """R-P2-12: Equipment tenant-scoped route test must pass."""
    result = _run_vitest("__tests__/routes/equipment-tenant-scoped.test.ts")
    assert result.returncode == 0, (
        f"equipment-tenant-scoped.test.ts failed:\nSTDOUT:\n{result.stdout[-2000:]}\nSTDERR:\n{result.stderr[-2000:]}"
    )


def test_r_p2_12_equipment_tenant_scoped_route_exists():
    """R-P2-12: A tenant-scoped GET /api/equipment route (no param) must exist."""
    content = _read_file(EQUIPMENT_TS)
    assert re.search(
        r'router\.get\(\s*"/api/equipment"\s*,', content
    ), "No tenant-scoped GET /api/equipment route found in equipment.ts"


def test_r_p2_12_equipment_tenant_route_uses_tenant_id():
    """R-P2-12: The tenant-scoped equipment route must use tenantId from auth."""
    content = _read_file(EQUIPMENT_TS)
    match = re.search(
        r'router\.get\(\s*"/api/equipment"\s*,.*?(?=router\.|export\s)',
        content, re.DOTALL
    )
    assert match, "Could not find /api/equipment route"
    route_block = match.group(0)
    assert "tenantId" in route_block or "user.tenantId" in route_block, (
        "Equipment tenant route should use tenantId from auth token"
    )


def test_r_p2_12_original_equipment_route_preserved():
    """R-P2-12 negative: Original /api/equipment/:companyId route must still exist."""
    content = _read_file(EQUIPMENT_TS)
    assert re.search(
        r'"/api/equipment/:companyId"', content
    ), "Original equipment/:companyId route was accidentally removed"


def test_r_p2_12_equipment_no_duplicate_post_route():
    """R-P2-12 negative: POST /api/equipment must not be duplicated."""
    content = _read_file(EQUIPMENT_TS)
    post_matches = re.findall(r'router\.post\(\s*"/api/equipment"', content)
    assert len(post_matches) == 1, (
        f"Expected exactly 1 POST /api/equipment route, found {len(post_matches)}"
    )
