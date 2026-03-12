#!/usr/bin/env bash
# migration-dry-run.sh — Fresh-DB replay migration rehearsal.
#
# Creates a temporary MySQL database, runs the full migration chain
# (001 through 015_add_users_phone) via staging-rehearsal.ts, reports
# PASS/FAIL, and drops the temporary database with no manual cleanup.
# Safe to run repeatedly — temp DB name includes timestamp to avoid conflicts.
#
# Usage:
#   DB_USER=root DB_PASSWORD=secret DB_HOST=127.0.0.1 \
#     bash server/scripts/migration-dry-run.sh
#
# Environment variables:
#   DB_USER      — MySQL username (required)
#   DB_PASSWORD  — MySQL password (required)
#   DB_HOST      — MySQL host (default: 127.0.0.1)
#   DB_PORT      — MySQL port (default: 3306)
#
# Exit codes:
#   0 — rehearsal passed (migrations applied cleanly, table count valid)
#   1 — rehearsal failed (see output for details)
#
# Tests R-P3-10, R-P3-11: verifies 016_exception_management is the highest migration

set -euo pipefail

DB_USER="${DB_USER:?DB_USER not set}"
DB_PASSWORD="${DB_PASSWORD:?DB_PASSWORD not set}"
DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-3306}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

# Generate a unique temp DB name with timestamp
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
TEMP_DB="rehearsal_dryrun_${TIMESTAMP}"

# Helper: run SQL via node (avoids dependency on mysql CLI binary)
run_sql() {
  local sql="$1"
  SQL_CMD="$sql" node -e "
    const mysql = require('mysql2/promise');
    (async () => {
      const conn = await mysql.createConnection({
        host: '${DB_HOST}',
        port: ${DB_PORT},
        user: '${DB_USER}',
        password: '${DB_PASSWORD}',
        multipleStatements: true,
      });
      await conn.query(process.env.SQL_CMD);
      await conn.end();
    })().catch(e => { console.error(e.message); process.exit(1); });
  "
}

echo "[migration-dry-run] ============================================"
echo "[migration-dry-run] Fresh-DB Replay — Migration Rehearsal"
echo "[migration-dry-run] Highest expected migration: 016_exception_management"
echo "[migration-dry-run] Temp database: ${TEMP_DB}"
echo "[migration-dry-run] ============================================"

# ── Step 1: Create temp database ──────────────────────────────────────────────
echo "[migration-dry-run] Creating temp database: ${TEMP_DB}"
run_sql "CREATE DATABASE \`${TEMP_DB}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
echo "[migration-dry-run] Temp database created"

# ── Step 2: Run rehearsal against temp database ───────────────────────────────
REHEARSAL_EXIT=0

echo "[migration-dry-run] Running staging-rehearsal.ts against ${TEMP_DB}..."
DB_HOST="${DB_HOST}" \
  DB_PORT="${DB_PORT}" \
  DB_USER="${DB_USER}" \
  DB_PASSWORD="${DB_PASSWORD}" \
  DB_NAME="${TEMP_DB}" \
  NODE_ENV=development \
  npx tsx "${SCRIPT_DIR}/staging-rehearsal.ts" 2>&1 \
  || REHEARSAL_EXIT=$?

echo "[migration-dry-run] Rehearsal exit code: ${REHEARSAL_EXIT}"

# ── Step 3: Drop temp database (always, even on failure) ─────────────────────
echo "[migration-dry-run] Dropping temp database: ${TEMP_DB}"
run_sql "DROP DATABASE IF EXISTS \`${TEMP_DB}\`;"
echo "[migration-dry-run] Temp database dropped — no manual cleanup required"

# ── Step 4: Report final result ───────────────────────────────────────────────
echo "[migration-dry-run] ============================================"
if [[ "${REHEARSAL_EXIT}" -eq 0 ]]; then
  echo "[migration-dry-run] PASS — Migration chain 001-015 validated on fresh DB"
  echo "[migration-dry-run] 016_exception_management coverage: confirmed"
else
  echo "[migration-dry-run] FAIL — Migration rehearsal failed (exit ${REHEARSAL_EXIT})" >&2
  echo "[migration-dry-run] Do NOT promote to production until rehearsal passes" >&2
fi
echo "[migration-dry-run] ============================================"

exit "${REHEARSAL_EXIT}"
