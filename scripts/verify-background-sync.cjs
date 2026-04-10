/**
 * Verification script for Phase 9: Background Sync Task
 *
 * Asserts that expo-task-manager is declared, backgroundSync.ts defines
 * the task with processQueue handler, connectivity.ts triggers processQueue
 * on reconnect, and _layout.tsx registers the background sync on mount.
 * Run: node scripts/verify-background-sync.cjs
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const TRUCKER = path.join(ROOT, 'apps', 'trucker');

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

// -- R-P9-01: package.json declares expo-task-manager in dependencies --
// Tests R-P9-01
console.log('\nR-P9-01: expo-task-manager dependency');
{
  const pkgPath = path.join(TRUCKER, 'package.json');
  const content = fs.readFileSync(pkgPath, 'utf8');
  const pkg = JSON.parse(content);
  const deps = pkg.dependencies || {};
  check(
    'R-P9-01',
    'package.json declares "expo-task-manager" in dependencies',
    deps['expo-task-manager'] !== undefined
  );
}

// -- R-P9-02: backgroundSync.ts calls TaskManager.defineTask("loadpilot-upload-sync", handler) with processQueue --
// Tests R-P9-02
console.log('\nR-P9-02: backgroundSync.ts defines task with TaskManager.defineTask');
{
  const filePath = path.join(TRUCKER, 'src', 'services', 'backgroundSync.ts');
  const exists = fs.existsSync(filePath);
  check('R-P9-02', 'backgroundSync.ts exists', exists);

  if (exists) {
    const content = fs.readFileSync(filePath, 'utf8');
    check(
      'R-P9-02',
      'backgroundSync.ts calls TaskManager.defineTask',
      /defineTask/.test(content)
    );
    check(
      'R-P9-02',
      'defineTask uses task name "loadpilot-upload-sync"',
      /loadpilot-upload-sync/.test(content)
    );
    check(
      'R-P9-02',
      'handler calls processQueue()',
      /processQueue/.test(content)
    );
  }
}

// -- R-P9-03: background task handler calls processQueue and returns BackgroundFetchResult.NewData --
// Tests R-P9-03
console.log('\nR-P9-03: handler returns BackgroundFetchResult.NewData');
{
  const filePath = path.join(TRUCKER, 'src', 'services', 'backgroundSync.ts');
  const content = fs.readFileSync(filePath, 'utf8');
  check(
    'R-P9-03',
    'handler calls processQueue()',
    /processQueue\s*\(\s*\)/.test(content)
  );
  check(
    'R-P9-03',
    'handler returns BackgroundFetchResult.NewData',
    /BackgroundFetch\.BackgroundFetchResult\.NewData/.test(content) ||
      /BackgroundFetchResult\.NewData/.test(content)
  );
}

// -- R-P9-04: connectivity.ts calls processQueue when NetInfo transitions offline to online --
// Tests R-P9-04
console.log('\nR-P9-04: connectivity.ts triggers processQueue on reconnect');
{
  const filePath = path.join(TRUCKER, 'src', 'services', 'connectivity.ts');
  const content = fs.readFileSync(filePath, 'utf8');
  check(
    'R-P9-04',
    'connectivity.ts imports processQueue',
    /import\s*\{[^}]*processQueue[^}]*\}\s*from/.test(content)
  );
  check(
    'R-P9-04',
    'connectivity.ts calls processQueue()',
    /processQueue\s*\(\s*\)/.test(content)
  );
  check(
    'R-P9-04',
    'connectivity.ts detects offline-to-online transition',
    /wasOffline/.test(content) || (/isConnected\s*===\s*false/.test(content) && /isConnected\s*===\s*true/.test(content))
  );
}

// -- R-P9-05: Root _layout.tsx calls registerBackgroundSync() in useEffect with [] --
// Tests R-P9-05
console.log('\nR-P9-05: _layout.tsx registers background sync on mount');
{
  const filePath = path.join(TRUCKER, 'src', 'app', '_layout.tsx');
  const content = fs.readFileSync(filePath, 'utf8');
  check(
    'R-P9-05',
    '_layout.tsx imports registerBackgroundSync',
    /import\s*\{[^}]*registerBackgroundSync[^}]*\}\s*from/.test(content)
  );
  check(
    'R-P9-05',
    '_layout.tsx calls registerBackgroundSync() inside useEffect',
    /useEffect\s*\(\s*\(\s*\)\s*=>\s*\{[^}]*registerBackgroundSync\s*\(\s*\)/.test(content)
  );
  check(
    'R-P9-05',
    '_layout.tsx useEffect has empty dependency array []',
    /registerBackgroundSync[\s\S]*?\}\s*,\s*\[\s*\]\s*\)/.test(content)
  );
}

// -- Summary --
console.log(`\n--- Results: ${passed} passed, ${failed} failed ---`);
if (failed > 0) {
  process.exit(1);
}
