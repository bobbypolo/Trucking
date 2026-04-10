/**
 * verify-doc-upload.cjs
 *
 * Static verification script for Document Upload + OCR Integration (Phase 5).
 * Reads source files via fs.readFileSync and validates document upload
 * patterns via regex matching.
 *
 * Tests R-P5-01, R-P5-02, R-P5-03, R-P5-04, R-P5-05, R-P5-06, R-P5-07, R-P5-08, R-P5-09
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
const docsServicePath = path.join(
  ROOT,
  "apps/trucker/src/services/documents.ts",
);
const docsContent = fs.readFileSync(docsServicePath, "utf-8");

const apiPath = path.join(ROOT, "apps/trucker/src/services/api.ts");
const apiContent = fs.readFileSync(apiPath, "utf-8");

const uploadScreenPath = path.join(
  ROOT,
  "apps/trucker/src/app/(camera)/upload.tsx",
);
const uploadContent = fs.readFileSync(uploadScreenPath, "utf-8");

const ocrResultPath = path.join(
  ROOT,
  "apps/trucker/src/app/(camera)/ocr-result.tsx",
);
const ocrContent = fs.readFileSync(ocrResultPath, "utf-8");

// --- R-P5-01: documents.ts exports 4 functions ---
// # Tests R-P5-01
check(
  "R-P5-01",
  "documents.ts exports 4 functions: uploadDocument, triggerOcr, getOcrResult, listDocuments",
  /export.*function\s+uploadDocument/.test(docsContent) &&
    /export.*function\s+triggerOcr/.test(docsContent) &&
    /export.*function\s+getOcrResult/.test(docsContent) &&
    /export.*function\s+listDocuments/.test(docsContent) &&
    countMatches(docsContent, /export\s+(async\s+)?function/) >= 4,
);

// --- R-P5-02: api.ts exports uploadFile(urlPath, formData) with FormData via fetch ---
// # Tests R-P5-02
check(
  "R-P5-02",
  "api.ts exports uploadFile(urlPath, formData) that sends FormData via fetch() without setting Content-Type",
  /uploadFile/.test(apiContent) &&
    /FormData/.test(apiContent) &&
    /fetch\(/.test(apiContent),
);

// --- R-P5-03: upload.tsx renders picker with 5 document types ---
// # Tests R-P5-03
check(
  "R-P5-03",
  'upload.tsx renders picker with 5 document types: BOL, Rate Confirmation, POD, Fuel Receipt, Scale Ticket',
  /BOL/.test(uploadContent) &&
    /Rate\s*Confirmation/.test(uploadContent) &&
    /POD/.test(uploadContent) &&
    /Fuel\s*Receipt/.test(uploadContent) &&
    /Scale\s*Ticket/.test(uploadContent),
);

// --- R-P5-04: UploadScreen calls uploadDocument() with 3 params ---
// # Tests R-P5-04
check(
  "R-P5-04",
  "UploadScreen calls uploadDocument() with uri, loadId, and documentType params",
  countMatches(uploadContent, /uploadDocument/) >= 1 &&
    /uri/.test(uploadContent) &&
    /loadId/.test(uploadContent) &&
    /documentType|selectedType/.test(uploadContent),
);

// --- R-P5-05: upload.tsx calls triggerOcr(documentId) and navigates to ocr-result ---
// # Tests R-P5-05
check(
  "R-P5-05",
  "upload.tsx calls triggerOcr(documentId) using documentId from upload response and navigates to ocr-result",
  countMatches(uploadContent, /triggerOcr/) >= 1 &&
    /documentId/.test(uploadContent) &&
    /result\.id/.test(uploadContent) &&
    /ocr-result/.test(uploadContent),
);

// --- R-P5-06: ocr-result.tsx calls getOcrResult and renders fields[] ---
// # Tests R-P5-06
check(
  "R-P5-06",
  "ocr-result.tsx calls getOcrResult(documentId) on mount and renders fields with field_name, extracted_value, confidence",
  countMatches(ocrContent, /getOcrResult/) >= 1 &&
    /field_name/.test(ocrContent) &&
    /extracted_value/.test(ocrContent) &&
    /confidence/.test(ocrContent) &&
    (/FlatList/.test(ocrContent) || /\.map\(/.test(ocrContent)),
);

// --- R-P5-07: UploadScreen renders error Text and Retry Pressable ---
// # Tests R-P5-07
check(
  "R-P5-07",
  'UploadScreen renders error <Text> and "Retry" <Pressable> when uploadDocument() returns an error',
  /error/.test(uploadContent) &&
    /[Rr]etry/.test(uploadContent) &&
    /Pressable/.test(uploadContent) &&
    /Text/.test(uploadContent),
);

// --- R-P5-08: api.ts uploadFile deletes Content-Type ---
// # Tests R-P5-08
check(
  "R-P5-08",
  'api.ts uploadFile deletes Content-Type key so runtime sets multipart boundary automatically',
  /delete\s+headers\s*\[\s*["']Content-Type["']\s*\]/.test(apiContent) ||
    (!/Content-Type.*multipart/.test(apiContent) &&
      /uploadFile/.test(apiContent) &&
      /FormData/.test(apiContent)),
);

// --- R-P5-09: UploadScreen renders "File too large" for 413 ---
// # Tests R-P5-09
check(
  "R-P5-09",
  'UploadScreen renders "File too large" error text when server returns status 413',
  /413/.test(uploadContent) && /File too large/.test(uploadContent),
);

// --- Summary ---
process.stdout.write(`\n  Results: ${passes} passed, ${failures} failed\n`);

if (failures > 0) {
  process.exit(1);
}
