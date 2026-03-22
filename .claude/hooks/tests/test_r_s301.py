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


def _read_route():
    with open(ROUTE_PATH, "r", encoding="utf-8") as f:
        return f.read()


def _read_index():
    with open(INDEX_PATH, "r", encoding="utf-8") as f:
        return f.read()


def _read_test():
    with open(TEST_PATH, "r", encoding="utf-8") as f:
        return f.read()


# ---- Positive / behavioral tests ----

def test_stripe_route_file_exists_and_exports_router():
    """R-P3-01: stripe route file exists and exports a default router."""
    assert os.path.isfile(ROUTE_PATH), (
        f"stripe.ts route not found at {ROUTE_PATH}"
    )
    content = _read_route()
    assert "export default router" in content, (
        "stripe.ts must export default router"
    )
    assert content.count("router.post(") >= 3, (
        "stripe.ts must define at least 3 POST routes"
    )


def test_checkout_session_endpoint_defined():
    """R-P3-01: create-checkout-session endpoint is defined in stripe route."""
    content = _read_route()
    assert "/api/stripe/create-checkout-session" in content, (
        "create-checkout-session endpoint not found in stripe.ts"
    )


def test_checkout_session_returns_session_id_and_url():
    """R-P3-01: checkout session handler returns sessionId and url keys."""
    content = _read_route()
    assert "sessionId" in content, (
        "checkout session route must return sessionId"
    )
    assert '"url"' in content or "'url'" in content or "url:" in content, (
        "checkout session route must return url"
    )


def test_checkout_session_has_require_auth():
    """R-P3-02: create-checkout-session uses requireAuth middleware."""
    content = _read_route()
    # Find the checkout session router.post and check it has requireAuth
    checkout_match = re.search(
        r'router\.post\(\s*["\']\/api\/stripe\/create-checkout-session["\']'
        r'(.*?)\)',
        content,
        re.DOTALL,
    )
    assert checkout_match is not None, (
        "router.post for create-checkout-session not found"
    )
    assert "requireAuth" in checkout_match.group(1), (
        "create-checkout-session must use requireAuth middleware"
    )


def test_checkout_session_has_require_tenant():
    """R-P3-02: create-checkout-session uses requireTenant middleware."""
    content = _read_route()
    checkout_match = re.search(
        r'router\.post\(\s*["\']\/api\/stripe\/create-checkout-session["\']'
        r'(.*?)\)',
        content,
        re.DOTALL,
    )
    assert checkout_match is not None
    assert "requireTenant" in checkout_match.group(1), (
        "create-checkout-session must use requireTenant middleware"
    )


def test_webhook_endpoint_defined():
    """R-P3-03: webhook endpoint is defined in stripe route."""
    content = _read_route()
    assert "/api/stripe/webhook" in content, (
        "webhook endpoint not found in stripe.ts"
    )


def test_webhook_uses_raw_body():
    """R-P3-03: webhook uses express.raw() for signature verification."""
    content = _read_route()
    assert "express.raw(" in content, (
        "express.raw() not used for webhook route in stripe.ts"
    )


def test_webhook_checks_signature_header():
    """R-P3-03: webhook validates stripe-signature header."""
    content = _read_route()
    assert "stripe-signature" in content, (
        "webhook must check stripe-signature header"
    )


def test_webhook_returns_400_on_invalid():
    """R-P3-03: webhook returns 400 status on invalid signature."""
    content = _read_route()
    assert "400" in content, (
        "webhook handler must return 400 for invalid signatures"
    )


def test_webhook_route_is_public():
    """R-P3-04: webhook route does NOT use requireAuth middleware."""
    content = _read_route()
    webhook_match = re.search(
        r'router\.post\(\s*["\']\/api\/stripe\/webhook["\']'
        r'(.*?async)',
        content,
        re.DOTALL,
    )
    assert webhook_match is not None, (
        "router.post('/api/stripe/webhook'...) not found in stripe.ts"
    )
    middleware_args = webhook_match.group(1)
    assert "requireAuth" not in middleware_args, (
        "Webhook route must NOT use requireAuth (it must be public). "
        f"Found middleware: {middleware_args}"
    )
    assert "requireTenant" not in middleware_args, (
        "Webhook route must NOT use requireTenant (it must be public)"
    )


def test_stripe_registered_before_json_middleware():
    """R-P3-04: stripe routes registered BEFORE express.json() in index.ts."""
    content = _read_index()
    stripe_pos = content.find("stripeRouter")
    json_pos = content.find("app.use(express.json())")
    assert stripe_pos != -1, "stripeRouter not found in index.ts"
    assert json_pos != -1, "express.json() not found in index.ts"
    assert stripe_pos < json_pos, (
        "stripeRouter must be registered BEFORE express.json() in index.ts"
    )


def test_billing_portal_endpoint_defined():
    """R-P3-01: create-billing-portal endpoint is defined."""
    content = _read_route()
    assert "/api/stripe/create-billing-portal" in content, (
        "create-billing-portal endpoint not found in stripe.ts"
    )


# ---- Negative / error tests ----

def test_checkout_session_handles_stripe_not_configured():
    """R-P3-01 (negative): checkout session returns 503 when Stripe not configured."""
    content = _read_route()
    assert "503" in content, (
        "checkout session must return 503 when Stripe is not configured"
    )
    assert "Stripe not configured" in content, (
        "checkout session must return 'Stripe not configured' error message"
    )


def test_webhook_handles_missing_signature():
    """R-P3-03 (negative): webhook returns 400 when signature header is missing."""
    content = _read_route()
    assert "Missing stripe-signature" in content, (
        "webhook must handle missing stripe-signature header with clear error"
    )


def test_checkout_session_handles_invalid_tier():
    """R-P3-01 (negative): checkout session returns error for invalid tier."""
    content = _read_route()
    assert "invalid_tier" in content, (
        "checkout session must handle invalid_tier errors from service"
    )


def test_billing_portal_handles_missing_customer_id():
    """R-P3-01 (negative): billing portal returns 400 when customerId missing."""
    content = _read_route()
    assert "stripeCustomerId is required" in content, (
        "billing portal must validate stripeCustomerId is present"
    )


# ---- Integration / vitest tests ----

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
    content = _read_test()
    for marker in ["R-P3-01", "R-P3-02", "R-P3-03", "R-P3-04"]:
        assert marker in content, (
            f"R-marker {marker} not found in stripe.test.ts"
        )


def test_vitest_tests_cover_401_scenario():
    """R-P3-02 (negative): vitest tests verify 401 without auth."""
    content = _read_test()
    assert "401" in content, (
        "stripe.test.ts must test 401 unauthorized scenario"
    )
    assert "without auth" in content.lower() or "no auth" in content.lower(), (
        "stripe.test.ts must have test for no-auth scenario"
    )


def test_vitest_tests_cover_400_webhook():
    """R-P3-03 (negative): vitest tests verify 400 on bad webhook signature."""
    content = _read_test()
    assert "invalid" in content.lower() and "signature" in content.lower(), (
        "stripe.test.ts must test invalid webhook signature scenario"
    )
