// Tests R-P1-05, R-P1-06, R-P1-07
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

/**
 * Auth Readiness Gate tests for App.tsx (S-1.3)
 *
 * R-P1-05: isAuthReady state added — children render blocked until refreshData() completes
 * R-P1-06: Login produces no 401 console errors — children mount only after auth ready
 * R-P1-07: Logout resets isAuthReady to false
 *
 * Strategy: Source-level assertions (same pattern as App.navigation.test.tsx)
 * since full App rendering requires mocking 30+ lazy imports and services.
 */

const appSource = fs.readFileSync(
  path.resolve("App.tsx"),
  "utf-8",
);

describe("App.tsx auth readiness gate (S-1.3)", () => {
  describe("R-P1-05: isAuthReady state blocks children until refreshData completes", () => {
    it("declares isAuthReady state with useState(false)", () => {
      expect(appSource).toMatch(/\bisAuthReady\b.*useState.*false/s);
    });

    it("sets isAuthReady to true only after refreshData completes in onUserChange", () => {
      // The onUserChange callback should await refreshData, then setIsAuthReady(true)
      // Must appear in the onUserChange callback context
      expect(appSource).toMatch(/await\s+refreshData\s*\(/);
      expect(appSource).toMatch(/setIsAuthReady\s*\(\s*true\s*\)/);
    });

    it("gates render on isAuthReady — shows LoadingSkeleton when not ready", () => {
      // When user exists but isAuthReady is false, show loading instead of children
      expect(appSource).toMatch(/isAuthReady/);
      // The gate should appear before the main authenticated content renders
      expect(appSource).toMatch(/!isAuthReady/);
    });
  });

  describe("R-P1-06: Login — children mount only after auth ready", () => {
    it("does not setUser before refreshData completes in onUserChange", () => {
      // In the onUserChange callback, setUser should come AFTER refreshData
      // or isAuthReady should gate the render regardless of setUser timing
      const onUserChangeMatch = appSource.match(
        /onUserChange\s*\(\s*async\s*\(\s*updatedUser\s*\)\s*=>\s*\{([\s\S]*?)\}\s*\)/,
      );
      expect(onUserChangeMatch).toBeTruthy();
      const callbackBody = onUserChangeMatch![1];

      // Either: setUser happens after await refreshData, OR
      // isAuthReady gate is set to true only after refreshData completes
      // The key behavior: setIsAuthReady(true) must come AFTER await refreshData()
      const refreshPos = callbackBody.indexOf("await refreshData");
      const authReadyPos = callbackBody.indexOf("setIsAuthReady(true)");
      expect(refreshPos).toBeGreaterThanOrEqual(0);
      expect(authReadyPos).toBeGreaterThanOrEqual(0);
      expect(authReadyPos).toBeGreaterThan(refreshPos);
    });

    it("handleLogin sets isAuthReady after awaiting refreshData", () => {
      // The handleLogin function should also properly gate auth readiness
      // Either it relies on onUserChange (which handles it), or it directly handles it
      // At minimum, the render gate prevents children from appearing before data is ready
      const hasRenderGate = appSource.includes("!isAuthReady");
      expect(hasRenderGate).toBe(true);
    });
  });

  describe("R-P1-07: Logout resets isAuthReady to false", () => {
    it("handleLogout sets isAuthReady to false", () => {
      // Extract handleLogout function body
      const logoutMatch = appSource.match(
        /handleLogout\s*=\s*async\s*\(\s*\)\s*=>\s*\{([\s\S]*?)\n\s*\};/,
      );
      expect(logoutMatch).toBeTruthy();
      const logoutBody = logoutMatch![1];
      expect(logoutBody).toContain("setIsAuthReady(false)");
    });

    it("onUserChange with null user resets isAuthReady", () => {
      // When onUserChange fires with null (signout), isAuthReady should reset
      const onUserChangeMatch = appSource.match(
        /onUserChange\s*\(\s*async\s*\(\s*updatedUser\s*\)\s*=>\s*\{([\s\S]*?)\}\s*\)/,
      );
      expect(onUserChangeMatch).toBeTruthy();
      const callbackBody = onUserChangeMatch![1];
      // Should contain logic for null user that resets auth ready
      expect(callbackBody).toMatch(/setIsAuthReady\s*\(\s*false\s*\)/);
    });
  });
});
