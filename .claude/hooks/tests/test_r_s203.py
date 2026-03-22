# Tests R-P2-10, R-P2-11, R-P2-12, R-P2-13
# Covers: server/services/gps/gps-provider.interface.ts, server/services/gps/samsara.adapter.ts, server/services/gps/index.ts
"""
S-203: Create GPS provider interface + Samsara adapter.

R-P2-10: GpsProvider interface is provider-agnostic with no Samsara-specific types
R-P2-11: Samsara adapter returns parsed GpsPosition array from API, with 5s timeout and 60s cache
R-P2-12: Missing SAMSARA_API_TOKEN returns mock positions with isMock: true
R-P2-13: Factory returns SamsaraAdapter for samsara, throws for unknown provider
"""

import os
import re
import subprocess


SERVER_DIR = os.path.join(
    os.path.dirname(__file__),
    "..", "..", "..", "server"
)

GPS_DIR = os.path.join(SERVER_DIR, "services", "gps")


# --- R-P2-10: Interface is provider-agnostic ---

def test_interface_exports_gps_position_with_all_fields():
    """R-P2-10: GpsPosition interface has all required provider-agnostic fields."""
    path = os.path.join(GPS_DIR, "gps-provider.interface.ts")
    assert os.path.isfile(path), f"Interface file not found at {path}"
    content = open(path, encoding="utf-8").read()

    assert "interface GpsPosition" in content, "Missing GpsPosition interface"
    required_fields = [
        "vehicleId", "latitude", "longitude", "speed",
        "heading", "recordedAt", "provider", "providerVehicleId"
    ]
    for field in required_fields:
        assert field in content, f"Missing required field: {field}"


def test_interface_exports_gps_provider_with_both_methods():
    """R-P2-10: GpsProvider interface exports getVehicleLocations and getVehicleLocation."""
    path = os.path.join(GPS_DIR, "gps-provider.interface.ts")
    content = open(path, encoding="utf-8").read()

    assert "interface GpsProvider" in content, "Missing GpsProvider interface"
    assert "getVehicleLocations" in content, "Missing getVehicleLocations method"
    assert "getVehicleLocation" in content, "Missing getVehicleLocation method"
    # Methods return correct types
    assert "Promise<GpsPosition[]>" in content, "getVehicleLocations must return Promise<GpsPosition[]>"
    assert "Promise<GpsPosition | null>" in content, "getVehicleLocation must return Promise<GpsPosition | null>"


def test_interface_contains_no_samsara_references():
    """R-P2-10: Interface file has no Samsara-specific imports, types, or class references."""
    path = os.path.join(GPS_DIR, "gps-provider.interface.ts")
    content = open(path, encoding="utf-8").read()

    assert "SamsaraAdapter" not in content, "Interface must not reference SamsaraAdapter"
    assert "samsara.adapter" not in content, "Interface must not import from samsara adapter"
    # No import statements referencing samsara
    for line in content.split("\n"):
        if line.strip().startswith("import"):
            assert "samsara" not in line.lower(), (
                f"Interface imports must not reference samsara: {line}"
            )


def test_interface_has_no_samsara_api_constants():
    """R-P2-10: Interface file must not contain Samsara API URLs or token references."""
    path = os.path.join(GPS_DIR, "gps-provider.interface.ts")
    content = open(path, encoding="utf-8").read()

    assert "api.samsara.com" not in content, "No Samsara API URLs in interface"
    assert "SAMSARA_API_TOKEN" not in content, "No Samsara token references in interface"


# --- R-P2-11: Samsara adapter with timeout and cache ---

def test_samsara_adapter_class_implements_interface():
    """R-P2-11: SamsaraAdapter class implements GpsProvider and imports from interface."""
    path = os.path.join(GPS_DIR, "samsara.adapter.ts")
    assert os.path.isfile(path), f"Adapter file not found at {path}"
    content = open(path, encoding="utf-8").read()

    assert "class SamsaraAdapter" in content, "Missing SamsaraAdapter class"
    assert "GpsProvider" in content, "Must reference GpsProvider interface"
    assert "gps-provider.interface" in content, "Must import from gps-provider.interface"


def test_samsara_adapter_has_5s_timeout_constant():
    """R-P2-11: Adapter defines 5000ms timeout and uses AbortSignal."""
    path = os.path.join(GPS_DIR, "samsara.adapter.ts")
    content = open(path, encoding="utf-8").read()

    assert "5000" in content, "Missing 5000ms timeout constant"
    assert "AbortSignal.timeout" in content, "Must use AbortSignal.timeout for request timeout"


def test_samsara_adapter_has_60s_cache_ttl():
    """R-P2-11: Adapter defines 60000ms (60s) cache TTL."""
    path = os.path.join(GPS_DIR, "samsara.adapter.ts")
    content = open(path, encoding="utf-8").read()

    assert "60000" in content, "Missing 60000ms cache TTL constant"
    assert re.search(r"cache", content, re.IGNORECASE), "Must implement cache mechanism"
    assert "Map" in content, "Cache should use Map for storage"


def test_samsara_adapter_calls_correct_api_endpoint():
    """R-P2-11: Adapter calls Samsara fleet vehicles locations endpoint."""
    path = os.path.join(GPS_DIR, "samsara.adapter.ts")
    content = open(path, encoding="utf-8").read()

    assert "api.samsara.com" in content, "Must call Samsara API"
    assert "fleet/vehicles/locations" in content, "Must use fleet vehicles locations endpoint"


def test_samsara_adapter_parses_api_response():
    """R-P2-11: Adapter has parseSamsaraLocation function for API response mapping."""
    path = os.path.join(GPS_DIR, "samsara.adapter.ts")
    content = open(path, encoding="utf-8").read()

    assert "parseSamsaraLocation" in content, "Must have parse function for Samsara response"
    # Verify it maps to GpsPosition fields
    assert "latitude" in content, "Must map latitude"
    assert "longitude" in content, "Must map longitude"
    assert "provider: \"samsara\"" in content, "Must set provider to 'samsara'"


# --- R-P2-12: Mock fallback ---

def test_samsara_adapter_checks_api_token():
    """R-P2-12: Adapter checks SAMSARA_API_TOKEN env var."""
    path = os.path.join(GPS_DIR, "samsara.adapter.ts")
    content = open(path, encoding="utf-8").read()

    assert "SAMSARA_API_TOKEN" in content, "Must check SAMSARA_API_TOKEN env var"
    assert "process.env.SAMSARA_API_TOKEN" in content, "Must read from process.env"


def test_samsara_adapter_mock_positions_have_is_mock_flag():
    """R-P2-12: Mock positions include isMock: true flag."""
    path = os.path.join(GPS_DIR, "samsara.adapter.ts")
    content = open(path, encoding="utf-8").read()

    assert "isMock: true" in content, "Mock positions must have isMock: true"
    assert "getMockPositions" in content, "Must have mock positions generator function"


def test_samsara_adapter_mock_has_valid_coordinates():
    """R-P2-12: Mock positions have realistic GPS coordinates (not 0,0)."""
    path = os.path.join(GPS_DIR, "samsara.adapter.ts")
    content = open(path, encoding="utf-8").read()

    # Find mock positions and verify they have non-zero coordinates
    mock_section = content[content.index("getMockPositions"):]
    assert re.search(r"latitude:\s*\d+\.\d+", mock_section), "Mock must have real latitude"
    assert re.search(r"longitude:\s*-?\d+\.\d+", mock_section), "Mock must have real longitude"


# --- R-P2-13: Factory function ---

def test_index_barrel_exports_factory_and_types():
    """R-P2-13: index.ts exports getGpsProvider factory and re-exports types."""
    path = os.path.join(GPS_DIR, "index.ts")
    assert os.path.isfile(path), f"Index file not found at {path}"
    content = open(path, encoding="utf-8").read()

    assert "getGpsProvider" in content, "Must export getGpsProvider"
    assert "GPS_PROVIDER" in content, "Must read GPS_PROVIDER env var"
    assert "GpsPosition" in content, "Must re-export GpsPosition type"
    assert "GpsProvider" in content, "Must re-export GpsProvider type"


def test_factory_defaults_to_samsara():
    """R-P2-13: Factory defaults to samsara when GPS_PROVIDER not set."""
    path = os.path.join(GPS_DIR, "index.ts")
    content = open(path, encoding="utf-8").read()

    # Should have a default of "samsara"
    assert '"samsara"' in content, "Factory must default to 'samsara'"


def test_factory_throws_for_unknown_provider():
    """R-P2-13: Factory throws Error with provider name for unknown values."""
    path = os.path.join(GPS_DIR, "index.ts")
    content = open(path, encoding="utf-8").read()

    assert "throw new Error" in content, "Factory must throw Error for unknown providers"
    assert "Unknown GPS provider" in content, "Error message must mention 'Unknown GPS provider'"


def test_factory_does_not_silently_return_null():
    """R-P2-13: Factory never returns null/undefined for unknown providers."""
    path = os.path.join(GPS_DIR, "index.ts")
    content = open(path, encoding="utf-8").read()

    # The default case in switch must throw, not return null
    switch_section = content[content.index("switch"):]
    assert "return null" not in switch_section, "Factory must throw, not return null"
    assert "return undefined" not in switch_section, "Factory must throw, not return undefined"


def test_vitest_gps_tests_pass():
    """R-P2-11, R-P2-12, R-P2-13: All 15 GPS vitest unit tests pass."""
    result = subprocess.run(
        "npx vitest run __tests__/services/gps/gps-provider.test.ts",
        shell=True,
        capture_output=True,
        text=True,
        cwd=SERVER_DIR,
        encoding="utf-8",
        errors="replace",
        timeout=120,
    )
    assert result.returncode == 0, (
        f"Vitest GPS tests failed:\n{result.stdout[-2000:]}\n{result.stderr[-2000:]}"
    )
    # Verify all 15 tests ran
    assert "15 passed" in result.stdout, (
        f"Expected 15 tests to pass, got:\n{result.stdout[-500:]}"
    )
