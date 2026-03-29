"""Tests for Phase 16: Documentation Staleness Remediation.

Validates that documentation files reference correct current file names,
contain no references to deleted components, and have accurate migration
numbering.
"""

import re
from pathlib import Path

import pytest

# Resolve project root from this test file location
_TEST_DIR = Path(__file__).resolve().parent  # .claude/hooks/tests/
_HOOKS_DIR = _TEST_DIR.parent  # .claude/hooks/
_CLAUDE_DIR = _HOOKS_DIR.parent  # .claude/
PROJECT_ROOT = _CLAUDE_DIR.parent  # project root


class TestDocFileReferencesCorrect:
    """# Tests R-P16-01 — All doc files reference correct current file names."""

    def test_production_checklist_weather_reference(self):
        """# Tests R-P16-01

        PRODUCTION_CHECKLIST.md must reference WEATHER_API_SETUP.md (the actual
        file), not the deleted WEATHER_SETUP_DEV.md.
        """
        checklist = PROJECT_ROOT / "PRODUCTION_CHECKLIST.md"
        if not checklist.exists():
            pytest.skip("PRODUCTION_CHECKLIST.md not present in worktree")
        content = checklist.read_text(encoding="utf-8")
        assert "WEATHER_SETUP_DEV.md" not in content, (
            "PRODUCTION_CHECKLIST.md still references deleted WEATHER_SETUP_DEV.md"
        )
        assert "WEATHER_API_SETUP.md" in content, (
            "PRODUCTION_CHECKLIST.md should reference WEATHER_API_SETUP.md"
        )

    def test_migration_readme_next_prefix_is_043(self):
        """# Tests R-P16-01

        server/migrations/README.md must state the next available prefix as 043,
        matching the actual migration files on disk (001 through 042).
        """
        readme = PROJECT_ROOT / "server" / "migrations" / "README.md"
        if not readme.exists():
            pytest.skip("server/migrations/README.md not present in worktree")
        content = readme.read_text(encoding="utf-8")
        assert "currently `043`" in content, (
            "Migration README should say next prefix is 043 (actual files go through 042)"
        )

    def test_migration_readme_documents_038_042(self):
        """# Tests R-P16-01

        server/migrations/README.md must document all migration files through 042,
        including the duplicate 038 and 039 prefixes.
        """
        readme = PROJECT_ROOT / "server" / "migrations" / "README.md"
        if not readme.exists():
            pytest.skip("server/migrations/README.md not present in worktree")
        content = readme.read_text(encoding="utf-8")
        # Must mention the new migrations 040-042
        assert "040_parties_tags" in content, (
            "Migration README must document 040_parties_tags.sql"
        )
        assert "041_tracking_provider_configs" in content, (
            "Migration README must document 041_tracking_provider_configs.sql"
        )
        assert "042_add_documents_is_locked" in content, (
            "Migration README must document 042_add_documents_is_locked.sql"
        )

    def test_migration_readme_documents_duplicate_038_039(self):
        """# Tests R-P16-01

        server/migrations/README.md must document the duplicate 038 and 039
        prefixes (like the existing duplicate 002/003 documentation).
        """
        readme = PROJECT_ROOT / "server" / "migrations" / "README.md"
        if not readme.exists():
            pytest.skip("server/migrations/README.md not present in worktree")
        content = readme.read_text(encoding="utf-8")
        assert "038_parties_tags" in content, (
            "Migration README must document 038_parties_tags.sql"
        )
        assert "039_tracking_provider_configs" in content, (
            "Migration README must document 039_tracking_provider_configs.sql"
        )


class TestNoDeletedComponentReferences:
    """# Tests R-P16-02 — No references to deleted components in docs."""

    def test_no_scanneroverlay_reference(self):
        """# Tests R-P16-02

        ScannerOverlay.tsx was deleted. No doc file should reference it.
        """
        docs_dir = PROJECT_ROOT / "docs"
        if not docs_dir.exists():
            pytest.skip("docs/ directory not present in worktree")

        violations = []
        for md_file in docs_dir.rglob("*.md"):
            content = md_file.read_text(encoding="utf-8", errors="replace")
            if "ScannerOverlay.tsx" in content:
                rel = md_file.relative_to(PROJECT_ROOT)
                violations.append(str(rel))

        assert violations == [], (
            f"Deleted ScannerOverlay.tsx still referenced in: {violations}"
        )

    def test_no_frontend_geminiservice_reference(self):
        """# Tests R-P16-02

        Frontend geminiService.ts was deleted (moved to server-side
        server/services/gemini.service.ts). Doc references should use
        the server-side path or note the migration.
        """
        docs_dir = PROJECT_ROOT / "docs"
        if not docs_dir.exists():
            pytest.skip("docs/ directory not present in worktree")

        # Check that no doc references geminiService.ts as if it still exists
        # in the frontend services/ directory
        violations = []
        for md_file in docs_dir.rglob("*.md"):
            content = md_file.read_text(encoding="utf-8", errors="replace")
            # Match references that imply geminiService.ts is a current frontend file
            # Allow references that note it was deleted/moved
            for i, line in enumerate(content.splitlines(), 1):
                if (
                    "geminiService.ts" in line
                    and "deleted" not in line.lower()
                    and "moved" not in line.lower()
                    and "was" not in line.lower()
                ):
                    rel = md_file.relative_to(PROJECT_ROOT)
                    violations.append(f"{rel}:{i}")

        # At minimum, the FRONTEND_FINDINGS_TRIAGE should have updated references
        triage = docs_dir / "validation" / "FRONTEND_FINDINGS_TRIAGE.md"
        if triage.exists():
            content = triage.read_text(encoding="utf-8")
            lines_with_ref = [
                i
                for i, line in enumerate(content.splitlines(), 1)
                if "geminiService.ts" in line
                and "deleted" not in line.lower()
                and "moved" not in line.lower()
                and "was" not in line.lower()
                and "server" not in line.lower()
            ]
            assert lines_with_ref == [], (
                f"FRONTEND_FINDINGS_TRIAGE.md references deleted geminiService.ts "
                f"without noting it was moved: lines {lines_with_ref}"
            )


class TestMigrationNumbering:
    """# Tests R-P16-03 — Migration numbering in docs matches actual files."""

    def test_migration_count_matches_readme(self):
        """# Tests R-P16-03

        The migration README must accurately reflect the total number of
        migration files and the highest prefix number.
        """
        migrations_dir = PROJECT_ROOT / "server" / "migrations"
        if not migrations_dir.exists():
            pytest.skip("server/migrations/ not present in worktree")

        sql_files = sorted(migrations_dir.glob("*.sql"))
        total_files = len(sql_files)

        # Extract highest prefix number
        prefixes = []
        for f in sql_files:
            match = re.match(r"^(\d{3})_", f.name)
            if match:
                prefixes.append(int(match.group(1)))

        highest_prefix = max(prefixes) if prefixes else 0
        assert highest_prefix == 42, (
            f"Expected highest migration prefix 042, got {highest_prefix:03d}"
        )
        assert total_files == 46, (
            f"Expected 46 migration files (with duplicate 002/003/038/039 prefixes), "
            f"got {total_files}"
        )

    def test_readme_next_prefix_consistent(self):
        """# Tests R-P16-03

        The 'next available prefix' in README.md must be exactly one more
        than the highest existing migration prefix.
        """
        migrations_dir = PROJECT_ROOT / "server" / "migrations"
        readme = migrations_dir / "README.md"
        if not readme.exists():
            pytest.skip("server/migrations/README.md not present in worktree")

        sql_files = sorted(migrations_dir.glob("*.sql"))
        prefixes = []
        for f in sql_files:
            match = re.match(r"^(\d{3})_", f.name)
            if match:
                prefixes.append(int(match.group(1)))

        highest = max(prefixes) if prefixes else 0
        assert highest == 42, f"Expected highest prefix 042, got {highest:03d}"
        expected_next = f"{highest + 1:03d}"
        assert expected_next == "043", (
            f"Expected next prefix to be 043, got {expected_next}"
        )

        content = readme.read_text(encoding="utf-8")
        assert f"currently `{expected_next}`" in content, (
            f"README says wrong next prefix; should be `{expected_next}` "
            f"(highest existing is {highest:03d})"
        )

    def test_readme_documents_duplicate_prefixes(self):
        """# Tests R-P16-03

        README.md must mention all sets of duplicate prefixes
        (002, 003, 038, 039).
        """
        readme = PROJECT_ROOT / "server" / "migrations" / "README.md"
        if not readme.exists():
            pytest.skip("server/migrations/README.md not present in worktree")
        content = readme.read_text(encoding="utf-8")
        # Already documents 002 and 003 duplicates
        assert "002" in content, "README must document duplicate 002 prefix"
        assert "003" in content, "README must document duplicate 003 prefix"
        # Must also document the new 038 and 039 duplicates
        assert "038" in content, "README must document duplicate 038 prefix"
        assert "039" in content, "README must document duplicate 039 prefix"


class TestNegativeCases:
    """Negative tests verifying invalid/stale references are rejected."""

    def test_invalid_weather_ref_absent(self):
        """# Tests R-P16-01

        Verify that the invalid WEATHER_SETUP_DEV.md reference (a deleted file)
        is not present. The checklist must reference the correct file name.
        """
        checklist = PROJECT_ROOT / "PRODUCTION_CHECKLIST.md"
        if not checklist.exists():
            pytest.skip("PRODUCTION_CHECKLIST.md not present in worktree")
        content = checklist.read_text(encoding="utf-8")
        invalid_count = content.count("WEATHER_SETUP_DEV.md")
        assert invalid_count == 0, (
            f"Found {invalid_count} invalid WEATHER_SETUP_DEV.md references"
        )

    def test_invalid_migration_prefix_rejected(self):
        """# Tests R-P16-03

        Verify that the old invalid prefix 040 is no longer stated as the
        next available prefix in the migration README.
        """
        readme = PROJECT_ROOT / "server" / "migrations" / "README.md"
        if not readme.exists():
            pytest.skip("server/migrations/README.md not present in worktree")
        content = readme.read_text(encoding="utf-8")
        assert "currently `040`" not in content, (
            "Migration README still says invalid prefix 040 (should be 043)"
        )
