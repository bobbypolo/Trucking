/**
 * Verification script for Phase 8: Local File Storage + Upload Queue
 *
 * Asserts that all required file storage and upload queue files exist
 * with correct structure and exports.
 * Run: node scripts/verify-upload-queue.cjs
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

// -- R-P8-01: package.json declares expo-file-system and @react-native-async-storage/async-storage --
// Tests R-P8-01
console.log('\nR-P8-01: expo-file-system and async-storage dependencies');
{
  const pkgPath = path.join(TRUCKER, 'package.json');
  const content = fs.readFileSync(pkgPath, 'utf8');
  const pkg = JSON.parse(content);
  const deps = pkg.dependencies || {};
  check(
    'R-P8-01',
    'package.json declares "expo-file-system" in dependencies',
    deps['expo-file-system'] !== undefined
  );
  check(
    'R-P8-01',
    'package.json declares "@react-native-async-storage/async-storage" in dependencies',
    deps['@react-native-async-storage/async-storage'] !== undefined
  );
}

// -- R-P8-02: fileStorage.ts exports saveFileLocally and deleteLocalFile --
// Tests R-P8-02
console.log('\nR-P8-02: fileStorage.ts exports save/delete functions');
{
  const filePath = path.join(TRUCKER, 'src', 'services', 'fileStorage.ts');
  const exists = fs.existsSync(filePath);
  check('R-P8-02', 'fileStorage.ts exists', exists);

  if (exists) {
    const content = fs.readFileSync(filePath, 'utf8');
    check(
      'R-P8-02',
      'fileStorage.ts exports saveFileLocally function',
      /export\s+(async\s+)?function\s+saveFileLocally/.test(content)
    );
    check(
      'R-P8-02',
      'saveFileLocally accepts uri parameter and returns permanent path',
      /saveFileLocally\s*\(\s*uri\s*:\s*string\s*\)/.test(content) &&
        /Promise\s*<\s*string\s*>/.test(content)
    );
    check(
      'R-P8-02',
      'fileStorage.ts exports deleteLocalFile function',
      /export\s+(async\s+)?function\s+deleteLocalFile/.test(content)
    );
    check(
      'R-P8-02',
      'deleteLocalFile accepts path parameter',
      /deleteLocalFile\s*\(\s*path\s*:\s*string\s*\)/.test(content)
    );
  }
}

// -- R-P8-03: uploadQueue.ts exports addToQueue, processQueue, getQueueItems --
// Tests R-P8-03
console.log('\nR-P8-03: uploadQueue.ts exports 3 functions');
{
  const filePath = path.join(TRUCKER, 'src', 'services', 'uploadQueue.ts');
  const exists = fs.existsSync(filePath);
  check('R-P8-03', 'uploadQueue.ts exists', exists);

  if (exists) {
    const content = fs.readFileSync(filePath, 'utf8');
    check(
      'R-P8-03',
      'uploadQueue.ts exports addToQueue function',
      /export\s+(async\s+)?function\s+addToQueue/.test(content)
    );
    check(
      'R-P8-03',
      'uploadQueue.ts exports processQueue function',
      /export\s+(async\s+)?function\s+processQueue/.test(content)
    );
    check(
      'R-P8-03',
      'uploadQueue.ts exports getQueueItems function',
      /export\s+(async\s+)?function\s+getQueueItems/.test(content)
    );
  }
}

// -- R-P8-04: uploadQueue.ts computes retry delay as Math.pow(2, retryCount) * 1000 --
// Tests R-P8-04
console.log('\nR-P8-04: Exponential backoff computation');
{
  const filePath = path.join(TRUCKER, 'src', 'services', 'uploadQueue.ts');
  const content = fs.readFileSync(filePath, 'utf8');
  check(
    'R-P8-04',
    'uploadQueue.ts uses Math.pow(2, retryCount) * 1000 for backoff delay',
    /Math\.pow\s*\(\s*2\s*,\s*(?:item\.)?retryCount\s*\)\s*\*\s*1000/.test(content)
  );
}

// -- R-P8-05: queue.ts defines QueueItem with 7 fields --
// Tests R-P8-05
console.log('\nR-P8-05: QueueItem type definition');
{
  const filePath = path.join(TRUCKER, 'src', 'types', 'queue.ts');
  const exists = fs.existsSync(filePath);
  check('R-P8-05', 'queue.ts exists', exists);

  if (exists) {
    const content = fs.readFileSync(filePath, 'utf8');
    check('R-P8-05', 'queue.ts defines QueueItem interface', /interface\s+QueueItem/.test(content));
    check('R-P8-05', 'QueueItem has id field', /id\s*:\s*string/.test(content));
    check('R-P8-05', 'QueueItem has filePath field', /filePath\s*:\s*string/.test(content));
    check('R-P8-05', 'QueueItem has loadId field', /loadId\s*:\s*string/.test(content));
    check('R-P8-05', 'QueueItem has documentType field', /documentType\s*:\s*string/.test(content));
    check('R-P8-05', 'QueueItem has status field', /status\s*:/.test(content));
    check('R-P8-05', 'QueueItem has retryCount field', /retryCount\s*:\s*number/.test(content));
    check('R-P8-05', 'QueueItem has createdAt field', /createdAt\s*:\s*string/.test(content));
    // Verify all 4 status values are defined
    check(
      'R-P8-05',
      'QueueItemStatus includes pending, uploading, completed, failed',
      /pending/.test(content) &&
        /uploading/.test(content) &&
        /completed/.test(content) &&
        /failed/.test(content)
    );
  }
}

// -- R-P8-06: uploadQueue.ts calls AsyncStorage.setItem("uploadQueue", JSON.stringify(items)) --
// Tests R-P8-06
console.log('\nR-P8-06: AsyncStorage persistence');
{
  const filePath = path.join(TRUCKER, 'src', 'services', 'uploadQueue.ts');
  const content = fs.readFileSync(filePath, 'utf8');
  check(
    'R-P8-06',
    'uploadQueue.ts imports AsyncStorage',
    /import\s+AsyncStorage\s+from\s+["']@react-native-async-storage\/async-storage["']/.test(content)
  );
  check(
    'R-P8-06',
    'uploadQueue.ts calls AsyncStorage.setItem("uploadQueue", JSON.stringify(items))',
    /AsyncStorage\.setItem\s*\(\s*["']uploadQueue["']\s*,\s*JSON\.stringify\s*\(\s*items\s*\)\s*\)/.test(content)
  );
}

// -- R-P8-07: fileStorage.ts calls FileSystem.copyAsync with { from: uri, to: permanentPath } --
// Tests R-P8-07
console.log('\nR-P8-07: FileSystem.copyAsync usage');
{
  const filePath = path.join(TRUCKER, 'src', 'services', 'fileStorage.ts');
  const content = fs.readFileSync(filePath, 'utf8');
  check(
    'R-P8-07',
    'fileStorage.ts imports from expo-file-system',
    /import\s+.*from\s+["']expo-file-system["']/.test(content)
  );
  check(
    'R-P8-07',
    'fileStorage.ts calls FileSystem.copyAsync or copyAsync',
    /copyAsync/.test(content)
  );
  check(
    'R-P8-07',
    'copyAsync called with { from: uri, to: permanentPath }',
    /copyAsync\s*\(\s*\{[^}]*from\s*:\s*uri[^}]*to\s*:\s*permanentPath[^}]*\}/.test(content)
  );
}

// -- R-P8-08: processQueue marks items with retryCount >= 5 as status: "failed" permanently --
// Tests R-P8-08
console.log('\nR-P8-08: Max retry exhaustion');
{
  const filePath = path.join(TRUCKER, 'src', 'services', 'uploadQueue.ts');
  const content = fs.readFileSync(filePath, 'utf8');
  check(
    'R-P8-08',
    'uploadQueue.ts checks retryCount >= 5 (or MAX_RETRIES)',
    /retryCount\s*>=\s*(5|MAX_RETRIES)/.test(content)
  );
  check(
    'R-P8-08',
    'uploadQueue.ts sets status to "failed" for exhausted items',
    /status\s*=\s*["']failed["']/.test(content)
  );
  check(
    'R-P8-08',
    'uploadQueue.ts skips exhausted items with continue',
    /retryCount\s*>=\s*(5|MAX_RETRIES)[\s\S]{0,200}continue/.test(content)
  );
}

// -- Summary --
console.log(`\n--- Results: ${passed} passed, ${failed} failed ---`);
if (failed > 0) {
  process.exit(1);
}
