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

  // Accepts either an explicit `app.use(pushTokensRouter)` call or inclusion
  // in the for-loop router mount array that index.ts uses to stay under the
  // modularization line-count cap.
  it("mounts pushTokensRouter via app.use", () => {
    const explicitUseRegex = /app\.use\(\s*pushTokensRouter\s*\)/;
    const loopMountRegex =
      /for\s*\(\s*const\s+\w+\s+of\s+\[[^\]]*\bpushTokensRouter\b[^\]]*\]\s*\)\s*app\.use\s*\(/;
    const mounted =
      explicitUseRegex.test(source) || loopMountRegex.test(source);
    expect(mounted).toBe(true);
  });
});
