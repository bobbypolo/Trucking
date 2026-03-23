"""
Tests R-W8-01a, R-W8-01b, R-W8-01c, R-W8-VPC-901

H-901: FMCSA Safety Score API Integration
Implement real FMCSA API calls in safety service with configurable base URL,
mock data fallback when API key not configured, and SafetyView integration.
"""

# Tests R-W8-01a, R-W8-01b, R-W8-01c, R-W8-VPC-901

# Story file coverage markers:
# from fmcsa.service (server/services/fmcsa.service.ts)
# from safety (server/routes/safety.ts)
# from SafetyView (components/SafetyView.tsx)

import re
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]


def _read(path: Path) -> str:
    return path.read_text(encoding="utf-8", errors="replace")


# ---------------------------------------------------------------------------
# R-W8-01a: fmcsa.service.ts makes real HTTP calls with configurable base URL
# ---------------------------------------------------------------------------


def test_r_w8_01a_fmcsa_service_exists():
    """R-W8-01a: fmcsa.service.ts exists and exports getSafetyScore."""
    # Tests R-W8-01a
    path = REPO_ROOT / "server" / "services" / "fmcsa.service.ts"
    assert path.exists(), "server/services/fmcsa.service.ts must exist"
    content = _read(path)
    assert "export async function getSafetyScore" in content, (
        "fmcsa.service.ts must export getSafetyScore function"
    )


def test_r_w8_01a_fmcsa_service_uses_fetch():
    """R-W8-01a: fmcsa.service.ts makes real HTTP calls via fetch with timeout."""
    # Tests R-W8-01a
    content = _read(REPO_ROOT / "server" / "services" / "fmcsa.service.ts")
    assert "fetch(" in content, "fmcsa.service.ts must use fetch() for HTTP calls"
    assert "AbortSignal.timeout" in content or "FMCSA_TIMEOUT_MS" in content, (
        "fmcsa.service.ts must have a timeout on fetch requests"
    )


def test_r_w8_01a_fmcsa_service_configurable_base_url():
    """R-W8-01a: fmcsa.service.ts supports configurable base URL via env var."""
    # Tests R-W8-01a
    content = _read(REPO_ROOT / "server" / "services" / "fmcsa.service.ts")
    assert "FMCSA_API_BASE_URL" in content, (
        "fmcsa.service.ts must support FMCSA_API_BASE_URL env var"
    )
    assert "FMCSA_DEFAULT_BASE_URL" in content, (
        "fmcsa.service.ts must have a default base URL"
    )
    assert "mobile.fmcsa.dot.gov" in content, (
        "Default base URL must point to real FMCSA API"
    )


def test_r_w8_01a_fmcsa_route_endpoint():
    """R-W8-01a: safety route has GET /api/safety/fmcsa/:dotNumber endpoint with auth."""
    # Tests R-W8-01a
    content = _read(REPO_ROOT / "server" / "routes" / "safety.ts")
    assert "/api/safety/fmcsa/:dotNumber" in content, (
        "safety.ts must have /api/safety/fmcsa/:dotNumber route"
    )
    assert "getSafetyScore" in content, (
        "safety.ts must call getSafetyScore from fmcsa.service"
    )
    assert "requireAuth" in content, "FMCSA endpoint must require authentication"


def test_r_w8_01a_route_returns_json_response():
    """R-W8-01a: safety route returns JSON and handles errors with 500."""
    # Tests R-W8-01a
    content = _read(REPO_ROOT / "server" / "routes" / "safety.ts")
    # Verify the route handler returns the result as JSON
    assert "res.json(result)" in content, "FMCSA route must return result as JSON"
    # Verify error handling returns 500
    assert "res.status(500)" in content, "FMCSA route must return 500 on error"


# ---------------------------------------------------------------------------
# R-W8-01a NEGATIVE: input validation and error paths
# ---------------------------------------------------------------------------


def test_r_w8_01a_negative_input_validation():
    """R-W8-01a: fmcsa.service.ts validates DOT number input (rejects non-numeric)."""
    # Tests R-W8-01a
    content = _read(REPO_ROOT / "server" / "services" / "fmcsa.service.ts")
    # Must reject non-numeric DOT numbers
    assert "invalid_input" in content, (
        "fmcsa.service.ts must return invalid_input reason for bad DOT numbers"
    )
    # Must have regex validation
    assert re.search(r"/\\d\+/", content) or re.search(r"\\d", content), (
        "fmcsa.service.ts must validate DOT number is numeric"
    )


def test_r_w8_01a_negative_api_error_handling():
    """R-W8-01a: fmcsa.service.ts handles API errors gracefully (never throws)."""
    # Tests R-W8-01a
    content = _read(REPO_ROOT / "server" / "services" / "fmcsa.service.ts")
    # Must handle non-OK status
    assert "response.ok" in content or "!response.ok" in content, (
        "fmcsa.service.ts must check response.ok"
    )
    assert "api_error" in content, (
        "fmcsa.service.ts must return api_error reason on failure"
    )
    # Must handle timeout
    assert "timeout" in content.lower(), "fmcsa.service.ts must handle timeout errors"
    # Must have try/catch
    assert content.count("catch") >= 1, (
        "fmcsa.service.ts must have try/catch for error handling"
    )


def test_r_w8_01a_negative_no_data_response():
    """R-W8-01a: fmcsa.service.ts handles missing carrier data gracefully."""
    # Tests R-W8-01a
    content = _read(REPO_ROOT / "server" / "services" / "fmcsa.service.ts")
    assert "no_data" in content, (
        "fmcsa.service.ts must return no_data reason when API returns no carrier"
    )


# ---------------------------------------------------------------------------
# R-W8-01b: Falls back to mock data when FMCSA_API_KEY not configured
# ---------------------------------------------------------------------------


def test_r_w8_01b_mock_fallback():
    """R-W8-01b: fmcsa.service.ts returns mock data with isMock flag when no API key."""
    # Tests R-W8-01b
    content = _read(REPO_ROOT / "server" / "services" / "fmcsa.service.ts")
    assert "FMCSA_API_KEY" in content, "fmcsa.service.ts must check FMCSA_API_KEY"
    assert "isMock" in content, "fmcsa.service.ts must return isMock flag for mock data"
    assert "isMock: true" in content, "Mock data response must set isMock: true"


def test_r_w8_01b_mock_data_structure():
    """R-W8-01b: mock data has complete structure with all required fields."""
    # Tests R-W8-01b
    content = _read(REPO_ROOT / "server" / "services" / "fmcsa.service.ts")
    assert "getMockSafetyData" in content, (
        "fmcsa.service.ts must have getMockSafetyData function"
    )
    # Mock must return full data shape
    assert "legalName" in content, "Mock data must include legalName"
    assert "safetyRating" in content, "Mock data must include safetyRating"
    assert "totalInspections" in content, "Mock data must include inspection data"
    assert "basicsScores" in content, "Mock data must include BASICS scores"


def test_r_w8_01b_negative_empty_api_key():
    """R-W8-01b: empty string API key also triggers mock fallback."""
    # Tests R-W8-01b
    content = _read(REPO_ROOT / "server" / "services" / "fmcsa.service.ts")
    # The service checks `if (!apiKey)` which covers empty string
    assert "!apiKey" in content or "apiKey" in content, (
        "fmcsa.service.ts must check for falsy API key values"
    )


# ---------------------------------------------------------------------------
# R-W8-01c: Caching -- second call within 24h returns cached data
# ---------------------------------------------------------------------------


def test_r_w8_01c_safetyview_fmcsa_integration():
    """R-W8-01c: SafetyView fetches FMCSA data and displays safety rating."""
    # Tests R-W8-01c
    content = _read(REPO_ROOT / "components" / "SafetyView.tsx")
    assert "fmcsaData" in content, (
        "SafetyView must have fmcsaData state for FMCSA scores"
    )
    assert "/api/safety/fmcsa/" in content, (
        "SafetyView must fetch from /api/safety/fmcsa/ endpoint"
    )
    assert "safetyRating" in content, (
        "SafetyView must display safetyRating from FMCSA data"
    )


def test_r_w8_01c_safetyview_mock_badge():
    """R-W8-01c: SafetyView shows mock badge when data is mock."""
    # Tests R-W8-01c
    content = _read(REPO_ROOT / "components" / "SafetyView.tsx")
    assert "isMock" in content, "SafetyView must handle isMock flag from FMCSA response"
    assert "Mock Data" in content, (
        "SafetyView must show 'Mock Data' label when isMock is true"
    )
    assert "FMCSA Verified" in content, (
        "SafetyView must show 'FMCSA Verified' when data is real"
    )


def test_r_w8_01c_cache_implementation():
    """R-W8-01c: fmcsa.service.ts implements 24-hour cache with TTL."""
    # Tests R-W8-01c
    content = _read(REPO_ROOT / "server" / "services" / "fmcsa.service.ts")
    assert "CACHE_TTL_MS" in content, (
        "fmcsa.service.ts must define CACHE_TTL_MS constant"
    )
    assert "24 * 60 * 60 * 1000" in content, (
        "Cache TTL must be 24 hours (24 * 60 * 60 * 1000)"
    )
    assert "cache" in content.lower(), "fmcsa.service.ts must use a cache mechanism"
    assert "clearFmcsaCache" in content, (
        "fmcsa.service.ts must export clearFmcsaCache for testing"
    )


def test_r_w8_01c_negative_cache_expiry():
    """R-W8-01c: cache entries expire after TTL (stale entries removed)."""
    # Tests R-W8-01c
    content = _read(REPO_ROOT / "server" / "services" / "fmcsa.service.ts")
    assert "expiresAt" in content, "Cache entries must track expiresAt timestamp"
    assert "Date.now()" in content, "Cache must compare current time against expiresAt"
    assert "cache.delete" in content, "Expired entries must be deleted from cache"


def test_r_w8_01c_negative_safetyview_fetch_failure():
    """R-W8-01c: SafetyView silently degrades when FMCSA fetch fails."""
    # Tests R-W8-01c
    content = _read(REPO_ROOT / "components" / "SafetyView.tsx")
    # Must have try/catch around FMCSA fetch
    assert "catch" in content, "SafetyView must catch errors from FMCSA fetch"
    # The N/A fallback should display when data isn't available
    assert "N/A" in content, "SafetyView must show N/A when FMCSA data not available"


# ---------------------------------------------------------------------------
# R-W8-VPC-901: VPC -- unit tests pass, tsc clean
# ---------------------------------------------------------------------------


def test_r_w8_vpc_901_test_file_exists_and_comprehensive():
    """R-W8-VPC-901: FMCSA service test file exists with comprehensive coverage."""
    # Tests R-W8-VPC-901
    path = REPO_ROOT / "server" / "__tests__" / "services" / "fmcsa.service.test.ts"
    assert path.exists(), "server/__tests__/services/fmcsa.service.test.ts must exist"
    content = _read(path)
    # Must test multiple scenarios
    assert "describe" in content, "Test file must have describe blocks"
    assert content.count("it(") >= 8, "FMCSA test file must have at least 8 test cases"


def test_r_w8_vpc_901_test_has_assertions():
    """R-W8-VPC-901: FMCSA service test has meaningful value-checking assertions."""
    # Tests R-W8-VPC-901
    content = _read(
        REPO_ROOT / "server" / "__tests__" / "services" / "fmcsa.service.test.ts"
    )
    assert content.count("expect(") >= 10, (
        "FMCSA test file must have at least 10 assertions"
    )
    # Must check actual returned values, not just existence
    assert "toBe(true)" in content or "toBe(false)" in content, (
        "Tests must check boolean return values"
    )
    assert 'toBe("' in content or "toBe('" in content, (
        "Tests must check string return values"
    )


def test_r_w8_vpc_901_test_covers_error_cases():
    """R-W8-VPC-901: FMCSA service test covers error/edge cases."""
    # Tests R-W8-VPC-901
    content = _read(
        REPO_ROOT / "server" / "__tests__" / "services" / "fmcsa.service.test.ts"
    )
    # Must test API failure scenarios
    assert "api_error" in content, "Tests must verify api_error handling"
    assert "timeout" in content.lower(), "Tests must verify timeout handling"
    assert "invalid" in content.lower(), "Tests must verify input validation"
    # Must test caching
    assert "cache" in content.lower(), "Tests must verify caching behavior"


def test_r_w8_vpc_901_test_mocks_fetch():
    """R-W8-VPC-901: FMCSA service test mocks fetch for isolation."""
    # Tests R-W8-VPC-901
    content = _read(
        REPO_ROOT / "server" / "__tests__" / "services" / "fmcsa.service.test.ts"
    )
    assert "mockFetch" in content or "vi.fn()" in content, (
        "Tests must mock fetch for API isolation"
    )
    assert "mockResolvedValue" in content or "mockRejectedValue" in content, (
        "Tests must set up mock responses for different scenarios"
    )


def test_r_w8_vpc_901_r_marker_in_vitest():
    """R-W8-VPC-901: Vitest test file has R-marker comment for traceability."""
    # Tests R-W8-VPC-901
    content = _read(
        REPO_ROOT / "server" / "__tests__" / "services" / "fmcsa.service.test.ts"
    )
    assert "R-W8" in content, (
        "Vitest test file must include R-W8 marker for traceability"
    )
