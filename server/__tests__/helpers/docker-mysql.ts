/**
 * Docker MySQL lifecycle helper.
 * Manages loadpilot-dev container, waits for MySQL readiness, and runs migrations.
 * Tests R-P1-01, R-P1-02
 */
import { execSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import dotenv from "dotenv";
import mysql from "mysql2/promise";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.resolve(__dirname, "../../../migrations");

// Load env from project root
const projectRoot = path.resolve(__dirname, "../../../");
dotenv.config({ path: path.join(projectRoot, ".env") });

const MIGRATION_ORDER = [
  "001_baseline.sql",
  "002_add_version_columns.sql",
  "002_load_status_normalization.sql",
  "003_enhance_dispatch_events.sql",
  "003_operational_entities.sql",
  "004_idempotency_keys.sql",
  "005_documents_table.sql",
  "006_add_load_legs_lat_lng.sql",
  "007_ocr_results.sql",
  "008_settlements.sql",
  "009_settlement_adjustments.sql",
  "exception_management.sql",
];

export function isContainerRunning(): boolean {
  try {
    const output = execSync(
      'docker ps --filter name=loadpilot-dev --format "{{.Names}}"',
      { encoding: "utf-8", timeout: 5000 },
    );
    return output.trim().includes("loadpilot-dev");
  } catch {
    return false;
  }
}

export async function waitForHealthy(maxAttempts = 30): Promise<void> {
  const host = process.env.DB_HOST || "127.0.0.1";
  const user = process.env.DB_USER || "root";
  const pass = process.env.DB_PASSWORD;
  const database = process.env.DB_NAME || "trucklogix";
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const conn = await mysql.createConnection({
        host,
        user,
        password: pass,
        database,
      });
      await conn.query("SELECT 1");
      await conn.end();
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }
  throw new Error(`MySQL not ready after ${maxAttempts * 2}s`);
}

export async function ensureContainer(): Promise<void> {
  if (!isContainerRunning()) {
    // Try to start existing stopped container first
    try {
      execSync("docker start loadpilot-dev", { timeout: 10000 });
    } catch {
      // Container does not exist — create it
      const rootPw = process.env.DB_PASSWORD || "";
      execSync(
        "docker run -d --name loadpilot-dev -e MYSQL_ROOT_PASSWORD -e MYSQL_DATABASE=trucklogix -p 3306:3306 mysql:8",
        {
          timeout: 60000,
          env: { ...process.env, MYSQL_ROOT_PASSWORD: rootPw },
        },
      );
    }
  }
  await waitForHealthy();
}

function extractUpSection(content: string): string {
  const lines = content.split("\n");
  let inUp = false;
  const upLines: string[] = [];
  for (const line of lines) {
    const stripped = line.trim();
    if (stripped === "-- UP") {
      inUp = true;
      continue;
    }
    if (stripped === "-- DOWN") break;
    if (inUp) upLines.push(line);
  }
  return upLines.length > 0 ? upLines.join("\n") : content;
}

export async function runMigrations(
  pool: mysql.Pool,
): Promise<{ applied: number }> {
  let applied = 0;
  for (const filename of MIGRATION_ORDER) {
    const filepath = path.join(MIGRATIONS_DIR, filename);
    if (!fs.existsSync(filepath)) continue;
    const content = fs.readFileSync(filepath, "utf-8");
    const sql = extractUpSection(content);
    // Split on semicolons to run statements one at a time
    const statements = sql
      .split(";")
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && !s.startsWith("--"));
    for (const stmt of statements) {
      try {
        await pool.query(stmt);
      } catch {
        // Ignore errors from already-applied migrations
      }
    }
    applied++;
  }
  return { applied };
}

export async function stopContainer(): Promise<void> {
  try {
    execSync("docker stop loadpilot-dev", { timeout: 15000 });
  } catch {
    // Container may already be stopped
  }
}
