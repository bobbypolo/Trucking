/**
 * Verification script for STORY-001 Phase 1: Expo Notifications service.
 *
 * Asserts that:
 *   - apps/trucker/package.json declares "expo-notifications": "~0.31.x"
 *   - apps/trucker/app.json plugins array contains an "expo-notifications" entry
 *   - apps/trucker/app.json contains extra.eas.projectId as a non-empty string
 *   - apps/trucker/src/services/pushNotifications.ts exports the 6 functions
 *     required by the plan and uses the expected APIs.
 *
 * Run: node scripts/verify-push-service.cjs
 *
 * # Tests R-P1-01, R-P1-02, R-P1-03, R-P1-04, R-P1-05, R-P1-06, R-P1-07
 * # Tests R-P1-08, R-P1-09
 *
 * Each block below is an inline test( describe(...) ) for one R-marker.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const TRUCKER = path.join(ROOT, 'apps', 'trucker');
const PKG_PATH = path.join(TRUCKER, 'package.json');
const APP_JSON_PATH = path.join(TRUCKER, 'app.json');
const SERVICE_PATH = path.join(
  TRUCKER,
  'src',
  'services',
  'pushNotifications.ts',
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

// -- R-P1-01: package.json declares expo-notifications "~0.31.x" --
// Tests R-P1-01
console.log('\nR-P1-01: package.json declares expo-notifications ~0.31.x');
{
  const content = fs.readFileSync(PKG_PATH, 'utf8');
  const pkg = JSON.parse(content);
  const deps = pkg.dependencies || {};
  check(
    'R-P1-01',
    'dependencies has "expo-notifications" key',
    typeof deps['expo-notifications'] === 'string',
  );
  check(
    'R-P1-01',
    'expo-notifications version starts with "~0.31."',
    typeof deps['expo-notifications'] === 'string' &&
      deps['expo-notifications'].startsWith('~0.31.'),
  );
}

// -- R-P1-02: app.json plugins contains expo-notifications entry --
// Tests R-P1-02
console.log('\nR-P1-02: app.json plugins contains "expo-notifications" entry');
{
  const content = fs.readFileSync(APP_JSON_PATH, 'utf8');
  const cfg = JSON.parse(content);
  const expo = cfg.expo || {};
  const plugins = Array.isArray(expo.plugins) ? expo.plugins : [];
  const hasNotifPlugin = plugins.some((entry) => {
    if (typeof entry === 'string') {
      return entry === 'expo-notifications';
    }
    if (Array.isArray(entry) && entry.length > 0) {
      return entry[0] === 'expo-notifications';
    }
    return false;
  });
  check(
    'R-P1-02',
    'plugins array contains an "expo-notifications" entry (string or array form)',
    hasNotifPlugin,
  );
}

// -- R-P1-03: app.json contains extra.eas.projectId non-empty string --
// Tests R-P1-03
console.log('\nR-P1-03: app.json contains extra.eas.projectId non-empty string');
{
  const content = fs.readFileSync(APP_JSON_PATH, 'utf8');
  const cfg = JSON.parse(content);
  const expo = cfg.expo || {};
  const projectId = expo.extra && expo.extra.eas && expo.extra.eas.projectId;
  check(
    'R-P1-03',
    'extra.eas.projectId is a non-empty string',
    typeof projectId === 'string' && projectId.length > 0,
  );
}

// Read the service file once for the remaining checks.
const serviceExists = fs.existsSync(SERVICE_PATH);
check('R-P1-04', 'pushNotifications.ts file exists', serviceExists);
const serviceSource = serviceExists ? fs.readFileSync(SERVICE_PATH, 'utf8') : '';

// -- R-P1-04: requestPushPermissions exported + calls requestPermissionsAsync --
// Tests R-P1-04
console.log(
  '\nR-P1-04: requestPushPermissions exported + calls Notifications.requestPermissionsAsync',
);
{
  check(
    'R-P1-04',
    'exports `async function requestPushPermissions`',
    /export\s+async\s+function\s+requestPushPermissions/.test(serviceSource),
  );
  check(
    'R-P1-04',
    'calls `Notifications.requestPermissionsAsync`',
    /Notifications\.requestPermissionsAsync\s*\(/.test(serviceSource),
  );
}

// -- R-P1-05: getPushToken reads Constants.expoConfig?.extra?.eas?.projectId AND calls getExpoPushTokenAsync({projectId}) --
// Tests R-P1-05
console.log(
  '\nR-P1-05: getPushToken reads projectId from Constants and calls getExpoPushTokenAsync({projectId})',
);
{
  check(
    'R-P1-05',
    'exports `async function getPushToken`',
    /export\s+async\s+function\s+getPushToken/.test(serviceSource),
  );
  check(
    'R-P1-05',
    'reads `Constants.expoConfig?.extra?.eas?.projectId`',
    /Constants\.expoConfig\?\.extra\?\.eas\?\.projectId/.test(serviceSource),
  );
  check(
    'R-P1-05',
    'calls `Notifications.getExpoPushTokenAsync({ projectId ... })`',
    /getExpoPushTokenAsync\s*\(\s*\{\s*projectId/.test(serviceSource),
  );
}

// -- R-P1-06: registerPushToken(token, platform) calls api.post("/push-tokens", body{token, platform}) --
// Tests R-P1-06
console.log(
  '\nR-P1-06: registerPushToken calls api.post("/push-tokens", { token, platform })',
);
{
  check(
    'R-P1-06',
    'exports `async function registerPushToken(token, platform)`',
    /export\s+async\s+function\s+registerPushToken\s*\(\s*token[^)]*platform[^)]*\)/.test(
      serviceSource,
    ),
  );
  check(
    'R-P1-06',
    'calls `api.post<...>("/push-tokens", ...)`',
    /api\.post\s*<[^>]*>\s*\(\s*["']\/push-tokens["']/.test(serviceSource),
  );
  check(
    'R-P1-06',
    'body argument contains `token` and `platform`',
    /\/push-tokens["'][\s\S]{0,200}\btoken\b[\s\S]{0,200}\bplatform\b/.test(
      serviceSource,
    ) ||
      /\/push-tokens["'][\s\S]{0,200}\bplatform\b[\s\S]{0,200}\btoken\b/.test(
        serviceSource,
      ),
  );
}

// -- R-P1-07: unregisterPushToken(token) calls api.post("/push-tokens/unregister", body{token}) --
// Tests R-P1-07
console.log(
  '\nR-P1-07: unregisterPushToken calls api.post("/push-tokens/unregister", { token })',
);
{
  check(
    'R-P1-07',
    'exports `async function unregisterPushToken`',
    /export\s+async\s+function\s+unregisterPushToken/.test(serviceSource),
  );
  check(
    'R-P1-07',
    'calls `api.post<...>("/push-tokens/unregister", ...)`',
    /api\.post\s*<[^>]*>\s*\(\s*["']\/push-tokens\/unregister["']/.test(
      serviceSource,
    ),
  );
  check(
    'R-P1-07',
    'body argument contains `token`',
    /\/push-tokens\/unregister["'][\s\S]{0,200}\btoken\b/.test(serviceSource),
  );
}

// -- R-P1-08: attachTokenRefreshListener(callback) calls Notifications.addPushTokenListener --
// Tests R-P1-08
console.log(
  '\nR-P1-08: attachTokenRefreshListener calls Notifications.addPushTokenListener',
);
{
  check(
    'R-P1-08',
    'exports `function attachTokenRefreshListener`',
    /export\s+function\s+attachTokenRefreshListener/.test(serviceSource),
  );
  check(
    'R-P1-08',
    'calls `Notifications.addPushTokenListener(`',
    /Notifications\.addPushTokenListener\s*\(/.test(serviceSource),
  );
  check(
    'R-P1-08',
    'callback parameter is forwarded into the listener body',
    /addPushTokenListener\s*\(\s*\(?\s*event[\s\S]{0,200}callback\s*\(/.test(
      serviceSource,
    ) || /addPushTokenListener\s*\(\s*callback\s*\)/.test(serviceSource),
  );
}

// -- R-P1-09: attachNotificationResponseHandler(router) wires deep-link to /loads/${loadId} --
// Tests R-P1-09
console.log(
  '\nR-P1-09: attachNotificationResponseHandler wires deep-link to /loads/${loadId}',
);
{
  check(
    'R-P1-09',
    'exports `function attachNotificationResponseHandler`',
    /export\s+function\s+attachNotificationResponseHandler/.test(serviceSource),
  );
  check(
    'R-P1-09',
    'calls `Notifications.addNotificationResponseReceivedListener`',
    /Notifications\.addNotificationResponseReceivedListener\s*\(/.test(
      serviceSource,
    ),
  );
  check(
    'R-P1-09',
    'reads `response.notification.request.content.data?.loadId` inside the listener body',
    /addNotificationResponseReceivedListener\s*\(\s*\(?\s*response[\s\S]{0,1000}response\.notification\.request\.content\.data[\s\S]{0,200}\?\.loadId/.test(
      serviceSource,
    ),
  );
  check(
    'R-P1-09',
    'calls `router.push(`/loads/${loadId}`)` inside the listener body',
    /router\.push\s*\(\s*`\/loads\/\$\{\s*loadId\s*\}`\s*\)/.test(serviceSource),
  );
}

// -- Summary --
console.log(`\n--- Results: ${passed} passed, ${failed} failed ---`);
if (failed > 0) {
  process.exit(1);
}
