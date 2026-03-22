# Tests R-P3-05, R-P3-06, R-P3-07, R-P3-08
"""
QA traceability markers for S-302: Replace QuickBooks 501 stub with real routes.

R-P3-05: 501 stub removed from accounting.ts
R-P3-06: GET /api/quickbooks/auth-url returns OAuth URL when configured, 503 when not
R-P3-07: POST /api/quickbooks/sync-invoice syncs invoice and returns QBO reference ID
R-P3-08: All routes enforce requireAuth + requireTenant
"""
import os


def _read_file(relative_path):
    """Read a source file relative to the server directory."""
    base = os.path.join(os.path.dirname(__file__), '..', '..', '..', 'server')
    full_path = os.path.join(base, relative_path)
    with open(full_path, encoding='utf-8') as f:
        return f.read()


# === R-P3-05: 501 stub removed from accounting.ts ===

def test_r_p3_05_stub_removed():
    """R-P3-05: accounting.ts no longer contains the 501 QuickBooks stub."""
    content = _read_file('routes/accounting.ts')
    assert '501' not in content, 'accounting.ts still contains 501 status code'
    assert 'QuickBooks integration is not yet available' not in content
    assert 'sync-qb' not in content


def test_r_p3_05_stub_removed_negative():
    """R-P3-05 negative: accounting.ts still exports a router (not broken)."""
    content = _read_file('routes/accounting.ts')
    assert 'export default router' in content, 'accounting.ts must still export router'


# === R-P3-06: GET /api/quickbooks/auth-url ===

def test_r_p3_06_quickbooks_route_exists():
    """R-P3-06: quickbooks.ts route file exists with auth-url endpoint."""
    route_path = os.path.join(
        os.path.dirname(__file__), '..', '..', '..', 'server', 'routes', 'quickbooks.ts'
    )
    assert os.path.isfile(route_path), 'server/routes/quickbooks.ts must exist'
    content = _read_file('routes/quickbooks.ts')
    assert '/api/quickbooks/auth-url' in content
    assert '503' in content, 'Must return 503 when not configured'


def test_r_p3_06_returns_503_when_not_configured():
    """R-P3-06 edge: route must handle not-configured case with 503."""
    content = _read_file('routes/quickbooks.ts')
    assert 'available' in content, 'Must check available flag from service'
    assert '503' in content, 'Must return 503 status for unconfigured state'


def test_r_p3_06_index_wired():
    """R-P3-06: quickbooks router is wired in server/index.ts."""
    content = _read_file('index.ts')
    assert 'quickbooksRouter' in content
    assert 'import quickbooksRouter from' in content


# === R-P3-07: POST /api/quickbooks/sync-invoice ===

def test_r_p3_07_sync_invoice_route():
    """R-P3-07: POST /api/quickbooks/sync-invoice route exists."""
    content = _read_file('routes/quickbooks.ts')
    assert '/api/quickbooks/sync-invoice' in content
    assert 'qboInvoiceId' in content, 'Must return qboInvoiceId in response'


def test_r_p3_07_sync_invoice_error_handling():
    """R-P3-07 negative: sync-invoice must handle service failures gracefully."""
    content = _read_file('routes/quickbooks.ts')
    assert '502' in content, 'Must return 502 for service-level sync failures'
    assert 'catch' in content, 'Must have try/catch for error handling'


# === R-P3-08: All routes enforce requireAuth + requireTenant ===

def test_r_p3_08_auth_enforcement():
    """R-P3-08: All routes enforce requireAuth + requireTenant."""
    content = _read_file('routes/quickbooks.ts')
    assert 'requireAuth' in content
    assert 'requireTenant' in content
    # Count occurrences - should have 5 routes, each with both middleware
    assert content.count('requireAuth') >= 5, 'All 5 routes must have requireAuth'
    assert content.count('requireTenant') >= 5, 'All 5 routes must have requireTenant'


def test_r_p3_08_no_unprotected_routes():
    """R-P3-08 negative: no route handler should lack auth middleware."""
    content = _read_file('routes/quickbooks.ts')
    # Every router.get/post must be followed by requireAuth
    import re
    route_defs = re.findall(r'router\.(get|post)\(', content)
    auth_refs = content.count('requireAuth')
    assert auth_refs >= len(route_defs), (
        f'Found {len(route_defs)} route definitions but only {auth_refs} requireAuth references'
    )
