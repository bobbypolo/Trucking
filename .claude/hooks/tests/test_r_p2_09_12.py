"""Source verification tests for S-2.2: Remove all read fallbacks in authService.ts.

Tests R-P2-09: getCompany() throws on API failure (no cache fallback)
Tests R-P2-10: getCompanyUsers() throws on API failure (no cache fallback)
Tests R-P2-11: Session hydration failure sets user to null (no silent cache lookup)
Tests R-P2-12: Session hydration failure emits event so UI can show re-login prompt
"""

import re
from pathlib import Path

# Resolve the project root (4 levels up from .claude/hooks/tests/)
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent.parent
AUTH_SERVICE = PROJECT_ROOT / "services" / "authService.ts"


def _read_auth_service() -> str:
    """Read the authService.ts source file."""
    assert AUTH_SERVICE.exists(), f"authService.ts not found at {AUTH_SERVICE}"
    return AUTH_SERVICE.read_text(encoding="utf-8")


def test_get_company_no_cache_fallback():
    """# Tests R-P2-09
    getCompany() must NOT fall back to getStoredCompanies() on API failure.
    The function should propagate the error (no try/catch swallowing).
    """
    source = _read_auth_service()

    # Find the getCompany function body
    match = re.search(
        r"export\s+const\s+getCompany\s*=\s*async\s*\([^)]*\)[^{]*\{(.*?)\n\};",
        source,
        re.DOTALL,
    )
    assert match is not None, "getCompany function not found in authService.ts"
    body = match.group(1)

    # Must NOT contain getStoredCompanies fallback
    assert "getStoredCompanies" not in body, (
        "getCompany still references getStoredCompanies — cache fallback not removed"
    )

    # Must NOT contain a try/catch that swallows errors
    assert "console.warn" not in body, (
        "getCompany still has console.warn — error is being swallowed"
    )


def test_get_company_users_no_cache_fallback():
    """# Tests R-P2-10
    getCompanyUsers() must NOT fall back to getStoredUsers() on API failure.
    The function should propagate the error (no try/catch swallowing).
    """
    source = _read_auth_service()

    # Find the getCompanyUsers function body
    match = re.search(
        r"export\s+const\s+getCompanyUsers\s*=\s*async\s*\([^)]*\)[^{]*\{(.*?)\n\};",
        source,
        re.DOTALL,
    )
    assert match is not None, "getCompanyUsers function not found in authService.ts"
    body = match.group(1)

    # Must NOT contain getStoredUsers fallback
    assert "getStoredUsers" not in body, (
        "getCompanyUsers still references getStoredUsers — cache fallback not removed"
    )

    # Must NOT contain a try/catch that swallows errors
    assert "console.warn" not in body, (
        "getCompanyUsers still has console.warn — error is being swallowed"
    )


def test_session_hydration_sets_user_null():
    """# Tests R-P2-11
    Session hydration failure must set user to null (no silent cache lookup).
    The onAuthStateChanged handler's catch block must NOT call getStoredUsers().
    """
    source = _read_auth_service()

    # Find the onAuthStateChanged handler
    match = re.search(
        r"onAuthStateChanged\s*\(\s*auth\s*,\s*async\s*\(\s*fbUser\s*\)\s*=>\s*\{(.*?)\n\s*\}\s*\)\s*;",
        source,
        re.DOTALL,
    )
    assert match is not None, "onAuthStateChanged handler not found in authService.ts"
    handler_body = match.group(1)

    # The catch block should set _sessionCache = null
    assert "_sessionCache = null" in handler_body, (
        "Session hydration catch block does not set _sessionCache to null"
    )

    # Must NOT fall back to getStoredUsers() for session resolution
    # Check that the old pattern (getStoredUsers().find) is gone
    assert "getStoredUsers()" not in handler_body, (
        "onAuthStateChanged handler still calls getStoredUsers() — silent cache lookup not removed"
    )


def test_session_hydration_emits_event():
    """# Tests R-P2-12
    Session hydration failure must emit an 'auth:session-failed' CustomEvent
    so the UI can show a re-login prompt.
    """
    source = _read_auth_service()

    # Find the onAuthStateChanged handler
    match = re.search(
        r"onAuthStateChanged\s*\(\s*auth\s*,\s*async\s*\(\s*fbUser\s*\)\s*=>\s*\{(.*?)\n\s*\}\s*\)\s*;",
        source,
        re.DOTALL,
    )
    assert match is not None, "onAuthStateChanged handler not found in authService.ts"
    handler_body = match.group(1)

    # Must dispatch auth:session-failed CustomEvent
    assert "auth:session-failed" in handler_body, (
        "onAuthStateChanged handler does not emit 'auth:session-failed' event"
    )
    assert "CustomEvent" in handler_body, (
        "onAuthStateChanged handler does not use CustomEvent for session failure"
    )
    assert "dispatchEvent" in handler_body, (
        "onAuthStateChanged handler does not call dispatchEvent"
    )
