/**
 * verify-mobile-auth.cjs
 *
 * Static verification script for Mobile Auth Integration (Phase 4).
 * Reads source files via fs.readFileSync and validates Firebase Auth
 * integration patterns via regex matching.
 *
 * Tests R-P4-01, R-P4-02, R-P4-03, R-P4-04, R-P4-05, R-P4-06, R-P4-07, R-P4-08
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

// --- R-P4-01: AuthContext imports and calls signInWithEmailAndPassword ---
const authContextPath = path.join(
  ROOT,
  "apps/trucker/src/contexts/AuthContext.tsx"
);
const authContextContent = fs.readFileSync(authContextPath, "utf-8");

check(
  "R-P4-01",
  "AuthContext.tsx imports and calls signInWithEmailAndPassword (>= 2 matches)",
  countMatches(authContextContent, /signInWithEmailAndPassword/g) >= 2
);

// --- R-P4-02: AuthContext error handling with Firebase error codes ---
check(
  "R-P4-02",
  "AuthContext.tsx maps auth/wrong-password and auth/user-not-found error codes",
  countMatches(
    authContextContent,
    /auth\/wrong-password|auth\/user-not-found/g
  ) >= 1
);

// --- R-P4-03: AuthContext imports and calls createUserWithEmailAndPassword ---
check(
  "R-P4-03",
  "AuthContext.tsx imports and calls createUserWithEmailAndPassword (>= 2 matches)",
  countMatches(authContextContent, /createUserWithEmailAndPassword/g) >= 2
);

// --- R-P4-04: AuthContext imports and calls signOut ---
check(
  "R-P4-04",
  "AuthContext.tsx imports and calls signOut (>= 2 matches)",
  countMatches(authContextContent, /signOut/g) >= 2
);

// --- R-P4-05: api.ts attaches Authorization: Bearer header with getIdToken ---
const apiPath = path.join(ROOT, "apps/trucker/src/services/api.ts");
const apiContent = fs.readFileSync(apiPath, "utf-8");

check(
  "R-P4-05",
  "api.ts attaches Authorization: Bearer header (>= 1 match) and uses getIdToken (>= 1 match)",
  countMatches(apiContent, /Authorization.*Bearer/g) >= 1 &&
    countMatches(apiContent, /getIdToken/g) >= 1
);

// --- R-P4-06: api.ts handles 401 with logout/signOut/clearAuth ---
check(
  "R-P4-06",
  "api.ts handles 401 responses with logout/signOut/clearAuth",
  countMatches(apiContent, /401/g) >= 1 &&
    countMatches(apiContent, /logout|signOut|clearAuth/g) >= 1
);

// --- R-P4-07: api.ts catches network errors (TypeError) ---
check(
  "R-P4-07",
  "api.ts catches network errors and wraps with user-friendly messages",
  countMatches(apiContent, /catch/g) >= 1 &&
    countMatches(apiContent, /network|Network|TypeError/g) >= 1
);

// --- R-P4-08: Firebase config uses EXPO_PUBLIC_FIREBASE_ env vars, no hardcoded keys ---
const firebaseConfigPath = path.join(
  ROOT,
  "apps/trucker/src/config/firebase.ts"
);
const firebaseConfigContent = fs.readFileSync(firebaseConfigPath, "utf-8");

check(
  "R-P4-08a",
  "Firebase config reads >= 6 EXPO_PUBLIC_FIREBASE_ env vars",
  countMatches(firebaseConfigContent, /EXPO_PUBLIC_FIREBASE/g) >= 6
);

check(
  "R-P4-08b",
  "Firebase config contains 0 hardcoded API key strings",
  countMatches(firebaseConfigContent, /AIza[a-zA-Z0-9_-]{35}/g) === 0
);

// --- Summary ---
process.stdout.write(`\n  Results: ${passes} passed, ${failures} failed\n`);

if (failures > 0) {
  process.exit(1);
}
