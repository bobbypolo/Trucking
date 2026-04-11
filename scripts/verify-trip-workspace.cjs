/**
 * verify-trip-workspace.cjs
 *
 * Static verification script for Sprint C Phase 1: Load List Service + Load List Screen.
 * Reads source files via fs.readFileSync and validates implementation patterns via regex.
 *
 * Tests R-P1-01, R-P1-02, R-P1-03, R-P1-04, R-P1-05, R-P1-06, R-P1-07
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
const loadsServicePath = path.join(
  ROOT,
  "apps/trucker/src/services/loads.ts"
);
const loadsServiceContent = fs.readFileSync(loadsServicePath, "utf-8");

const loadTypePath = path.join(ROOT, "apps/trucker/src/types/load.ts");
const loadTypeContent = fs.readFileSync(loadTypePath, "utf-8");

const loadCardPath = path.join(
  ROOT,
  "apps/trucker/src/components/LoadCard.tsx"
);
const loadCardContent = fs.readFileSync(loadCardPath, "utf-8");

const loadsScreenPath = path.join(
  ROOT,
  "apps/trucker/src/app/(tabs)/loads/index.tsx"
);
const loadsScreenContent = fs.readFileSync(loadsScreenPath, "utf-8");

// --- R-P1-01: loads.ts exports 3 functions ---
// Tests R-P1-01
check(
  "R-P1-01a",
  "loads.ts exports fetchLoads() calling api.get('/loads')",
  /export\s+(async\s+)?function\s+fetchLoads/.test(loadsServiceContent) &&
    /api\.get.*["']\/loads["']/.test(loadsServiceContent)
);

check(
  "R-P1-01b",
  "loads.ts exports fetchLoadById(id) calling fetchLoads() then filtering",
  /export\s+(async\s+)?function\s+fetchLoadById/.test(loadsServiceContent) &&
    /fetchLoads\(\)/.test(loadsServiceContent) &&
    /\.find\(/.test(loadsServiceContent)
);

check(
  "R-P1-01c",
  "loads.ts exports updateLoadStatus(id, status) calling api.patch",
  /export\s+(async\s+)?function\s+updateLoadStatus/.test(
    loadsServiceContent
  ) && /api\.patch/.test(loadsServiceContent)
);

// --- R-P1-02: Load interface + LoadLeg + getOrigin + getDestination ---
// Tests R-P1-02
check(
  "R-P1-02a",
  "load.ts defines Load interface with id, status, pickup_date, legs",
  /interface\s+Load\b/.test(loadTypeContent) &&
    /id\s*:\s*string/.test(loadTypeContent) &&
    /status\s*:\s*LoadStatus/.test(loadTypeContent) &&
    /pickup_date\s*:\s*string/.test(loadTypeContent) &&
    /legs\s*:\s*LoadLeg\[\]/.test(loadTypeContent)
);

check(
  "R-P1-02b",
  "load.ts defines LoadLeg interface with type, city, state, facility_name, date, sequence_order",
  /interface\s+LoadLeg\b/.test(loadTypeContent) &&
    /type\s*:/.test(loadTypeContent) &&
    /city\s*:\s*string/.test(loadTypeContent) &&
    /state\s*:\s*string/.test(loadTypeContent) &&
    /facility_name\s*:\s*string/.test(loadTypeContent) &&
    /date\s*:\s*string/.test(loadTypeContent) &&
    /sequence_order\s*:\s*number/.test(loadTypeContent)
);

check(
  "R-P1-02c",
  "load.ts exports getOrigin() extracting first Pickup leg city+state",
  /export\s+function\s+getOrigin/.test(loadTypeContent) &&
    /Pickup/.test(loadTypeContent) &&
    /\.city/.test(loadTypeContent) &&
    /\.state/.test(loadTypeContent)
);

check(
  "R-P1-02d",
  "load.ts exports getDestination() extracting last Dropoff leg city+state",
  /export\s+function\s+getDestination/.test(loadTypeContent) &&
    /Dropoff/.test(loadTypeContent)
);

// --- R-P1-03: LoadCard renders Pressable with origin, destination, status badge ---
// Tests R-P1-03
check(
  "R-P1-03a",
  "LoadCard.tsx renders a Pressable component",
  /Pressable/.test(loadCardContent)
);

check(
  "R-P1-03b",
  "LoadCard.tsx uses getOrigin(load) and getDestination(load)",
  /getOrigin\s*\(/.test(loadCardContent) &&
    /getDestination\s*\(/.test(loadCardContent)
);

check(
  "R-P1-03c",
  "LoadCard.tsx renders a color-coded status badge",
  /status/.test(loadCardContent) &&
    /backgroundColor/.test(loadCardContent) &&
    /badge/i.test(loadCardContent)
);

// --- R-P1-04: loads.tsx renders FlatList of LoadCard ---
// Tests R-P1-04
check(
  "R-P1-04a",
  "loads.tsx imports and renders FlatList",
  /FlatList/.test(loadsScreenContent)
);

check(
  "R-P1-04b",
  "loads.tsx imports and renders LoadCard in renderItem",
  /LoadCard/.test(loadsScreenContent) &&
    /renderItem/.test(loadsScreenContent)
);

check(
  "R-P1-04c",
  "loads.tsx uses fetchLoads() to populate data",
  /fetchLoads/.test(loadsScreenContent)
);

// --- R-P1-05: loads.tsx passes refreshing and onRefresh to FlatList ---
// Tests R-P1-05
check(
  "R-P1-05a",
  "loads.tsx passes refreshing={refreshing} prop to FlatList",
  /refreshing\s*=\s*\{/.test(loadsScreenContent)
);

check(
  "R-P1-05b",
  "loads.tsx passes onRefresh handler to FlatList",
  /onRefresh\s*=\s*\{/.test(loadsScreenContent)
);

// --- R-P1-06: loads.tsx renders ActivityIndicator when loading ---
// Tests R-P1-06
check(
  "R-P1-06",
  "loads.tsx renders ActivityIndicator when loading state is true",
  /ActivityIndicator/.test(loadsScreenContent) &&
    /loading/.test(loadsScreenContent)
);

// --- R-P1-07: loads.tsx renders error Text and Retry Pressable ---
// Tests R-P1-07
check(
  "R-P1-07a",
  "loads.tsx renders error text when fetchLoads fails",
  /error/.test(loadsScreenContent) && /Text/.test(loadsScreenContent)
);

check(
  "R-P1-07b",
  "loads.tsx renders Retry Pressable button on error",
  /Retry/.test(loadsScreenContent) &&
    /Pressable/.test(loadsScreenContent) &&
    /handleRetry|retry|onPress/.test(loadsScreenContent)
);

// --- Summary ---
process.stdout.write(`\n  Results: ${passes} passed, ${failures} failed\n`);

if (failures > 0) {
  process.exit(1);
}
