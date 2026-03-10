# Tests R-P3-01, R-P3-02, R-P3-03, R-P3-04, R-P3-05
"""
STORY-003: Express Type Augmentation - as-any Elimination
Tests that verify all as any casts have been removed from server routes/middleware
and App.tsx, and that TypeScript compilation remains clean.
"""

import subprocess
import os

PROJECT_ROOT = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..", "..")
)
SERVER_DIR = os.path.join(PROJECT_ROOT, "server")


def test_r_p3_01_no_as_any_server_routes_middleware():
    """# Tests R-P3-01 -- grep -r 'as any' server/routes/ server/middleware/ returns 0 matches."""
    result = subprocess.run(
        ["grep", "-r", "as any", "server/routes/", "server/middleware/"],
        capture_output=True,
        text=True,
        cwd=PROJECT_ROOT,
    )
    lines = [l for l in result.stdout.splitlines() if l.strip()]
    assert len(lines) == 0, (
        f"Found {len(lines)} 'as any' casts in server routes/middleware"
    )


def test_r_p3_02_no_as_any_app_tsx():
    """# Tests R-P3-02 -- grep -c 'as any' App.tsx returns 0."""
    app_path = os.path.join(PROJECT_ROOT, "App.tsx")
    if not os.path.exists(app_path):
        return  # App.tsx may not exist in server-only context
    result = subprocess.run(
        ["grep", "-c", "as any", "App.tsx"],
        capture_output=True,
        text=True,
        cwd=PROJECT_ROOT,
    )
    count = int(result.stdout.strip()) if result.stdout.strip().isdigit() else 0
    assert count == 0, f"Found {count} 'as any' casts in App.tsx"


def test_r_p3_03_server_tsc_clean():
    """# Tests R-P3-03 -- cd server && npx tsc --noEmit exits 0."""
    result = subprocess.run(
        "npx tsc --noEmit",
        capture_output=True,
        text=True,
        cwd=SERVER_DIR,
        shell=True,
        timeout=120,
    )
    assert result.returncode == 0, (
        f"Server TypeScript check failed:\n{result.stdout}\n{result.stderr}"
    )


def test_r_p3_04_frontend_tsc_clean():
    """# Tests R-P3-04 -- npx tsc --noEmit exits 0."""
    result = subprocess.run(
        "npx tsc --noEmit",
        capture_output=True,
        text=True,
        cwd=PROJECT_ROOT,
        shell=True,
        timeout=120,
    )
    assert result.returncode == 0, (
        f"Frontend TypeScript check failed:\n{result.stdout}\n{result.stderr}"
    )


def test_r_p3_05_server_vitest_pass():
    """# Tests R-P3-05 -- cd server && npx vitest run exits 0."""
    result = subprocess.run(
        "npx vitest run",
        capture_output=True,
        text=True,
        cwd=SERVER_DIR,
        shell=True,
        timeout=300,
    )
    assert result.returncode == 0, (
        f"Server vitest failed:\n{result.stdout[-3000:]}\n{result.stderr[-1000:]}"
    )
