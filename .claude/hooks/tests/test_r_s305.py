# Tests R-P3-15, R-P3-16
"""
S-305: Verify .env.example contains all integration env vars with proper documentation.
"""

import os
import re
import pytest

ENV_EXAMPLE_PATH = os.path.join(
    os.path.dirname(__file__), "..", "..", "..", ".env.example"
)


@pytest.fixture
def env_content():
    with open(ENV_EXAMPLE_PATH, "r", encoding="utf-8") as f:
        return f.read()


# --- R-P3-15: All integration env vars documented with descriptions and required/optional status ---


class TestEnvVarsDocumented:
    """R-P3-15: All integration env vars documented with descriptions and required/optional status."""

    def test_stripe_secret_key_present(self, env_content):
        assert "STRIPE_SECRET_KEY" in env_content

    def test_stripe_webhook_secret_present(self, env_content):
        assert "STRIPE_WEBHOOK_SECRET" in env_content

    def test_stripe_price_records_vault_present(self, env_content):
        assert "STRIPE_PRICE_RECORDS_VAULT" in env_content

    def test_stripe_price_automation_pro_present(self, env_content):
        assert "STRIPE_PRICE_AUTOMATION_PRO" in env_content

    def test_stripe_price_fleet_core_present(self, env_content):
        assert "STRIPE_PRICE_FLEET_CORE" in env_content

    def test_stripe_price_fleet_command_present(self, env_content):
        assert "STRIPE_PRICE_FLEET_COMMAND" in env_content

    def test_twilio_account_sid_present(self, env_content):
        assert "TWILIO_ACCOUNT_SID" in env_content

    def test_twilio_auth_token_present(self, env_content):
        assert "TWILIO_AUTH_TOKEN" in env_content

    def test_twilio_from_number_present(self, env_content):
        assert "TWILIO_FROM_NUMBER" in env_content

    def test_quickbooks_client_id_present(self, env_content):
        assert "QUICKBOOKS_CLIENT_ID" in env_content

    def test_quickbooks_client_secret_present(self, env_content):
        assert "QUICKBOOKS_CLIENT_SECRET" in env_content

    def test_quickbooks_redirect_uri_present(self, env_content):
        assert "QUICKBOOKS_REDIRECT_URI" in env_content

    def test_quickbooks_environment_present(self, env_content):
        assert "QUICKBOOKS_ENVIRONMENT" in env_content

    def test_quickbooks_token_encryption_key_present(self, env_content):
        assert "QUICKBOOKS_TOKEN_ENCRYPTION_KEY" in env_content

    def test_gps_provider_present(self, env_content):
        assert "GPS_PROVIDER" in env_content

    def test_gps_webhook_secret_present(self, env_content):
        assert "GPS_WEBHOOK_SECRET" in env_content

    def test_samsara_api_token_present(self, env_content):
        assert "SAMSARA_API_TOKEN" in env_content

    def test_weather_enabled_removed(self, env_content):
        """WEATHER_ENABLED should be removed from .env.example."""
        assert "WEATHER_ENABLED" not in env_content

    def test_stripe_section_header_present(self, env_content):
        assert "Stripe" in env_content

    def test_twilio_section_header_present(self, env_content):
        assert "Twilio" in env_content

    def test_quickbooks_section_header_present(self, env_content):
        assert "QuickBooks" in env_content

    def test_gps_section_header_present(self, env_content):
        assert "GPS" in env_content

    def test_required_optional_markers_present(self, env_content):
        """Each section should use [REQUIRED] or [OPTIONAL] markers."""
        assert "[REQUIRED" in env_content or "[OPTIONAL" in env_content

    def test_all_vars_have_description_comments(self, env_content):
        """Every env var assignment should be preceded by a comment line."""
        lines = env_content.split("\n")
        var_lines = []
        for i, line in enumerate(lines):
            stripped = line.strip()
            # Match var assignments (not commented out)
            if (
                stripped
                and not stripped.startswith("#")
                and "=" in stripped
                and not stripped.startswith("//")
            ):
                var_name = stripped.split("=")[0].strip()
                if var_name and var_name.isupper():
                    var_lines.append((i, var_name))

        # Each var should have a comment somewhere above it (within 10 lines)
        # or be part of a group where the first var has a comment
        for line_idx, var_name in var_lines:
            has_comment = False
            for j in range(max(0, line_idx - 10), line_idx):
                if lines[j].strip().startswith("#"):
                    has_comment = True
                    break
            assert has_comment, (
                f"Variable {var_name} at line {line_idx + 1} has no description comment above it"
            )


# --- R-P3-16: No real API keys or secrets in the file ---


class TestNoRealSecrets:
    """R-P3-16: No real API keys or secrets in the file."""

    def test_no_stripe_live_keys(self, env_content):
        """No live Stripe keys as actual values (sk_live_, pk_live_, whsec_live_)."""
        lines = env_content.split("\n")
        for line in lines:
            stripped = line.strip()
            # Skip comment lines -- they may mention key prefixes as documentation
            if stripped.startswith("#"):
                continue
            assert "sk_live_" not in stripped, (
                f"Live Stripe secret key found: {stripped}"
            )
            assert "pk_live_" not in stripped, (
                f"Live Stripe public key found: {stripped}"
            )
            assert "whsec_live_" not in stripped, (
                f"Live Stripe webhook secret found: {stripped}"
            )

    def test_no_stripe_test_keys(self, env_content):
        """No actual Stripe test keys (sk_test_ with real chars)."""
        # Real test keys have 24+ random chars after prefix
        matches = re.findall(r"sk_test_[A-Za-z0-9]{20,}", env_content)
        assert len(matches) == 0, f"Found potential real Stripe test key: {matches}"

    def test_no_twilio_real_sids(self, env_content):
        """No real Twilio Account SIDs (AC followed by 32 hex chars)."""
        matches = re.findall(r"AC[0-9a-f]{32}", env_content)
        assert len(matches) == 0, f"Found potential real Twilio SID: {matches}"

    def test_no_long_random_tokens(self, env_content):
        """Values should be placeholder-style, not long random strings."""
        lines = env_content.split("\n")
        for line in lines:
            stripped = line.strip()
            if stripped.startswith("#") or "=" not in stripped:
                continue
            _, _, value = stripped.partition("=")
            value = value.strip()
            # Skip known safe patterns (ports, hostnames, email addresses, URLs)
            if any(
                safe in value.lower()
                for safe in [
                    "localhost",
                    "your_",
                    "here",
                    "example",
                    "ethereal",
                    "loadpilot",
                    "noreply",
                    "firebaseapp",
                    "appspot",
                    "http",
                    "smtp",
                    "development",
                    "sandbox",
                    "0.0.0",
                    "127.0.0",
                    "false",
                    "true",
                    "info",
                    "samsara",
                ]
            ):
                continue
            # Skip numeric-only values (ports, etc.)
            if value.isdigit():
                continue
            # Flag values that look like real secrets (40+ random chars)
            if len(value) > 40 and re.match(r"^[A-Za-z0-9+/=_-]+$", value):
                pytest.fail(f"Potential real secret found: {stripped[:50]}...")

    def test_placeholder_values_used(self, env_content):
        """New integration vars should use placeholder values like 'your_xxx_here'."""
        # Check that Stripe, Twilio, QuickBooks, GPS vars have placeholder values
        lines = env_content.split("\n")
        integration_vars = [
            "STRIPE_SECRET_KEY",
            "STRIPE_WEBHOOK_SECRET",
            "TWILIO_ACCOUNT_SID",
            "TWILIO_AUTH_TOKEN",
            "TWILIO_FROM_NUMBER",
            "QUICKBOOKS_CLIENT_ID",
            "QUICKBOOKS_CLIENT_SECRET",
            "QUICKBOOKS_TOKEN_ENCRYPTION_KEY",
            "SAMSARA_API_TOKEN",
            "GPS_WEBHOOK_SECRET",
        ]
        for line in lines:
            stripped = line.strip()
            if stripped.startswith("#"):
                continue
            for var in integration_vars:
                if stripped.startswith(var + "="):
                    value = stripped.split("=", 1)[1].strip()
                    # Value should be a placeholder, not empty or a real key
                    assert value, f"{var} should have a placeholder value, not be empty"
                    assert any(
                        p in value.lower()
                        for p in ["your_", "here", "example", "placeholder", "+1555"]
                    ), f"{var} value '{value}' doesn't look like a placeholder"
