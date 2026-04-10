#!/usr/bin/env node
/**
 * scripts/demo-tunnel.cjs - Cloudflare tunnel for external demo access.
 *
 * Starts a cloudflared Quick Tunnel pointing at localhost:5000 (the demo
 * server). Prints the public HTTPS URL for the salesperson to use.
 *
 * Usage: node scripts/demo-tunnel.cjs
 * npm script: npm run demo:tunnel
 */
"use strict";

const { spawn, execSync } = require("child_process");

const LOCAL_PORT = process.env.PORT || 5000;
const LOCAL_URL = "http://localhost:" + LOCAL_PORT;

function checkCloudflared() {
  try {
    const version = execSync("cloudflared version", {
      encoding: "utf8",
    }).trim();
    process.stdout.write("[tunnel] " + version + "\n");
    return true;
  } catch {
    process.stderr.write(
      "[tunnel] ERROR: cloudflared not found.\n" +
        "Install it from: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/\n",
    );
    return false;
  }
}

function checkLocalServer() {
  const http = require("http");
  return new Promise((resolve) => {
    const req = http.get(LOCAL_URL + "/api/health", (res) => {
      res.resume();
      resolve(res.statusCode >= 200 && res.statusCode < 400);
    });
    req.on("error", () => resolve(false));
    req.setTimeout(3000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function main() {
  if (!checkCloudflared()) process.exit(1);

  const serverUp = await checkLocalServer();
  if (!serverUp) {
    process.stderr.write(
      "[tunnel] Demo server not responding at " +
        LOCAL_URL +
        "/api/health\n" +
        "[tunnel] Start it first: npm run demo:serve\n",
    );
    process.exit(1);
  }

  process.stdout.write("[tunnel] Starting Cloudflare tunnel to " + LOCAL_URL + "...\n");
  process.stdout.write("[tunnel] Press Ctrl+C to stop the tunnel.\n\n");

  const child = spawn("cloudflared", ["tunnel", "--url", LOCAL_URL], {
    stdio: ["ignore", "pipe", "pipe"],
    shell: true,
  });

  let urlPrinted = false;

  function handleOutput(data) {
    const text = data.toString();
    const urlMatch = text.match(/https:\/\/[\w-]+\.trycloudflare\.com/);
    if (urlMatch && !urlPrinted) {
      urlPrinted = true;
      process.stdout.write("\n" + "=".repeat(60) + "\n");
      process.stdout.write("  DEMO URL (share with salesperson):\n");
      process.stdout.write("  " + urlMatch[0] + "\n");
      process.stdout.write("=".repeat(60) + "\n\n");
      process.stdout.write("  Admin login: use the Firebase admin credentials\n");
      process.stdout.write("  Driver login: use the Firebase driver credentials\n");
      process.stdout.write("  Reset Demo button in sidebar to reset between demos\n\n");
    }
  }

  child.stdout.on("data", handleOutput);
  child.stderr.on("data", handleOutput);

  child.on("exit", (code) => {
    process.stdout.write("[tunnel] cloudflared exited with code " + code + "\n");
    process.exit(code || 0);
  });

  process.on("SIGINT", () => {
    process.stdout.write("\n[tunnel] Shutting down tunnel...\n");
    child.kill("SIGTERM");
  });
  process.on("SIGTERM", () => child.kill("SIGTERM"));
}

main();
