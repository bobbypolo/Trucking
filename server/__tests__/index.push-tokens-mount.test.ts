import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

/**
 * Static-source verification: ensure server/index.ts both imports and mounts
 * the push-tokens router. This guards against accidental removal of either
 * the import or the `app.use` call.
 *
 * Tests R-P4-09
 */
describe("server/index.ts mounts push-tokens router", () => {
  const indexPath = path.resolve(__dirname, "..", "index.ts");
  const source = fs.readFileSync(indexPath, "utf8");

  it("imports pushTokensRouter from ./routes/push-tokens", () => {
    const importRegex =
      /import\s+pushTokensRouter\s+from\s+["']\.\/routes\/push-tokens["']/;
    expect(importRegex.test(source)).toBe(true);
  });

  it("calls app.use(pushTokensRouter)", () => {
    const useRegex = /app\.use\(\s*pushTokensRouter\s*\)/;
    expect(useRegex.test(source)).toBe(true);
  });
});
