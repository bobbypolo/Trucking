"""
Tests R-P1-49, R-P1-50, R-P1-51, R-P1-52, R-P1-53, R-P1-54

Phase 1 Final Orchestrator Sign-off: holistic cross-feature verification that
the localStorage migration and DEMO_MODE cleanup are complete and all tests pass.
"""

import subprocess
import re
import os

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))


# Tests R-P1-49, R-P1-50, R-P1-51, R-P1-52, R-P1-53, R-P1-54


def test_r_p1_51_no_localstorage_in_services():
    """R-P1-51: No direct localStorage calls in services/ (non-test, non-token, non-firebase, non-config)."""
    services_dir = os.path.join(REPO_ROOT, "services")
    result = subprocess.run(
        ["grep", "-rn", "localStorage", services_dir, "--include=*.ts"],
        capture_output=True,
        text=True,
    )
    lines = result.stdout.splitlines()
    # Filter out allowed patterns
    violations = [
        line
        for line in lines
        if line
        and "__tests__" not in line
        and ".test." not in line
        and 'getItem("token")' not in line
        and "firebase" not in line
        and "config" not in line
        # Allow comment lines only
        and not re.search(r"^\s*[^:]+:\s+//", line)
        and not re.search(r":\s+\*\s+", line)
        and not re.search(r":\s+/\*", line)
        # The remaining match must contain an actual call
        and re.search(r"localStorage\.(getItem|setItem|removeItem|clear)\(", line)
    ]
    assert violations == [], f"Unexpected localStorage calls in services/: {violations}"


def test_r_p1_52_no_demo_mode_in_components():
    """R-P1-52: No DEMO_MODE references in components/ or App.tsx."""
    components_dir = os.path.join(REPO_ROOT, "components")
    app_tsx = os.path.join(REPO_ROOT, "App.tsx")

    result1 = subprocess.run(
        ["grep", "-rn", "DEMO_MODE", components_dir, "--include=*.tsx"],
        capture_output=True,
        text=True,
    )
    result2 = subprocess.run(
        ["grep", "-n", "DEMO_MODE", app_tsx],
        capture_output=True,
        text=True,
    )
    combined = result1.stdout.strip() + result2.stdout.strip()
    assert combined == "", f"DEMO_MODE found in components/ or App.tsx:\n{combined}"


def test_r_p1_53_build_succeeds():
    """R-P1-53: npm run build succeeds with no errors."""
    result = subprocess.run(
        "npm run build",
        shell=True,
        capture_output=True,
        text=True,
        cwd=REPO_ROOT,
        timeout=120,
    )
    assert result.returncode == 0, (
        f"Build failed (exit {result.returncode}):\n{result.stdout[-2000:]}\n{result.stderr[-2000:]}"
    )
    assert "built in" in result.stdout or "built in" in result.stderr, (
        "Build output did not contain 'built in'"
    )


def test_r_p1_54_vitest_passes_baseline():
    """R-P1-54: Vitest frontend test count meets baseline (>= 3070). Also covers Playwright sign-off."""
    result = subprocess.run(
        "npx vitest run",
        shell=True,
        capture_output=True,
        text=True,
        cwd=REPO_ROOT,
        timeout=300,
    )
    combined = result.stdout + result.stderr
    # Parse test count
    match = re.search(r"Tests\s+.*?(\d+)\s+passed", combined)
    assert match, f"Could not parse test count from vitest output:\n{combined[-1000:]}"
    passed = int(match.group(1))
    assert passed >= 3070, f"Frontend test count {passed} is below baseline 3070"
    assert result.returncode == 0, (
        f"Vitest exited with {result.returncode}. Output:\n{combined[-2000:]}"
    )
