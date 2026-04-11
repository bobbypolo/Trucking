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
  it("calls app.use(driversRouter)", () => {
    const useRegex = /app\.use\(\s*driversRouter\s*\)/;
    expect(useRegex.test(source)).toBe(true);
  });
});
