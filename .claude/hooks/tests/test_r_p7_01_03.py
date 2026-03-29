"""Tests for S-7.1 Auth Lifecycle E2E spec — R-P7-01, R-P7-02, R-P7-03.

Validates that e2e/auth-lifecycle.spec.ts is structurally correct and contains
all required elements for the auth lifecycle E2E test.
"""

from pathlib import Path

# Story file coverage: import auth-lifecycle.spec (e2e/auth-lifecycle.spec.ts)
# Path to the spec file relative to the project root
SPEC_PATH = Path(__file__).resolve().parents[3] / "e2e" / "auth-lifecycle.spec.ts"


def _read_spec() -> str:
    """Read the auth-lifecycle spec file content."""
    assert SPEC_PATH.exists(), f"Spec file not found: {SPEC_PATH}"
    return SPEC_PATH.read_text(encoding="utf-8")


class TestRP701AuthLifecycleFlow:
    """Tests R-P7-01: login -> session token -> protected route -> token expiry -> SessionExpiredModal -> re-login."""

    def test_spec_file_exists(self) -> None:
        """# Tests R-P7-01 — spec file exists at e2e/auth-lifecycle.spec.ts"""
        assert SPEC_PATH.exists() is True, f"Expected spec file at {SPEC_PATH}"
        assert SPEC_PATH.name == "auth-lifecycle.spec.ts", (
            f"Expected filename auth-lifecycle.spec.ts, got {SPEC_PATH.name}"
        )
        content = _read_spec()
        assert "Auth Lifecycle E2E" in content, (
            "Spec file must contain 'Auth Lifecycle E2E' test suite name"
        )

    def test_login_step_present(self) -> None:
        """# Tests R-P7-01 — spec contains login step (email + password fill)"""
        content = _read_spec()
        assert "emailInput" in content or 'input[type="email"]' in content, (
            "Spec must contain email input selector for login step"
        )
        assert "passwordInput" in content or 'input[type="password"]' in content, (
            "Spec must contain password input selector for login step"
        )
        assert ".fill(" in content, "Spec must fill form fields during login"

    def test_session_token_verification(self) -> None:
        """# Tests R-P7-01 — spec verifies session token after login"""
        content = _read_spec()
        assert "idToken" in content, (
            "Spec must reference idToken for session verification"
        )
        # Verify token structure check (3 dot-separated segments)
        assert 'split(".")' in content or "split('.')" in content, (
            "Spec must validate token has 3 JWT segments"
        )

    def test_protected_route_navigation(self) -> None:
        """# Tests R-P7-01 — spec navigates to a protected route after login"""
        content = _read_spec()
        # Must navigate to the /dashboard protected route specifically
        assert 'page.goto("/dashboard")' in content, (
            "Spec must navigate to /dashboard as the protected route"
        )
        # Must verify URL after navigation
        assert "page.url()" in content, (
            "Spec must check page.url() after protected route navigation"
        )

    def test_token_expiry_forced(self) -> None:
        """# Tests R-P7-01 — spec forces token expiry via auth:session-expired event"""
        content = _read_spec()
        assert "auth:session-expired" in content, (
            "Spec must dispatch auth:session-expired CustomEvent to force token expiry"
        )
        assert "CustomEvent" in content, (
            "Spec must use CustomEvent to dispatch session-expired"
        )

    def test_session_expired_modal_appears(self) -> None:
        """# Tests R-P7-01 — spec verifies SessionExpiredModal is visible after expiry"""
        content = _read_spec()
        assert "alertdialog" in content, (
            "Spec must check for role='alertdialog' (SessionExpiredModal)"
        )
        assert "session-expired-title" in content, (
            "Spec must reference session-expired-title element"
        )
        assert "toBeVisible" in content, (
            "Spec must assert modal is visible with toBeVisible()"
        )

    def test_relogin_succeeds(self) -> None:
        """# Tests R-P7-01 — spec performs re-login after SessionExpiredModal"""
        content = _read_spec()
        # Must click Sign In button in modal
        assert "Sign In" in content, "Spec must reference 'Sign In' button in modal"
        # Must fill login form again for re-login
        login_fill_count = content.count(".fill(")
        assert login_fill_count >= 4, (
            f"Spec must fill login form at least twice (login + re-login), "
            f"found {login_fill_count} .fill() calls (expected >= 4)"
        )

    def test_full_lifecycle_test_name(self) -> None:
        """# Tests R-P7-01 — spec has a test covering the full lifecycle flow"""
        content = _read_spec()
        assert "login" in content.lower() and "session" in content.lower(), (
            "Spec must have a test name mentioning login and session"
        )
        assert "expiry" in content.lower() or "expired" in content.lower(), (
            "Spec must have a test mentioning token expiry"
        )
        assert (
            "re-login" in content.lower()
            or "relogin" in content.lower()
            or "re_login" in content.lower()
        ), "Spec must reference re-login flow"


class TestRP702FirebaseEmulator:
    """Tests R-P7-02: Test runs against Firebase Auth Emulator (required)."""

    def test_emulator_host_env_var_referenced(self) -> None:
        """# Tests R-P7-02 — spec references FIREBASE_AUTH_EMULATOR_HOST env var"""
        content = _read_spec()
        assert "FIREBASE_AUTH_EMULATOR_HOST" in content, (
            "Spec must reference FIREBASE_AUTH_EMULATOR_HOST environment variable"
        )

    def test_emulator_rest_api_urls(self) -> None:
        """# Tests R-P7-02 — spec uses Firebase Auth Emulator REST API endpoints"""
        content = _read_spec()
        assert "identitytoolkit.googleapis.com" in content, (
            "Spec must use identitytoolkit.googleapis.com for emulator REST API"
        )
        assert "signUp" in content or "signInWithPassword" in content, (
            "Spec must use signUp or signInWithPassword emulator endpoints"
        )

    def test_emulator_signup_user_creation(self) -> None:
        """# Tests R-P7-02 — spec creates test users via emulator REST API"""
        content = _read_spec()
        assert "createEmulatorUser" in content or "EMULATOR_SIGNUP_URL" in content, (
            "Spec must have helper to create users in the emulator"
        )
        assert "returnSecureToken" in content, (
            "Spec must pass returnSecureToken: true to emulator API"
        )

    def test_emulator_signin_function(self) -> None:
        """# Tests R-P7-02 — spec signs in users via emulator REST API"""
        content = _read_spec()
        assert "signInEmulatorUser" in content or "EMULATOR_SIGNIN_URL" in content, (
            "Spec must have helper to sign in users via emulator"
        )

    def test_emulator_skip_when_unavailable(self) -> None:
        """# Tests R-P7-02 — spec skips gracefully when emulator is not running"""
        content = _read_spec()
        assert "isEmulatorRunning" in content, (
            "Spec must check if emulator is running before executing"
        )
        assert "test.skip" in content, (
            "Spec must use test.skip when emulator is not available"
        )

    def test_emulator_configuration_test_present(self) -> None:
        """# Tests R-P7-02 — spec has a dedicated test for emulator configuration"""
        content = _read_spec()
        assert "Firebase Auth Emulator configuration" in content, (
            "Spec must have a test validating emulator configuration"
        )


class TestRP703ConsoleErrorListener:
    """Tests R-P7-03: Test fails if any step produces a console error."""

    def test_console_error_listener_present(self) -> None:
        """# Tests R-P7-03 — spec has console.error listener attached to page"""
        content = _read_spec()
        assert "ConsoleErrorCollector" in content or "console" in content, (
            "Spec must have a console error collection mechanism"
        )
        assert 'msg.type() === "error"' in content or "console.error" in content, (
            "Spec must filter for error-type console messages"
        )

    def test_console_error_assertion(self) -> None:
        """# Tests R-P7-03 — spec asserts no console errors at end of lifecycle test"""
        content = _read_spec()
        assert "assertNoErrors" in content, (
            "Spec must call assertNoErrors() to verify no console errors occurred"
        )

    def test_console_error_collector_class(self) -> None:
        """# Tests R-P7-03 — spec has a ConsoleErrorCollector class"""
        content = _read_spec()
        assert "class ConsoleErrorCollector" in content, (
            "Spec must define a ConsoleErrorCollector class for structured error collection"
        )
        assert (
            "errors:" in content
            or "errors =" in content
            or "readonly errors" in content
        ), "ConsoleErrorCollector must have an errors array"

    def test_console_error_test_present(self) -> None:
        """# Tests R-P7-03 — spec has a test verifying the console error mechanism works"""
        content = _read_spec()
        assert "DELIBERATE_TEST_ERROR" in content, (
            "Spec must have a test that injects a deliberate console.error to verify the collector"
        )
        assert "threwError" in content or "assertNoErrors" in content, (
            "Spec must verify that assertNoErrors() throws when errors are present"
        )

    def test_r_p7_03_reference_in_error_message(self) -> None:
        """# Tests R-P7-03 — console error assertion references R-P7-03"""
        content = _read_spec()
        assert "R-P7-03" in content, (
            "Console error messages must reference R-P7-03 for traceability"
        )
