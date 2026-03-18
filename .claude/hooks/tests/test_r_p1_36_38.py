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


def test_r_p1_36_core_no_active_exports():
    """R-P1-36 edge: core.ts must not export getTenantKey or migrateKey functions."""
    core_path = os.path.join(SERVICES_DIR, "storage", "core.ts")
    if not os.path.exists(core_path):
        return  # deleted counts as passing
    content = _read_file(core_path)
    # Verify the deprecated functions are absent
    bad_patterns = ["export const getTenantKey", "export const migrateKey"]
    found = [p for p in bad_patterns if p in content]
    assert found == [], "core.ts still exports deprecated functions: " + ", ".join(
        found
    )


def test_r_p1_36_core_is_stub_or_empty():
    """R-P1-36 negative: core.ts should be a stub (no functional logic)."""
    core_path = os.path.join(SERVICES_DIR, "storage", "core.ts")
    if not os.path.exists(core_path):
        return
    content = _read_file(core_path)
    # Stub files have no function bodies with curly-brace logic
    # A no-op file has <= 15 non-blank lines
    non_blank_lines = [ln for ln in content.splitlines() if ln.strip()]
    assert len(non_blank_lines) <= 15, (
        f"core.ts has {len(non_blank_lines)} non-blank lines — expected stub (<= 15). "
        "May still contain active logic."
    )


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
    """R-P1-37 edge: migrationService.ts should not import from core (removed exports)."""
    path = os.path.join(SERVICES_DIR, "storage", "migrationService.ts")
    if not os.path.exists(path):
        return  # deleted counts as passing
    content = _read_file(path)
    # core.ts is now a no-op stub with no exports — any import would fail at runtime
    lines_with_core_import = [
        ln for ln in content.splitlines() if 'from "./core"' in ln
    ]
    assert lines_with_core_import == [], (
        "migrationService.ts still imports from core.ts (which has no exports): "
        + str(lines_with_core_import)
    )


def test_r_p1_37_migration_service_exports_are_stubs():
    """R-P1-37 negative: migrationService.ts must export stub functions (not live logic)."""
    path = os.path.join(SERVICES_DIR, "storage", "migrationService.ts")
    if not os.path.exists(path):
        return
    content = _read_file(path)
    # Stub getLocalDataSummary must return empty array — check for return []
    assert "return [];" in content, (
        "migrationService.ts getLocalDataSummary must return empty array (no-op stub)"
    )
    # Stub isMigrationComplete must return true
    assert "return true;" in content, (
        "migrationService.ts isMigrationComplete must return true (migration complete)"
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


def test_r_p1_38_index_barrel_no_reexport():
    """R-P1-38 negative: storage/index.ts must not re-export getTenantKey or migrateKey."""
    index_path = os.path.join(SERVICES_DIR, "storage", "index.ts")
    if not os.path.exists(index_path):
        return
    content = _read_file(index_path)
    # Negative check: these exports must be absent
    assert "getTenantKey" not in content, (
        "services/storage/index.ts still exports getTenantKey"
    )
    assert "migrateKey" not in content, (
        "services/storage/index.ts still exports migrateKey"
    )
