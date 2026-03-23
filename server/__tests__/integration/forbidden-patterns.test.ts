import { describe, it, expect } from "vitest";
import { execSync } from "child_process";
import path from "path";
import fs from "fs";

// Tests R-S34-01, R-S34-02
// CI-GUARD: forbidden pattern enforcement for production code quality.
// All tests must pass with zero matches. A match indicates a regression.

const ROOT = path.resolve(__dirname, "../../..");
const SERVER = path.join(ROOT, "server");
const SERVICES = path.join(ROOT, "services");
const COMPONENTS = path.join(ROOT, "components");

// ─────────────────────────────────────────────────────────────────────────────
// Utility: grep using execSync for simple single-file-extension cases
// ─────────────────────────────────────────────────────────────────────────────
function grepNonTest(pattern: string, dir: string, ext = "*.ts"): string[] {
  try {
    const result = execSync(
      `grep -r "${pattern}" "${dir}" --include="${ext}" --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=coverage -l`,
      { encoding: "utf-8", timeout: 15000 },
    );
    return result
      .trim()
      .split("\n")
      .filter((f) => f && !f.includes("__tests__") && !f.includes(".test."));
  } catch {
    return []; // grep returns exit code 1 when no matches
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Utility: walk a directory tree and collect files matching an extension filter
// ─────────────────────────────────────────────────────────────────────────────
function walkFiles(
  dir: string,
  extFilter: RegExp,
  excludeTests = true,
): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;

  function recurse(current: string) {
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (
          excludeTests &&
          (entry.name === "__tests__" || entry.name.includes(".test"))
        )
          continue;
        recurse(full);
      } else if (entry.isFile() && extFilter.test(entry.name)) {
        if (
          excludeTests &&
          (entry.name.includes(".test.") || entry.name.includes(".spec."))
        )
          continue;
        results.push(full);
      }
    }
  }

  recurse(dir);
  return results;
}

// ─────────────────────────────────────────────────────────────────────────────
// Utility: scan a list of files for a regex pattern; return file:line matches
// ─────────────────────────────────────────────────────────────────────────────
function scanFiles(files: string[], pattern: RegExp): string[] {
  const hits: string[] = [];
  for (const filePath of files) {
    const lines = fs.readFileSync(filePath, "utf-8").split("\n");
    for (let i = 0; i < lines.length; i++) {
      if (pattern.test(lines[i])) {
        const rel = path.relative(ROOT, filePath).replace(/\\/g, "/");
        hits.push(`${rel}:${i + 1}: ${lines[i].trim().slice(0, 120)}`);
      }
    }
  }
  return hits;
}

// ─────────────────────────────────────────────────────────────────────────────
// Utility: detect DEMO_MODE seed injection blocks (multi-line pattern).
// A "seed injection" is: DEMO_MODE referenced on line N, then within WINDOW
// lines a non-empty object-array literal assignment (= [{) appears.
// This catches blocks like: if (x.length === 0 && DEMO_MODE) { list = [{id: "..."}] }
// False positives excluded: empty arrays (= []), type annotations, return [].
// ─────────────────────────────────────────────────────────────────────────────
function scanDemoModeSeedInjection(
  files: string[],
  windowLines = 12,
): string[] {
  const hits: string[] = [];
  // Matches assignment of a non-empty object-array: "= [{" (seed data literal)
  // Does NOT match: "= []", "= [variable]", type annotations, "return ["
  const SEED_ARRAY_RE = /=\s*\[\s*\{/;
  for (const filePath of files) {
    const lines = fs.readFileSync(filePath, "utf-8").split("\n");
    const rel = path.relative(ROOT, filePath).replace(/\\/g, "/");
    for (let i = 0; i < lines.length; i++) {
      if (!lines[i].includes("DEMO_MODE")) continue;
      // Scan forward window for seed indicators
      const windowEnd = Math.min(i + windowLines, lines.length);
      for (let j = i + 1; j < windowEnd; j++) {
        const wline = lines[j];
        // Non-empty object-array assignment: seed data inline literal
        if (SEED_ARRAY_RE.test(wline)) {
          hits.push(
            `${rel}:${j + 1}: DEMO_MODE seed object-array assignment near DEMO_MODE ref at line ${i + 1}`,
          );
          break;
        }
        // localStorage.setItem inside a DEMO_MODE block (seed persistence)
        if (/localStorage\.setItem/.test(wline)) {
          hits.push(
            `${rel}:${j + 1}: DEMO_MODE + localStorage.setItem (seed injection) near DEMO_MODE ref at line ${i + 1}`,
          );
          break;
        }
      }
    }
  }
  return hits;
}

// ─────────────────────────────────────────────────────────────────────────────
// Migrated domain storage modules — these must NOT have localStorage CRUD
// (core.ts and migrationService.ts are infrastructure, not domain modules)
// ─────────────────────────────────────────────────────────────────────────────
const MIGRATED_STORAGE_FILES = [
  "quotes.ts",
  "leads.ts",
  "bookings.ts",
  "messages.ts",
  "calls.ts",
  "tasks.ts",
  "recovery.ts",
  "directory.ts",
].map((f) => path.join(SERVICES, "storage", f));

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 1 — Original guardrails (preserved from initial CI guard)
// ─────────────────────────────────────────────────────────────────────────────
describe("Forbidden Patterns — Original CI Guardrails", () => {
  it("no 'admin123' hardcoded credential in server runtime code", () => {
    const hits = grepNonTest("admin123", SERVER);
    expect(hits, `admin123 found in: ${hits.join(", ")}`).toEqual([]);
  }, 20_000);

  it("no 'iscope-authority-001' test tenant ID in server runtime code", () => {
    const hits = grepNonTest("iscope-authority-001", SERVER);
    expect(hits, `iscope-authority-001 found in: ${hits.join(", ")}`).toEqual(
      [],
    );
  });

  it("no 'KCI-USA' hardcoded facility code in services runtime code", () => {
    const hits = grepNonTest("KCI-USA", SERVICES);
    expect(hits, `KCI-USA found in: ${hits.join(", ")}`).toEqual([]);
  });

  it("no CDN tailwind link in dist/ (production build must use bundled CSS)", () => {
    const distDir = path.join(ROOT, "dist");
    if (!fs.existsSync(distDir)) return;
    const hits = grepNonTest("cdn.tailwindcss", distDir, "*");
    expect(hits, `cdn.tailwindcss found in dist: ${hits.join(", ")}`).toEqual(
      [],
    );
  });

  it("no aistudiocdn in dist/ (must use server-proxied AI)", () => {
    const distDir = path.join(ROOT, "dist");
    if (!fs.existsSync(distDir)) return;
    const hits = grepNonTest("aistudiocdn", distDir, "*");
    expect(hits, `aistudiocdn found in dist: ${hits.join(", ")}`).toEqual([]);
  });

  it("no importmap in dist/index.html", () => {
    const indexHtml = path.join(ROOT, "dist", "index.html");
    if (!fs.existsSync(indexHtml)) return;
    const content = fs.readFileSync(indexHtml, "utf-8");
    expect(content, "importmap found in dist/index.html").not.toContain(
      "importmap",
    );
  });

  it("no req.query.companyId used for SQL tenant scoping (use req.user.companyId)", () => {
    const hits = grepNonTest("req.query.companyId", SERVER);
    expect(hits, `req.query.companyId found in: ${hits.join(", ")}`).toEqual(
      [],
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 2 — localStorage in migrated domain modules (R-S34-01, R-S34-02)
// ─────────────────────────────────────────────────────────────────────────────
describe("Forbidden Patterns — localStorage in Migrated Domain Modules", () => {
  it("no localStorage.setItem in migrated storage modules (use API)", () => {
    const existing = MIGRATED_STORAGE_FILES.filter((f) => fs.existsSync(f));
    const hits = scanFiles(existing, /localStorage\.setItem/);
    expect(
      hits,
      `localStorage.setItem found in migrated storage modules:\n${hits.join("\n")}`,
    ).toEqual([]);
  });

  it("no localStorage.getItem in migrated storage modules (use API)", () => {
    const existing = MIGRATED_STORAGE_FILES.filter((f) => fs.existsSync(f));
    const hits = scanFiles(existing, /localStorage\.getItem/);
    expect(
      hits,
      `localStorage.getItem found in migrated storage modules:\n${hits.join("\n")}`,
    ).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 3 — Browser dialogs in components (R-S34-01, R-S34-02)
// ─────────────────────────────────────────────────────────────────────────────
describe("Forbidden Patterns — Native Browser Dialogs in Components", () => {
  it("no alert() in .tsx component files (use toast/modal instead)", () => {
    const tsxFiles = walkFiles(COMPONENTS, /\.tsx$/, true);
    const hits = scanFiles(tsxFiles, /\balert\(/);
    expect(hits, `alert() found in components:\n${hits.join("\n")}`).toEqual(
      [],
    );
  });

  it("no window.confirm() in .tsx component files (use ConfirmDialog instead)", () => {
    const tsxFiles = walkFiles(COMPONENTS, /\.tsx$/, true);
    const hits = scanFiles(tsxFiles, /\bwindow\.confirm\(/);
    expect(
      hits,
      `window.confirm() found in components:\n${hits.join("\n")}`,
    ).toEqual([]);
  });

  it("no prompt() in .tsx component files (use InputDialog instead)", () => {
    const tsxFiles = walkFiles(COMPONENTS, /\.tsx$/, true);
    const hits = scanFiles(tsxFiles, /\bprompt\(/);
    expect(hits, `prompt() found in components:\n${hits.join("\n")}`).toEqual(
      [],
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 4 — Hardcoded mock / demo values in services (R-S34-01, R-S34-02)
// ─────────────────────────────────────────────────────────────────────────────
describe("Forbidden Patterns — Hardcoded Mock/Demo Values in Services", () => {
  const serviceFiles = walkFiles(SERVICES, /\.ts$/, true);

  it("no '4022A' hardcoded equipment unit ID in services", () => {
    const hits = scanFiles(serviceFiles, /4022A/);
    expect(hits, `4022A found:\n${hits.join("\n")}`).toEqual([]);
  });

  it("no 'Default-01' hardcoded tenant/company ID in services", () => {
    const hits = scanFiles(serviceFiles, /Default-01/);
    expect(hits, `Default-01 found:\n${hits.join("\n")}`).toEqual([]);
  });

  it("no 'KCI-USA' hardcoded facility code in services", () => {
    const hits = scanFiles(serviceFiles, /KCI-USA/);
    expect(hits, `KCI-USA found:\n${hits.join("\n")}`).toEqual([]);
  });

  it("no '39.1031' hardcoded GPS coordinate in services", () => {
    const hits = scanFiles(serviceFiles, /39\.1031/);
    expect(hits, `39.1031 found:\n${hits.join("\n")}`).toEqual([]);
  });

  it("no 'UNSET' sentinel value in services (use null/undefined instead)", () => {
    const hits = scanFiles(serviceFiles, /'UNSET'|"UNSET"/);
    expect(hits, `UNSET found:\n${hits.join("\n")}`).toEqual([]);
  });

  it("no 'Titan Recovery' demo company name in services", () => {
    const hits = scanFiles(serviceFiles, /Titan Recovery/);
    expect(hits, `Titan Recovery found:\n${hits.join("\n")}`).toEqual([]);
  });

  it("no 'Rapid Tire' demo company name in services", () => {
    const hits = scanFiles(serviceFiles, /Rapid Tire/);
    expect(hits, `Rapid Tire found:\n${hits.join("\n")}`).toEqual([]);
  });

  it("no '555-0199' demo phone number in services", () => {
    const hits = scanFiles(serviceFiles, /555-0199/);
    expect(hits, `555-0199 found:\n${hits.join("\n")}`).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 5 — DEMO_MODE seed injection in services (R-S34-01, R-S34-02)
// ─────────────────────────────────────────────────────────────────────────────
describe("Forbidden Patterns — DEMO_MODE Seed Injection in Services", () => {
  it("no DEMO_MODE seed injection blocks in services/ (no DEMO_MODE + array-seed within 12 lines)", () => {
    const serviceFiles = walkFiles(SERVICES, /\.ts$/, true);
    const hits = scanDemoModeSeedInjection(serviceFiles, 12);
    expect(hits, `DEMO_MODE seed injection found:\n${hits.join("\n")}`).toEqual(
      [],
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 6 — "Authority" jargon in .tsx components (R-S34-01, R-S34-02)
// Excluded: TypeScript type definitions (type Authority, interface Authority)
// Only catches string literal usage like "Authority" in JSX/display strings.
// ─────────────────────────────────────────────────────────────────────────────
describe("Forbidden Patterns — 'Authority' Jargon in Component UI", () => {
  it("no '\"Authority\"' string literal in .tsx component files (use plain trucking language)", () => {
    const tsxFiles = walkFiles(COMPONENTS, /\.tsx$/, true);
    // Match "Authority" as a string literal (double-quoted) — excludes type definitions
    const hits = scanFiles(tsxFiles, /"Authority"/);
    expect(
      hits,
      `"Authority" string literal found in components:\n${hits.join("\n")}`,
    ).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 7 — Fake success strings in server routes (R-S34-01, R-S34-02)
// ─────────────────────────────────────────────────────────────────────────────
describe("Forbidden Patterns — Fake Success in Server Routes", () => {
  it("no 'Sync queued' fake success message in server/routes/ (use 501 Not Implemented)", () => {
    const routeFiles = walkFiles(path.join(SERVER, "routes"), /\.ts$/, true);
    const hits = scanFiles(routeFiles, /Sync queued/);
    expect(
      hits,
      `"Sync queued" found in server/routes:\n${hits.join("\n")}`,
    ).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 8 — localStorage-as-SoR regression guard in services/ (R-P4-08, R-P4-09, R-P4-10)
//
// services/**/*.ts files must not use localStorage as a source of record for
// domain data. Auth token reads (localStorage.getItem("token") for Bearer
// headers) and comments are the only permissible references.
//
// Exclusions:
//   - Any file path containing "__tests__", ".test.", or ".spec."
//   - services/config.ts  (framework config, no domain storage)
//   - Lines that are only a comment (trimmed line starts with "//", "/*", "*")
//   - Lines that exclusively do an auth-token read:
//       localStorage.getItem("token") or localStorage.getItem('token')
//       with no other localStorage call on the same line
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Scan files for localStorage.getItem / localStorage.setItem calls that are
 * NOT auth-token reads and NOT inside comments.
 *
 * Returns file:line strings for every violation found.
 */
function scanLocalStorageSoR(files: string[]): string[] {
  // Pattern that detects any localStorage.getItem or localStorage.setItem call
  const LS_CALL_RE = /localStorage\.(getItem|setItem)\s*\(/;

  // A line is an "auth token read" (permitted) if it only contains a
  // localStorage.getItem("token") / localStorage.getItem('token') call and
  // does NOT contain any setItem on the same line.
  const AUTH_TOKEN_RE = /localStorage\.getItem\(\s*["']token["']\s*\)/;

  const hits: string[] = [];

  for (const filePath of files) {
    const lines = fs.readFileSync(filePath, "utf-8").split("\n");
    const rel = path.relative(ROOT, filePath).replace(/\\/g, "/");

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // Skip pure comment lines
      if (
        trimmed.startsWith("//") ||
        trimmed.startsWith("/*") ||
        trimmed.startsWith("*")
      ) {
        continue;
      }

      // Skip lines that contain inline comments but no localStorage call before the comment
      // (handled implicitly: LS_CALL_RE won't match on comment-only content)

      if (!LS_CALL_RE.test(line)) continue;

      // Allow auth-token reads (used for Bearer headers) — but only if no
      // setItem is also present on the same line.
      if (AUTH_TOKEN_RE.test(line) && !/localStorage\.setItem/.test(line)) {
        continue;
      }

      hits.push(`${rel}:${i + 1}: ${trimmed.slice(0, 120)}`);
    }
  }

  return hits;
}

// Config files that are legitimately exempt from domain-storage rules
const LS_SOR_EXCLUDED_FILES = new Set([path.join(SERVICES, "config.ts")]);

describe("Forbidden Patterns — localStorage as Source of Record in services/", () => {
  // Collect all services/**/*.ts files, excluding test files and config
  const allServiceFiles = walkFiles(SERVICES, /\.ts$/, true).filter(
    (f) => !LS_SOR_EXCLUDED_FILES.has(f),
  );

  // R-P4-08: Guard scans the right directory and finds the right files
  it("R-P4-08: services/**/*.ts files collected (excluding __tests__ and config)", () => {
    // There must be at least one service file to scan — if this is zero
    // the guard is silently broken and provides no protection.
    expect(
      allServiceFiles.length,
      "No .ts files found under services/ — directory path may be wrong",
    ).toBeGreaterThan(0);

    // None of the collected files should be test files or the config file
    const badFiles = allServiceFiles.filter(
      (f) =>
        f.includes("__tests__") ||
        f.includes(".test.") ||
        f.includes(".spec.") ||
        f === path.join(SERVICES, "config.ts"),
    );
    expect(
      badFiles,
      `Excluded files leaked into scan set:\n${badFiles.join("\n")}`,
    ).toEqual([]);
  });

  // R-P4-09: The detection function correctly identifies a regression call
  it("R-P4-09: scanLocalStorageSoR() flags localStorage.setItem('loadpilot_test', 'value') in a synthetic service file", () => {
    const tmpDir = path.join(ROOT, "server", "__tests__", "_tmp_ls_guard");
    const tmpFile = path.join(tmpDir, "synthetic-service.ts");

    // Write a synthetic service file containing the forbidden pattern
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
    fs.writeFileSync(
      tmpFile,
      [
        "// synthetic service for R-P4-09 guard validation",
        "export function doSomething() {",
        "  localStorage.setItem('loadpilot_test', 'value');",
        "}",
      ].join("\n"),
      "utf-8",
    );

    try {
      const hits = scanLocalStorageSoR([tmpFile]);
      expect(
        hits.length,
        `Expected scanLocalStorageSoR to flag localStorage.setItem call, but got 0 hits. Scan logic may be broken.\nFile: ${tmpFile}`,
      ).toBeGreaterThan(0);
    } finally {
      // Clean up temp file regardless of test outcome
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  // R-P4-08 continued: actual regression scan — zero hits expected
  it("R-P4-08: no localStorage.getItem/setItem used as SoR in services/**/*.ts (auth token reads permitted)", () => {
    const hits = scanLocalStorageSoR(allServiceFiles);
    expect(
      hits,
      `localStorage-as-SoR regression found in services/:\n${hits.join("\n")}`,
    ).toEqual([]);
  });
});
