"""
Tests for services/storage/directory.ts

Verifies the directory service module uses server API (not localStorage)
after STORY-502 comment hygiene update.
"""

import pathlib

REPO_ROOT = pathlib.Path(__file__).resolve().parents[3]


class TestDirectoryService:
    """directory.ts uses server API, no localStorage calls."""

    def test_directory_ts_exists(self):
        """services/storage/directory.ts exists."""
        f = REPO_ROOT / "services" / "storage" / "directory.ts"
        assert f.exists(), f"Expected {f} to exist"

    def test_directory_uses_api_url(self):
        """directory.ts uses API_URL for server calls."""
        content = (REPO_ROOT / "services" / "storage" / "directory.ts").read_text(encoding="utf-8")
        assert "API_URL" in content, "directory.ts should use API_URL"

    def test_directory_no_localstorage(self):
        """directory.ts has no localStorage calls."""
        content = (REPO_ROOT / "services" / "storage" / "directory.ts").read_text(encoding="utf-8")
        lines = content.splitlines()
        violations = []
        for i, line in enumerate(lines, 1):
            stripped = line.strip()
            if stripped.startswith("//") or stripped.startswith("*"):
                continue
            if "localStorage" in line:
                violations.append(f"line {i}: {line.strip()}")
        msg = "directory.ts should have no localStorage calls: " + "; ".join(violations)
        assert len(violations) == 0, msg

    def test_directory_exports_get_providers(self):
        """directory.ts exports getProviders function."""
        content = (REPO_ROOT / "services" / "storage" / "directory.ts").read_text(encoding="utf-8")
        assert "getProviders" in content, "directory.ts should export getProviders"
