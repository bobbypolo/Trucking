"""Source verification tests for S-2.2: Remove all read fallbacks in authService.ts.

Tests R-P2-09: getCompany() throws on API failure (no cache fallback)
Tests R-P2-10: getCompanyUsers() throws on API failure (no cache fallback)
Tests R-P2-11: Session hydration failure sets user to null (no silent cache lookup)
Tests R-P2-12: Session hydration failure emits event so UI can show re-login prompt

Covers: services/authService.ts (source verification via grep)
"""

import re
from pathlib import Path

# Story coverage sentinel — maps this test file to the production module.
# from authService (TypeScript source verified by grep-based pattern matching)
_COVERS_MODULE = "authService"

# Resolve the project root (4 levels up from .claude/hooks/tests/)
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent.parent
AUTH_SERVICE = PROJECT_ROOT / "services" / "authService.ts"


def _read_auth_service() -> str:
    """Read the authService.ts source file."""
    assert AUTH_SERVICE.exists(), f"authService.ts not found at {AUTH_SERVICE}"
    return AUTH_SERVICE.read_text(encoding="utf-8")


def _extract_function(source: str, name: str) -> str:
    """Extract a named exported const function body from source."""
    pattern = (
        rf"export\s+const\s+{re.escape(name)}\s*=\s*async\s*\([^)]*\)[^{{]*\{{(.*?)\n\}};"
    )
    match = re.search(pattern, source, re.DOTALL)
    assert match is not None, f"{name} function not found in authService.ts"
    return match.group(1)


def _extract_on_auth_handler(source: str) -> str:
    """Extract the onAuthStateChanged handler body."""
    pattern = r"onAuthStateChanged\s*\(\s*auth\s*,\s*async\s*\(\s*fbUser\s*\)\s*=>\s*\{(.*?)\n\s*\}\s*\)\s*;"
    match = re.search(pattern, source, re.DOTALL)
    assert match is not None, "onAuthStateChanged handler not found in authService.ts"
    return match.group(1)


# ── R-P2-09: getCompany no fallback ──────────────────────────────


def test_get_company_no_stored_companies_reference():
    """# Tests R-P2-09
    getCompany() must NOT reference getStoredCompanies() at all.
    """
    body = _extract_function(_read_auth_service(), "getCompany")
    occurrences = body.count("getStoredCompanies")
    assert occurrences == 0, (
        f"getCompany references getStoredCompanies {occurrences} times — cache fallback not removed"
    )


def test_get_company_no_error_swallowing():
    """# Tests R-P2-09
    getCompany() must NOT swallow errors with console.warn.
    """
    body = _extract_function(_read_auth_service(), "getCompany")
    warn_count = body.count("console.warn")
    assert warn_count == 0, (
        f"getCompany has {warn_count} console.warn calls — error is being swallowed"
    )


def test_get_company_no_try_catch():
    """# Tests R-P2-09
    getCompany() must NOT have a try/catch that swallows errors.
    Error-path: verifies absence of fallback pattern.
    """
    body = _extract_function(_read_auth_service(), "getCompany")
    # Count try blocks — the function should have zero
    try_count = len(re.findall(r"\btry\b", body))
    assert try_count == 0, (
        f"getCompany has {try_count} try blocks — should propagate errors directly"
    )


# ── R-P2-10: getCompanyUsers no fallback ─────────────────────────


def test_get_company_users_no_stored_users_reference():
    """# Tests R-P2-10
    getCompanyUsers() must NOT reference getStoredUsers() at all.
    """
    body = _extract_function(_read_auth_service(), "getCompanyUsers")
    occurrences = body.count("getStoredUsers")
    assert occurrences == 0, (
        f"getCompanyUsers references getStoredUsers {occurrences} times — cache fallback not removed"
    )


def test_get_company_users_no_error_swallowing():
    """# Tests R-P2-10
    getCompanyUsers() must NOT swallow errors with console.warn.
    Error-path: verifies absence of warning log.
    """
    body = _extract_function(_read_auth_service(), "getCompanyUsers")
    warn_count = body.count("console.warn")
    assert warn_count == 0, (
        f"getCompanyUsers has {warn_count} console.warn calls — error is being swallowed"
    )


def test_get_company_users_no_try_catch():
    """# Tests R-P2-10
    getCompanyUsers() must NOT have a try/catch.
    Error-path: verifies absence of error swallowing pattern.
    """
    body = _extract_function(_read_auth_service(), "getCompanyUsers")
    try_count = len(re.findall(r"\btry\b", body))
    assert try_count == 0, (
        f"getCompanyUsers has {try_count} try blocks — should propagate errors directly"
    )


# ── R-P2-11: Session hydration null on failure ──────────────────


def test_session_hydration_sets_session_cache_null():
    """# Tests R-P2-11
    The catch block must set _sessionCache = null.
    """
    handler = _extract_on_auth_handler(_read_auth_service())
    assert "_sessionCache = null" in handler, (
        "Session hydration catch block does not set _sessionCache to null"
    )


def test_session_hydration_no_get_stored_users():
    """# Tests R-P2-11
    The onAuthStateChanged handler must NOT call getStoredUsers() for fallback.
    Error-path: verifies silent cache lookup is removed.
    """
    handler = _extract_on_auth_handler(_read_auth_service())
    occurrences = handler.count("getStoredUsers()")
    assert occurrences == 0, (
        f"onAuthStateChanged handler calls getStoredUsers() {occurrences} times — silent cache lookup not removed"
    )


# ── R-P2-12: Session hydration emits event ──────────────────────


def test_session_hydration_emits_custom_event():
    """# Tests R-P2-12
    The handler must dispatch auth:session-failed CustomEvent.
    """
    handler = _extract_on_auth_handler(_read_auth_service())
    assert handler.count("auth:session-failed") == 1, (
        "onAuthStateChanged handler does not emit exactly one 'auth:session-failed' event"
    )


def test_session_hydration_uses_custom_event_class():
    """# Tests R-P2-12
    The handler must use CustomEvent (not plain Event).
    """
    handler = _extract_on_auth_handler(_read_auth_service())
    custom_event_count = handler.count("CustomEvent")
    assert custom_event_count == 1, (
        f"Expected exactly 1 CustomEvent usage, found {custom_event_count}"
    )


def test_session_hydration_calls_dispatch_event():
    """# Tests R-P2-12
    The handler must call dispatchEvent to fire the event.
    """
    handler = _extract_on_auth_handler(_read_auth_service())
    dispatch_count = handler.count("dispatchEvent")
    assert dispatch_count == 1, (
        f"Expected exactly 1 dispatchEvent call, found {dispatch_count}"
    )


def test_session_hydration_event_includes_email():
    """# Tests R-P2-12
    The CustomEvent detail must include the user's email.
    Error-path: verifies the event payload has actionable data.
    """
    handler = _extract_on_auth_handler(_read_auth_service())
    assert "email" in handler, (
        "CustomEvent detail does not include email — UI cannot identify user for re-login prompt"
    )
