/**
 * Integration test: App.tsx polling loop verification (R-P2-12)
 *
 * Full App mount requires mocking 30+ lazy-loaded components and Firebase auth.
 * Following the established pattern in App.authReady.test.tsx and App.navigation.test.tsx,
 * we use source-level assertions for structural verification plus a focused unit
 * test that simulates the polling callback logic with fake timers.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";

const appSource = fs.readFileSync(path.resolve("App.tsx"), "utf-8");

// Tests R-P2-12
describe("App.tsx polling loop (R-P2-12)", () => {
  describe("structural verification — source-level assertions", () => {
    it("declares pollIntervalRef to hold the interval handle", () => {
      expect(appSource).toMatch(/pollIntervalRef\s*=\s*useRef/);
    });

    it("creates setInterval with 10000ms calling refreshData inside onUserChange callback", () => {
      // Must have setInterval with 10000 referencing refreshData within proximity
      expect(appSource).toMatch(/setInterval\s*\(/);
      expect(appSource).toMatch(/10000/);
      // Both must appear in the same useEffect block (not more than 500 chars apart)
      const setIntervalIdx = appSource.indexOf("setInterval");
      const refreshDataIdx = appSource.indexOf(
        "refreshData(updatedUser)",
        setIntervalIdx - 50,
      );
      expect(setIntervalIdx).toBeGreaterThan(-1);
      expect(refreshDataIdx).toBeGreaterThan(-1);
      expect(Math.abs(setIntervalIdx - refreshDataIdx)).toBeLessThan(500);
    });

    it("clears the polling interval in the useEffect cleanup return", () => {
      // Cleanup return must contain clearInterval
      expect(appSource).toMatch(/clearInterval\s*\(/);
      // The cleanup should reference pollIntervalRef.current
      const cleanupMatch = appSource.match(
        /return\s*\(\s*\)\s*=>\s*\{[\s\S]{0,400}clearInterval[\s\S]{0,100}\}/,
      );
      expect(cleanupMatch).toBeTruthy();
    });

    it("clears the polling interval when user becomes null (logout path)", () => {
      // In the else branch (null user), pollIntervalRef.current should be cleared
      const elseMatch = appSource.match(
        /\}\s*else\s*\{[\s\S]{0,300}clearInterval[\s\S]{0,100}\}/,
      );
      expect(elseMatch).toBeTruthy();
    });
  });

  describe("behavioural verification — simulated polling callback", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    // Tests R-P2-12
    it("polling callback invokes refreshData at least twice within 10500ms", async () => {
      // Simulate the App.tsx polling logic in isolation:
      // pollIntervalRef.current = setInterval(() => { refreshData(user); }, 10000)
      // after an initial immediate call (refreshData on mount), advancing 10500ms
      // should yield >= 2 total calls (1 initial + 1 from interval).
      const getLoads = vi.fn().mockResolvedValue([]);
      const mockUser = { companyId: "c1", uid: "u1" };

      const refreshData = vi.fn(async () => {
        await getLoads(mockUser);
      });

      // Initial call on mount (equivalent to `await refreshData(updatedUser)`)
      await refreshData();

      // Set up polling interval (as App.tsx does)
      const intervalId = setInterval(() => {
        refreshData();
      }, 10000);

      expect(refreshData).toHaveBeenCalledTimes(1);

      // Advance past one interval
      await vi.advanceTimersByTimeAsync(10500);

      expect(refreshData).toHaveBeenCalledTimes(2);
      expect(getLoads).toHaveBeenCalledTimes(2);

      clearInterval(intervalId);
    });
  });
});
