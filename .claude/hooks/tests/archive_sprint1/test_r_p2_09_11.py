"""Tests R-P2-09, R-P2-10, R-P2-11"""
# Tests R-P2-09, R-P2-10, R-P2-11

import re
import subprocess
from pathlib import Path

APP_TSX = Path("F:/Trucking/DisbatchMe/App.tsx")


def test_no_fallback_null_in_app_tsx():
    """R-P2-09: grep -rn 'fallback={null}' App.tsx returns 0 matches"""
    content = APP_TSX.read_text(encoding="utf-8")
    matches = re.findall(r"fallback=\{null\}", content)
    assert len(matches) == 0, (
        f"Found {len(matches)} fallback={{null}} instances in App.tsx"
    )


def test_every_suspense_has_loading_skeleton_fallback():
    """R-P2-10: Every <Suspense> in App.tsx has a LoadingSkeleton fallback"""
    content = APP_TSX.read_text(encoding="utf-8")
    suspense_tags = re.findall(r"<Suspense[^>]*(?:>|/>)", content, re.DOTALL)
    for tag in suspense_tags:
        if "fallback=" in tag:
            assert "LoadingSkeleton" in tag, (
                f"Suspense tag has non-LoadingSkeleton fallback: {tag[:100]}"
            )


def test_build_succeeds():
    """R-P2-11: npm run build succeeds (no new bundle size regression)"""
    result = subprocess.run(
        'cd /d "F:\\Trucking\\DisbatchMe" && npm run build',
        shell=True,
        capture_output=True,
        text=True,
        timeout=180,
    )
    assert result.returncode == 0, (
        f"npm run build failed:\n"
        f"stdout: {result.stdout[-2000:]}\n"
        f"stderr: {result.stderr[-2000:]}"
    )
