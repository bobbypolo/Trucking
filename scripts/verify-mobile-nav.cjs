/**
 * verify-mobile-nav.cjs
 * Verification script for STORY-003: Mobile Navigation Shell
 *
 * Asserts all route files exist, tab layout has 3 tabs, auth group has
 * login/signup, AuthContext exports AuthProvider and useAuth hook.
 */
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const APP_DIR = path.join(ROOT, "apps", "trucker", "src", "app");
const CTX_DIR = path.join(ROOT, "apps", "trucker", "src", "contexts");

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    passed++;
    console.log(`  PASS: ${label}`);
  } else {
    failed++;
    console.error(`  FAIL: ${label}`);
  }
}

function readFile(filePath) {
  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved)) {
    return null;
  }
  return fs.readFileSync(resolved, "utf-8");
}

// ── R-P3-01: AuthContext exports AuthProvider and useAuth ──
console.log("\n--- R-P3-01: AuthContext exports ---");
const authCtxPath = path.join(CTX_DIR, "AuthContext.tsx");
const authCtx = readFile(authCtxPath);
assert(authCtx !== null, "AuthContext.tsx exists");
if (authCtx !== null) {
  const providerMatches = authCtx.match(/export.*AuthProvider/g);
  assert(
    providerMatches !== null && providerMatches.length >= 1,
    "AuthContext exports AuthProvider (>= 1 match)"
  );
  const hookMatches = authCtx.match(/export.*useAuth/g);
  assert(
    hookMatches !== null && hookMatches.length >= 1,
    "AuthContext exports useAuth (>= 1 match)"
  );
} else {
  assert(false, "AuthContext exports AuthProvider (file missing)");
  assert(false, "AuthContext exports useAuth (file missing)");
}

// ── R-P3-02: AuthContext isAuthenticated default + login/logout ──
console.log("\n--- R-P3-02: AuthContext state ---");
if (authCtx !== null) {
  assert(
    /isAuthenticated.*false/.test(authCtx),
    "isAuthenticated default false"
  );
  assert(/login/.test(authCtx), "login function present");
  assert(/logout/.test(authCtx), "logout function present");
} else {
  assert(false, "isAuthenticated default false (file missing)");
  assert(false, "login function present (file missing)");
  assert(false, "logout function present (file missing)");
}

// ── R-P3-03: Tab layout ──
console.log("\n--- R-P3-03: Tab layout ---");
const tabLayoutPath = path.join(APP_DIR, "(tabs)", "_layout.tsx");
const tabLayout = readFile(tabLayoutPath);
assert(tabLayout !== null, "(tabs)/_layout.tsx exists");
if (tabLayout !== null) {
  const tabsMatches = tabLayout.match(/Tabs/g);
  assert(
    tabsMatches !== null && tabsMatches.length >= 1,
    "Tab layout contains Tabs component (>= 1 match)"
  );
  assert(tabLayout.includes("index"), 'Tab layout contains "index" screen');
  assert(tabLayout.includes("loads"), 'Tab layout contains "loads" screen');
  assert(tabLayout.includes("profile"), 'Tab layout contains "profile" screen');
} else {
  assert(false, "Tab layout contains Tabs component (file missing)");
  assert(false, 'Tab layout contains "index" screen (file missing)');
  assert(false, 'Tab layout contains "loads" screen (file missing)');
  assert(false, 'Tab layout contains "profile" screen (file missing)');
}

// ── R-P3-04: Auth group files exist ──
console.log("\n--- R-P3-04: Auth group files ---");
const loginPath = path.join(APP_DIR, "(auth)", "login.tsx");
const signupPath = path.join(APP_DIR, "(auth)", "signup.tsx");
assert(fs.existsSync(loginPath), "(auth)/login.tsx exists");
assert(fs.existsSync(signupPath), "(auth)/signup.tsx exists");

// ── R-P3-05: Root layout wraps with AuthProvider + redirect ──
console.log("\n--- R-P3-05: Root layout ---");
const rootLayoutPath = path.join(APP_DIR, "_layout.tsx");
const rootLayout = readFile(rootLayoutPath);
assert(rootLayout !== null, "_layout.tsx exists");
if (rootLayout !== null) {
  const authProviderMatches = rootLayout.match(/AuthProvider/g);
  assert(
    authProviderMatches !== null && authProviderMatches.length >= 1,
    "Root layout contains AuthProvider (>= 1 match)"
  );
  const redirectMatches = rootLayout.match(/Redirect|router\.replace/g);
  assert(
    redirectMatches !== null && redirectMatches.length >= 1,
    "Root layout contains redirect logic (>= 1 match)"
  );
} else {
  assert(false, "Root layout contains AuthProvider (file missing)");
  assert(false, "Root layout contains redirect logic (file missing)");
}

// ── R-P3-06: Login screen inputs + button ──
console.log("\n--- R-P3-06: Login screen ---");
const login = readFile(loginPath);
if (login !== null) {
  const inputMatches = login.match(/TextInput/g);
  assert(
    inputMatches !== null && inputMatches.length >= 2,
    "Login has >= 2 TextInput components"
  );
  const buttonMatches = login.match(/Pressable|TouchableOpacity/g);
  assert(
    buttonMatches !== null && buttonMatches.length >= 1,
    "Login has >= 1 submit button (Pressable|TouchableOpacity)"
  );
} else {
  assert(false, "Login has >= 2 TextInput components (file missing)");
  assert(false, "Login has >= 1 submit button (file missing)");
}

// ── R-P3-07: Signup screen inputs + button ──
console.log("\n--- R-P3-07: Signup screen ---");
const signup = readFile(signupPath);
if (signup !== null) {
  const inputMatches = signup.match(/TextInput/g);
  assert(
    inputMatches !== null && inputMatches.length >= 2,
    "Signup has >= 2 TextInput components"
  );
  const buttonMatches = signup.match(/Pressable|TouchableOpacity/g);
  assert(
    buttonMatches !== null && buttonMatches.length >= 1,
    "Signup has >= 1 submit button (Pressable|TouchableOpacity)"
  );
} else {
  assert(false, "Signup has >= 2 TextInput components (file missing)");
  assert(false, "Signup has >= 1 submit button (file missing)");
}

// ── Summary ──
console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
if (failed > 0) {
  process.exit(1);
}
