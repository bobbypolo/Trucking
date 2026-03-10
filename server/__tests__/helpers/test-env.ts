/**
 * Test environment setup helper.
 * Loads .env from project root and exports helpers for real-infrastructure tests.
 * Tests R-P1-01, R-P1-02, R-P1-03, R-P1-04, R-P1-05
 */
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import mysql from "mysql2/promise";

// Load .env from project root (two levels up from server/)
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "../../../");
dotenv.config({ path: path.join(projectRoot, ".env") });

export function getPool(): mysql.Pool {
  return mysql.createPool({
    host: process.env.DB_HOST || "127.0.0.1",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "root",
    database: process.env.DB_NAME || "trucklogix",
    waitForConnections: true,
    connectionLimit: 5,
    queueLimit: 10,
  });
}

export function getFirebaseApiKey(): string {
  const key = process.env.FIREBASE_WEB_API_KEY;
  if (!key) {
    throw new Error("FIREBASE_WEB_API_KEY env var not set");
  }
  return key;
}

export function getFirebaseProjectId(): string {
  const id = process.env.FIREBASE_PROJECT_ID;
  if (!id) {
    throw new Error("FIREBASE_PROJECT_ID env var not set");
  }
  return id;
}

export function hasServiceAccount(): boolean {
  const fs = require("fs");
  const serviceAccountPath = path.join(
    __dirname,
    "../../../serviceAccount.json",
  );
  return fs.existsSync(serviceAccountPath);
}

export function isDockerRunning(): boolean {
  try {
    const { execSync } = require("child_process");
    const output = execSync(
      'docker ps --filter name=loadpilot-dev --format "{{.Names}}"',
      {
        encoding: "utf-8",
        timeout: 5000,
      },
    );
    return output.trim().includes("loadpilot-dev");
  } catch {
    return false;
  }
}

export function skipIfNoDocker(): boolean {
  return !isDockerRunning();
}

export function skipIfNoFirebase(): boolean {
  try {
    getFirebaseApiKey();
    return false;
  } catch {
    return true;
  }
}
