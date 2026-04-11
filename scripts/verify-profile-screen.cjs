/**
 * Verification script for STORY-010 Phase 10: Mobile Profile screen.
 *
 * Asserts that:
 *   - apps/trucker/src/app/(tabs)/profile.tsx imports `api` from
 *     "../../services/api", calls `api.get("/drivers/me")`, has a
 *     <TextInput> with value+onChangeText, calls
 *     `api.patch("/drivers/me", { phone })`, navigates to "/settings"
 *     via `useRouter` from "expo-router", and renders loading/error
 *     branches.
 *   - apps/trucker/src/types/driver.ts declares
 *     `interface DriverProfile` with the six required fields.
 *
 * Run: node scripts/verify-profile-screen.cjs
 *
 * # Tests R-P10-01, R-P10-02, R-P10-03, R-P10-04, R-P10-05, R-P10-06
 *
 * Each block below is an inline test( describe(...) ) for one R-marker.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const TRUCKER = path.join(ROOT, 'apps', 'trucker');
const PROFILE_PATH = path.join(
  TRUCKER,
  'src',
  'app',
  '(tabs)',
  'profile.tsx',
);
const DRIVER_TYPES_PATH = path.join(
  TRUCKER,
  'src',
  'types',
  'driver.ts',
);

let passed = 0;
let failed = 0;

function check(id, description, condition) {
  if (condition) {
    console.log(`  PASS [${id}]: ${description}`);
    passed++;
  } else {
    console.error(`  FAIL [${id}]: ${description}`);
    failed++;
  }
}

// Read source files once for all checks.
const profileExists = fs.existsSync(PROFILE_PATH);
check('R-P10-00', 'profile.tsx file exists', profileExists);
const profileSource = profileExists
  ? fs.readFileSync(PROFILE_PATH, 'utf8')
  : '';

const driverTypesExists = fs.existsSync(DRIVER_TYPES_PATH);
check('R-P10-00', 'types/driver.ts file exists', driverTypesExists);
const driverTypesSource = driverTypesExists
  ? fs.readFileSync(DRIVER_TYPES_PATH, 'utf8')
  : '';

// -- R-P10-01: profile.tsx imports api from "../../services/api" AND calls api.get("/drivers/me") --
// Tests R-P10-01
console.log(
  '\nR-P10-01: profile.tsx imports api and calls api.get("/drivers/me")',
);
{
  check(
    'R-P10-01',
    'imports `api` from "../../services/api"',
    /import\s+(?:\{[^}]*\bapi\b[^}]*\}|api|\*\s+as\s+api)\s+from\s+["']\.\.\/\.\.\/services\/api["']/.test(
      profileSource,
    ),
  );
  check(
    'R-P10-01',
    'calls `api.get<...>("/drivers/me")`',
    /\bapi\.get\s*(?:<[^>]*>)?\s*\(\s*["']\/drivers\/me["']/.test(
      profileSource,
    ),
  );
}

// -- R-P10-02: profile.tsx has <TextInput with both value={...} and onChangeText={...} --
// Tests R-P10-02
console.log(
  '\nR-P10-02: profile.tsx has <TextInput with value and onChangeText on the same element',
);
{
  // Multiline regex: match <TextInput followed (in the same JSX element)
  // by both value={...} and onChangeText={...}. We allow either ordering
  // and up to ~500 chars of props between the tag open and close.
  const hasValueThenOnChange =
    /<TextInput\b[^>]{0,500}\bvalue\s*=\s*\{[^}]*\}[^>]{0,500}\bonChangeText\s*=\s*\{[^}]*\}/s.test(
      profileSource,
    );
  const hasOnChangeThenValue =
    /<TextInput\b[^>]{0,500}\bonChangeText\s*=\s*\{[^}]*\}[^>]{0,500}\bvalue\s*=\s*\{[^}]*\}/s.test(
      profileSource,
    );
  check(
    'R-P10-02',
    '<TextInput element has both value={...} and onChangeText={...}',
    hasValueThenOnChange || hasOnChangeThenValue,
  );
}

// -- R-P10-03: profile.tsx calls api.patch("/drivers/me", { phone... }) --
// Tests R-P10-03
console.log(
  '\nR-P10-03: profile.tsx calls api.patch("/drivers/me", { phone })',
);
{
  check(
    'R-P10-03',
    'calls `api.patch<...>("/drivers/me", ...)`',
    /\bapi\.patch\s*(?:<[^>]*>)?\s*\(\s*["']\/drivers\/me["']/.test(
      profileSource,
    ),
  );
  // The second argument must be an object literal containing `phone`.
  // Allow up to ~300 chars between the path and the phone key.
  check(
    'R-P10-03',
    'patch body object literal contains `phone`',
    /\bapi\.patch\s*(?:<[^>]*>)?\s*\(\s*["']\/drivers\/me["']\s*,\s*\{[\s\S]{0,300}\bphone\b/.test(
      profileSource,
    ),
  );
}

// -- R-P10-04: profile.tsx calls router.push("/settings") AND imports useRouter from "expo-router" --
// Tests R-P10-04
console.log(
  '\nR-P10-04: profile.tsx calls router.push("/settings") and imports useRouter from "expo-router"',
);
{
  check(
    'R-P10-04',
    'imports `useRouter` from "expo-router"',
    /import\s+\{[^}]*\buseRouter\b[^}]*\}\s+from\s+["']expo-router["']/.test(
      profileSource,
    ),
  );
  check(
    'R-P10-04',
    'calls `router.push("/settings")`',
    /\brouter\.push\s*\(\s*["']\/settings["']\s*\)/.test(profileSource),
  );
}

// -- R-P10-05: profile.tsx has {loading and {error conditional branches --
// Tests R-P10-05
console.log(
  '\nR-P10-05: profile.tsx renders loading and error branches (conditional on `loading` and `error`)',
);
{
  check(
    'R-P10-05',
    'JSX contains `{loading` conditional branch',
    /\{\s*loading\b/.test(profileSource),
  );
  check(
    'R-P10-05',
    'JSX contains `{error` conditional branch',
    /\{\s*error\b/.test(profileSource),
  );
}

// -- R-P10-06: types/driver.ts declares interface DriverProfile with 6 fields --
// Tests R-P10-06
console.log(
  '\nR-P10-06: types/driver.ts declares interface DriverProfile with id, name, email, phone, role, companyId',
);
{
  check(
    'R-P10-06',
    'declares `interface DriverProfile`',
    /\binterface\s+DriverProfile\b[^{]*\{/.test(driverTypesSource),
  );
  const fields = ['id', 'name', 'email', 'phone', 'role', 'companyId'];
  for (const field of fields) {
    // Field declaration: `<name>: <type>` or `<name>?: <type>` inside the
    // interface body. We match the field name at line/column start to avoid
    // matching occurrences inside comments or other prose.
    const fieldRe = new RegExp(`^\\s*${field}\\s*\\??\\s*:`, 'm');
    check(
      'R-P10-06',
      `DriverProfile has field \`${field}\``,
      fieldRe.test(driverTypesSource),
    );
  }
}

// -- Summary --
console.log(`\n--- Results: ${passed} passed, ${failed} failed ---`);
if (failed > 0) {
  process.exit(1);
}
