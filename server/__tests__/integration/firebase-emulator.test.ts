/**
 * Firebase Emulator Setup Integration Tests — STORY-000
 *
 * Verifies firebase.json emulator config, server-side emulator detection
 * logging, .env.emulator file contents, and Firestore cost-saving guards.
 *
 * R-markers: Tests R-P0-01, R-P0-02, R-P0-03, R-P0-05, R-P0-06, R-P0-07
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "../../..");

describe("Firebase Emulator Configuration (R-P0-01)", () => {
  // Tests R-P0-01
  const firebaseJson = JSON.parse(
    fs.readFileSync(path.join(projectRoot, "firebase.json"), "utf-8"),
  );

  it("firebase.json contains an emulators block", () => {
    expect(firebaseJson).toHaveProperty("emulators");
    expect(typeof firebaseJson.emulators).toBe("object");
  });

  it("emulators.auth.port is 9099", () => {
    expect(firebaseJson.emulators.auth).toBeDefined();
    expect(firebaseJson.emulators.auth.port).toBe(9099);
  });

  it("emulators.firestore.port is 8080", () => {
    expect(firebaseJson.emulators.firestore).toBeDefined();
    expect(firebaseJson.emulators.firestore.port).toBe(8080);
  });
});

describe("Server auth.ts emulator detection (R-P0-02)", () => {
  // Tests R-P0-02
  const authSource = fs.readFileSync(
    path.join(projectRoot, "server/auth.ts"),
    "utf-8",
  );

  it('logs "Firebase Auth Emulator active" when FIREBASE_AUTH_EMULATOR_HOST is set', () => {
    expect(authSource).toContain("process.env.FIREBASE_AUTH_EMULATOR_HOST");
    expect(authSource).toContain("Firebase Auth Emulator active");
  });

  it("emulator detection uses logger.info (not console.log)", () => {
    const emulatorBlock = authSource.substring(
      authSource.indexOf("FIREBASE_AUTH_EMULATOR_HOST"),
    );
    const blockEnd = emulatorBlock.indexOf("}");
    const block = emulatorBlock.substring(0, blockEnd);
    expect(block).toContain("logger.info");
  });
});

describe("Server firestore.ts emulator detection (R-P0-03)", () => {
  // Tests R-P0-03
  const firestoreSource = fs.readFileSync(
    path.join(projectRoot, "server/firestore.ts"),
    "utf-8",
  );

  it('logs "Firestore Emulator active" when FIRESTORE_EMULATOR_HOST is set', () => {
    expect(firestoreSource).toContain("process.env.FIRESTORE_EMULATOR_HOST");
    expect(firestoreSource).toContain("Firestore Emulator active");
  });

  it("emulator detection uses logger.info (not console.log)", () => {
    const emulatorBlock = firestoreSource.substring(
      firestoreSource.indexOf("FIRESTORE_EMULATOR_HOST"),
    );
    const blockEnd = emulatorBlock.indexOf("}");
    const block = emulatorBlock.substring(0, blockEnd);
    expect(block).toContain("logger.info");
  });
});

describe(".env.emulator file (R-P0-05)", () => {
  // Tests R-P0-05
  const envEmulatorPath = path.join(projectRoot, ".env.emulator");

  it(".env.emulator file exists", () => {
    expect(fs.existsSync(envEmulatorPath)).toBe(true);
  });

  it("contains FIREBASE_AUTH_EMULATOR_HOST variable", () => {
    const content = fs.readFileSync(envEmulatorPath, "utf-8");
    expect(content).toMatch(/^FIREBASE_AUTH_EMULATOR_HOST=/m);
  });

  it("contains FIRESTORE_EMULATOR_HOST variable", () => {
    const content = fs.readFileSync(envEmulatorPath, "utf-8");
    expect(content).toMatch(/^FIRESTORE_EMULATOR_HOST=/m);
  });

  it("contains VITE_USE_FIREBASE_EMULATOR variable", () => {
    const content = fs.readFileSync(envEmulatorPath, "utf-8");
    expect(content).toMatch(/^VITE_USE_FIREBASE_EMULATOR=/m);
  });

  it("FIREBASE_AUTH_EMULATOR_HOST points to 127.0.0.1:9099", () => {
    const content = fs.readFileSync(envEmulatorPath, "utf-8");
    expect(content).toMatch(/^FIREBASE_AUTH_EMULATOR_HOST=127\.0\.0\.1:9099$/m);
  });

  it("FIRESTORE_EMULATOR_HOST points to 127.0.0.1:8080", () => {
    const content = fs.readFileSync(envEmulatorPath, "utf-8");
    expect(content).toMatch(/^FIRESTORE_EMULATOR_HOST=127\.0\.0\.1:8080$/m);
  });
});

describe("Zero onSnapshot on collection-level queries (R-P0-06)", () => {
  // Tests R-P0-06
  it("no onSnapshot calls exist on collection-level queries in the codebase", () => {
    const srcDir = path.join(projectRoot, "services");
    const serverDir = path.join(projectRoot, "server");
    const componentsDir = path.join(projectRoot, "components");

    const dirsToScan = [srcDir, serverDir, componentsDir].filter((d) =>
      fs.existsSync(d),
    );

    let onSnapshotCount = 0;
    const violations: string[] = [];

    function scanDir(dir: string): void {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name === "node_modules" || entry.name === "__tests__") {
            continue;
          }
          scanDir(fullPath);
        } else if (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) {
          const content = fs.readFileSync(fullPath, "utf-8");
          const lines = content.split("\n");
          for (let i = 0; i < lines.length; i++) {
            if (lines[i].includes(".onSnapshot(")) {
              onSnapshotCount++;
              violations.push(
                `${path.relative(projectRoot, fullPath)}:${i + 1}`,
              );
            }
          }
        }
      }
    }

    for (const dir of dirsToScan) {
      scanDir(dir);
    }

    expect(onSnapshotCount).toBe(0);
  });
});

describe("Firestore read cost-saving guards (R-P0-07)", () => {
  // Tests R-P0-07
  it("all server-side Firestore reads are single-doc or have .limit()", () => {
    const serverDir = path.join(projectRoot, "server");
    const violations: string[] = [];

    function scanDir(dir: string): void {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name === "node_modules" || entry.name === "__tests__") {
            continue;
          }
          scanDir(fullPath);
        } else if (entry.name.endsWith(".ts")) {
          const content = fs.readFileSync(fullPath, "utf-8");
          const lines = content.split("\n");

          // Find collection-level reads: .collection(...).where(...).get()
          // that do NOT have .limit() or .doc() in the chain
          // We scan for .collection( calls and trace forward
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (line.includes(".collection(")) {
              // Gather the surrounding context (up to 10 lines forward)
              const context = lines.slice(i, i + 10).join(" ");

              // If the chain has .doc() it's a single-doc read — OK
              if (context.includes(".doc(")) {
                continue;
              }

              // If it's a .set() or .add() or .update() it's a write — OK
              if (
                context.includes(".set(") ||
                context.includes(".add(") ||
                context.includes(".update(")
              ) {
                continue;
              }

              // If it has .get() it's a collection-level read
              if (context.includes(".get()")) {
                // Must have .limit()
                if (!context.includes(".limit(")) {
                  violations.push(
                    `${path.relative(projectRoot, fullPath)}:${i + 1} — collection-level .get() without .limit()`,
                  );
                }
              }
            }
          }
        }
      }
    }

    scanDir(serverDir);

    expect(violations).toEqual([]);
  });
});
