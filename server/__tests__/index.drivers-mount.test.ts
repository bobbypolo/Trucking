import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

/**
 * Static-source verification: ensure server/index.ts both imports and mounts
 * the drivers router. This guards against accidental removal of either the
 * import or the `app.use` call — the driver profile endpoints depend on
 * both.
 *
 * Tests R-P9-07
 */
describe("server/index.ts mounts drivers router", () => {
  const indexPath = path.resolve(__dirname, "..", "index.ts");
  const source = fs.readFileSync(indexPath, "utf8");

  // Tests R-P9-07
  it("imports driversRouter from ./routes/drivers", () => {
    const importRegex =
      /import\s+driversRouter\s+from\s+["']\.\/routes\/drivers["']/;
    expect(importRegex.test(source)).toBe(true);
  });

  // Tests R-P9-07
  // Accepts either an explicit `app.use(driversRouter)` call or inclusion in
  // the for-loop router mount array `for (const r of [..., driversRouter]) app.use(r)`
  // that index.ts uses to stay under the modularization line-count cap.
  it("mounts driversRouter via app.use", () => {
    const explicitUseRegex = /app\.use\(\s*driversRouter\s*\)/;
    const loopMountRegex =
      /for\s*\(\s*const\s+\w+\s+of\s+\[[^\]]*\bdriversRouter\b[^\]]*\]\s*\)\s*app\.use\s*\(/;
    const mounted =
      explicitUseRegex.test(source) || loopMountRegex.test(source);
    expect(mounted).toBe(true);
  });
});
