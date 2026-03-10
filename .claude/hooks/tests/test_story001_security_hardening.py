"""
QA traceability tests for STORY-001: Security Hardening & API URL Centralization.

Tests R-P1-01 through R-P1-07 for the LoadPilot Production Readiness Sprint.
"""
# Tests R-P1-01, R-P1-02, R-P1-03, R-P1-04, R-P1-05, R-P1-06, R-P1-07

import os
import subprocess
import sys

PROJECT_ROOT = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..", "..")
)
SERVICES_DIR = os.path.join(PROJECT_ROOT, "services")
SERVER_DIR = os.path.join(PROJECT_ROOT, "server")
VITE_CONFIG = os.path.join(PROJECT_ROOT, "vite.config.ts")
ENV_EXAMPLE = os.path.join(PROJECT_ROOT, ".env.example")

_SHELL = sys.platform == "win32"


def test_r_p1_01_no_localhost_in_services():
    """R-P1-01: grep -r localhost:5000 services/ returns zero matches."""
    count = 0
    for root, _dirs, files in os.walk(SERVICES_DIR):
        for fname in files:
            if not fname.endswith((".ts", ".tsx", ".js")):
                continue
            fpath = os.path.join(root, fname)
            with open(fpath, encoding="utf-8") as f:
                text = f.read()
            if "localhost:5000" in text:
                count += 1

    assert count == 0, (
        f"Found {count} service file(s) with literal 'localhost:5000'. "
        "All service files must import API_URL from services/config.ts."
    )


def test_r_p1_01_config_ts_exists():
    """R-P1-01: services/config.ts exists and exports API_URL."""
    config_path = os.path.join(SERVICES_DIR, "config.ts")
    assert os.path.isfile(config_path), "services/config.ts must exist"
    content = open(config_path, encoding="utf-8").read()
    assert "API_URL" in content, "config.ts must export API_URL"
    assert "VITE_API_URL" in content, "config.ts must reference VITE_API_URL"


def test_r_p1_01_service_files_import_config():
    """R-P1-01: The 8 service files import API_URL from services/config.ts."""
    expected_importers = [
        "api.ts",
        "authService.ts",
        "brokerService.ts",
        "exceptionService.ts",
        "financialService.ts",
        "fuelService.ts",
        "networkService.ts",
        "storageService.ts",
    ]
    for fname in expected_importers:
        fpath = os.path.join(SERVICES_DIR, fname)
        assert os.path.isfile(fpath), f"Expected service file missing: {fname}"
        content = open(fpath, encoding="utf-8").read()
        assert (
            "./config" in content
            or "from './config'" in content
            or 'from "./config"' in content
        ), f"{fname} must import from ./config"


def test_r_p1_02_vite_config_uses_vite_gemini_key():
    """R-P1-02: vite.config.ts only references VITE_GEMINI_API_KEY, not bare GEMINI_API_KEY."""
    assert os.path.isfile(VITE_CONFIG), "vite.config.ts must exist"
    content = open(VITE_CONFIG, encoding="utf-8").read()
    lines = content.splitlines()

    non_vite_refs = []
    for lineno, line in enumerate(lines, 1):
        stripped = line.strip()
        if stripped.startswith("//") or stripped.startswith("*"):
            continue
        # Check for env.GEMINI_API_KEY without VITE_ prefix
        if "env.GEMINI_API_KEY" in line and "VITE_GEMINI_API_KEY" not in line:
            non_vite_refs.append(f"line {lineno}: {stripped}")

    assert not non_vite_refs, (
        "vite.config.ts references bare GEMINI_API_KEY (non-Vite-prefixed): "
        + "\n".join(non_vite_refs)
    )
    assert "VITE_GEMINI_API_KEY" in content, (
        "vite.config.ts must reference VITE_GEMINI_API_KEY"
    )


def test_r_p1_03_helmet_sets_nosniff():
    """R-P1-03: Security middleware test passes — x-content-type-options: nosniff present."""
    result = subprocess.run(
        "npx vitest run --reporter=verbose __tests__/middleware/security-middleware.test.ts",
        shell=True,
        cwd=SERVER_DIR,
        capture_output=True,
        text=True,
        timeout=60,
    )
    assert result.returncode == 0, (
        f"security-middleware.test.ts failed:\n{result.stdout}\n{result.stderr}"
    )
    assert "nosniff" in result.stdout.lower() or "R-P1-03" in result.stdout, (
        "Expected nosniff test or R-P1-03 reference in output"
    )


def test_r_p1_04_rate_limit_returns_429():
    """R-P1-04: Rate limit test passes — 429 on threshold exceeded."""
    result = subprocess.run(
        "npx vitest run --reporter=verbose __tests__/middleware/security-middleware.test.ts",
        shell=True,
        cwd=SERVER_DIR,
        capture_output=True,
        text=True,
        timeout=60,
    )
    assert result.returncode == 0, (
        f"security-middleware.test.ts failed:\n{result.stdout}\n{result.stderr}"
    )
    assert "429" in result.stdout, "Expected 429 test result in vitest output"


def test_r_p1_05_no_silent_catch_blocks():
    """R-P1-05: grep 'catch (e) {}' in authService.ts and storageService.ts returns 0 matches."""
    files_to_check = [
        os.path.join(SERVICES_DIR, "authService.ts"),
        os.path.join(SERVICES_DIR, "storageService.ts"),
    ]
    violations = []
    for fpath in files_to_check:
        if not os.path.isfile(fpath):
            continue
        content = open(fpath, encoding="utf-8").read()
        lines = content.splitlines()
        for lineno, line in enumerate(lines, 1):
            if "catch (e) {}" in line:
                violations.append(f"{os.path.basename(fpath)}:{lineno}: {line.strip()}")

    assert not violations, (
        f"Found {len(violations)} silent catch block(s): " + "\n".join(violations)
    )


def test_r_p1_05_console_warn_replacements_present():
    """R-P1-05: authService and storageService have console.warn in catch blocks."""
    auth_path = os.path.join(SERVICES_DIR, "authService.ts")
    storage_path = os.path.join(SERVICES_DIR, "storageService.ts")

    auth_content = open(auth_path, encoding="utf-8").read()
    storage_content = open(storage_path, encoding="utf-8").read()

    assert "console.warn" in auth_content, (
        "authService.ts must have console.warn in catch blocks"
    )
    assert "console.warn" in storage_content, (
        "storageService.ts must have console.warn in catch blocks"
    )


def test_r_p1_06_env_example_has_required_entries():
    """R-P1-06: .env.example contains entries for VITE_API_URL, VITE_GEMINI_API_KEY, CORS_ORIGIN, RATE_LIMIT_MAX."""
    assert os.path.isfile(ENV_EXAMPLE), ".env.example must exist"
    content = open(ENV_EXAMPLE, encoding="utf-8").read()

    required = ["VITE_API_URL", "VITE_GEMINI_API_KEY", "CORS_ORIGIN", "RATE_LIMIT_MAX"]
    missing = [key for key in required if key not in content]
    assert not missing, f".env.example missing required entries: {missing}"


def test_r_p1_07_server_vitest_passes():
    """R-P1-07: cd server && npx vitest run exits 0 (all 672+ tests pass)."""
    result = subprocess.run(
        "npx vitest run",
        shell=True,
        cwd=SERVER_DIR,
        capture_output=True,
        text=True,
        timeout=120,
    )
    assert result.returncode == 0, (
        f"Server vitest failed (rc={result.returncode}):\n"
        f"stdout: {result.stdout[-1000:]}\nstderr: {result.stderr[-500:]}"
    )
    assert "passed" in result.stdout.lower(), "Expected 'passed' in vitest output"
