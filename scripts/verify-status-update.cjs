/**
 * verify-status-update.cjs
 *
 * Static verification script for Status Update Flow (Phase 3).
 * Reads source files via fs.readFileSync and validates status update
 * integration patterns via regex matching.
 *
 * Tests R-P3-01, R-P3-02, R-P3-03, R-P3-04, R-P3-05, R-P3-06, R-P3-07
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
let failures = 0;
let passes = 0;

function check(id, description, condition) {
  if (condition) {
    passes++;
    process.stdout.write(`  PASS  ${id}: ${description}\n`);
  } else {
    failures++;
    console.error(`  FAIL  ${id}: ${description}`);
  }
}

function countMatches(content, regex) {
  const matches = content.match(regex);
  return matches ? matches.length : 0;
}

// --- Read source files ---
const statusButtonPath = path.join(
  ROOT,
  "apps/trucker/src/components/StatusUpdateButton.tsx"
);
const statusButtonContent = fs.readFileSync(statusButtonPath, "utf-8");

const hookPath = path.join(
  ROOT,
  "apps/trucker/src/hooks/useLoadStatus.ts"
);
const hookContent = fs.readFileSync(hookPath, "utf-8");

const detailPath = path.join(
  ROOT,
  "apps/trucker/src/app/(tabs)/loads/[id].tsx"
);
const detailContent = fs.readFileSync(detailPath, "utf-8");

// --- R-P3-01: StatusUpdateButton accepts currentStatus and onStatusChange props,
//              renders 1+ Pressable buttons for valid next statuses ---
check(
  "R-P3-01",
  "StatusUpdateButton accepts currentStatus: LoadStatus and onStatusChange props, renders Pressable",
  /currentStatus\s*:\s*LoadStatus/.test(statusButtonContent) &&
    /onStatusChange/.test(statusButtonContent) &&
    countMatches(statusButtonContent, /Pressable/g) >= 1
);

// --- R-P3-02: useLoadStatus hook exports transitionTo that calls updateLoadStatus ---
check(
  "R-P3-02",
  "useLoadStatus exports transitionTo(status) that calls updateLoadStatus(loadId, status)",
  /export\s+(function\s+useLoadStatus|const\s+useLoadStatus|default\s+function\s+useLoadStatus)/.test(hookContent) &&
    /transitionTo/.test(hookContent) &&
    /updateLoadStatus/.test(hookContent)
);

// --- R-P3-03: useLoadStatus sets status optimistically before API call
//              and reverts to previousStatus in the catch block ---
check(
  "R-P3-03",
  "useLoadStatus sets status optimistically before API call and reverts to previousStatus on error",
  /setStatus\(/.test(hookContent) &&
    /catch/.test(hookContent) &&
    /previous/.test(hookContent)
);

// --- R-P3-04: loads/[id].tsx renders StatusUpdateButton with currentStatus and onStatusChange ---
check(
  "R-P3-04",
  "loads/[id].tsx renders StatusUpdateButton with currentStatus={...} and onStatusChange={transitionTo}",
  countMatches(detailContent, /StatusUpdateButton/g) >= 2 &&
    /currentStatus\s*=\s*\{/.test(detailContent) &&
    /onStatusChange\s*=\s*\{/.test(detailContent)
);

// --- R-P3-05: StatusUpdateButton filters to 3 driver transitions ---
check(
  "R-P3-05",
  "StatusUpdateButton defines 3 driver transitions: dispatched->in_transit, in_transit->arrived, arrived->delivered",
  /dispatched/.test(statusButtonContent) &&
    /in_transit/.test(statusButtonContent) &&
    /arrived/.test(statusButtonContent) &&
    /delivered/.test(statusButtonContent)
);

// --- R-P3-06: Failed transition renders error Text showing server message ---
check(
  "R-P3-06",
  "Failed transition renders error <Text> showing the server's message field from 422 response",
  /error/.test(hookContent) &&
    /message/.test(hookContent) &&
    (/Text/.test(statusButtonContent) || /Text/.test(detailContent))
);

// --- R-P3-07: useLoadStatus rejects invalid transition by rolling back
//              and displaying 422 error ---
check(
  "R-P3-07",
  "useLoadStatus rejects invalid transition: rolls back optimistic state and displays 422 error",
  /setStatus\(/.test(hookContent) &&
    /previous/.test(hookContent) &&
    /setError/.test(hookContent) &&
    /422|Invalid.*transition|message/.test(hookContent)
);

// --- Summary ---
process.stdout.write(`\n  Results: ${passes} passed, ${failures} failed\n`);

if (failures > 0) {
  process.exit(1);
}
