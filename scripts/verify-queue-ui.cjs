/**
 * Verification script for Phase 10: Queue Status UI + Offline Upload Integration
 * Run: node scripts/verify-queue-ui.cjs
 */

"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const TRUCKER = path.join(ROOT, "apps", "trucker");

let passed = 0;
let failed = 0;

function check(id, description, condition) {
  if (condition) {
    console.log("  PASS [" + id + "]: " + description);
    passed++;
  } else {
    console.error("  FAIL [" + id + "]: " + description);
    failed++;
  }
}

function countMatches(str, regex) {
  const m = str.match(new RegExp(regex.source, "g"));
  return m ? m.length : 0;
}

// Tests R-P10-01
console.log("\nR-P10-01: QueueStatusBadge calls getQueueItems and renders red badge");
{
  const filePath = path.join(TRUCKER, "src", "components", "QueueStatusBadge.tsx");
  const exists = fs.existsSync(filePath);
  check("R-P10-01", "QueueStatusBadge.tsx exists", exists);
  if (exists) {
    const content = fs.readFileSync(filePath, "utf8");
    check("R-P10-01", "calls getQueueItems()", countMatches(content, /getQueueItems/) >= 1);
    check("R-P10-01", "filters pending status", /pending/.test(content));
    check("R-P10-01", "filters failed status", /failed/.test(content));
    check("R-P10-01", "renders red badge", /#dc2626/.test(content) || /red/.test(content));
    check("R-P10-01", "renders count text", /\{count\}/.test(content));
  }
}

// Tests R-P10-02
console.log("\nR-P10-02: QueueScreen renders FlatList with 4 fields");
{
  const filePath = path.join(TRUCKER, "src", "app", "(tabs)", "queue.tsx");
  const exists = fs.existsSync(filePath);
  check("R-P10-02", "queue.tsx exists", exists);
  if (exists) {
    const content = fs.readFileSync(filePath, "utf8");
    check("R-P10-02", "calls getQueueItems()", /getQueueItems/.test(content));
    check("R-P10-02", "uses FlatList", /FlatList/.test(content));
    check("R-P10-02", "shows filename", /filename/.test(content));
    check("R-P10-02", "shows documentType", /documentType/.test(content));
    check("R-P10-02", "shows status", /status/.test(content));
    check("R-P10-02", "shows retryCount", /retryCount/.test(content));
  }
}

// Tests R-P10-03
console.log("\nR-P10-03: QueueScreen has Retry Pressable for failed items");
{
  const filePath = path.join(TRUCKER, "src", "app", "(tabs)", "queue.tsx");
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, "utf8");
    check("R-P10-03", "has Retry button", /[Rr]etry/.test(content));
    check("R-P10-03", "checks failed status", /failed/.test(content));
    check("R-P10-03", "uses Pressable", /Pressable/.test(content));
    check("R-P10-03", "calls retryQueueItem", /retryQueueItem/.test(content));
  } else {
    check("R-P10-03", "queue.tsx exists", false);
  }
}

// Tests R-P10-04
console.log("\nR-P10-04: upload.tsx uses offline fallback with queue");
{
  const filePath = path.join(TRUCKER, "src", "app", "(camera)", "upload.tsx");
  const exists = fs.existsSync(filePath);
  check("R-P10-04", "upload.tsx exists", exists);
  if (exists) {
    const content = fs.readFileSync(filePath, "utf8");
    check("R-P10-04", "imports useConnectivity", /useConnectivity/.test(content));
    check("R-P10-04", "checks isOnline", /isOnline/.test(content));
    check("R-P10-04", "imports saveFileLocally", /saveFileLocally/.test(content));
    check("R-P10-04", "imports addToQueue", /addToQueue/.test(content));
    check("R-P10-04", "calls saveFileLocally()", /saveFileLocally\(/.test(content));
    check("R-P10-04", "calls addToQueue()", /addToQueue\(/.test(content));
  }
}

// Tests R-P10-05
console.log("\nR-P10-05: Tab layout adds queue tab with QueueStatusBadge");
{
  const filePath = path.join(TRUCKER, "src", "app", "(tabs)", "_layout.tsx");
  const content = fs.readFileSync(filePath, "utf8");
  check("R-P10-05", "references queue tab", countMatches(content, /[Qq]ueue/) >= 1);
  check("R-P10-05", "imports QueueStatusBadge", /QueueStatusBadge/.test(content));
  check("R-P10-05", "has Tabs.Screen for queue", /name=.queue./.test(content));
  check("R-P10-05", "uses QueueStatusBadge in config", /QueueStatusBadge/.test(content));
}

// Supporting files
console.log("\nSupporting files:");
{
  const queueTypePath = path.join(TRUCKER, "src", "types", "queue.ts");
  check("SUPPORT", "types/queue.ts exists", fs.existsSync(queueTypePath));
  if (fs.existsSync(queueTypePath)) {
    const c = fs.readFileSync(queueTypePath, "utf8");
    check("SUPPORT", "exports QueueItem", /QueueItem/.test(c));
    check("SUPPORT", "has filePath", /filePath/.test(c));
    check("SUPPORT", "has retryCount", /retryCount/.test(c));
  }

  const uqPath = path.join(TRUCKER, "src", "services", "uploadQueue.ts");
  check("SUPPORT", "uploadQueue.ts exists", fs.existsSync(uqPath));
  if (fs.existsSync(uqPath)) {
    const c = fs.readFileSync(uqPath, "utf8");
    check("SUPPORT", "exports getQueueItems", /export.*getQueueItems/.test(c));
    check("SUPPORT", "exports addToQueue", /export.*addToQueue/.test(c));
    check("SUPPORT", "exports processQueue", /export.*processQueue/.test(c));
    check("SUPPORT", "uses AsyncStorage", /AsyncStorage/.test(c));
    check("SUPPORT", "has exponential backoff", /Math\.pow/.test(c));
  }

  const fsPath = path.join(TRUCKER, "src", "services", "fileStorage.ts");
  check("SUPPORT", "fileStorage.ts exists", fs.existsSync(fsPath));
  if (fs.existsSync(fsPath)) {
    const c = fs.readFileSync(fsPath, "utf8");
    check("SUPPORT", "exports saveFileLocally", /export.*saveFileLocally/.test(c));
    check("SUPPORT", "uses copyAsync", /copyAsync/.test(c));
  }
}

console.log("\n--- Results: " + passed + " passed, " + failed + " failed ---");
if (failed > 0) { process.exit(1); }
