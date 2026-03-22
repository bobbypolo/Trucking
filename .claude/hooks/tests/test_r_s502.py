# Tests R-P5-06, R-P5-07, R-P5-08
"""
QA traceability markers for S-502: Tier gates on premium routes.

R-P5-06: AI endpoints return 403 for Records Vault tier, 200 for Automation Pro
R-P5-07: Base CRUD endpoints (loads, quotes, invoices) accessible by Records Vault tier (regression)
R-P5-08: GPS tracking returns 403 for Records Vault and Automation Pro, 200 for Fleet Core+
"""


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
    assert "requireTier" not in content, (
        "loads.ts must NOT use requireTier -- Records Vault base tier remains ungated"
    )


# --- Negative / Edge case tests ---


def test_r_p5_06_ai_routes_require_tier_not_records_vault():
    """R-P5-06 (negative): AI routes must NOT allow Records Vault tier."""
    with open("server/routes/ai.ts", "r") as f:
        content = f.read()
    # requireTier calls should NOT include "Records Vault"
    # Find all requireTier(...) calls and check none include Records Vault
    import re
    tier_calls = re.findall(r'requireTier\([^)]+\)', content)
    assert len(tier_calls) > 0, "ai.ts must have requireTier calls"
    for call in tier_calls:
        assert "Records Vault" not in call, (
            f"AI route must NOT allow Records Vault: {call}"
        )


def test_r_p5_08_tracking_webhook_not_tier_gated():
    """R-P5-08 (edge): Webhook endpoint must NOT have requireTier (uses API key auth)."""
    with open("server/routes/tracking.ts", "r") as f:
        content = f.read()
    # The webhook handler should not use requireTier
    # Find the webhook route definition and check it doesn't have requireTier
    lines = content.split("\n")
    in_webhook = False
    for i, line in enumerate(lines):
        if 'router.post("/api/tracking/webhook"' in line:
            in_webhook = True
        if in_webhook and "requireTier" in line:
            assert False, (
                f"Webhook endpoint at line {i+1} must NOT use requireTier "
                "(webhooks use API key auth, not Firebase)"
            )
        if in_webhook and ");" in line and "router" not in line:
            break


def test_r_p5_08_tracking_routes_require_fleet_core():
    """R-P5-08 (negative): Tracking routes must require at least Fleet Core, not just any tier."""
    with open("server/routes/tracking.ts", "r") as f:
        content = f.read()
    import re
    tier_calls = re.findall(r'requireTier\([^)]+\)', content)
    for call in tier_calls:
        assert "Fleet Core" in call, (
            f"Tracking requireTier must include Fleet Core: {call}"
        )
        # Must NOT include Records Vault or Automation Pro
        assert "Records Vault" not in call, (
            f"Tracking must NOT allow Records Vault: {call}"
        )
        assert "Automation Pro" not in call, (
            f"Tracking must NOT allow Automation Pro: {call}"
        )
