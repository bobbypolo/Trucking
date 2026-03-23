"""
Tests R-W8-04

H-904: Wave 8 Verification
Verify all Wave 8 feature completion stories pass: FMCSA integration,
camera capture, configuration documentation, and full test suites.
"""

# Tests R-W8-04

import subprocess
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]


def _read(path: Path) -> str:
    return path.read_text(encoding="utf-8", errors="replace")


# ---------------------------------------------------------------------------
# R-W8-04: .env.example is complete — has SMTP and FMCSA vars
# ---------------------------------------------------------------------------


def test_env_example_has_smtp_vars():
    """R-W8-04: .env.example includes SMTP configuration variables."""
    content = _read(REPO_ROOT / ".env.example")
    assert "SMTP_HOST" in content, "Missing SMTP_HOST in .env.example"
    assert "SMTP_PORT" in content, "Missing SMTP_PORT in .env.example"
    assert "SMTP_USER" in content, "Missing SMTP_USER in .env.example"
    assert "SMTP_PASS" in content, "Missing SMTP_PASS in .env.example"
    assert "SMTP_FROM" in content, "Missing SMTP_FROM in .env.example"


def test_env_example_has_fmcsa_vars():
    """R-W8-04: .env.example includes FMCSA API configuration variables."""
    content = _read(REPO_ROOT / ".env.example")
    assert "FMCSA_API_KEY" in content, "Missing FMCSA_API_KEY in .env.example"


def test_env_example_has_all_required_sections():
    """R-W8-04: .env.example covers all major feature categories."""
    content = _read(REPO_ROOT / ".env.example")
    # Required sections that should exist
    required = [
        "Firebase",  # Firebase Frontend Configuration
        "Google Maps",  # Google Maps API key
        "MySQL",  # Database connection
        "Gemini",  # AI/OCR
        "SMTP",  # Email notifications
        "FMCSA",  # Safety scores
        "CORS",  # API access control
        "Weather",  # Weather integration
    ]
    for section in required:
        assert section in content, f"Missing section '{section}' in .env.example"


# ---------------------------------------------------------------------------
# R-W8-04: FMCSA service exists with graceful fallback
# ---------------------------------------------------------------------------


def test_fmcsa_service_exists():
    """R-W8-04: FMCSA service file exists."""
    fmcsa = REPO_ROOT / "server" / "services" / "fmcsa.service.ts"
    assert fmcsa.exists(), "server/services/fmcsa.service.ts not found"


def test_fmcsa_service_has_fallback():
    """R-W8-04: FMCSA service has graceful fallback when API key not configured."""
    content = _read(REPO_ROOT / "server" / "services" / "fmcsa.service.ts")
    assert "mock" in content.lower() or "fallback" in content.lower(), (
        "FMCSA service missing mock/fallback data for when API key is absent"
    )


def test_fmcsa_route_exists():
    """R-W8-04: FMCSA safety endpoint exists in safety routes."""
    content = _read(REPO_ROOT / "server" / "routes" / "safety.ts")
    assert "fmcsa" in content.lower(), "No FMCSA route in server/routes/safety.ts"
    assert "/api/safety/fmcsa/" in content, "Missing /api/safety/fmcsa/ endpoint"


# ---------------------------------------------------------------------------
# R-W8-04: Scanner component has camera support
# ---------------------------------------------------------------------------


def test_scanner_component_exists():
    """R-W8-04: Scanner.tsx component exists."""
    scanner = REPO_ROOT / "components" / "Scanner.tsx"
    assert scanner.exists(), "components/Scanner.tsx not found"


def test_scanner_has_camera_capture():
    """R-W8-04: Scanner has getUserMedia camera support."""
    content = _read(REPO_ROOT / "components" / "Scanner.tsx")
    assert "getUserMedia" in content, "Scanner.tsx missing getUserMedia call"
    assert "camera" in content.lower(), "Scanner.tsx missing camera-related code"


def test_scanner_has_fallback():
    """R-W8-04: Scanner falls back to file picker when camera unavailable."""
    content = _read(REPO_ROOT / "components" / "Scanner.tsx")
    # Should have file input as fallback
    assert "input" in content.lower(), "Scanner.tsx missing file input fallback"


# ---------------------------------------------------------------------------
# R-W8-04: TypeScript compiles with 0 errors
# ---------------------------------------------------------------------------


def test_typescript_no_errors():
    """R-W8-04: npx tsc --noEmit produces 0 errors."""
    result = subprocess.run(
        "npx tsc --noEmit",
        shell=True,
        capture_output=True,
        text=True,
        cwd=str(REPO_ROOT),
        timeout=120,
        encoding="utf-8",
        errors="replace",
    )
    assert result.returncode == 0, (
        f"TypeScript errors found (exit {result.returncode}):\n"
        f"{result.stdout[:2000]}\n{result.stderr[:2000]}"
    )
