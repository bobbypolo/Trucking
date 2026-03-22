# Tests R-P3-01, R-P3-02, R-P3-03, R-P3-04
# Covers: Stripe webhook + checkout routes (server/routes/stripe.ts)
"""
S-301: Add Stripe webhook + checkout routes.

R-P3-01: POST /api/stripe/create-checkout-session returns 200 with sessionId and url when Stripe configured
R-P3-02: POST /api/stripe/create-checkout-session returns 401 without auth token
R-P3-03: POST /api/stripe/webhook returns 200 on valid event, 400 on invalid signature
R-P3-04: Webhook endpoint accessible without auth token (public)
"""

import os
import re
import subprocess


SERVER_DIR = os.path.join(
    os.path.dirname(__file__), "..", "..", "..", "server"
)
ROUTE_PATH = os.path.join(SERVER_DIR, "routes", "stripe.ts")
INDEX_PATH = os.path.join(SERVER_DIR, "index.ts")
TEST_PATH = os.path.join(SERVER_DIR, "__tests__", "routes", "stripe.test.ts")


def test_stripe_route_file_exists():
    """R-P3-01: stripe route file exists."""
    assert os.path.isfile(ROUTE_PATH), (
        f"stripe.ts route not found at {ROUTE_PATH}"
    )


def test_checkout_session_endpoint_defined():
    """R-P3-01: create-checkout-session endpoint is defined in stripe route."""
    with open(ROUTE_PATH, "r", encoding="utf-8") as f:
        content = f.read()
    assert "/api/stripe/create-checkout-session" in content, (
        "create-checkout-session endpoint not found in stripe.ts"
    )


def test_checkout_session_has_require_auth():
    """R-P3-02: create-checkout-session uses requireAuth middleware."""
    with open(ROUTE_PATH, "r", encoding="utf-8") as f:
        content = f.read()
    # The route definition should include requireAuth
    assert "requireAuth" in content, (
        "requireAuth not used in stripe.ts checkout session route"
    )


def test_webhook_endpoint_defined():
    """R-P3-03: webhook endpoint is defined in stripe route."""
    with open(ROUTE_PATH, "r", encoding="utf-8") as f:
        content = f.read()
    assert "/api/stripe/webhook" in content, (
        "webhook endpoint not found in stripe.ts"
    )


def test_webhook_uses_raw_body():
    """R-P3-03: webhook uses express.raw() for signature verification."""
    with open(ROUTE_PATH, "r", encoding="utf-8") as f:
        content = f.read()
    assert "express.raw(" in content, (
        "express.raw() not used for webhook route in stripe.ts"
    )


def test_webhook_no_require_auth():
    """R-P3-04: webhook route does NOT use requireAuth middleware."""
    with open(ROUTE_PATH, "r", encoding="utf-8") as f:
        content = f.read()
    # Find the router.post("/api/stripe/webhook" ... line and its middleware args
    # We look for the actual router.post call, not comments
    match = re.search(
        r'router\.post\(\s*["\']\/api\/stripe\/webhook["\'].*?\)',
        content,
        re.DOTALL,
    )
    assert match is not None, (
        "router.post('/api/stripe/webhook'...) not found in stripe.ts"
    )
    webhook_registration = match.group(0)
    assert "requireAuth" not in webhook_registration, (
        "Webhook route should NOT use requireAuth (it must be public)"
    )


def test_stripe_registered_before_json_middleware():
    """R-P3-04: stripe routes registered BEFORE express.json() in index.ts."""
    with open(INDEX_PATH, "r", encoding="utf-8") as f:
        content = f.read()
    stripe_pos = content.find("stripeRouter")
    json_pos = content.find("app.use(express.json())")
    assert stripe_pos != -1, "stripeRouter not found in index.ts"
    assert json_pos != -1, "express.json() not found in index.ts"
    assert stripe_pos < json_pos, (
        "stripeRouter must be registered BEFORE express.json() in index.ts"
    )


def test_billing_portal_endpoint_defined():
    """R-P3-01: create-billing-portal endpoint is defined."""
    with open(ROUTE_PATH, "r", encoding="utf-8") as f:
        content = f.read()
    assert "/api/stripe/create-billing-portal" in content, (
        "create-billing-portal endpoint not found in stripe.ts"
    )


def test_vitest_stripe_tests_pass():
    """R-P3-01, R-P3-02, R-P3-03, R-P3-04: All vitest stripe route tests pass."""
    result = subprocess.run(
        "npx vitest run __tests__/routes/stripe.test.ts",
        shell=True,
        cwd=SERVER_DIR,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        timeout=60,
    )
    assert result.returncode == 0, (
        f"Vitest stripe route tests failed:\n{result.stdout}\n{result.stderr}"
    )


def test_stripe_test_file_has_r_markers():
    """Traceability: stripe test file contains R-P3 markers."""
    with open(TEST_PATH, "r", encoding="utf-8") as f:
        content = f.read()
    for marker in ["R-P3-01", "R-P3-02", "R-P3-03", "R-P3-04"]:
        assert marker in content, (
            f"R-marker {marker} not found in stripe.test.ts"
        )
