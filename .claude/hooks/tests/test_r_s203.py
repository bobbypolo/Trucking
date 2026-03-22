# Tests R-P2-10, R-P2-11, R-P2-12, R-P2-13
# Covers: GPS provider interface + Samsara adapter (server/services/gps/)
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


def test_interface_file_exists():
    """R-P2-10: gps-provider.interface.ts exists."""
    path = os.path.join(GPS_DIR, "gps-provider.interface.ts")
    assert os.path.isfile(path), f"Interface file not found at {path}"


def test_interface_has_gps_position_type():
    """R-P2-10: GpsPosition type is defined with provider-agnostic fields."""
    path = os.path.join(GPS_DIR, "gps-provider.interface.ts")
    content = open(path, encoding="utf-8").read()

    assert "interface GpsPosition" in content, "Missing GpsPosition interface"
    assert "vehicleId" in content, "Missing vehicleId field"
    assert "latitude" in content, "Missing latitude field"
    assert "longitude" in content, "Missing longitude field"
    assert "speed" in content, "Missing speed field"
    assert "heading" in content, "Missing heading field"
    assert "recordedAt" in content, "Missing recordedAt field"
    assert "provider" in content, "Missing provider field"
    assert "providerVehicleId" in content, "Missing providerVehicleId field"


def test_interface_has_gps_provider():
    """R-P2-10: GpsProvider interface with getVehicleLocations and getVehicleLocation."""
    path = os.path.join(GPS_DIR, "gps-provider.interface.ts")
    content = open(path, encoding="utf-8").read()

    assert "interface GpsProvider" in content, "Missing GpsProvider interface"
    assert "getVehicleLocations" in content, "Missing getVehicleLocations method"
    assert "getVehicleLocation" in content, "Missing getVehicleLocation method"


def test_interface_no_samsara_imports():
    """R-P2-10: Interface file has no Samsara-specific imports or types."""
    path = os.path.join(GPS_DIR, "gps-provider.interface.ts")
    content = open(path, encoding="utf-8").read()

    # No samsara-specific types should appear in the interface
    assert "SamsaraAdapter" not in content, "Interface must not reference SamsaraAdapter"
    assert "import" not in content.split("export")[0].strip() or "samsara" not in content.lower().split("export")[0], (
        "Interface file must not import from samsara adapter"
    )


def test_samsara_adapter_file_exists():
    """R-P2-11: samsara.adapter.ts exists."""
    path = os.path.join(GPS_DIR, "samsara.adapter.ts")
    assert os.path.isfile(path), f"Adapter file not found at {path}"


def test_samsara_adapter_implements_gps_provider():
    """R-P2-11: SamsaraAdapter implements GpsProvider interface."""
    path = os.path.join(GPS_DIR, "samsara.adapter.ts")
    content = open(path, encoding="utf-8").read()

    assert "class SamsaraAdapter" in content, "Missing SamsaraAdapter class"
    assert "GpsProvider" in content, "Must reference GpsProvider interface"


def test_samsara_adapter_has_timeout():
    """R-P2-11: Adapter uses 5-second timeout."""
    path = os.path.join(GPS_DIR, "samsara.adapter.ts")
    content = open(path, encoding="utf-8").read()

    assert "5000" in content, "Missing 5000ms timeout constant"
    assert "AbortSignal.timeout" in content or "signal" in content, (
        "Must use AbortSignal for timeout"
    )


def test_samsara_adapter_has_cache():
    """R-P2-11: Adapter implements 60-second cache."""
    path = os.path.join(GPS_DIR, "samsara.adapter.ts")
    content = open(path, encoding="utf-8").read()

    assert "60000" in content, "Missing 60000ms cache TTL constant"
    assert "cache" in content.lower(), "Must have cache mechanism"


def test_samsara_adapter_has_mock_fallback():
    """R-P2-12: Adapter has mock fallback when no API token."""
    path = os.path.join(GPS_DIR, "samsara.adapter.ts")
    content = open(path, encoding="utf-8").read()

    assert "SAMSARA_API_TOKEN" in content, "Must check SAMSARA_API_TOKEN env var"
    assert "isMock" in content, "Must set isMock flag on mock positions"


def test_index_file_exists():
    """R-P2-13: index.ts barrel file exists with factory function."""
    path = os.path.join(GPS_DIR, "index.ts")
    assert os.path.isfile(path), f"Index file not found at {path}"


def test_index_has_factory():
    """R-P2-13: Factory function getGpsProvider exists."""
    path = os.path.join(GPS_DIR, "index.ts")
    content = open(path, encoding="utf-8").read()

    assert "getGpsProvider" in content, "Missing getGpsProvider factory function"
    assert "GPS_PROVIDER" in content, "Must read GPS_PROVIDER env var"


def test_factory_throws_for_unknown():
    """R-P2-13: Factory throws error message containing unknown provider name."""
    path = os.path.join(GPS_DIR, "index.ts")
    content = open(path, encoding="utf-8").read()

    assert "throw" in content.lower() or "Error" in content, (
        "Factory must throw for unknown providers"
    )


def test_vitest_gps_tests_pass():
    """R-P2-11, R-P2-12, R-P2-13: All GPS vitest unit tests pass."""
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
