// Tests R-P4-06, R-P4-07, R-P4-08, R-P4-09, R-P4-10
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

// Read source files for structural verification
const authSource = fs.readFileSync(
  path.resolve("services/authService.ts"),
  "utf-8",
);
const firebaseSource = fs.readFileSync(
  path.resolve("services/firebase.ts"),
  "utf-8",
);
const featuresSource = fs.readFileSync(
  path.resolve("config/features.ts"),
  "utf-8",
);
const mockDataSource = fs.readFileSync(
  path.resolve("services/mockDataService.ts"),
  "utf-8",
);

describe("R-P4-06: seedFixtures not in production bundle", () => {
  it("authService.ts does not statically define seedFixtures", () => {
    // seedFixtures must NOT be defined as a top-level const in authService.ts
    // It should only appear inside seedDatabase() via dynamic import
    const topLevelMatch = authSource.match(
      /^(?:export\s+)?const\s+seedFixtures\s*=/m,
    );
    expect(topLevelMatch).toBeNull();
  });

  it("seedFixtures is defined in mockDataService.ts", () => {
    expect(mockDataSource).toMatch(
      /export\s+const\s+seedFixtures\s*=/,
    );
  });

  it("seedDatabase uses dynamic import() for seedFixtures", () => {
    // The dynamic import pattern ensures Vite tree-shakes the fixtures
    expect(authSource).toMatch(
      /await\s+import\s*\(\s*["']\.\/mockDataService["']\s*\)/,
    );
  });

  it("no static import of mockDataService in authService.ts", () => {
    // authService must NOT have a static import from mockDataService
    // Only dynamic import() inside seedDatabase() is allowed
    const staticImport = authSource.match(
      /^import\s+.*from\s+["']\.\/mockDataService["']/m,
    );
    expect(staticImport).toBeNull();
  });
});

describe("R-P4-07: no dev credentials in production bundle", () => {
  it('admin@loadpilot.com not in authService.ts as a static string', () => {
    // The string should only exist in mockDataService.ts (dynamic import target)
    const matches = (authSource.match(/admin@loadpilot\.com/g) || []).length;
    expect(matches).toBe(0);
  });

  it('"User123" in authService.ts is behind import.meta.env.DEV guard', () => {
    // Find all "User123" occurrences that are NOT in comments
    const lines = authSource.split("\n");
    const codeLines = lines.filter(
      (line) => {
        const trimmed = line.trim();
        return trimmed.includes("User123") &&
          !trimmed.startsWith("//") &&
          !trimmed.startsWith("*");
      },
    );
    // Every code line containing "User123" must also contain import.meta.env.DEV
    for (const line of codeLines) {
      expect(line).toContain("import.meta.env.DEV");
    }
    // There must be exactly one such code line (the _devFallbackPassword definition)
    expect(codeLines.length).toBe(1);
  });

  it("mockDataService.ts contains the seed email addresses", () => {
    expect(mockDataSource).toContain("admin@loadpilot.com");
    expect(mockDataSource).toContain("User123");
  });
});

describe("R-P4-08: DEMO_MODE production guard", () => {
  it("DEMO_MODE is exported from firebase.ts", () => {
    expect(firebaseSource).toMatch(/export\s+const\s+DEMO_MODE/);
  });

  it("DEMO_MODE includes import.meta.env.DEV condition", () => {
    expect(firebaseSource).toMatch(
      /DEMO_MODE\s*=[\s\S]*?import\.meta\.env\.DEV/,
    );
  });

  it("DEMO_MODE includes !firebaseConfig.apiKey condition", () => {
    expect(firebaseSource).toMatch(
      /DEMO_MODE\s*=[\s\S]*?!firebaseConfig\.apiKey/,
    );
  });

  it("production guard throws if import.meta.env.PROD && DEMO_MODE", () => {
    expect(firebaseSource).toMatch(
      /if\s*\(\s*import\.meta\.env\.PROD\s*&&\s*DEMO_MODE\s*\)/,
    );
    expect(firebaseSource).toContain("throw new Error");
  });

  it("production guard error message mentions VITE_FIREBASE_API_KEY", () => {
    expect(firebaseSource).toContain("VITE_FIREBASE_API_KEY");
  });

  it("DEMO_MODE cannot be true in production (import.meta.env.DEV is false)", () => {
    // Structural verification: DEMO_MODE requires import.meta.env.DEV
    // which is statically false in production builds
    const modeGuard = firebaseSource.match(
      /import\.meta\.env\.MODE\s*!==\s*['"]production['"]/,
    );
    expect(modeGuard).not.toBeNull();
  });
});

describe("R-P4-09: config/features.ts documents trust boundary", () => {
  it("features.ts contains trust boundary documentation", () => {
    expect(featuresSource).toContain("TRUST BOUNDARY");
  });

  it("documents that flags evaluate to false in production", () => {
    expect(featuresSource).toContain(
      "Every flag evaluates to `false` in production builds",
    );
  });

  it("documents that code paths are tree-shaken", () => {
    expect(featuresSource).toContain("tree-shaken");
  });

  it("documents PRODUCTION INVARIANTS", () => {
    expect(featuresSource).toContain("PRODUCTION INVARIANTS");
  });

  it("documents seed credentials are never bundled", () => {
    expect(featuresSource).toContain("never bundled in production");
  });

  it("documents DEMO_MODE guard reference", () => {
    expect(featuresSource).toContain("services/firebase.ts");
    expect(featuresSource).toContain("DEMO_MODE");
  });

  it("all feature flags use import.meta.env.DEV", () => {
    // Extract the features object body
    const featuresBlock = featuresSource.match(
      /export\s+const\s+features\s*=\s*\{([\s\S]*?)\}\s*as\s+const/,
    );
    expect(featuresBlock).not.toBeNull();
    const body = featuresBlock![1];
    // Every non-comment line with a colon (key: value) must reference import.meta.env.DEV
    const valueLines = body.split("\n").filter(
      (line) => {
        const trimmed = line.trim();
        return trimmed.includes(":") &&
          !trimmed.startsWith("//") &&
          !trimmed.startsWith("/*") &&
          !trimmed.startsWith("*");
      },
    );
    expect(valueLines.length).toBeGreaterThanOrEqual(5);
    for (const line of valueLines) {
      expect(line).toContain("import.meta.env.DEV");
    }
  });
});

describe("R-P4-10: seedDatabase() uses dynamic import for fixtures", () => {
  it("seedDatabase is an async function", () => {
    expect(authSource).toMatch(
      /export\s+const\s+seedDatabase\s*=\s*async/,
    );
  });

  it("seedDatabase uses await import() for mockDataService", () => {
    // Extract the seedDatabase function body
    const fnStart = authSource.indexOf("export const seedDatabase");
    expect(fnStart).toBeGreaterThan(-1);
    const fnBody = authSource.slice(fnStart, fnStart + 500);
    expect(fnBody).toMatch(
      /const\s*\{\s*seedFixtures\s*\}\s*=\s*await\s+import\s*\(\s*["']\.\/mockDataService["']\s*\)/,
    );
  });

  it("seedDatabase does NOT use static seedFixtures reference", () => {
    // Before the seedDatabase function, there should be no module-level seedFixtures const
    const fnStart = authSource.indexOf("export const seedDatabase");
    const beforeFn = authSource.slice(0, fnStart);
    const staticDef = beforeFn.match(/^const\s+seedFixtures\s*=/m);
    expect(staticDef).toBeNull();
  });

  it("dynamic import pattern is tree-shakeable by Vite", () => {
    // Vite tree-shakes dynamic imports when the importing code is
    // dead-code-eliminated. seedDatabase is called only when
    // features.seedSystem is true (import.meta.env.DEV).
    // Verify this chain exists in the codebase.
    expect(featuresSource).toContain("seedSystem: import.meta.env.DEV");
  });
});
