/**
 * Verification script for STORY-011 Phase 11: Settings screen + layout
 * registration.
 *
 * Asserts that apps/trucker/src/app/settings.tsx:
 *   - imports AsyncStorage from @react-native-async-storage/async-storage and
 *     uses the literal key "@loadpilot/notification-prefs"
 *   - has a useEffect calling AsyncStorage.getItem("@loadpilot/notification-prefs")
 *   - calls AsyncStorage.setItem("@loadpilot/notification-prefs", JSON.stringify(...))
 *   - renders exactly 3 <Switch elements
 *   - imports useAuth from "../contexts/AuthContext", destructures logout,
 *     and calls logout( inside an onPress arrow-function body
 *   - imports Alert from "react-native" and contains an Alert.alert call with
 *     a button option { style: "destructive", ... }
 *   - imports Constants from "expo-constants" and reads Constants.expoConfig?.version
 *   - contains a router.replace("/") call and imports useRouter
 *
 * And that apps/trucker/src/app/_layout.tsx contains
 * <Stack.Screen name="settings".
 *
 * Run: node scripts/verify-settings-screen.cjs
 *
 * # Tests R-P11-01, R-P11-02, R-P11-03, R-P11-04, R-P11-05, R-P11-06, R-P11-07, R-P11-08, R-P11-09
 *
 * Each block below is an inline test( describe(...) ) for one R-marker.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const TRUCKER = path.join(ROOT, 'apps', 'trucker');
const SETTINGS_PATH = path.join(TRUCKER, 'src', 'app', 'settings.tsx');
const LAYOUT_PATH = path.join(TRUCKER, 'src', 'app', '_layout.tsx');

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
const settingsExists = fs.existsSync(SETTINGS_PATH);
check('R-P11-00', 'settings.tsx file exists', settingsExists);
const settingsSource = settingsExists
  ? fs.readFileSync(SETTINGS_PATH, 'utf8')
  : '';

const layoutExists = fs.existsSync(LAYOUT_PATH);
check('R-P11-00', '_layout.tsx file exists', layoutExists);
const layoutSource = layoutExists
  ? fs.readFileSync(LAYOUT_PATH, 'utf8')
  : '';

// -- R-P11-01: imports AsyncStorage from @react-native-async-storage/async-storage
//              AND uses the literal key "@loadpilot/notification-prefs" --
// Tests R-P11-01
console.log(
  '\nR-P11-01: settings.tsx imports AsyncStorage and uses the prefs key literal',
);
{
  // Default import, named import, or namespace import of AsyncStorage from the
  // storage package.
  const importRe =
    /import\s+(?:AsyncStorage|\{[^}]*\bAsyncStorage\b[^}]*\}|\*\s+as\s+AsyncStorage)\s+from\s+["']@react-native-async-storage\/async-storage["']/;
  check(
    'R-P11-01',
    'imports `AsyncStorage` from "@react-native-async-storage/async-storage"',
    importRe.test(settingsSource),
  );
  check(
    'R-P11-01',
    'uses literal key `"@loadpilot/notification-prefs"`',
    /["']@loadpilot\/notification-prefs["']/.test(settingsSource),
  );
}

// -- R-P11-02: has useEffect calling AsyncStorage.getItem("@loadpilot/notification-prefs") --
// Tests R-P11-02
console.log(
  '\nR-P11-02: settings.tsx has useEffect calling AsyncStorage.getItem("@loadpilot/notification-prefs")',
);
{
  // Multiline match: useEffect(...) body contains AsyncStorage.getItem with
  // the exact prefs key. Allow up to ~1500 chars between useEffect and
  // the getItem call to cover the async IIFE + try/catch body.
  const effectRe =
    /useEffect\s*\(\s*\(\s*\)\s*=>\s*\{[\s\S]{0,2000}AsyncStorage\.getItem\s*\(\s*["']@loadpilot\/notification-prefs["']\s*\)/;
  check(
    'R-P11-02',
    'useEffect body calls AsyncStorage.getItem("@loadpilot/notification-prefs")',
    effectRe.test(settingsSource),
  );
}

// -- R-P11-03: calls AsyncStorage.setItem("@loadpilot/notification-prefs", JSON.stringify(...)) --
// Tests R-P11-03
console.log(
  '\nR-P11-03: settings.tsx calls AsyncStorage.setItem with JSON.stringify',
);
{
  const setItemRe =
    /AsyncStorage\.setItem\s*\(\s*["']@loadpilot\/notification-prefs["']\s*,\s*JSON\.stringify\s*\(/;
  check(
    'R-P11-03',
    'AsyncStorage.setItem("@loadpilot/notification-prefs", JSON.stringify(...))',
    setItemRe.test(settingsSource),
  );
}

// -- R-P11-04: renders exactly 3 <Switch elements --
// Tests R-P11-04
console.log('\nR-P11-04: settings.tsx renders exactly 3 <Switch elements');
{
  const switchCount = (settingsSource.match(/<Switch[\s>]/g) || []).length;
  check(
    'R-P11-04',
    `exactly 3 <Switch elements (found ${switchCount})`,
    switchCount === 3,
  );
}

// -- R-P11-05: imports useAuth from "../contexts/AuthContext", destructures
//              logout, calls logout( inside an onPress arrow-function body --
// Tests R-P11-05
console.log(
  '\nR-P11-05: settings.tsx imports useAuth, destructures logout, and calls logout inside an onPress arrow body',
);
{
  check(
    'R-P11-05',
    'imports `useAuth` from "../contexts/AuthContext"',
    /import\s+\{[^}]*\buseAuth\b[^}]*\}\s+from\s+["']\.\.\/contexts\/AuthContext["']/.test(
      settingsSource,
    ),
  );
  // Allow `const { logout }` or `const { logout, ... }` from useAuth() call.
  check(
    'R-P11-05',
    'destructures `logout` from useAuth()',
    /\{\s*[^}]*\blogout\b[^}]*\}\s*=\s*useAuth\s*\(\s*\)/.test(settingsSource),
  );
  // Multiline: onPress: (...) => { ... logout( ... }
  // Allow up to ~500 chars between the arrow-function brace and logout(.
  const logoutInOnPressRe =
    /onPress\s*:\s*(?:async\s+)?\(\s*\)\s*=>\s*\{[\s\S]{0,500}\blogout\s*\(/;
  check(
    'R-P11-05',
    'onPress arrow-function body contains `logout(` call',
    logoutInOnPressRe.test(settingsSource),
  );
}

// -- R-P11-06: imports Alert from "react-native" AND contains Alert.alert
//              whose options include an object with style: "destructive" --
// Tests R-P11-06
console.log(
  '\nR-P11-06: settings.tsx imports Alert from "react-native" and uses Alert.alert with destructive button',
);
{
  check(
    'R-P11-06',
    'imports `Alert` from "react-native"',
    /import\s+\{[^}]*\bAlert\b[^}]*\}\s+from\s+["']react-native["']/.test(
      settingsSource,
    ),
  );
  // Multiline: Alert.alert(...) body contains an object with style: "destructive".
  const destructiveRe =
    /Alert\.alert\s*\([\s\S]{0,2000}style\s*:\s*["']destructive["']/;
  check(
    'R-P11-06',
    'Alert.alert call includes button object with `style: "destructive"`',
    destructiveRe.test(settingsSource),
  );
}

// -- R-P11-07: imports Constants from "expo-constants" AND reads
//              Constants.expoConfig?.version or .expoConfig.version --
// Tests R-P11-07
console.log(
  '\nR-P11-07: settings.tsx imports Constants and reads Constants.expoConfig?.version',
);
{
  check(
    'R-P11-07',
    'imports `Constants` from "expo-constants"',
    /import\s+(?:Constants|\{[^}]*\bConstants\b[^}]*\}|\*\s+as\s+Constants)\s+from\s+["']expo-constants["']/.test(
      settingsSource,
    ),
  );
  check(
    'R-P11-07',
    'reads `Constants.expoConfig?.version` or `Constants.expoConfig.version`',
    /Constants\.expoConfig\s*\??\.\s*version\b/.test(settingsSource),
  );
}

// -- R-P11-08: contains router.replace("/") AND imports useRouter --
// Tests R-P11-08
console.log(
  '\nR-P11-08: settings.tsx contains router.replace("/") and imports useRouter',
);
{
  check(
    'R-P11-08',
    'imports `useRouter` from "expo-router"',
    /import\s+\{[^}]*\buseRouter\b[^}]*\}\s+from\s+["']expo-router["']/.test(
      settingsSource,
    ),
  );
  check(
    'R-P11-08',
    'calls `router.replace("/")`',
    /\brouter\.replace\s*\(\s*["']\/["']\s*\)/.test(settingsSource),
  );
}

// -- R-P11-09: _layout.tsx contains <Stack.Screen name="settings" --
// Tests R-P11-09
console.log('\nR-P11-09: _layout.tsx contains <Stack.Screen name="settings"');
{
  check(
    'R-P11-09',
    '_layout.tsx contains `<Stack.Screen name="settings"`',
    /<Stack\.Screen\s+name\s*=\s*["']settings["']/.test(layoutSource),
  );
}

// -- Summary --
console.log(`\n--- Results: ${passed} passed, ${failed} failed ---`);
if (failed > 0) {
  process.exit(1);
}
