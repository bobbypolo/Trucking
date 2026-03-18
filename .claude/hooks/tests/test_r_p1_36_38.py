# Tests R-P1-36, R-P1-37, R-P1-38
"""
STORY-110: Remove Dead localStorage Infrastructure
Tests that services/storage/core.ts and migrationService.ts are dead/no-op
and that getTenantKey/migrateKey are not referenced in services/.
"""

import subprocess
import os

SERVICES_DIR = os.path.normpath(
    os.path.join(os.path.dirname(__file__), "..", "..", "..", "services")
)


def _read_file(path: str) -> str:
    with open(path, encoding="utf-8") as f:
        return f.read()


# ---------------------------------------------------------------------------
# R-P1-36: services/storage/core.ts deleted or contains no localStorage calls
# ---------------------------------------------------------------------------


def test_r_p1_36_core_no_localstorage():
    """R-P1-36: services/storage/core.ts deleted or contains no localStorage calls."""
    core_path = os.path.join(SERVICES_DIR, "storage", "core.ts")
    if not os.path.exists(core_path):
        return  # deleted counts as passing
    content = _read_file(core_path)
    assert "localStorage" not in content, (
        "services/storage/core.ts still contains localStorage calls"
    )


def test_r_p1_36_core_file_exists_or_deleted():
    """R-P1-36 edge: core.ts should either not exist or exist as a no-op stub."""
    core_path = os.path.join(SERVICES_DIR, "storage", "core.ts")
    if os.path.exists(core_path):
        content = _read_file(core_path)
        # Must not export getTenantKey or migrateKey functions
        assert "export const getTenantKey" not in content, (
            "core.ts still exports getTenantKey"
        )
        assert "export const migrateKey" not in content, (
            "core.ts still exports migrateKey"
        )
    # else: file is deleted, which is fine


# ---------------------------------------------------------------------------
# R-P1-37: services/storage/migrationService.ts deleted or is a no-op
# ---------------------------------------------------------------------------


def test_r_p1_37_migration_service_noop():
    """R-P1-37: services/storage/migrationService.ts deleted or is a no-op."""
    path = os.path.join(SERVICES_DIR, "storage", "migrationService.ts")
    if not os.path.exists(path):
        return  # deleted counts as passing
    content = _read_file(path)
    assert "localStorage" not in content, (
        "services/storage/migrationService.ts still uses localStorage"
    )
    assert "fetch(" not in content, (
        "services/storage/migrationService.ts still contains fetch calls"
    )


def test_r_p1_37_migration_service_no_active_imports():
    """R-P1-37 edge: migrationService.ts should not import from core (removed)."""
    path = os.path.join(SERVICES_DIR, "storage", "migrationService.ts")
    if not os.path.exists(path):
        return  # deleted counts as passing
    content = _read_file(path)
    # Should not import from core since core is now a no-op stub with no exports
    assert 'from "./core"' not in content, (
        "migrationService.ts still imports from core.ts"
    )


# ---------------------------------------------------------------------------
# R-P1-38: grep for getTenantKey|migrateKey in services/ returns 0 matches
# ---------------------------------------------------------------------------


def test_r_p1_38_no_tenant_key_or_migrate_key_in_services():
    """R-P1-38: grep for getTenantKey|migrateKey in services/ (excl tests) returns 0 matches."""
    result = subprocess.run(
        ["grep", "-rn", r"getTenantKey\|migrateKey", SERVICES_DIR],
        capture_output=True,
        text=True,
    )
    # Filter out test files
    matches = [
        line
        for line in result.stdout.strip().splitlines()
        if line
        and not any(x in line for x in ["__tests__", ".test.", ".spec.", "/test"])
    ]
    assert matches == [], (
        "getTenantKey or migrateKey still found in services/ (non-test):\n"
        + "\n".join(matches)
    )


def test_r_p1_38_storageservice_no_reexport():
    """R-P1-38 edge: services/storageService.ts must not re-export getTenantKey or migrateKey."""
    ss_path = os.path.join(SERVICES_DIR, "storageService.ts")
    if not os.path.exists(ss_path):
        return
    content = _read_file(ss_path)
    assert "getTenantKey" not in content, (
        "services/storageService.ts still re-exports getTenantKey"
    )
    assert "migrateKey" not in content, (
        "services/storageService.ts still re-exports migrateKey"
    )
