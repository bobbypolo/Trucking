/**
 * Unit tests for scripts/demo-certify.cjs — Phase 7 Windows-safe
 * certification pipeline.
 *
 * R-P7-01: appends a ### <timestamp> block under ## Sales Demo Certification
 *          with the last 50 lines of the input log.
 * R-P7-02: exits 1 when the input log file is missing.
 * R-P7-03: source contains zero references to /tmp (Windows-safe) and does
 *          reference os.tmpdir().
 *
 * The tests import the .cjs via require and also spawn it as a subprocess
 * for the exit-code path so we verify the real executable, not a mock.
 */
import { describe, it, expect, beforeEach } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { spawnSync } from "child_process";
import { createRequire } from "module";

const require_ = createRequire(import.meta.url);

// Resolve the .cjs path from repo root. The test file lives at
// __tests__/scripts/demo-certify.test.ts so up two levels reaches root.
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const CERT_SCRIPT = path.join(REPO_ROOT, "scripts", "demo-certify.cjs");

interface CertifyModule {
  defaultLogPath: () => string;
  defaultEvidencePath: () => string;
  tailLines: (text: string, maxLines: number) => string;
  appendCertificationBlock: (
    evidenceFile: string,
    timestamp: string,
    tailText: string,
  ) => void;
}

function loadCertifyModule(): CertifyModule {
  // Invalidate the require cache so each test sees a fresh module.
  delete require_.cache[require_.resolve(CERT_SCRIPT)];
  return require_(CERT_SCRIPT) as CertifyModule;
}

function makeTempDir(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

describe("demo-certify.cjs", () => {
  beforeEach(() => {
    // Each test creates its own temp dir — no shared state.
  });

  describe("R-P7-01: appends timestamped block under H2", () => {
    it("appends ### <timestamp> block under ## Sales Demo Certification heading", () => {
      const mod = loadCertifyModule();
      const dir = makeTempDir("demo-certify-r01-");
      const evidence = path.join(dir, "evidence.md");
      const initial =
        "# LoadPilot Release Evidence\n\n## Sales Demo Certification\n";
      fs.writeFileSync(evidence, initial, "utf8");

      const timestamp = "2026-04-08T12:34:56.789Z";
      const tail = "line A\nline B\nline C";
      mod.appendCertificationBlock(evidence, timestamp, tail);

      const after = fs.readFileSync(evidence, "utf8");

      // Must still contain the H2 heading.
      expect(after).toContain("## Sales Demo Certification");
      // Must contain the exact timestamped H3.
      expect(after).toContain("### " + timestamp);
      // Must contain the tail payload verbatim.
      expect(after).toContain("line A\nline B\nline C");
      // The new block must come AFTER the heading (not before it).
      const headingIdx = after.indexOf("## Sales Demo Certification");
      const blockIdx = after.indexOf("### " + timestamp);
      expect(blockIdx).toBeGreaterThan(headingIdx);
    });

    it("creates the heading when the evidence file lacks it", () => {
      const mod = loadCertifyModule();
      const dir = makeTempDir("demo-certify-r01b-");
      const evidence = path.join(dir, "evidence.md");
      fs.writeFileSync(evidence, "# Evidence\n", "utf8");

      mod.appendCertificationBlock(evidence, "2026-04-08T00:00:00.000Z", "ok");

      const after = fs.readFileSync(evidence, "utf8");
      expect(after).toContain("## Sales Demo Certification");
      expect(after).toContain("### 2026-04-08T00:00:00.000Z");
      expect(after).toContain("ok");
    });

    it("tailLines keeps only the last 50 lines of a longer log", () => {
      const mod = loadCertifyModule();
      const lines: string[] = [];
      for (let i = 1; i <= 120; i += 1) {
        lines.push("l" + i);
      }
      const tail = mod.tailLines(lines.join("\n"), 50);
      const tailArray = tail.split("\n");
      expect(tailArray.length).toBe(50);
      expect(tailArray[0]).toBe("l71");
      expect(tailArray[49]).toBe("l120");
    });

    it("end-to-end subprocess run appends a block with tail content", () => {
      const dir = makeTempDir("demo-certify-e2e-");
      const logFile = path.join(dir, "run.log");
      const evidence = path.join(dir, "evidence.md");
      fs.writeFileSync(
        logFile,
        "playwright-start\npassed: 4\nfailed: 0\n",
        "utf8",
      );
      fs.writeFileSync(
        evidence,
        "# Evidence\n\n## Sales Demo Certification\n",
        "utf8",
      );

      const result = spawnSync(
        process.execPath,
        [CERT_SCRIPT, logFile, evidence],
        {
          encoding: "utf8",
        },
      );
      expect(result.status).toBe(0);

      const after = fs.readFileSync(evidence, "utf8");
      expect(after).toContain("## Sales Demo Certification");
      expect(after).toContain("passed: 4");
      expect(after).toContain("failed: 0");
      // H3 heading present — we do not pin the exact timestamp but the
      // marker "### 20" is stable for any year 2000+.
      expect(after).toMatch(/### 20\d\d-/);
    });
  });

  describe("R-P7-02: exits 1 when input log is missing", () => {
    it("returns exit code 1 with a descriptive stderr message", () => {
      const dir = makeTempDir("demo-certify-r02-");
      const missingLog = path.join(dir, "does-not-exist.log");
      const evidence = path.join(dir, "evidence.md");
      fs.writeFileSync(evidence, "# Evidence\n", "utf8");

      const result = spawnSync(
        process.execPath,
        [CERT_SCRIPT, missingLog, evidence],
        {
          encoding: "utf8",
        },
      );

      expect(result.status).toBe(1);
      expect(result.stderr).toContain("log file not found");
      expect(result.stderr).toContain(missingLog);

      // Evidence file must be untouched when the script aborts.
      const after = fs.readFileSync(evidence, "utf8");
      expect(after).toBe("# Evidence\n");
    });
  });

  describe("R-P7-03: Windows-safe temp handling (no /tmp)", () => {
    it("source contains zero /tmp references", () => {
      const source = fs.readFileSync(CERT_SCRIPT, "utf8");
      // Strip line comments so we only inspect executable / documented tokens.
      // But the criterion says *zero references* anywhere, so scan raw.
      const matches = source.match(/\/tmp/g) || [];
      expect(matches.length).toBe(0);
    });

    it("source references os.tmpdir() as the temp-path resolver", () => {
      const source = fs.readFileSync(CERT_SCRIPT, "utf8");
      expect(source).toContain("os.tmpdir()");
    });

    it("defaultLogPath() resolves under the OS temp directory", () => {
      const mod = loadCertifyModule();
      const resolved = mod.defaultLogPath();
      // os.tmpdir() is the canonical prefix on every platform.
      expect(resolved.startsWith(os.tmpdir())).toBe(true);
      // And on Windows the separator must be a backslash; on POSIX a
      // forward slash. path.sep is the authoritative check.
      expect(resolved).toContain(path.sep);
    });
  });
});
