/**
 * verify-doc-list.cjs
 *
 * Static verification script for Document List per Load (Phase 6).
 * Reads source files via fs.readFileSync and validates DocumentList
 * patterns via regex matching.
 *
 * Tests R-P6-01, R-P6-02, R-P6-03, R-P6-04
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

function countMatches(str, regex) {
  const matches = str.match(new RegExp(regex.source, "g"));
  return matches ? matches.length : 0;
}

// --- Read source files ---
const docListPath = path.join(
  ROOT,
  "apps/trucker/src/components/DocumentList.tsx",
);
const docListContent = fs.readFileSync(docListPath, "utf-8");

const loadDetailPath = path.join(
  ROOT,
  "apps/trucker/src/app/(tabs)/loads/[id].tsx",
);
const detailContent = fs.readFileSync(loadDetailPath, "utf-8");

// --- R-P6-01: DocumentList calls listDocuments on mount via useEffect and re-fetches on focus ---
// # Tests R-P6-01
check(
  "R-P6-01",
  "DocumentList calls listDocuments(loadId) on mount via useEffect and re-fetches on focus via useFocusEffect",
  countMatches(docListContent, /listDocuments/) >= 1 &&
    /useEffect/.test(docListContent) &&
    /useFocusEffect/.test(docListContent),
);

// --- R-P6-02: DocumentList renders FlatList with document_type, filename, created_at ---
// # Tests R-P6-02
check(
  "R-P6-02",
  "DocumentList renders FlatList showing document_type, filename, and created_at",
  /FlatList/.test(docListContent) &&
    /document_type/.test(docListContent) &&
    /filename/.test(docListContent) &&
    /created_at/.test(docListContent),
);

// --- R-P6-03: loads/[id].tsx has Capture Document Pressable navigating to CameraScreen ---
// # Tests R-P6-03
check(
  "R-P6-03",
  'loads/[id].tsx renders "Capture Document" Pressable that navigates to CameraScreen with loadId',
  /[Cc]apture\s*[Dd]ocument/.test(detailContent) &&
    /[Cc]amera/.test(detailContent) &&
    /Pressable/.test(detailContent) &&
    /loadId/.test(detailContent),
);

// --- R-P6-04: DocumentList shows "No documents yet" when empty ---
// # Tests R-P6-04
check(
  "R-P6-04",
  'DocumentList renders "No documents yet" Text when documents array is empty',
  /[Nn]o documents/.test(docListContent),
);

// --- Summary ---
process.stdout.write(`\n  Results: ${passes} passed, ${failures} failed\n`);

if (failures > 0) {
  process.exit(1);
}
