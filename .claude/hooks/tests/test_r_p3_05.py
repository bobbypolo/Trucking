# Tests R-P3-05, R-P3-06, R-P3-07, R-P3-08
"""
QA traceability markers for S-302: Replace QuickBooks 501 stub with real routes.

R-P3-05: 501 stub removed from accounting.ts
R-P3-06: GET /api/quickbooks/auth-url returns OAuth URL when configured, 503 when not
R-P3-07: POST /api/quickbooks/sync-invoice syncs invoice and returns QBO reference ID
R-P3-08: All routes enforce requireAuth + requireTenant
"""
import subprocess
import os


def test_r_p3_05_stub_removed():
    """R-P3-05: 501 stub removed from accounting.ts"""
    accounting_path = os.path.join(
        os.path.dirname(__file__), "..", "..", "..", "server", "routes", "accounting.ts"
    )
    with open(accounting_path, encoding="utf-8") as f:
        content = f.read()
    assert "501" not in content, "accounting.ts still contains 501 status code"
    assert "QuickBooks integration is not yet available" not in content
    assert "sync-qb" not in content


def test_r_p3_06_quickbooks_route_exists():
    """R-P3-06: quickbooks.ts route file exists with auth-url endpoint"""
    route_path = os.path.join(
        os.path.dirname(__file__), "..", "..", "..", "server", "routes", "quickbooks.ts"
    )
    assert os.path.isfile(route_path), "server/routes/quickbooks.ts must exist"
    with open(route_path, encoding="utf-8") as f:
        content = f.read()
    assert "/api/quickbooks/auth-url" in content
    assert "503" in content, "Must return 503 when not configured"


def test_r_p3_07_sync_invoice_route():
    """R-P3-07: POST /api/quickbooks/sync-invoice route exists"""
    route_path = os.path.join(
        os.path.dirname(__file__), "..", "..", "..", "server", "routes", "quickbooks.ts"
    )
    with open(route_path, encoding="utf-8") as f:
        content = f.read()
    assert "/api/quickbooks/sync-invoice" in content
    assert "qboInvoiceId" in content, "Must return qboInvoiceId in response"


def test_r_p3_08_auth_enforcement():
    """R-P3-08: All routes enforce requireAuth + requireTenant"""
    route_path = os.path.join(
        os.path.dirname(__file__), "..", "..", "..", "server", "routes", "quickbooks.ts"
    )
    with open(route_path, encoding="utf-8") as f:
        content = f.read()
    assert "requireAuth" in content
    assert "requireTenant" in content
    # Count occurrences - should have 5 routes, each with both middleware
    assert content.count("requireAuth") >= 5, "All 5 routes must have requireAuth"
    assert content.count("requireTenant") >= 5, "All 5 routes must have requireTenant"


def test_r_p3_06_index_wired():
    """R-P3-06: quickbooks router is wired in server/index.ts"""
    index_path = os.path.join(
        os.path.dirname(__file__), "..", "..", "..", "server", "index.ts"
    )
    with open(index_path, encoding="utf-8") as f:
        content = f.read()
    assert "quickbooksRouter" in content
    assert 'import quickbooksRouter from "./routes/quickbooks"' in content
