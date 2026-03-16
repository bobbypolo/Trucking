import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Tests R-P1-09-AC1, R-P2-04

describe("R-P1-09: Environment Validation on Boot", () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    // Reset module cache so validateEnv re-reads process.env
    vi.resetModules();
    // Clone env to avoid cross-test contamination
    process.env = { ...ORIGINAL_ENV };
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
  });

  const REQUIRED_VARS = ["DB_HOST", "DB_USER", "DB_PASSWORD", "DB_NAME"];

  describe("AC1: Server fails fast with descriptive error if required env vars missing", () => {
    it("throws when all required vars are missing", async () => {
      // Remove all required vars
      for (const v of REQUIRED_VARS) {
        delete process.env[v];
      }
      delete process.env.FIREBASE_PROJECT_ID;
      delete process.env.GOOGLE_APPLICATION_CREDENTIALS;

      const { validateEnv } = await import("../../lib/env");
      expect(() => validateEnv()).toThrow();
    });

    it("error message lists ALL missing vars, not just the first one", async () => {
      for (const v of REQUIRED_VARS) {
        delete process.env[v];
      }
      delete process.env.FIREBASE_PROJECT_ID;
      delete process.env.GOOGLE_APPLICATION_CREDENTIALS;

      const { validateEnv } = await import("../../lib/env");
      try {
        validateEnv();
        expect.unreachable("Should have thrown");
      } catch (e: any) {
        // Should mention all missing DB vars
        for (const v of REQUIRED_VARS) {
          expect(e.message).toContain(v);
        }
        // Should mention Firebase requirement
        expect(e.message).toMatch(
          /FIREBASE_PROJECT_ID|GOOGLE_APPLICATION_CREDENTIALS/,
        );
      }
    });

    it("throws when only DB_HOST is missing", async () => {
      process.env.DB_HOST = "";
      process.env.DB_USER = "testuser";
      process.env.DB_PASSWORD = "testpass";
      process.env.DB_NAME = "testdb";
      process.env.FIREBASE_PROJECT_ID = "test-project";

      const { validateEnv } = await import("../../lib/env");
      expect(() => validateEnv()).toThrow(/DB_HOST/);
    });

    it("throws when only DB_PASSWORD is missing", async () => {
      process.env.DB_HOST = "localhost";
      process.env.DB_USER = "testuser";
      delete process.env.DB_PASSWORD;
      process.env.DB_NAME = "testdb";
      process.env.FIREBASE_PROJECT_ID = "test-project";

      const { validateEnv } = await import("../../lib/env");
      expect(() => validateEnv()).toThrow(/DB_PASSWORD/);
    });

    it("throws when neither FIREBASE_PROJECT_ID nor GOOGLE_APPLICATION_CREDENTIALS set", async () => {
      process.env.DB_HOST = "localhost";
      process.env.DB_USER = "testuser";
      process.env.DB_PASSWORD = "testpass";
      process.env.DB_NAME = "testdb";
      delete process.env.FIREBASE_PROJECT_ID;
      delete process.env.GOOGLE_APPLICATION_CREDENTIALS;

      const { validateEnv } = await import("../../lib/env");
      expect(() => validateEnv()).toThrow(
        /FIREBASE_PROJECT_ID.*GOOGLE_APPLICATION_CREDENTIALS|GOOGLE_APPLICATION_CREDENTIALS.*FIREBASE_PROJECT_ID/,
      );
    });

    it("passes when all required vars present with FIREBASE_PROJECT_ID", async () => {
      process.env.DB_HOST = "localhost";
      process.env.DB_USER = "testuser";
      process.env.DB_PASSWORD = "testpass";
      process.env.DB_NAME = "testdb";
      process.env.FIREBASE_PROJECT_ID = "test-project";

      const { validateEnv } = await import("../../lib/env");
      expect(() => validateEnv()).not.toThrow();
    });

    it("passes when all required vars present with GOOGLE_APPLICATION_CREDENTIALS instead", async () => {
      process.env.DB_HOST = "localhost";
      process.env.DB_USER = "testuser";
      process.env.DB_PASSWORD = "testpass";
      process.env.DB_NAME = "testdb";
      delete process.env.FIREBASE_PROJECT_ID;
      process.env.GOOGLE_APPLICATION_CREDENTIALS =
        "/path/to/serviceAccount.json";

      const { validateEnv } = await import("../../lib/env");
      expect(() => validateEnv()).not.toThrow();
    });

    it("JWT_SECRET missing does NOT cause failure (Firebase-only auth)", async () => {
      process.env.DB_HOST = "localhost";
      process.env.DB_USER = "testuser";
      process.env.DB_PASSWORD = "testpass";
      process.env.DB_NAME = "testdb";
      process.env.FIREBASE_PROJECT_ID = "test-project";
      delete process.env.JWT_SECRET;

      const { validateEnv } = await import("../../lib/env");
      expect(() => validateEnv()).not.toThrow();
    });

    it("no hardcoded fallback values — empty string treated as missing", async () => {
      process.env.DB_HOST = "";
      process.env.DB_USER = "";
      process.env.DB_PASSWORD = "";
      process.env.DB_NAME = "";
      delete process.env.FIREBASE_PROJECT_ID;
      delete process.env.GOOGLE_APPLICATION_CREDENTIALS;

      const { validateEnv } = await import("../../lib/env");
      try {
        validateEnv();
        expect.unreachable("Should have thrown");
      } catch (e: any) {
        expect(e.message).toContain("DB_HOST");
        expect(e.message).toContain("DB_USER");
        expect(e.message).toContain("DB_PASSWORD");
        expect(e.message).toContain("DB_NAME");
      }
    });

    it("multiple missing vars are listed in a single error message", async () => {
      delete process.env.DB_HOST;
      delete process.env.DB_USER;
      process.env.DB_PASSWORD = "testpass";
      process.env.DB_NAME = "testdb";
      process.env.FIREBASE_PROJECT_ID = "test-project";

      const { validateEnv } = await import("../../lib/env");
      try {
        validateEnv();
        expect.unreachable("Should have thrown");
      } catch (e: any) {
        expect(e.message).toContain("DB_HOST");
        expect(e.message).toContain("DB_USER");
        // Should NOT mention vars that are present
        expect(e.message).not.toContain("DB_PASSWORD");
        expect(e.message).not.toContain("DB_NAME");
      }
    });
  });

  describe("R-P2-04: Fail-closed in staging/production, warn-only in dev", () => {
    function setRequiredVars() {
      process.env.DB_HOST = "localhost";
      process.env.DB_USER = "testuser";
      process.env.DB_PASSWORD = "testpass";
      process.env.DB_NAME = "testdb";
      process.env.FIREBASE_PROJECT_ID = "test-project";
    }

    it("throws when CORS_ORIGIN is missing in production", async () => {
      setRequiredVars();
      process.env.NODE_ENV = "production";
      delete process.env.CORS_ORIGIN;

      const { validateEnv } = await import("../../lib/env");
      expect(() => validateEnv()).toThrow(/CORS_ORIGIN/);
    });

    it("throws when CORS_ORIGIN is empty string in production", async () => {
      setRequiredVars();
      process.env.NODE_ENV = "production";
      process.env.CORS_ORIGIN = "";

      const { validateEnv } = await import("../../lib/env");
      expect(() => validateEnv()).toThrow(/CORS_ORIGIN/);
    });

    it("throws when CORS_ORIGIN is missing in staging", async () => {
      setRequiredVars();
      process.env.NODE_ENV = "staging";
      delete process.env.CORS_ORIGIN;

      const { validateEnv } = await import("../../lib/env");
      expect(() => validateEnv()).toThrow(/CORS_ORIGIN/);
    });

    it("passes when CORS_ORIGIN is set in production", async () => {
      setRequiredVars();
      process.env.NODE_ENV = "production";
      process.env.CORS_ORIGIN = "https://app.loadpilot.com";

      const { validateEnv } = await import("../../lib/env");
      expect(() => validateEnv()).not.toThrow();
    });

    it("passes when CORS_ORIGIN is set in staging", async () => {
      setRequiredVars();
      process.env.NODE_ENV = "staging";
      process.env.CORS_ORIGIN = "https://staging.loadpilot.com";

      const { validateEnv } = await import("../../lib/env");
      expect(() => validateEnv()).not.toThrow();
    });

    it("does NOT throw when CORS_ORIGIN is missing in development (warn-only)", async () => {
      setRequiredVars();
      process.env.NODE_ENV = "development";
      delete process.env.CORS_ORIGIN;

      const { validateEnv } = await import("../../lib/env");
      // In dev, missing CORS_ORIGIN is a warning, not a failure
      expect(() => validateEnv()).not.toThrow();
    });

    it("does NOT throw when CORS_ORIGIN is missing and NODE_ENV is undefined (warn-only)", async () => {
      setRequiredVars();
      delete process.env.NODE_ENV;
      delete process.env.CORS_ORIGIN;

      const { validateEnv } = await import("../../lib/env");
      // Undefined NODE_ENV falls into warn-only path
      expect(() => validateEnv()).not.toThrow();
    });

    it("does NOT throw when CORS_ORIGIN is missing in test environment (warn-only)", async () => {
      setRequiredVars();
      process.env.NODE_ENV = "test";
      delete process.env.CORS_ORIGIN;

      const { validateEnv } = await import("../../lib/env");
      // test env is not in strict set — warn only
      expect(() => validateEnv()).not.toThrow();
    });

    it("error message references the NODE_ENV when throwing in staging", async () => {
      setRequiredVars();
      process.env.NODE_ENV = "staging";
      delete process.env.CORS_ORIGIN;

      const { validateEnv } = await import("../../lib/env");
      try {
        validateEnv();
        expect.unreachable("Should have thrown");
      } catch (e: any) {
        expect(e.message).toContain("staging");
        expect(e.message).toContain("CORS_ORIGIN");
      }
    });
  });

  describe("getCorsOrigin: safe CORS origin resolution", () => {
    it("returns CORS_ORIGIN when set", async () => {
      process.env.CORS_ORIGIN = "https://app.loadpilot.com";
      process.env.NODE_ENV = "production";

      const { getCorsOrigin } = await import("../../lib/env");
      expect(getCorsOrigin()).toBe("https://app.loadpilot.com");
    });

    it("splits comma-separated CORS_ORIGIN into array", async () => {
      process.env.CORS_ORIGIN =
        "https://app.loadpilot.com, https://admin.loadpilot.com";
      process.env.NODE_ENV = "production";

      const { getCorsOrigin } = await import("../../lib/env");
      const result = getCorsOrigin();
      expect(Array.isArray(result)).toBe(true);
      expect(result).toEqual([
        "https://app.loadpilot.com",
        "https://admin.loadpilot.com",
      ]);
    });

    it("returns localhost origins array when CORS_ORIGIN is not set in development", async () => {
      delete process.env.CORS_ORIGIN;
      process.env.NODE_ENV = "development";

      const { getCorsOrigin } = await import("../../lib/env");
      const result = getCorsOrigin();
      expect(Array.isArray(result)).toBe(true);
      expect(result).toContain("http://localhost:5173");
      expect(result).toContain("http://localhost:3000");
    });

    it("returns localhost origins array when CORS_ORIGIN is not set and NODE_ENV is undefined", async () => {
      delete process.env.CORS_ORIGIN;
      delete process.env.NODE_ENV;

      const { getCorsOrigin } = await import("../../lib/env");
      const result = getCorsOrigin();
      expect(Array.isArray(result)).toBe(true);
      expect(result).toContain("http://localhost:5173");
    });

    it("throws in production when CORS_ORIGIN is missing (defense in depth)", async () => {
      delete process.env.CORS_ORIGIN;
      process.env.NODE_ENV = "production";

      const { getCorsOrigin } = await import("../../lib/env");
      expect(() => getCorsOrigin()).toThrow(/CORS_ORIGIN/);
    });

    it("throws in staging when CORS_ORIGIN is missing (defense in depth)", async () => {
      delete process.env.CORS_ORIGIN;
      process.env.NODE_ENV = "staging";

      const { getCorsOrigin } = await import("../../lib/env");
      expect(() => getCorsOrigin()).toThrow(/CORS_ORIGIN/);
    });

    it("never returns wildcard '*'", async () => {
      delete process.env.CORS_ORIGIN;
      process.env.NODE_ENV = "development";

      const { getCorsOrigin } = await import("../../lib/env");
      const result = getCorsOrigin();
      expect(result).not.toBe("*");
      if (Array.isArray(result)) {
        expect(result).not.toContain("*");
      }
    });

    it("CORS-01: trailing comma in comma-separated origins produces no empty strings", async () => {
      // Tests CORS-01 — filter(Boolean) removes empty string from trailing comma
      process.env.CORS_ORIGIN =
        "https://app.loadpilot.com,https://admin.loadpilot.com,";
      process.env.NODE_ENV = "production";

      const { getCorsOrigin } = await import("../../lib/env");
      const result = getCorsOrigin();
      expect(Array.isArray(result)).toBe(true);
      expect(result).toEqual([
        "https://app.loadpilot.com",
        "https://admin.loadpilot.com",
      ]);
      if (Array.isArray(result)) {
        expect(result.every((o) => o.length > 0)).toBe(true);
      }
    });

    it("CORS-02: whitespace-padded single origin is trimmed", async () => {
      // Tests CORS-02 — .trim() on single-value origin
      process.env.CORS_ORIGIN = "  https://app.loadpilot.com  ";
      process.env.NODE_ENV = "production";

      const { getCorsOrigin } = await import("../../lib/env");
      const result = getCorsOrigin();
      expect(result).toBe("https://app.loadpilot.com");
    });
  });
});
