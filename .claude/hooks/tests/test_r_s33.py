"""Tests for STORY-033: Fix TypeScript Errors.

Tests R-S33-01, R-S33-02
"""

# Tests R-S33-01, R-S33-02
# Coverage: import exceptions
# Coverage: import health

import subprocess
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]
SERVER_DIR = REPO_ROOT / "server"
EXCEPTIONS_SCHEMA = SERVER_DIR / "schemas" / "exceptions.ts"


def _run_tsc(cwd: Path) -> tuple[int, str]:
    """Run tsc --noEmit and return (returncode, output)."""
    result = subprocess.run(
        "npx tsc --noEmit",
        shell=True,
        capture_output=True,
        text=True,
        cwd=str(cwd),
        timeout=90,
    )
    output = (result.stdout + result.stderr).strip()
    return result.returncode, output


def test_r_s33_01_frontend_tsc_zero_errors():
    """R-S33-01: npx tsc --noEmit returns 0 errors for frontend."""
    # Tests R-S33-01
    returncode, output = _run_tsc(REPO_ROOT)
    assert returncode == 0, (
        f"Frontend TypeScript has errors (exit {returncode}):\n{output}"
    )


def test_r_s33_02_server_tsc_zero_errors():
    """R-S33-02: cd server && npx tsc --noEmit returns 0 errors for server."""
    # Tests R-S33-02
    returncode, output = _run_tsc(SERVER_DIR)
    assert returncode == 0, (
        f"Server TypeScript has errors (exit {returncode}):\n{output}"
    )


def test_r_s33_exceptions_schema_uses_passthrough():
    """Verify exceptions.ts uses z.object({}).passthrough() not z.record(z.unknown())."""
    # Tests R-S33-02
    content = EXCEPTIONS_SCHEMA.read_text(encoding="utf-8")
    assert "z.record(z.unknown())" not in content, (
        "exceptions.ts must not use z.record(z.unknown()) — Zod v4 requires key type arg. "
        "Use z.object({}).passthrough() instead."
    )
    assert "passthrough" in content, (
        "exceptions.ts links field must use z.object({}).passthrough() for Zod v4 compat"
    )


def test_r_s33_exceptions_schema_links_field_present():
    """Verify the links field is still present in createExceptionSchema."""
    # Tests R-S33-01, R-S33-02
    content = EXCEPTIONS_SCHEMA.read_text(encoding="utf-8")
    assert "links:" in content, "links field must still be present in createExceptionSchema"
    assert "createExceptionSchema" in content, "createExceptionSchema must be exported"
    assert "patchExceptionSchema" in content, "patchExceptionSchema must be exported"
