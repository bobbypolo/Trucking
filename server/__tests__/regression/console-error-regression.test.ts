/**
 * Console error regression tests — S-7.5
 *
 * Verifies error handling patterns that prevent console errors:
 *   - R-P7-09: Zero HTTP 500 errors — all server routes have try-catch or global errorHandler
 *   - R-P7-10: Zero HTTP 401 errors — api.ts has token refresh retry
 *   - R-P7-11: Total console errors <= 12 — route aliases, error handlers, structured responses
 *
 * These are static/structural code analysis tests that verify error-preventing
 * patterns exist in the codebase. They do NOT use Playwright.
 */

import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const ROOT = path.resolve(__dirname, "..", "..", "..");
const SERVER_ROUTES = path.join(ROOT, "server", "routes");
const SERVICES_DIR = path.join(ROOT, "services");
const SERVER_INDEX = path.join(ROOT, "server", "index.ts");

/**
 * Helper: read a file and return its content, or empty string if missing.
 */
function readFile(filePath: string): string {
  try {
    return fs.readFileSync(filePath, "utf-8");
  } catch {
    return "";
  }
}

/**
 * Helper: list all .ts route files in server/routes/.
 */
function listRouteFiles(): string[] {
  const entries = fs.readdirSync(SERVER_ROUTES);
  return entries.filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"));
}

/**
 * Helper: count route handlers (router.get, router.post, etc.) in a file.
 */
function countRouteHandlers(content: string): number {
  const pattern = /router\.(get|post|put|patch|delete)\s*\(/g;
  return (content.match(pattern) || []).length;
}

/**
 * Helper: count try-catch blocks in a file.
 */
function countTryCatch(content: string): number {
  // Count 'try {' patterns (allowing whitespace variations)
  const tryPattern = /\btry\s*\{/g;
  return (content.match(tryPattern) || []).length;
}

/**
 * Helper: check if a route file has async handlers that could throw
 * without try-catch protection. Returns unprotected handler count.
 *
 * A handler is considered "protected" if:
 * 1. It has its own try-catch, OR
 * 2. The route uses only synchronous code (no await), OR
 * 3. The global errorHandler catches async errors (requires express-async-errors or manual next(err))
 */
function countUnprotectedAsyncHandlers(content: string): number {
  // Find all async route handlers
  const asyncHandlerPattern =
    /router\.(get|post|put|patch|delete)\s*\([^)]+,\s*(?:[^)]+,\s*)*async/g;
  const asyncHandlers = content.match(asyncHandlerPattern) || [];

  if (asyncHandlers.length === 0) return 0;

  // Count try blocks — each try-catch protects one handler
  const tryCatchCount = countTryCatch(content);

  // If there are at least as many try-catch blocks as async handlers, all protected
  const unprotected = Math.max(0, asyncHandlers.length - tryCatchCount);
  return unprotected;
}

// ── R-P7-09: Zero HTTP 500 errors — server routes have error handlers ────────

describe("R-P7-09: Server routes have error handlers (zero 500s)", () => {
  const routeFiles = listRouteFiles();

  it("should have route files in server/routes/", () => {
    expect(routeFiles.length).toBeGreaterThan(0);
  });

  it("server/index.ts registers the global errorHandler middleware", () => {
    const indexContent = readFile(SERVER_INDEX);
    expect(indexContent).toContain('import { errorHandler }');
    expect(indexContent).toContain("app.use(errorHandler)");
  });

  it("errorHandler catches AppError instances and wraps unknown errors", () => {
    const handlerPath = path.join(
      ROOT,
      "server",
      "middleware",
      "errorHandler.ts",
    );
    const content = readFile(handlerPath);
    expect(content).toBeTruthy();
    // Must detect AppError
    expect(content).toContain("instanceof AppError");
    // Must wrap unknown errors
    expect(content).toContain("InternalError");
    // Must set status code
    expect(content).toMatch(/res\.status\(/);
    // Must return JSON
    expect(content).toMatch(/\.json\(/);
  });

  it("errorHandler is registered AFTER all route handlers in index.ts", () => {
    const indexContent = readFile(SERVER_INDEX);
    const routeUsePattern = /app\.use\(\w+Router\)/g;
    const allRouteUses = [...indexContent.matchAll(routeUsePattern)];
    const errorHandlerPos = indexContent.indexOf("app.use(errorHandler)");

    expect(errorHandlerPos).toBeGreaterThan(0);
    // errorHandler must come after all route registrations
    for (const match of allRouteUses) {
      expect(errorHandlerPos).toBeGreaterThan(match.index!);
    }
  });

  /**
   * Files with documented safe-async patterns (no try-catch needed):
   * - weather.ts: delegates to getWeatherForLocation which never throws
   *   (tested separately below)
   */
  const SAFE_ASYNC_FILES = new Set(["weather.ts"]);

  it.each(routeFiles)(
    "route file %s has error handling for async handlers",
    (routeFile) => {
      if (SAFE_ASYNC_FILES.has(routeFile)) return; // Tested by dedicated assertion

      const content = readFile(path.join(SERVER_ROUTES, routeFile));
      expect(content).toBeTruthy();

      const handlerCount = countRouteHandlers(content);
      if (handlerCount === 0) return; // Skip files with no handlers

      // Check for async handlers
      const hasAsync = /\basync\b/.test(content);
      if (!hasAsync) {
        // Synchronous-only route — global errorHandler covers sync throws
        return;
      }

      // For async routes, each async handler should have try-catch
      // OR the route should use next(err) pattern
      const hasTryCatch = countTryCatch(content) > 0;
      const hasNextError = /next\s*\(\s*(?:err|error|e)\s*\)/.test(content);
      const hasNextNewError = /next\s*\(\s*new\s+\w+Error/.test(content);

      expect(
        hasTryCatch || hasNextError || hasNextNewError,
      ).toBeTruthy();
    },
  );

  it("no route handler catches errors and silently swallows them", () => {
    for (const routeFile of routeFiles) {
      const content = readFile(path.join(SERVER_ROUTES, routeFile));
      // Pattern: catch block with empty body (swallowed error)
      const swallowedPattern = /catch\s*\([^)]*\)\s*\{\s*\}/g;
      const matches = content.match(swallowedPattern) || [];
      expect(matches.length).toBe(0);
    }
  });

  it("metrics.ts is safe despite no try-catch (synchronous handler)", () => {
    const content = readFile(path.join(SERVER_ROUTES, "metrics.ts"));
    expect(content).toBeTruthy();
    // metrics.ts handler is synchronous — no await
    const asyncHandlers = content.match(
      /router\.(get|post|put|patch|delete)\s*\([^)]+,\s*(?:[^)]+,\s*)*async/g,
    );
    expect(asyncHandlers || []).toHaveLength(0);
  });

  it("weather.ts delegates to service that never throws (graceful degradation)", () => {
    const content = readFile(path.join(SERVER_ROUTES, "weather.ts"));
    expect(content).toBeTruthy();
    // weather route calls getWeatherForLocation which handles errors internally
    expect(content).toContain("getWeatherForLocation");
    // Has explicit validation with 400 responses (not 500)
    expect(content).toContain("res.status(400)");
    // Comment documents the no-throw contract
    expect(content).toMatch(/always return 200|never returns 500|degraded/i);
  });
});

// ── R-P7-10: Zero HTTP 401 errors — api.ts has token refresh retry ───────────

describe("R-P7-10: Frontend api.ts has 401 retry with token refresh (zero 401s)", () => {
  const apiTsPath = path.join(SERVICES_DIR, "api.ts");
  const apiContent = readFile(apiTsPath);
  const authServicePath = path.join(SERVICES_DIR, "authService.ts");
  const authContent = readFile(authServicePath);

  it("api.ts exists and exports apiFetch", () => {
    expect(apiContent).toBeTruthy();
    expect(apiContent).toContain("export const apiFetch");
  });

  it("api.ts detects 401 status and enters retry path", () => {
    expect(apiContent).toContain("response.status === 401");
  });

  it("api.ts calls forceRefreshToken on first 401", () => {
    expect(apiContent).toContain("forceRefreshToken");
    // Must import it
    expect(apiContent).toContain("import");
    expect(apiContent).toMatch(/import\s*\{[^}]*forceRefreshToken[^}]*\}/);
  });

  it("api.ts retries the request with fresh token after 401", () => {
    // Must have retry fetch call
    expect(apiContent).toMatch(/retryResponse\s*=\s*await\s+fetch/);
    // Must use fresh token in retry headers
    expect(apiContent).toContain("freshToken");
    expect(apiContent).toContain("retryHeaders");
  });

  it("api.ts dispatches auth:session-expired if retry also returns 401", () => {
    expect(apiContent).toContain("retryResponse.status === 401");
    expect(apiContent).toContain("auth:session-expired");
    expect(apiContent).toContain("window.dispatchEvent");
  });

  it("api.ts handles retry success (retryResponse.ok)", () => {
    expect(apiContent).toContain("retryResponse.ok");
    expect(apiContent).toMatch(/retryResponse\.json\(\)/);
  });

  it("authService.ts exports forceRefreshToken function", () => {
    expect(authContent).toBeTruthy();
    expect(authContent).toMatch(/export\s+(async\s+)?function\s+forceRefreshToken|export\s+const\s+forceRefreshToken/);
  });

  it("server requireAuth returns structured AuthError (not raw 401)", () => {
    const requireAuthPath = path.join(
      ROOT,
      "server",
      "middleware",
      "requireAuth.ts",
    );
    const content = readFile(requireAuthPath);
    expect(content).toBeTruthy();
    // Must use AuthError class, not raw res.status(401)
    expect(content).toContain("AuthError");
    expect(content).toContain("next(");
    // Should NOT have raw res.status(401)
    expect(content).not.toMatch(/res\.status\(401\)/);
  });
});

// ── R-P7-11: Total console errors <= 12 ──────────────────────────────────────

describe("R-P7-11: Error reduction patterns (total console errors <= 12)", () => {
  it("global errorHandler returns structured JSON for all errors", () => {
    const handlerPath = path.join(
      ROOT,
      "server",
      "middleware",
      "errorHandler.ts",
    );
    const content = readFile(handlerPath);
    // Must call toJSON()
    expect(content).toContain("toJSON()");
    // Must set status code from AppError
    expect(content).toContain("appError.statusCode");
    // Must never expose stack traces in response
    expect(content).not.toMatch(/res\..*json.*stack/);
  });

  it("AppError class provides structured error envelope", () => {
    const appErrorPath = path.join(ROOT, "server", "errors", "AppError.ts");
    const content = readFile(appErrorPath);
    expect(content).toBeTruthy();
    // Must define error_class, error_code, statusCode
    expect(content).toContain("error_class");
    expect(content).toContain("error_code");
    expect(content).toContain("statusCode");
    // Must have toJSON method
    expect(content).toContain("toJSON");
  });

  it("dispatch route has tenant-scoped alias /api/dispatch/events (reduces 404s)", () => {
    const content = readFile(path.join(SERVER_ROUTES, "dispatch.ts"));
    // Both old path and new alias exist
    expect(content).toContain("/api/dispatch-events");
    expect(content).toContain("/api/dispatch/events");
  });

  it("all route files return structured error responses (not plain text)", () => {
    const routeFiles = listRouteFiles();
    for (const routeFile of routeFiles) {
      const content = readFile(path.join(SERVER_ROUTES, routeFile));
      // Check: any res.status(500) must be followed by .json(), not .send() with plain text
      const raw500Pattern = /res\.status\(500\)\.send\s*\(\s*["']/g;
      const matches = content.match(raw500Pattern) || [];
      expect(matches).toHaveLength(0);
    }
  });

  it("api.ts handles AbortError silently (no console errors from cancelled requests)", () => {
    const apiContent = readFile(path.join(SERVICES_DIR, "api.ts"));
    expect(apiContent).toContain("AbortError");
    // Must return undefined instead of throwing
    expect(apiContent).toContain("return undefined");
  });

  it("api.ts handles 403 with ForbiddenError class (structured, not raw throw)", () => {
    const apiContent = readFile(path.join(SERVICES_DIR, "api.ts"));
    expect(apiContent).toContain("ForbiddenError");
    expect(apiContent).toContain("response.status === 403");
  });

  it("server index.ts registers all 32 route modules", () => {
    const indexContent = readFile(SERVER_INDEX);
    // Count app.use() calls for routers
    const routerPattern = /app\.use\((?:[^)]*Router[^)]*)\)/g;
    const routerCalls = indexContent.match(routerPattern) || [];
    // Should have at least 30 route registrations (32 routes total, some combined)
    expect(routerCalls.length).toBeGreaterThanOrEqual(30);
  });

  it("health route is registered before rate limiter (avoids false 429s)", () => {
    const indexContent = readFile(SERVER_INDEX);
    const healthPos = indexContent.indexOf("app.use(healthRouter)");
    const rateLimitPos = indexContent.indexOf('app.use("/api", apiLimiter)');
    expect(healthPos).toBeGreaterThan(0);
    expect(rateLimitPos).toBeGreaterThan(0);
    expect(healthPos).toBeLessThan(rateLimitPos);
  });

  it("at least 30 of 32 route files have try-catch or next(err) error handling", () => {
    const routeFiles = listRouteFiles();
    let protectedCount = 0;

    for (const routeFile of routeFiles) {
      const content = readFile(path.join(SERVER_ROUTES, routeFile));
      const hasTryCatch = countTryCatch(content) > 0;
      const hasNextError = /next\s*\(\s*(?:new\s+\w+Error|err|error)\s*\)/.test(
        content,
      );
      const isSyncOnly = !/\basync\b/.test(content);

      if (hasTryCatch || hasNextError || isSyncOnly) {
        protectedCount++;
      }
    }

    // At least 30 of 32 route files must be protected
    expect(protectedCount).toBeGreaterThanOrEqual(30);
  });

  it("no route file uses res.status(500) without .json() response", () => {
    const routeFiles = listRouteFiles();
    for (const routeFile of routeFiles) {
      const content = readFile(path.join(SERVER_ROUTES, routeFile));
      // res.status(500).json({...}) is OK, res.status(500).send("text") is NOT
      const lines = content.split("\n");
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes("res.status(500)")) {
          // The same line or next line should have .json(
          const context = lines[i] + (lines[i + 1] || "");
          expect(context).toMatch(/\.json\s*\(/);
        }
      }
    }
  });

  it("total route files with unprotected async handlers is zero", () => {
    const routeFiles = listRouteFiles();
    const unprotectedFiles: string[] = [];

    for (const routeFile of routeFiles) {
      const content = readFile(path.join(SERVER_ROUTES, routeFile));
      if (countUnprotectedAsyncHandlers(content) > 0) {
        unprotectedFiles.push(routeFile);
      }
    }

    // weather.ts is async but delegates to a no-throw service
    // Filter out known safe async-without-trycatch files
    const trulyUnprotected = unprotectedFiles.filter(
      (f) => f !== "weather.ts",
    );
    expect(trulyUnprotected).toHaveLength(0);
  });
});
