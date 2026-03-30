/**
 * Port Configuration Canonicalization Tests
 *
 * Verifies that all configuration files agree on port defaults:
 * - Express: PORT env var, default 5000
 * - Vite: VITE_PORT env var, default 3101; proxy to VITE_BACKEND_PORT || PORT || 5000
 * - Playwright: webServer health check uses PORT ?? 5000
 * - .env.example: Documents PORT=5000 and VITE_PORT=3101
 * - No hardcoded 5101 in config files
 *
 * Tests R-P1-01 Tests R-P1-02 Tests R-P1-03 Tests R-P1-04 Tests R-P1-05
 */
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const projectRoot = path.resolve(__dirname, "../../../");

describe("Port Configuration Canonicalization", () => {
  // Tests R-P1-01
  describe("R-P1-01: Express port configuration", () => {
    it("server/index.ts uses process.env.PORT with default 5000", () => {
      const indexPath = path.join(projectRoot, "server", "index.ts");
      const content = fs.readFileSync(indexPath, "utf-8");

      // Must contain the canonical port assignment
      expect(content).toContain("process.env.PORT || 5000");

      // Must NOT contain hardcoded 5101
      expect(content).not.toContain("5101");
    });
  });

  // Tests R-P1-02
  describe("R-P1-02: Playwright webServer configuration", () => {
    it("playwright.config.ts uses PORT ?? 5000 for health check URL", () => {
      const configPath = path.join(projectRoot, "playwright.config.ts");
      const content = fs.readFileSync(configPath, "utf-8");

      // Must use PORT ?? 5000 (not 5101)
      expect(content).toContain("process.env.PORT ?? 5000");

      // Must NOT contain the old 5101 default in code (comments excluded via regex)
      const codeLines = content
        .split("\n")
        .filter(
          (line) =>
            !line.trim().startsWith("*") && !line.trim().startsWith("//"),
        );
      const codeContent = codeLines.join("\n");
      expect(codeContent).not.toContain("5101");
    });
  });

  // Tests R-P1-03
  describe("R-P1-03: Vite proxy configuration", () => {
    it("vite.config.ts uses VITE_BACKEND_PORT || PORT || 5000 for backend port", () => {
      const configPath = path.join(projectRoot, "vite.config.ts");
      const content = fs.readFileSync(configPath, "utf-8");

      // Must use the three-level fallback chain
      expect(content).toContain("process.env.VITE_BACKEND_PORT");
      expect(content).toContain("process.env.PORT");
      expect(content).toContain("5000");

      // Verify the specific fallback pattern exists
      expect(content).toMatch(
        /VITE_BACKEND_PORT\s*\|\|\s*process\.env\.PORT\s*\|\|\s*5000/,
      );

      // Must NOT contain hardcoded 5101
      expect(content).not.toContain("5101");
    });

    it("vite.config.ts uses VITE_PORT with default 3101 for frontend", () => {
      const configPath = path.join(projectRoot, "vite.config.ts");
      const content = fs.readFileSync(configPath, "utf-8");

      // Frontend port uses VITE_PORT env var
      expect(content).toContain("process.env.VITE_PORT");
      expect(content).toContain("3101");
    });
  });

  // Tests R-P1-04
  describe("R-P1-04: .env.example documentation", () => {
    it(".env.example documents PORT=5000", () => {
      const envPath = path.join(projectRoot, ".env.example");
      const content = fs.readFileSync(envPath, "utf-8");

      // Must document PORT with default 5000
      expect(content).toMatch(/PORT=5000/);
    });

    it(".env.example documents VITE_PORT=3101", () => {
      const envPath = path.join(projectRoot, ".env.example");
      const content = fs.readFileSync(envPath, "utf-8");

      // Must document VITE_PORT with default 3101
      expect(content).toMatch(/VITE_PORT=3101/);
    });

    it(".env.example documents VITE_BACKEND_PORT with default 5000", () => {
      const envPath = path.join(projectRoot, ".env.example");
      const content = fs.readFileSync(envPath, "utf-8");

      // VITE_BACKEND_PORT should default to 5000, not 5101
      expect(content).toMatch(/VITE_BACKEND_PORT=5000/);
      expect(content).not.toMatch(/VITE_BACKEND_PORT=5101/);
    });
  });

  // Tests R-P1-05
  describe("R-P1-05: No hardcoded 5101 in config files", () => {
    const configFiles = [
      "server/index.ts",
      "vite.config.ts",
      "playwright.config.ts",
    ];

    for (const relPath of configFiles) {
      it(`${relPath} contains no hardcoded 5101`, () => {
        const filePath = path.join(projectRoot, relPath);
        const content = fs.readFileSync(filePath, "utf-8");

        // Filter out comment lines to avoid false positives on JSDoc/comments
        const codeLines = content
          .split("\n")
          .filter(
            (line) =>
              !line.trim().startsWith("*") &&
              !line.trim().startsWith("//") &&
              !line.trim().startsWith("/*"),
          );
        const codeContent = codeLines.join("\n");
        expect(codeContent).not.toContain("5101");
      });
    }

    it(".env.example contains no 5101 defaults", () => {
      const envPath = path.join(projectRoot, ".env.example");
      const content = fs.readFileSync(envPath, "utf-8");

      // No 5101 should appear anywhere in .env.example
      expect(content).not.toContain("5101");
    });

    it("playwright.config.ts comment references port 5000 not 5101", () => {
      const configPath = path.join(projectRoot, "playwright.config.ts");
      const content = fs.readFileSync(configPath, "utf-8");

      // The comment should reference 5000, not 5101
      expect(content).toContain("localhost:3101/5000");
      expect(content).not.toContain("localhost:3101/5101");
    });
  });
});
