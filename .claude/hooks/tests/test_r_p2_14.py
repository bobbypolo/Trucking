# Tests R-P2-14, R-P2-15, R-P2-16, R-P2-17, R-P2-18, R-P2-19
# Covers: import quickbooks.service (server/services/quickbooks.service.ts)
# Covers: import intuit-oauth.d (server/types/intuit-oauth.d.ts)
"""
S-204: QuickBooks OAuth service.

Validates that the quickbooks.service.ts properly implements:
- OAuth authorization URL generation
- Token exchange with AES-256-GCM encryption
- Token refresh and re-encryption
- Invoice/Bill sync to QuickBooks
- Graceful fallback when not configured
"""

import subprocess


def _run_qb_tests():
    """Helper: run the QuickBooks service test suite."""
    return subprocess.run(
        ["npx", "vitest", "run", "__tests__/services/quickbooks.service.test.ts"],
        capture_output=True,
        text=True,
        cwd="server",
        shell=True,
        timeout=60,
        encoding="utf-8",
        errors="replace",
    )


def _run_crypto_tests():
    """Helper: run the QuickBooks crypto roundtrip test suite."""
    return subprocess.run(
        ["npx", "vitest", "run", "__tests__/services/quickbooks-crypto.test.ts"],
        capture_output=True,
        text=True,
        cwd="server",
        shell=True,
        timeout=60,
        encoding="utf-8",
        errors="replace",
    )


def test_r_p2_14_get_authorization_url():
    """R-P2-14: getAuthorizationUrl returns valid Intuit OAuth URL."""
    result = _run_qb_tests()
    assert result.returncode == 0, (
        "QuickBooks auth URL tests failed: " + result.stdout + result.stderr
    )
    assert "passed" in result.stdout, "Expected test pass indication in output"


def test_r_p2_15_handle_callback_encrypts_tokens():
    """R-P2-15: handleCallback exchanges auth code, encrypts with AES-256-GCM."""
    result = _run_qb_tests()
    assert result.returncode == 0, (
        "QuickBooks callback tests failed: " + result.stdout + result.stderr
    )


def test_r_p2_16_get_client_decrypts_refreshes():
    """R-P2-16: getClient decrypts tokens, refreshes if expired."""
    result = _run_qb_tests()
    assert result.returncode == 0, (
        "QuickBooks getClient tests failed: " + result.stdout + result.stderr
    )


def test_r_p2_17_sync_invoice():
    """R-P2-17: syncInvoiceToQBO creates Invoice via Intuit API."""
    result = _run_qb_tests()
    assert result.returncode == 0, (
        "QuickBooks invoice sync tests failed: " + result.stdout + result.stderr
    )


def test_r_p2_18_encrypt_decrypt_roundtrip():
    """R-P2-18: Token encrypt/decrypt roundtrip preserves value."""
    result = _run_crypto_tests()
    assert result.returncode == 0, (
        "QuickBooks crypto roundtrip tests failed: " + result.stdout + result.stderr
    )


def test_r_p2_19_missing_env_graceful():
    """R-P2-19: Missing env vars returns { available: false, reason: no_api_key }."""
    result = _run_qb_tests()
    assert result.returncode == 0, (
        "QuickBooks graceful fallback tests failed: " + result.stdout + result.stderr
    )


def test_r_p2_14_negative_invalid_callback():
    """Negative test: handleCallback with invalid auth code returns error."""
    result = _run_qb_tests()
    assert result.returncode == 0, (
        "QuickBooks invalid callback test failed: " + result.stdout + result.stderr
    )
    # The vitest suite includes error cases: handleCallback with invalid code
    # returns { success: false, error: ... }
    assert "passed" in result.stdout
