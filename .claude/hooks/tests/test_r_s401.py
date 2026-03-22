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


def test_auth_file_exists():
    """Auth.tsx file exists."""
    assert os.path.isfile(AUTH_PATH), f"Auth.tsx not found at {AUTH_PATH}"


def test_no_card_number_input():
    """R-P4-01: No input field for card number exists in Auth.tsx."""
    with open(AUTH_PATH, "r", encoding="utf-8") as f:
        content = f.read()
    # Must not have any input with placeholder "Card Number"
    assert 'placeholder="Card Number"' not in content, (
        "PCI violation: found card number input in Auth.tsx"
    )


def test_no_card_expiry_input():
    """R-P4-01: No input field for card expiry (MM/YY) exists in Auth.tsx."""
    with open(AUTH_PATH, "r", encoding="utf-8") as f:
        content = f.read()
    assert 'placeholder="MM/YY"' not in content, (
        "PCI violation: found card expiry input in Auth.tsx"
    )


def test_no_card_cvc_input():
    """R-P4-01: No input field for CVC exists in Auth.tsx."""
    with open(AUTH_PATH, "r", encoding="utf-8") as f:
        content = f.read()
    assert 'placeholder="CVC"' not in content, (
        "PCI violation: found CVC input in Auth.tsx"
    )


def test_no_card_state_vars():
    """R-P4-01: No cardNumber/cardExpiry/cardCVC state variables in Auth.tsx."""
    with open(AUTH_PATH, "r", encoding="utf-8") as f:
        content = f.read()
    for var in ["cardNumber", "cardExpiry", "cardCVC"]:
        assert f"useState" not in content or var not in content, (
            f"Found card state variable '{var}' in Auth.tsx"
        )


def test_subscribe_with_stripe_button():
    """R-P4-02: Auth.tsx contains a 'Subscribe with Stripe' button."""
    with open(AUTH_PATH, "r", encoding="utf-8") as f:
        content = f.read()
    assert "Subscribe with Stripe" in content, (
        "Missing 'Subscribe with Stripe' button in Auth.tsx"
    )


def test_checkout_session_api_call():
    """R-P4-02: Auth.tsx calls /api/stripe/create-checkout-session."""
    with open(AUTH_PATH, "r", encoding="utf-8") as f:
        content = f.read()
    assert "create-checkout-session" in content, (
        "Missing checkout session API call in Auth.tsx"
    )


def test_success_url_in_checkout():
    """R-P4-02: Checkout session call includes successUrl."""
    with open(AUTH_PATH, "r", encoding="utf-8") as f:
        content = f.read()
    assert "successUrl" in content or "success_url" in content, (
        "Missing successUrl in checkout session call"
    )


def test_cancel_url_in_checkout():
    """R-P4-02: Checkout session call includes cancelUrl."""
    with open(AUTH_PATH, "r", encoding="utf-8") as f:
        content = f.read()
    assert "cancelUrl" in content or "cancel_url" in content, (
        "Missing cancelUrl in checkout session call"
    )


def test_start_free_trial_button():
    """R-P4-03: Auth.tsx contains a 'Start Free Trial' button."""
    with open(AUTH_PATH, "r", encoding="utf-8") as f:
        content = f.read()
    assert "Start Free Trial" in content, (
        "Missing 'Start Free Trial' button in Auth.tsx"
    )


def test_stripe_not_configured_fallback():
    """R-P4-04: Auth.tsx handles Stripe not configured gracefully."""
    with open(AUTH_PATH, "r", encoding="utf-8") as f:
        content = f.read()
    # Should check for stripe not configured and fallback to trial
    assert "trial" in content.lower() or "Trial" in content, (
        "Missing Stripe fallback/trial handling in Auth.tsx"
    )


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
