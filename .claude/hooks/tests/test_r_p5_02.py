# Tests R-P5-06, R-P5-07, R-P5-08
"""
QA traceability markers for S-502: Tier gates on premium routes.

R-P5-06: AI endpoints return 403 for Records Vault tier, 200 for Automation Pro
R-P5-07: Base CRUD endpoints (loads, quotes, invoices) accessible by Records Vault tier (regression)
R-P5-08: GPS tracking returns 403 for Records Vault and Automation Pro, 200 for Fleet Core+
"""
import subprocess
import json


def test_r_p5_06_ai_tier_gate_test_exists():
    """R-P5-06: Verify that AI tier gate tests exist in the test suite."""
    with open("server/__tests__/routes/tier-gates.test.ts", "r") as f:
        content = f.read()
    assert "R-P5-06" in content, "AI tier gate test must reference R-P5-06"
    assert "403" in content, "Test must check for 403 status"
    assert "Records Vault" in content, "Test must reference Records Vault tier"
    assert "Automation Pro" in content, "Test must reference Automation Pro tier"


def test_r_p5_07_base_crud_regression_test_exists():
    """R-P5-07: Verify that base CRUD regression tests exist."""
    with open("server/__tests__/routes/tier-gates.test.ts", "r") as f:
        content = f.read()
    assert "R-P5-07" in content, "Base CRUD regression test must reference R-P5-07"
    assert "/api/loads" in content, "Test must check /api/loads endpoint"


def test_r_p5_08_gps_tier_gate_test_exists():
    """R-P5-08: Verify that GPS tier gate tests exist."""
    with open("server/__tests__/routes/tier-gates.test.ts", "r") as f:
        content = f.read()
    assert "R-P5-08" in content, "GPS tier gate test must reference R-P5-08"
    assert "tracking" in content, "Test must check tracking endpoints"
    assert "Fleet Core" in content, "Test must reference Fleet Core tier"


def test_r_p5_06_ai_routes_have_require_tier():
    """R-P5-06: AI route file must import and use requireTier middleware."""
    with open("server/routes/ai.ts", "r") as f:
        content = f.read()
    assert "requireTier" in content, "ai.ts must use requireTier middleware"
    assert "Automation Pro" in content, "ai.ts must gate with Automation Pro tier"


def test_r_p5_08_tracking_routes_have_require_tier():
    """R-P5-08: Tracking route file must import and use requireTier middleware."""
    with open("server/routes/tracking.ts", "r") as f:
        content = f.read()
    assert "requireTier" in content, "tracking.ts must use requireTier middleware"
    assert "Fleet Core" in content, "tracking.ts must gate with Fleet Core tier"


def test_r_p5_07_loads_routes_no_require_tier():
    """R-P5-07: Loads route file must NOT use requireTier (base tier remains ungated)."""
    with open("server/routes/loads.ts", "r") as f:
        content = f.read()
    assert "requireTier" not in content, "loads.ts must NOT use requireTier — Records Vault base tier remains ungated"
