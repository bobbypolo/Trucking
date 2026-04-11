/**
 * verify-load-detail.cjs
 *
 * Static verification script for Load Detail Screen + Navigation (Phase 2).
 * Reads source files via fs.readFileSync and validates load detail screen,
 * Stack navigation layout, and LoadCard navigation patterns via regex matching.
 *
 * Tests R-P2-01, R-P2-02, R-P2-03, R-P2-04, R-P2-05
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
const detailPath = path.join(
  ROOT,
  "apps/trucker/src/app/(tabs)/loads/[id].tsx",
);
const detailContent = fs.readFileSync(detailPath, "utf-8");

const layoutPath = path.join(
  ROOT,
  "apps/trucker/src/app/(tabs)/loads/_layout.tsx",
);
const layoutContent = fs.readFileSync(layoutPath, "utf-8");

const loadCardPath = path.join(
  ROOT,
  "apps/trucker/src/components/LoadCard.tsx",
);
const loadCardContent = fs.readFileSync(loadCardPath, "utf-8");

// --- R-P2-01: [id].tsx calls fetchLoadById on mount via useEffect ---
check(
  "R-P2-01",
  "[id].tsx calls fetchLoadById (>= 1 match) and uses useEffect (>= 1 match)",
  countMatches(detailContent, /fetchLoadById/g) >= 1 &&
    countMatches(detailContent, /useEffect/g) >= 1,
);

// --- R-P2-02: [id].tsx renders origin, destination, pickup_date, delivery date ---
check(
  "R-P2-02",
  "[id].tsx renders origin, destination, pickup_date, and delivery date sections",
  /[Oo]rigin/.test(detailContent) &&
    /[Dd]estination/.test(detailContent) &&
    /pickup_date/.test(detailContent) &&
    /[Dd]elivery/.test(detailContent),
);

// --- R-P2-03: [id].tsx renders status badge with color per LoadStatus ---
check(
  "R-P2-03",
  "[id].tsx renders status badge with LoadStatus color mapping",
  /status/.test(detailContent) &&
    /LoadStatus/.test(detailContent) &&
    /statusBadge/.test(detailContent) &&
    /STATUS_COLORS/.test(detailContent),
);

// --- R-P2-04: _layout.tsx defines Stack with index and [id] screens ---
check(
  "R-P2-04",
  "_layout.tsx defines Stack navigator with index and [id] screens",
  /Stack/.test(layoutContent) &&
    /index/.test(layoutContent) &&
    /\[id\]/.test(layoutContent),
);

// --- R-P2-05: LoadCard navigates to detail via router.push ---
check(
  "R-P2-05",
  "LoadCard calls router.push with loads/ path on press",
  /router\.push/.test(loadCardContent) &&
    /loads\//.test(loadCardContent) &&
    /Pressable/.test(loadCardContent),
);

// --- Summary ---
process.stdout.write(`\n  Results: ${passes} passed, ${failures} failed\n`);

if (failures > 0) {
  process.exit(1);
}
