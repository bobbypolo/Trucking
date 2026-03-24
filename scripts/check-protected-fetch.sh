#!/usr/bin/env bash
# check-protected-fetch.sh - Detect raw fetch() calls in production components
# that should use the api client (services/api.ts) instead.
#
# Usage: bash scripts/check-protected-fetch.sh
# Exit:  0 = clean, 1 = violations found
#
# Scope:
#   - Scans .ts and .tsx files under components/ and services/
#   - Excludes: test files, api.ts itself, authService.ts, external API services
#
# Rationale: All internal API calls must route through the centralized api client
# (api.get, api.post, etc.) to ensure consistent auth headers, 401 retry logic,
# 403 handling, and AbortController support.
#
# External API services (Google Maps, Azure Maps, OpenWeatherMap) are exempt
# because they call third-party endpoints, not our own backend.

set -euo pipefail

# Resolve project root relative to this script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

VIOLATION_COUNT=0
VIOLATIONS=""

# -----------------------------------------------------------------------
# Configuration: excluded files and directories
# -----------------------------------------------------------------------
# Files that legitimately use raw fetch (not internal API calls):
#   - api.ts              : the centralized api client itself
#   - authService.ts      : raw auth endpoints (login, token refresh)
#   - Auth.tsx            : pre-auth login/signup page (no JWT token available)
#   - weatherService.ts   : external Azure Maps / OpenWeatherMap APIs
#   - directionsService.ts: external Google Maps Directions API
#   - distanceMatrixService.ts: external Google Maps Distance Matrix API
#   - geocodingService.ts : external Google Maps Geocoding API
#   - roadsService.ts     : external Google Maps Roads API
EXCLUDED_FILES=(
  "services/api.ts"
  "services/authService.ts"
  "services/apiHealth.ts"          # pre-auth health check, must work without JWT
  "components/Auth.tsx"
  "services/weatherService.ts"
  "services/directionsService.ts"
  "services/distanceMatrixService.ts"
  "services/geocodingService.ts"
  "services/roadsService.ts"
)

# -----------------------------------------------------------------------
# Step 1: Find all raw fetch( calls in components/ and services/
# -----------------------------------------------------------------------
SEARCH_DIRS=()
for dir in "components" "services"; do
  target="${PROJECT_ROOT}/${dir}"
  if [ -d "$target" ]; then
    SEARCH_DIRS+=("$target")
  fi
done

if [ ${#SEARCH_DIRS[@]} -eq 0 ]; then
  echo "ERROR: Neither components/ nor services/ found under ${PROJECT_ROOT}"
  exit 1
fi

# Collect raw matches into a temp file
TMPFILE=$(mktemp)
trap 'rm -f "$TMPFILE"' EXIT

if command -v rg &>/dev/null; then
  rg -n --no-heading \
    --glob '*.ts' --glob '*.tsx' \
    --glob '!*__tests__*' \
    --glob '!*.test.ts' --glob '!*.test.tsx' \
    --glob '!*.spec.ts' --glob '!*.spec.tsx' \
    'fetch\(' \
    "${SEARCH_DIRS[@]}" > "$TMPFILE" 2>/dev/null || true
else
  grep -rn --include='*.ts' --include='*.tsx' \
    --exclude='*.test.ts' --exclude='*.test.tsx' \
    --exclude='*.spec.ts' --exclude='*.spec.tsx' \
    --exclude-dir='__tests__' \
    'fetch(' \
    "${SEARCH_DIRS[@]}" > "$TMPFILE" 2>/dev/null || true
fi

# -----------------------------------------------------------------------
# Step 2: Filter out allowed patterns
# -----------------------------------------------------------------------
while IFS= read -r line; do
  # Skip empty lines
  [ -z "$line" ] && continue

  # Extract file path (everything before first :linenum:)
  filepath=$(echo "$line" | sed 's/^\(.*\):[0-9][0-9]*:.*$/\1/')
  # Normalize to forward slashes for cross-platform matching
  filepath_normalized="${filepath//\\//}"

  # --- Exclusion: configured exempt files ---
  skip=false
  for excluded in "${EXCLUDED_FILES[@]}"; do
    if echo "$filepath_normalized" | grep -qF "/${excluded}"; then
      skip=true
      break
    fi
  done
  if [ "$skip" = true ]; then
    continue
  fi

  # --- Exclusion: test files (belt-and-suspenders) ---
  if echo "$filepath_normalized" | grep -qE '(__tests__|\.test\.(ts|tsx)|\.spec\.(ts|tsx))'; then
    continue
  fi

  # --- Exclusion: lines containing external URLs ---
  if echo "$line" | grep -qE 'https?://'; then
    continue
  fi

  # Extract the line content (after file:linenum:)
  line_content=$(echo "$line" | sed 's/^[^:]*:[0-9][0-9]*://')
  trimmed=$(echo "$line_content" | sed 's/^[[:space:]]*//')

  # --- Exclusion: comments ---
  if echo "$trimmed" | grep -qE '^(//|/\*|\*)'; then
    continue
  fi

  # --- Exclusion: import/type statements ---
  if echo "$trimmed" | grep -qE '^import '; then
    continue
  fi

  # This is a violation -- format the output
  VIOLATION_COUNT=$((VIOLATION_COUNT + 1))

  # Build a clean relative path from the raw grep output
  # Strip project root prefix (handles both / and \ separators)
  display_line="${line}"
  # Normalize entire line to forward slashes for display
  display_line="${display_line//\\//}"
  # Remove project root prefix
  root_fwd="${PROJECT_ROOT//\\//}"
  display_line="${display_line#"${root_fwd}/"}"

  VIOLATIONS="${VIOLATIONS}  ${display_line}\n"

done < "$TMPFILE"

# -----------------------------------------------------------------------
# Step 3: Report
# -----------------------------------------------------------------------
echo "=========================================="
echo "  Protected Fetch Guardrail Check"
echo "=========================================="
echo ""
echo "Scope:    components/**/*.{ts,tsx}, services/**/*.{ts,tsx}"
echo "Excluded: api.ts, authService.ts, test files, external API services"
echo "          (weather, directions, distanceMatrix, geocoding, roads)"
echo ""

if [ "$VIOLATION_COUNT" -eq 0 ]; then
  echo "RESULT: PASS -- No raw fetch() violations found."
  echo ""
  echo "All internal API calls use the centralized api client."
  exit 0
else
  echo "RESULT: FAIL -- ${VIOLATION_COUNT} raw fetch() violation(s) found."
  echo ""
  echo "The following files use raw fetch() for internal API calls."
  echo "They should use api.get(), api.post(), etc. from services/api.ts instead."
  echo ""
  echo "Violations:"
  echo -e "$VIOLATIONS"
  echo "To fix: Replace raw fetch(\`\${API_URL}/...\`) calls with the"
  echo "appropriate api.get(), api.post(), api.patch(), or api.delete() method."
  echo "See services/api.ts for the available methods."
  echo ""
  echo "To add a new exemption (e.g., for a new external API service),"
  echo "add the file path to the EXCLUDED_FILES array in this script."
  exit 1
fi
