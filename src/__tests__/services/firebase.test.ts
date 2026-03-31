/**
 * Firebase Emulator Connection Tests — STORY-000
 *
 * Verifies that services/firebase.ts calls connectAuthEmulator and
 * connectFirestoreEmulator when VITE_USE_FIREBASE_EMULATOR === "true".
 *
 * R-marker: Tests R-P0-04
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const projectRoot = path.resolve(__dirname, "../../..");
const source = fs.readFileSync(
  path.join(projectRoot, "services/firebase.ts"),
  "utf-8",
);

describe("services/firebase.ts emulator connection (R-P0-04)", () => {
  // Tests R-P0-04
  it("imports connectAuthEmulator from firebase/auth", () => {
    expect(source).toMatch(
      /import\s*\{[^}]*connectAuthEmulator[^}]*\}\s*from\s*['"]firebase\/auth['"]/,
    );
  });

  it("imports connectFirestoreEmulator from firebase/firestore", () => {
    expect(source).toMatch(
      /import\s*\{[^}]*connectFirestoreEmulator[^}]*\}\s*from\s*['"]firebase\/firestore['"]/,
    );
  });

  it('checks VITE_USE_FIREBASE_EMULATOR === "true" before connecting', () => {
    expect(source).toMatch(
      /import\.meta\.env\.VITE_USE_FIREBASE_EMULATOR\s*===\s*['"]true['"]/,
    );
  });

  it("calls connectAuthEmulator with auth instance and emulator URL", () => {
    expect(source).toMatch(/connectAuthEmulator\(\s*_auth/);
    expect(source).toContain("http://127.0.0.1:9099");
  });

  it("calls connectFirestoreEmulator with firestore instance and port 8080", () => {
    expect(source).toMatch(/connectFirestoreEmulator\(\s*_firestore/);
    expect(source).toContain("8080");
  });

  it("emulator connection is inside the !DEMO_MODE block", () => {
    const demoModeBlockStart = source.indexOf("if (!DEMO_MODE)");
    const emulatorCheckPos = source.indexOf("VITE_USE_FIREBASE_EMULATOR");
    const elseBlockPos = source.indexOf("} else {", demoModeBlockStart);

    // Emulator check must be between the if (!DEMO_MODE) and the else
    expect(emulatorCheckPos).toBeGreaterThan(demoModeBlockStart);
    expect(emulatorCheckPos).toBeLessThan(elseBlockPos);
  });

  it("connectAuthEmulator has disableWarnings option set", () => {
    expect(source).toContain("disableWarnings: true");
  });
});
