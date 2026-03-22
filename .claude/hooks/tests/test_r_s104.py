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


def test_migration_030_file_exists():
    """R-P1-08: Migration file 030_gps_positions.sql exists."""
    assert os.path.isfile(_migration_path()), (
        f"Migration file not found at {_migration_path()}"
    )


def test_migration_030_has_up_and_down():
    """R-P1-08: Migration has both UP and DOWN markers."""
    content = open(_migration_path(), encoding="utf-8").read()
    assert "-- UP" in content, "Missing -- UP marker"
    assert "-- DOWN" in content, "Missing -- DOWN marker"


def test_migration_030_creates_gps_positions_table():
    """R-P1-08: Migration creates gps_positions table."""
    content = open(_migration_path(), encoding="utf-8").read()
    assert re.search(r"CREATE TABLE\s+(IF NOT EXISTS\s+)?gps_positions", content, re.IGNORECASE), (
        "Missing CREATE TABLE gps_positions"
    )


def test_migration_030_has_all_required_columns():
    """R-P1-08: Migration has all required columns with correct types."""
    content = open(_migration_path(), encoding="utf-8").read()

    assert re.search(r"id\s+VARCHAR\(36\)", content, re.IGNORECASE), "Missing id VARCHAR(36)"
    assert re.search(r"company_id\s+VARCHAR\(36\)\s+NOT NULL", content, re.IGNORECASE), "Missing company_id"
    assert re.search(r"vehicle_id\s+VARCHAR\(36\)\s+NOT NULL", content, re.IGNORECASE), "Missing vehicle_id"
    assert re.search(r"driver_id\s+VARCHAR\(36\)", content, re.IGNORECASE), "Missing driver_id"
    assert re.search(r"latitude\s+DECIMAL\(10,\s*7\)", content, re.IGNORECASE), "Missing latitude DECIMAL(10,7)"
    assert re.search(r"longitude\s+DECIMAL\(10,\s*7\)", content, re.IGNORECASE), "Missing longitude DECIMAL(10,7)"
    assert re.search(r"speed\s+DECIMAL\(6,\s*2\)", content, re.IGNORECASE), "Missing speed DECIMAL(6,2)"
    assert re.search(r"heading\s+DECIMAL\(5,\s*2\)", content, re.IGNORECASE), "Missing heading DECIMAL(5,2)"
    assert re.search(r"recorded_at\s+DATETIME\s+NOT NULL", content, re.IGNORECASE), "Missing recorded_at DATETIME"
    assert re.search(r"provider\s+VARCHAR\(30\)", content, re.IGNORECASE), "Missing provider VARCHAR(30)"
    assert re.search(r"provider_vehicle_id\s+VARCHAR\(100\)", content, re.IGNORECASE), "Missing provider_vehicle_id"
    assert re.search(r"created_at\s+TIMESTAMP", content, re.IGNORECASE), "Missing created_at TIMESTAMP"


def test_migration_030_has_compound_index():
    """R-P1-08: Migration has compound index on (company_id, vehicle_id, recorded_at DESC)."""
    content = open(_migration_path(), encoding="utf-8").read()
    assert re.search(
        r"INDEX\s+\w+\s*\(\s*company_id\s*,\s*vehicle_id\s*,\s*recorded_at\s+DESC\s*\)",
        content,
        re.IGNORECASE,
    ), "Missing compound index on (company_id, vehicle_id, recorded_at DESC)"


def test_migration_030_down_drops_table():
    """R-P1-09: DOWN migration drops gps_positions table."""
    content = open(_migration_path(), encoding="utf-8").read()
    down_section = content.split("-- DOWN")[1] if "-- DOWN" in content else ""
    assert re.search(r"DROP TABLE\s+(IF EXISTS\s+)?gps_positions", down_section, re.IGNORECASE), (
        "DOWN migration must drop gps_positions table"
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
