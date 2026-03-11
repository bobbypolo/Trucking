# Tests R-P2-01, R-P2-02, R-P2-03, R-P2-04, R-P2-05
"""
STORY-002: Firebase UID Linkage (foundation)
Validates backfill_firebase_uid.cjs script, migration 010 (firebase_uid column),
resolveSqlPrincipalByFirebaseUid, and dev user linkage.
"""

import subprocess
import os


def _repo_root():
    return str(
        __import__("pathlib").Path(__file__).resolve().parent.parent.parent.parent
    )


def _server_dir():
    return os.path.join(_repo_root(), "server")


def _server_file(relative_path):
    return os.path.join(_server_dir(), relative_path)


def test_r_p2_01_backfill_script_exists():
    path = _server_file("scripts/backfill_firebase_uid.cjs")
    assert os.path.exists(path), "backfill script not found at " + path


def test_r_p2_01_backfill_has_json_keys():
    path = _server_file("scripts/backfill_firebase_uid.cjs")
    with open(path) as f:
        content = f.read()
    assert "updated" in content
    assert "alreadyLinked" in content
    assert "missingFirebaseUser" in content
    assert "total" in content
    assert "JSON.stringify" in content


def test_r_p2_01_migration_010_exists():
    path = _server_file("migrations/010_add_firebase_uid_to_users.sql")
    assert os.path.exists(path), "Migration 010 not found at " + path


def test_r_p2_02_seed_script_exists():
    path = _server_file("scripts/seed-dev-user.cjs")
    assert os.path.exists(path), "Dev user seed script not found at " + path


def test_r_p2_03_unique_constraint_in_migration():
    path = _server_file("migrations/010_add_firebase_uid_to_users.sql")
    with open(path) as f:
        content = f.read()
    assert "UNIQUE" in content.upper()


def test_r_p2_04_resolve_function_exists():
    path = _server_file("lib/sql-auth.ts")
    assert os.path.exists(path)
    with open(path) as f:
        content = f.read()
    assert "resolveSqlPrincipalByFirebaseUid" in content
    assert "firebase_uid = ?" in content


def test_r_p2_05_verify_script_exists():
    path = _server_file("scripts/verify-firebase-uid-linkage.cjs")
    assert os.path.exists(path)


def test_r_p2_05_vitest_suite_passes():
    server = _server_dir()
    cmd = "npx vitest run __tests__/scripts/backfill-firebase-uid.test.ts --reporter=verbose"
    result = subprocess.run(
        cmd,
        cwd=server,
        capture_output=True,
        encoding="utf-8",
        errors="replace",
        timeout=60,
        shell=True,
    )
    combined = (result.stdout or "") + (result.stderr or "")
    assert result.returncode == 0, "vitest failed: " + combined[-500:]
    assert "passed" in combined.lower()
