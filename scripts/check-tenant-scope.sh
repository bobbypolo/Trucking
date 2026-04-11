#!/usr/bin/env bash
# check-tenant-scope.sh — tenant isolation check (reference / local-dev)
#
# NOTE: CI now runs the Node.js port at scripts/check-tenant-scope.cjs.
# The self-hosted Windows runner has no bash (WSL is not installed), so
# this script cannot execute under GitHub Actions. The .cjs port is the
# source of truth for CI; this file is retained for POSIX developers who
# prefer running the shell version locally. Both implementations must
# produce byte-identical output — verify with:
#   diff <(bash scripts/check-tenant-scope.sh) <(node scripts/check-tenant-scope.cjs)
#
# Tests R-P3-04: CI grep check fails on unscoped tenant-table queries
#
# For each tenant-scoped table, scans server/ TypeScript files for
# SELECT/UPDATE/DELETE queries that reference the table but do NOT
# include "company_id" in the same query string.
#
# Exit 0 = all queries scoped
# Exit 1 = unscoped queries found
#
# Usage: bash scripts/check-tenant-scope.sh

set -euo pipefail

# Tables that have a company_id column directly.
# Tables without company_id (e.g., dispatch_events, load_legs) inherit tenant
# scope via FK relationships and are excluded from this check.
TENANT_TABLES=(
  loads
  equipment
  users
  invoices
  bills
  settlements
  documents
  tracking_events
  incidents
  call_sessions
  ar_invoices
  ap_bills
  driver_settlements
  compliance_records
  work_items
)

# Directories to scan
SCAN_DIRS="server/routes server/services server/repositories"

violations=0

for table in "${TENANT_TABLES[@]}"; do
  # Find lines with SELECT/UPDATE/DELETE referencing this table
  # but NOT containing company_id on the same line or within 2 lines
  # We use a two-pass approach:
  #   Pass 1: Find all SQL query lines referencing this table
  #   Pass 2: Check if company_id appears within the surrounding context

  # Grep for SQL statements referencing this table in .ts files
  matches=$(grep -rn \
    -E "(SELECT|UPDATE|DELETE|INSERT).*\b${table}\b" \
    --include="*.ts" \
    $SCAN_DIRS 2>/dev/null || true)

  if [ -z "$matches" ]; then
    continue
  fi

  while IFS= read -r line; do
    file=$(echo "$line" | cut -d: -f1)
    lineno=$(echo "$line" | cut -d: -f2)
    content=$(echo "$line" | cut -d: -f3-)

    # Skip test files
    if echo "$file" | grep -qE '__tests__|\.test\.|\.spec\.'; then
      continue
    fi

    # Skip comments
    if echo "$content" | grep -qE '^\s*(//|/\*|\*)'; then
      continue
    fi

    # Check if company_id appears in the same query context
    # Look at the line itself and 5 lines after it for multi-line queries
    context=$(sed -n "${lineno},$((lineno + 5))p" "$file" 2>/dev/null || true)

    if ! echo "$context" | grep -q "company_id"; then
      # Special cases: queries that are intentionally not tenant-scoped
      # 1. Health check queries (SELECT 1, SHOW TABLES, etc.)
      if echo "$content" | grep -qiE 'SELECT\s+1|SHOW\s+TABLES|information_schema'; then
        continue
      fi
      # 2. Lookup queries for FK validation that don't return tenant data
      # (e.g., "SELECT id FROM loads WHERE id = ?" used to verify existence
      #  before an insert that IS tenant-scoped)
      if echo "$content" | grep -qE 'SELECT\s+id\s+FROM.*WHERE\s+id\s*='; then
        # Check if the broader context (10 lines) has company_id scoping
        broader=$(sed -n "$((lineno > 5 ? lineno - 5 : 1)),$((lineno + 10))p" "$file" 2>/dev/null || true)
        if echo "$broader" | grep -q "company_id\|companyId\|tenantId"; then
          continue
        fi
      fi
      # 3. Migration files
      if echo "$file" | grep -q "migrations"; then
        continue
      fi

      echo "VIOLATION: ${file}:${lineno} — Query on '${table}' without company_id scoping"
      echo "  ${content}"
      violations=$((violations + 1))
    fi
  done <<< "$matches"
done

if [ "$violations" -gt 0 ]; then
  echo ""
  echo "FAIL: ${violations} unscoped tenant-table query(ies) found."
  echo "Every query on a tenant-scoped table MUST include company_id in its WHERE clause."
  exit 1
else
  echo "PASS: All tenant-table queries are properly scoped with company_id."
  exit 0
fi
