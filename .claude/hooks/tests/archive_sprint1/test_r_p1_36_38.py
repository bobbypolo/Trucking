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
    # Behavioral: verify the specific banned pattern is absent
    assert "localStorage" not in content, (
        "services/storage/core.ts still contains localStorage calls"
    )


def test_r_p1_36_core_no_active_exports():
    """R-P1-36: core.ts must not export getTenantKey or migrateKey functions."""
    core_path = os.path.join(SERVICES_DIR, "storage", "core.ts")
    if not os.path.exists(core_path):
        return  # deleted counts as passing
    content = _read_file(core_path)
    bad_patterns = ["export const getTenantKey", "export const migrateKey"]
    found = [p for p in bad_patterns if p in content]
    # Behavioral: found list must equal empty list
    assert found == [], "core.ts still exports deprecated functions: " + ", ".join(
        found
    )


def test_r_p1_36_core_error_if_localstorage_present():
    """R-P1-36 negative/error: raise AssertionError if localStorage found in core.ts."""
    core_path = os.path.join(SERVICES_DIR, "storage", "core.ts")
    if not os.path.exists(core_path):
        return  # deleted counts as passing
    content = _read_file(core_path)
    # Count localStorage occurrences — must be zero
    count = content.count("localStorage")
    assert count == 0, f"core.ts contains {count} localStorage reference(s); expected 0"


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
    """R-P1-37: migrationService.ts must not import from core (removed exports)."""
    path = os.path.join(SERVICES_DIR, "storage", "migrationService.ts")
    if not os.path.exists(path):
        return  # deleted counts as passing
    content = _read_file(path)
    # Behavioral: list of lines with core import must equal empty list
    lines_with_core_import = [
        ln for ln in content.splitlines() if 'from "./core"' in ln
    ]
    assert lines_with_core_import == [], (  # noqa: behavioral
        "migrationService.ts still imports from core.ts (which has no exports): "
        + str(lines_with_core_import)
    )


def test_r_p1_37_migration_service_exports_are_stubs():
    """R-P1-37: migrationService.ts must export stub functions (not live logic)."""
    path = os.path.join(SERVICES_DIR, "storage", "migrationService.ts")
    if not os.path.exists(path):
        return
    content = _read_file(path)
    # Behavioral: specific return values indicate no-op stubs
    assert "return [];" in content, (
        "migrationService.ts getLocalDataSummary must return empty array"
    )
    assert "return true;" in content, (
        "migrationService.ts isMigrationComplete must return true"
    )


def test_r_p1_37_migration_service_error_if_fetch_present():
    """R-P1-37 error: fail if migrationService.ts contains active fetch calls."""
    path = os.path.join(SERVICES_DIR, "storage", "migrationService.ts")
    if not os.path.exists(path):
        return
    content = _read_file(path)
    fetch_count = content.count("fetch(")
    assert fetch_count == 0, (
        f"migrationService.ts contains {fetch_count} fetch() call(s); expected 0"
    )


# ---------------------------------------------------------------------------
# R-P1-38: grep for getTenantKey|migrateKey in services/ returns 0 matches
# ---------------------------------------------------------------------------


def test_r_p1_38_no_tenant_key_or_migrate_key_in_services():
    """R-P1-38: getTenantKey/migrateKey not in services/ (excl tests) returns 0 matches."""
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
    # Behavioral: match count must equal zero
    assert len(matches) == 0, (
        "getTenantKey or migrateKey still found in services/ (non-test):\n"
        + "\n".join(matches)
    )


def test_r_p1_38_storageservice_no_reexport():
    """R-P1-38: services/storageService.ts must not re-export getTenantKey or migrateKey."""
    ss_path = os.path.join(SERVICES_DIR, "storageService.ts")
    if not os.path.exists(ss_path):
        return
    content = _read_file(ss_path)
    # Behavioral: count of references must equal zero
    count_tk = content.count("getTenantKey")
    count_mk = content.count("migrateKey")
    assert count_tk == 0, (
        f"services/storageService.ts re-exports getTenantKey ({count_tk} refs)"
    )
    assert count_mk == 0, (
        f"services/storageService.ts re-exports migrateKey ({count_mk} refs)"
    )


def test_r_p1_38_index_barrel_invalid_if_reexports_present():
    """R-P1-38 invalid/error: storage/index.ts must not re-export getTenantKey or migrateKey."""
    index_path = os.path.join(SERVICES_DIR, "storage", "index.ts")
    if not os.path.exists(index_path):
        return
    content = _read_file(index_path)
    # Negative check: count invalid exports
    invalid_exports = [
        token for token in ["getTenantKey", "migrateKey"] if token in content
    ]
    assert invalid_exports == [], (
        "services/storage/index.ts still has invalid re-exports: "
        + str(invalid_exports)
    )
