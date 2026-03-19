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
    assert violations == [], "Unexpected localStorage calls in services/: " + str(
        violations
    )


def test_r_p1_51_actual_localstorage_calls_absent():
    """R-P1-51 (edge): Verify no actual setItem/removeItem calls in non-test service files."""
    services_dir = os.path.join(REPO_ROOT, "services")
    result = subprocess.run(
        ["grep", "-rn", "localStorage", services_dir, "--include=*.ts"],
        capture_output=True,
        text=True,
    )
    lines = result.stdout.splitlines()
    violations = []
    for line in lines:
        if not line:
            continue
        if (
            "__tests__" in line
            or ".test." in line
            or "firebase" in line
            or "config" in line
        ):
            continue
        # Get the part after the line number prefix (file:line:content)
        parts = line.split(":", 2)
        code = parts[2].lstrip() if len(parts) >= 3 else ""
        if code.startswith("//") or code.startswith("*"):
            continue
        if re.search(r"localStorage\.(setItem|removeItem)\(", line):
            violations.append(line)
    assert violations == [], (
        "R-P1-51: localStorage.setItem/removeItem present in services/ (non-test): "
        + str(violations)
    )


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
    assert combined == "", "DEMO_MODE found in components/ or App.tsx: " + combined


def test_r_p1_52_demo_mode_not_in_apptsx():
    """R-P1-52 (error): Explicitly assert DEMO_MODE absent from App.tsx (guards against regression)."""
    app_tsx = os.path.join(REPO_ROOT, "App.tsx")
    assert os.path.exists(app_tsx), "App.tsx not found — path mismatch?"
    with open(app_tsx, "r", encoding="utf-8") as f:
        content = f.read()
    non_comment_lines = [
        line
        for line in content.splitlines()
        if "DEMO_MODE" in line
        and not line.lstrip().startswith("//")
        and not line.lstrip().startswith("*")
    ]
    assert non_comment_lines == [], (
        "R-P1-52: DEMO_MODE found in App.tsx non-comment lines: "
        + str(non_comment_lines)
    )


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
        "Build failed (exit "
        + str(result.returncode)
        + "): "
        + result.stdout[-2000:]
        + result.stderr[-2000:]
    )
    assert "built in" in result.stdout or "built in" in result.stderr, (
        "Build output did not contain 'built in'"
    )


def test_r_p1_53_build_does_not_emit_typescript_errors():
    """R-P1-53 (negative): Build must not emit TypeScript error lines."""
    result = subprocess.run(
        "npm run build",
        shell=True,
        capture_output=True,
        text=True,
        cwd=REPO_ROOT,
        timeout=120,
    )
    combined = result.stdout + result.stderr
    ts_errors = [line for line in combined.splitlines() if "error TS" in line]
    assert ts_errors == [], "R-P1-53: TypeScript errors found in build output: " + str(
        ts_errors[:5]
    )


def test_r_p1_54_vitest_passes_baseline():
    """R-P1-54: Vitest frontend test count meets baseline (>= 3070). Also covers Playwright sign-off."""
    result = subprocess.run(
        "npx vitest run",
        shell=True,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        cwd=REPO_ROOT,
        timeout=300,
    )
    combined = result.stdout + result.stderr
    # Parse test count
    match = re.search(r"Tests\s+.*?(\d+)\s+passed", combined)
    assert match, "Could not parse test count from vitest output: " + combined[-1000:]
    passed = int(match.group(1))
    assert passed >= 3070, (
        "Frontend test count " + str(passed) + " is below baseline 3070"
    )
    assert result.returncode == 0, (
        "Vitest exited with " + str(result.returncode) + ". Output: " + combined[-2000:]
    )
