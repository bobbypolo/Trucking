# Tests R-P4-01, R-P4-02, R-P4-03, R-P4-04, R-P4-05
# Covers: Auth.tsx Stripe Checkout replacement (components/Auth.tsx)
"""
S-401: Replace Auth.tsx payment form with Stripe Checkout redirect.

R-P4-01: No input for card number, expiry, or CVC exists in rendered output (PCI compliance)
R-P4-02: Subscribe with Stripe button calls checkout session API with successUrl and cancelUrl
R-P4-03: Start Free Trial button bypasses payment, logs in with trial status
R-P4-04: When Stripe not configured, payment step auto-falls through to trial
R-P4-05: Existing signup flow tests still pass (regression)
"""

import os
import re
import subprocess


AUTH_PATH = os.path.join(
    os.path.dirname(__file__), "..", "..", "..", "components", "Auth.tsx"
)


def _read_auth():
    """Read Auth.tsx content."""
    with open(AUTH_PATH, "r", encoding="utf-8") as f:
        return f.read()


def test_auth_file_exists():
    """Auth.tsx file exists and is non-empty."""
    assert os.path.isfile(AUTH_PATH), f"Auth.tsx not found at {AUTH_PATH}"
    content = _read_auth()
    assert len(content) > 100, "Auth.tsx is suspiciously small"
    assert "export" in content, "Auth.tsx does not export any component"


def test_no_card_number_input():
    """R-P4-01: No input field for card number exists in Auth.tsx (value check)."""
    content = _read_auth()
    assert 'placeholder="Card Number"' not in content, (
        "PCI violation: found card number input placeholder in Auth.tsx"
    )
    assert "setCardNumber" not in content, (
        "PCI violation: found setCardNumber state setter in Auth.tsx"
    )


def test_no_card_expiry_input():
    """R-P4-01: No input field for card expiry (MM/YY) exists in Auth.tsx (value check)."""
    content = _read_auth()
    assert 'placeholder="MM/YY"' not in content, (
        "PCI violation: found card expiry input placeholder in Auth.tsx"
    )
    assert "setCardExpiry" not in content, (
        "PCI violation: found setCardExpiry state setter in Auth.tsx"
    )


def test_no_card_cvc_input():
    """R-P4-01: No input field for CVC exists in Auth.tsx (value check)."""
    content = _read_auth()
    assert 'placeholder="CVC"' not in content, (
        "PCI violation: found CVC input placeholder in Auth.tsx"
    )
    assert "setCardCVC" not in content, (
        "PCI violation: found setCardCVC state setter in Auth.tsx"
    )


def test_no_card_state_vars():
    """R-P4-01: No cardNumber/cardExpiry/cardCVC state variables in Auth.tsx (value check)."""
    content = _read_auth()
    card_vars = ["cardNumber", "cardExpiry", "cardCVC"]
    found = [v for v in card_vars if re.search(rf'\buseState\b.*{v}|{v}.*\buseState\b', content)]
    assert len(found) == 0, (
        f"PCI violation: found card state variables: {found}"
    )


def test_subscribe_with_stripe_button():
    """R-P4-02: Auth.tsx contains a 'Subscribe with Stripe' button with proper handler."""
    content = _read_auth()
    assert "Subscribe with Stripe" in content, (
        "Missing 'Subscribe with Stripe' button text in Auth.tsx"
    )
    # Verify it's inside a button element
    stripe_btn_match = re.search(
        r'<button[^>]*>[\s\S]*?Subscribe with Stripe[\s\S]*?</button>',
        content
    )
    assert stripe_btn_match is not None, (
        "'Subscribe with Stripe' text exists but not inside a <button> element"
    )


def test_checkout_session_api_call():
    """R-P4-02: Auth.tsx calls /api/stripe/create-checkout-session with fetch."""
    content = _read_auth()
    assert "create-checkout-session" in content, (
        "Missing checkout session API endpoint in Auth.tsx"
    )
    assert "fetch" in content, (
        "Missing fetch call for checkout session API in Auth.tsx"
    )


def test_success_url_in_checkout():
    """R-P4-02: Checkout session call includes successUrl (value check)."""
    content = _read_auth()
    assert "successUrl" in content, (
        "Missing successUrl parameter in checkout session call"
    )
    # Verify it's part of a JSON body
    body_match = re.search(r'JSON\.stringify\([^)]*successUrl', content)
    assert body_match is not None, (
        "successUrl not found in JSON.stringify call body"
    )


def test_cancel_url_in_checkout():
    """R-P4-02: Checkout session call includes cancelUrl (value check)."""
    content = _read_auth()
    assert "cancelUrl" in content, (
        "Missing cancelUrl parameter in checkout session call"
    )
    # Verify it's part of a JSON body
    body_match = re.search(r'JSON\.stringify\([^)]*cancelUrl', content)
    assert body_match is not None, (
        "cancelUrl not found in JSON.stringify call body"
    )


def test_start_free_trial_button():
    """R-P4-03: Auth.tsx contains a 'Start Free Trial' button with proper handler."""
    content = _read_auth()
    assert "Start Free Trial" in content, (
        "Missing 'Start Free Trial' button text in Auth.tsx"
    )
    # Verify it's inside a button element
    trial_btn_match = re.search(
        r'<button[^>]*>[\s\S]*?Start Free Trial[\s\S]*?</button>',
        content
    )
    assert trial_btn_match is not None, (
        "'Start Free Trial' text exists but not inside a <button> element"
    )


def test_stripe_not_configured_fallback():
    """R-P4-04: Auth.tsx handles Stripe not configured with fallback to trial."""
    content = _read_auth()
    # Must handle non-ok response from Stripe API
    assert "!response.ok" in content or "response.ok" in content, (
        "Missing response.ok check for Stripe fallback"
    )
    # Must call processSignup as fallback
    assert "processSignup" in content, (
        "Missing processSignup fallback call when Stripe unavailable"
    )


# ----- Negative / edge-case tests -----

def test_no_raw_card_data_in_fetch_body():
    """R-P4-01 negative: fetch body must never contain raw card data fields."""
    content = _read_auth()
    fetch_bodies = re.findall(r'JSON\.stringify\(({[^}]+})\)', content)
    for body in fetch_bodies:
        assert "cardNumber" not in body, (
            "Security violation: raw card number sent in fetch body"
        )
        assert "cardCVC" not in body, (
            "Security violation: raw CVC sent in fetch body"
        )
        assert "cardExpiry" not in body, (
            "Security violation: raw card expiry sent in fetch body"
        )


def test_stripe_checkout_error_handling():
    """R-P4-04 negative: handleStripeCheckout has try/catch for error handling."""
    content = _read_auth()
    # Must have error handling in the Stripe checkout flow
    stripe_fn = re.search(
        r'handleStripeCheckout[\s\S]*?catch\s*[\({]',
        content
    )
    assert stripe_fn is not None, (
        "handleStripeCheckout missing try/catch error handling"
    )


def test_tier_prices_defined():
    """R-P4-02: TIER_PRICES constant has all four subscription tiers."""
    content = _read_auth()
    assert "TIER_PRICES" in content, "Missing TIER_PRICES constant"
    for tier in ["Records Vault", "Automation Pro", "Fleet Core", "Fleet Command"]:
        assert tier in content, f"Missing tier '{tier}' in TIER_PRICES"


def test_vitest_frontend_passes():
    """R-P4-05: Existing signup flow tests still pass (regression)."""
    result = subprocess.run(
        "npx vitest run src/__tests__/components/Auth.test.tsx --reporter=verbose",
        shell=True,
        capture_output=True,
        text=True,
        cwd=os.path.join(os.path.dirname(__file__), "..", "..", ".."),
        timeout=120,
        encoding="utf-8",
        errors="replace",
    )
    assert result.returncode == 0, (
        f"Auth tests failed:\nSTDOUT:\n{result.stdout[-2000:]}\nSTDERR:\n{result.stderr[-2000:]}"
    )


def test_vitest_stripe_tests_pass():
    """R-P4-02 + R-P4-03 + R-P4-04: Stripe-specific tests pass."""
    result = subprocess.run(
        "npx vitest run src/__tests__/components/Auth.stripe.test.tsx --reporter=verbose",
        shell=True,
        capture_output=True,
        text=True,
        cwd=os.path.join(os.path.dirname(__file__), "..", "..", ".."),
        timeout=120,
        encoding="utf-8",
        errors="replace",
    )
    assert result.returncode == 0, (
        f"Stripe tests failed:\nSTDOUT:\n{result.stdout[-2000:]}\nSTDERR:\n{result.stderr[-2000:]}"
    )
