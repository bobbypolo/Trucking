#!/usr/bin/env bash
# apply-migrations.sh — Apply schema.sql + all migrations 001-013 sequentially.
# Exits 0 on success, non-zero on any SQL error.
#
# Usage:
#   DB_USER=root DB_PASSWORD=secret DB_HOST=127.0.0.1 DB_NAME=trucklogix \
#     bash server/scripts/apply-migrations.sh
#
# Environment variables (all required):
#   DB_USER      — MySQL username
#   DB_PASSWORD  — MySQL password
#   DB_HOST      — MySQL host (default: 127.0.0.1)
#   DB_NAME      — Target database name (default: trucklogix)
#
# Tests R-P1-04

set -euo pipefail

DB_USER="${DB_USER:?DB_USER not set}"
DB_PASSWORD="${DB_PASSWORD:?DB_PASSWORD not set}"
DB_HOST="${DB_HOST:-127.0.0.1}"
DB_NAME="${DB_NAME:-trucklogix}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
MIGRATIONS_DIR="${SERVER_DIR}/migrations"

MYSQL_CMD=(mysql -u"${DB_USER}" -p"${DB_PASSWORD}" -h"${DB_HOST}" --batch --silent)

# Ordered list of migrations — schema.sql first, then numbered migrations
MIGRATION_FILES=(
  "${SERVER_DIR}/schema.sql"
  "${MIGRATIONS_DIR}/001_baseline.sql"
  "${MIGRATIONS_DIR}/002_add_version_columns.sql"
  "${MIGRATIONS_DIR}/002_load_status_normalization.sql"
  "${MIGRATIONS_DIR}/003_enhance_dispatch_events.sql"
  "${MIGRATIONS_DIR}/003_operational_entities.sql"
  "${MIGRATIONS_DIR}/004_idempotency_keys.sql"
  "${MIGRATIONS_DIR}/005_documents_table.sql"
  "${MIGRATIONS_DIR}/006_add_load_legs_lat_lng.sql"
  "${MIGRATIONS_DIR}/007_ocr_results.sql"
  "${MIGRATIONS_DIR}/008_settlements.sql"
  "${MIGRATIONS_DIR}/009_settlement_adjustments.sql"
  "${MIGRATIONS_DIR}/010_add_firebase_uid_to_users.sql"
  "${MIGRATIONS_DIR}/011_accounting_financial_ledger.sql"
  "${MIGRATIONS_DIR}/012_accounting_v3_extensions.sql"
  "${MIGRATIONS_DIR}/013_ifta_intelligence.sql"
)

echo "[apply-migrations] Starting migration run against ${DB_HOST}/${DB_NAME}"
echo "[apply-migrations] Total files: ${#MIGRATION_FILES[@]}"

SQL_ERRORS=0

for file in "${MIGRATION_FILES[@]}"; do
  if [[ ! -f "${file}" ]]; then
    echo "[apply-migrations] SKIP (file not found): ${file}"
    continue
  fi

  filename="$(basename "${file}")"
  echo "[apply-migrations] Applying: ${filename} ..."

  # Extract only the UP section (content before '-- DOWN')
  # If no '-- DOWN' marker, use full file content
  up_sql=$(awk '/^-- DOWN/{exit} {print}' "${file}")

  # Run the UP section through mysql, capturing stderr for error detection
  if err_output=$("${MYSQL_CMD[@]}" "${DB_NAME}" <<< "${up_sql}" 2>&1); then
    echo "[apply-migrations] OK: ${filename}"
  else
    echo "[apply-migrations] ERROR in ${filename}: ${err_output}" >&2
    ((SQL_ERRORS++)) || true
  fi
done

echo "[apply-migrations] Done. SQL errors: ${SQL_ERRORS}"

if [[ "${SQL_ERRORS}" -gt 0 ]]; then
  echo "[apply-migrations] FAILED with ${SQL_ERRORS} error(s)" >&2
  exit 1
fi

echo "[apply-migrations] SUCCESS — all migrations applied cleanly"
exit 0
