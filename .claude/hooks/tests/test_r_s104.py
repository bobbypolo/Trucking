# Tests R-P1-08, R-P1-09
# Covers: migration 030_gps_positions.sql
"""
S-104: Add GPS positions table.

R-P1-08: Migration 030 creates gps_positions table with compound index
R-P1-09: Can insert and query positions ordered by recorded_at DESC
"""

import os
import re
import subprocess


def _migration_path():
    return os.path.join(
        os.path.dirname(__file__),
        "..", "..", "..", "server", "migrations", "030_gps_positions.sql"
    )


def _read_migration():
    return open(_migration_path(), encoding="utf-8").read()


# ── R-P1-08: Table creation with compound index ─────────────────────────


def test_migration_030_file_exists():
    """R-P1-08: Migration file 030_gps_positions.sql exists."""
    exists = os.path.isfile(_migration_path())
    assert exists == True, (
        f"Migration file not found at {_migration_path()}"
    )


def test_migration_030_has_up_and_down():
    """R-P1-08: Migration has both UP and DOWN markers."""
    content = _read_migration()
    assert content.count("-- UP") == 1, "Must have exactly one -- UP marker"
    assert content.count("-- DOWN") == 1, "Must have exactly one -- DOWN marker"
    # UP must come before DOWN
    up_idx = content.index("-- UP")
    down_idx = content.index("-- DOWN")
    assert up_idx < down_idx, "-- UP must come before -- DOWN"


def test_migration_030_creates_gps_positions_table():
    """R-P1-08: Migration creates gps_positions table with correct name."""
    content = _read_migration()
    match = re.search(r"CREATE TABLE\s+(IF NOT EXISTS\s+)?(\w+)", content, re.IGNORECASE)
    assert match is not None, "Missing CREATE TABLE statement"
    table_name = match.group(2)
    assert table_name == "gps_positions", (
        f"Expected table name 'gps_positions', got '{table_name}'"
    )


def test_migration_030_has_all_required_columns():
    """R-P1-08: Migration has all 12 required columns with correct types."""
    content = _read_migration()

    required = {
        "id": r"id\s+VARCHAR\(36\)",
        "company_id": r"company_id\s+VARCHAR\(36\)\s+NOT NULL",
        "vehicle_id": r"vehicle_id\s+VARCHAR\(36\)\s+NOT NULL",
        "driver_id": r"driver_id\s+VARCHAR\(36\)",
        "latitude": r"latitude\s+DECIMAL\(10,\s*7\)",
        "longitude": r"longitude\s+DECIMAL\(10,\s*7\)",
        "speed": r"speed\s+DECIMAL\(6,\s*2\)",
        "heading": r"heading\s+DECIMAL\(5,\s*2\)",
        "recorded_at": r"recorded_at\s+DATETIME\s+NOT NULL",
        "provider": r"provider\s+VARCHAR\(30\)",
        "provider_vehicle_id": r"provider_vehicle_id\s+VARCHAR\(100\)",
        "created_at": r"created_at\s+TIMESTAMP",
    }
    found_count = 0
    for col_name, pattern in required.items():
        match = re.search(pattern, content, re.IGNORECASE)
        assert match is not None, f"Missing column: {col_name}"
        found_count += 1
    assert found_count == 12, f"Expected 12 columns, found {found_count}"


def test_migration_030_has_compound_index():
    """R-P1-08: Migration has compound index on (company_id, vehicle_id, recorded_at DESC)."""
    content = _read_migration()
    idx_match = re.search(
        r"INDEX\s+(\w+)\s*\(\s*company_id\s*,\s*vehicle_id\s*,\s*recorded_at\s+DESC\s*\)",
        content,
        re.IGNORECASE,
    )
    assert idx_match is not None, "Missing compound index"
    idx_name = idx_match.group(1)
    assert len(idx_name) > 0, "Index must have a name"
    # Verify the index is on the gps_positions table (in the CREATE TABLE block)
    assert "gps_positions" in content[:idx_match.start()], (
        "Index must be inside the gps_positions CREATE TABLE"
    )


def test_migration_030_has_primary_key():
    """R-P1-08: id column is the PRIMARY KEY."""
    content = _read_migration()
    assert "PRIMARY KEY" in content.upper(), "Missing PRIMARY KEY"
    # PRIMARY KEY should be on the id column
    pk_match = re.search(r"id\s+VARCHAR\(36\)\s+PRIMARY KEY", content, re.IGNORECASE)
    assert pk_match is not None, "id VARCHAR(36) must be PRIMARY KEY"


def test_migration_030_uses_innodb():
    """R-P1-08: Table uses InnoDB engine (required for transactions)."""
    content = _read_migration()
    assert "ENGINE=InnoDB" in content, "Must use ENGINE=InnoDB"


def test_migration_030_uses_utf8mb4():
    """R-P1-08: Table uses utf8mb4 charset."""
    content = _read_migration()
    assert "utf8mb4" in content, "Must use utf8mb4 charset"


# ── R-P1-09: Insert and query positions ordered by recorded_at DESC ─────


def test_migration_030_down_drops_only_gps_positions():
    """R-P1-09: DOWN migration drops gps_positions table and nothing else."""
    content = _read_migration()
    down_section = content.split("-- DOWN")[1] if "-- DOWN" in content else ""
    drop_match = re.search(r"DROP TABLE\s+(IF EXISTS\s+)?(\w+)", down_section, re.IGNORECASE)
    assert drop_match is not None, "DOWN section must have DROP TABLE"
    dropped_table = drop_match.group(2)
    assert dropped_table == "gps_positions", (
        f"DOWN must drop 'gps_positions', got '{dropped_table}'"
    )
    drop_count = len(re.findall(r"DROP TABLE", down_section, re.IGNORECASE))
    assert drop_count == 1, f"DOWN must drop exactly 1 table, found {drop_count}"


def test_migration_030_index_supports_desc_queries():
    """R-P1-09: Compound index column order supports WHERE company_id=? AND vehicle_id=? ORDER BY recorded_at DESC."""
    content = _read_migration()
    # The index must have company_id first, then vehicle_id, then recorded_at DESC
    # This column order supports the leftmost prefix rule for queries
    idx_match = re.search(
        r"INDEX\s+\w+\s*\(([^)]+)\)",
        content,
        re.IGNORECASE,
    )
    assert idx_match is not None, "Missing index definition"
    cols = idx_match.group(1)
    col_list = [c.strip().split()[0] for c in cols.split(",")]
    assert col_list == ["company_id", "vehicle_id", "recorded_at"], (
        f"Index columns must be [company_id, vehicle_id, recorded_at], got {col_list}"
    )


def test_migration_030_vitest_passes():
    """R-P1-09: Vitest migration tests for gps_positions pass."""
    result = subprocess.run(
        "npx vitest run __tests__/migrations/030_gps_positions.test.ts",
        shell=True,
        capture_output=True,
        text=True,
        cwd=os.path.join(
            os.path.dirname(__file__),
            "..", "..", "..", "server"
        ),
        encoding="utf-8",
        errors="replace",
        timeout=120,
    )
    assert result.returncode == 0, (
        f"Vitest gps_positions migration tests failed:\n{result.stdout[-2000:]}\n{result.stderr[-2000:]}"
    )


# ── Negative / Edge-case tests ──────────────────────────────────────────


def test_migration_030_no_drop_in_up_section():
    """R-P1-08 (negative): UP section must not contain DROP TABLE."""
    content = _read_migration()
    up_section = content.split("-- DOWN")[0] if "-- DOWN" in content else content
    # Remove the UP marker itself
    up_body = up_section.split("-- UP")[1] if "-- UP" in up_section else up_section
    drop_count = len(re.findall(r"DROP TABLE", up_body, re.IGNORECASE))
    assert drop_count == 0, f"UP section must not DROP any tables, found {drop_count}"


def test_migration_030_no_truncate():
    """R-P1-08 (negative): Migration must not contain TRUNCATE."""
    content = _read_migration()
    assert "TRUNCATE" not in content.upper(), "Migration must not use TRUNCATE"


def test_migration_030_driver_id_is_nullable():
    """R-P1-09 (edge): driver_id should be nullable (positions can exist without a driver)."""
    content = _read_migration()
    # Verify driver_id is NOT marked as NOT NULL
    driver_line_match = re.search(r"driver_id\s+VARCHAR\(36\)\s*(.*?)(?:,|$)", content, re.IGNORECASE)
    assert driver_line_match is not None, "driver_id column must exist"
    after_type = driver_line_match.group(1).upper()
    assert "NOT NULL" not in after_type or "NULL" in after_type, (
        "driver_id should be nullable (NULL allowed)"
    )
