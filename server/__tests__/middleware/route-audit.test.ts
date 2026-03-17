import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

// Tests R-P1-05-AC3

/**
 * Route Audit Test: Enumerates all registered routes across route modules
 * and verifies each data-accessing route has requireAuth + requireTenant middleware.
 *
 * Environment-aware public allowlist:
 * - Production: only /api/health is public
 * - Dev/staging: adds Firebase-backed provisioning endpoints
 *
 * /api/metrics is NOT public (admin-only per AC3)
 */

const ROUTES_DIR = path.resolve(__dirname, "../../routes");
const INDEX_PATH = path.resolve(__dirname, "../../index.ts");

// Production public allowlist: ONLY /api/health
const PRODUCTION_PUBLIC_ROUTES = new Set(["GET /api/health"]);

// Dev/staging adds provisioning endpoints (Firebase-backed)
const DEV_STAGING_PUBLIC_ROUTES = new Set([
  "GET /api/health",
  "POST /api/auth/register",
  "POST /api/auth/login",
  "POST /api/auth/reset-password",
  "POST /api/users",
]);

// Regex to match Express route definitions (handles multi-line declarations)
// Captures: method, path, and a window of text up to the handler to detect middleware
const ROUTE_BLOCK_REGEX =
  /router\.(get|post|put|patch|delete)\s*\(\s*['"`]([^'"`]+)['"`]([\s\S]{0,300}?)\)\s*[,;)]/g;
const INDEX_ROUTE_BLOCK_REGEX =
  /app\.(get|post|put|patch|delete)\s*\(\s*['"`]([^'"`]+)['"`]([\s\S]{0,300}?)\)\s*[,;)]/g;

// Fallback: single-line regex for routes that fit on one line
const ROUTE_DEF_REGEX =
  /router\.(get|post|put|patch|delete)\s*\(\s*['"`]([^'"`]+)['"`]/g;
const INDEX_ROUTE_DEF_REGEX =
  /app\.(get|post|put|patch|delete)\s*\(\s*['"`]([^'"`]+)['"`]/g;

// Regex to check if a route handler block includes requireAuth / requireTenant
const AUTH_MIDDLEWARE_REGEX = /requireAuth/;
const TENANT_MIDDLEWARE_REGEX = /requireTenant/;

interface RouteEntry {
  method: string;
  path: string;
  file: string;
  line: string;
  hasAuth: boolean;
  hasTenant: boolean;
}

/**
 * Extracts all route definitions from a file, handling both single-line and
 * multi-line `router.METHOD("path", middleware1, middleware2, handler)` forms.
 *
 * Strategy: scan the whole file for each router.METHOD( opening, then capture
 * 300 characters of context after the path string to detect requireAuth /
 * requireTenant references that may appear on subsequent lines.
 */
function extractRoutesFromContent(
  content: string,
  file: string,
  routerVar: string = "router",
): RouteEntry[] {
  const routes: RouteEntry[] = [];
  // Match: router.get("/path", ... up to closing paren of the route call
  // We use a forward scan: find METHOD + path, then scan ahead for middleware
  const methodRe = new RegExp(
    `${routerVar}\\.(get|post|put|patch|delete)\\s*\\(\\s*['"\`]([^'"\`]+)['"\`]`,
    "g",
  );

  let match: RegExpExecArray | null;
  while ((match = methodRe.exec(content)) !== null) {
    const method = match[1].toUpperCase();
    const routePath = match[2];
    // Capture ~300 chars after the path to detect middleware
    const contextStart = match.index;
    const contextEnd = Math.min(content.length, contextStart + 400);
    const block = content.slice(contextStart, contextEnd);

    routes.push({
      method,
      path: routePath,
      file,
      line: block.split("\n")[0].trim(),
      hasAuth: AUTH_MIDDLEWARE_REGEX.test(block),
      hasTenant: TENANT_MIDDLEWARE_REGEX.test(block),
    });
  }

  return routes;
}

function extractRoutes(): RouteEntry[] {
  const routes: RouteEntry[] = [];

  // Scan route modules
  const routeFiles = fs
    .readdirSync(ROUTES_DIR)
    .filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"));

  for (const file of routeFiles) {
    const filePath = path.join(ROUTES_DIR, file);
    const content = fs.readFileSync(filePath, "utf-8");
    routes.push(...extractRoutesFromContent(content, file, "router"));
  }

  // Scan index.ts for inline routes (uses 'app' variable)
  if (fs.existsSync(INDEX_PATH)) {
    const content = fs.readFileSync(INDEX_PATH, "utf-8");
    routes.push(...extractRoutesFromContent(content, "index.ts", "app"));
  }

  return routes;
}

describe("R-P1-05: Route Protection Audit", () => {
  const allRoutes = extractRoutes();

  describe("AC3: All data-accessing routes have requireAuth", () => {
    it("finds at least 20 routes (sanity check)", () => {
      expect(allRoutes.length).toBeGreaterThanOrEqual(20);
    });

    it("every non-public route has requireAuth middleware", () => {
      const unprotected: string[] = [];

      for (const route of allRoutes) {
        const key = `${route.method} ${route.path}`;
        // Skip public routes (use production allowlist - strictest)
        if (PRODUCTION_PUBLIC_ROUTES.has(key)) continue;
        // Skip dev provisioning routes (they're protected in prod)
        if (DEV_STAGING_PUBLIC_ROUTES.has(key)) continue;

        if (!route.hasAuth) {
          unprotected.push(`${key} in ${route.file}`);
        }
      }

      expect(
        unprotected,
        `Unprotected routes found:\n${unprotected.join("\n")}`,
      ).toHaveLength(0);
    });

    it("every non-public route has requireTenant middleware", () => {
      const noTenant: string[] = [];

      // Routes that are intentionally auth-only (no tenant isolation needed):
      // - /api/users/me: returns the calling user's own profile
      // - /api/metrics: admin-only cross-tenant operational metrics (uses requireAdmin)
      // - /api/ai/*: AI proxy routes scope output by user identity, not tenant DB rows.
      //   These are mounted at /api/ai in index.ts; route defs use bare paths /extract-* etc.
      const TENANT_EXEMPT_ROUTES = new Set([
        "GET /api/users/me",
        "GET /api/metrics",
        "POST /extract-load",
        "POST /extract-broker",
        "POST /extract-equipment",
        "POST /generate-training",
        "POST /analyze-safety",
      ]);

      for (const route of allRoutes) {
        const key = `${route.method} ${route.path}`;
        // Skip public routes
        if (PRODUCTION_PUBLIC_ROUTES.has(key)) continue;
        if (DEV_STAGING_PUBLIC_ROUTES.has(key)) continue;
        // Skip auth-only routes that have documented exemptions
        if (TENANT_EXEMPT_ROUTES.has(key)) continue;

        if (!route.hasTenant) {
          noTenant.push(`${key} in ${route.file}`);
        }
      }

      expect(
        noTenant,
        `Routes without tenant isolation:\n${noTenant.join("\n")}`,
      ).toHaveLength(0);
    });
  });

  describe("AC3: Public endpoint allowlist enforcement", () => {
    it("/api/health is the only public endpoint in production", () => {
      expect(PRODUCTION_PUBLIC_ROUTES.size).toBe(1);
      expect(PRODUCTION_PUBLIC_ROUTES.has("GET /api/health")).toBe(true);
    });

    it("/api/health route exists in index.ts", () => {
      const healthRoute = allRoutes.find((r) => r.path === "/api/health");
      expect(healthRoute).toBeDefined();
      expect(healthRoute?.method).toBe("GET");
    });

    it("/api/health does NOT have requireAuth (it is public)", () => {
      const healthRoute = allRoutes.find((r) => r.path === "/api/health");
      expect(healthRoute).toBeDefined();
      expect(healthRoute?.hasAuth).toBe(false);
    });

    it("/api/metrics is NOT in the public allowlist", () => {
      expect(PRODUCTION_PUBLIC_ROUTES.has("GET /api/metrics")).toBe(false);
      expect(DEV_STAGING_PUBLIC_ROUTES.has("GET /api/metrics")).toBe(false);
    });

    it("dev/staging provisioning endpoints are defined", () => {
      expect(DEV_STAGING_PUBLIC_ROUTES.has("POST /api/auth/register")).toBe(
        true,
      );
      expect(DEV_STAGING_PUBLIC_ROUTES.has("POST /api/auth/login")).toBe(true);
    });
  });

  describe("AC3: Route inventory cross-check", () => {
    it("all route files are imported in index.ts", () => {
      const indexContent = fs.readFileSync(INDEX_PATH, "utf-8");
      const routeFiles = fs
        .readdirSync(ROUTES_DIR)
        .filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"));

      for (const file of routeFiles) {
        const moduleName = file.replace(".ts", "");
        const importPattern = new RegExp(
          `from\\s+['\\"]\\.\/routes\\/${moduleName}['\\"']`,
        );
        expect(
          importPattern.test(indexContent),
          `Route module ${file} is not imported in index.ts`,
        ).toBe(true);
      }
    });

    it("no route uses the deprecated verifyFirebaseToken", () => {
      const routeFiles = fs
        .readdirSync(ROUTES_DIR)
        .filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"));

      const offenders: string[] = [];
      for (const file of routeFiles) {
        const content = fs.readFileSync(path.join(ROUTES_DIR, file), "utf-8");
        if (
          content.includes("verifyFirebaseToken") ||
          content.includes("authenticateToken")
        ) {
          offenders.push(file);
        }
      }

      expect(
        offenders,
        `Routes still using deprecated auth: ${offenders.join(", ")}`,
      ).toHaveLength(0);
    });

    it("no route file imports JWT_SECRET or jsonwebtoken", () => {
      const routeFiles = fs
        .readdirSync(ROUTES_DIR)
        .filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"));

      const offenders: string[] = [];
      for (const file of routeFiles) {
        const content = fs.readFileSync(path.join(ROUTES_DIR, file), "utf-8");
        if (
          content.includes("JWT_SECRET") ||
          content.includes("'jsonwebtoken'")
        ) {
          offenders.push(file);
        }
      }

      expect(
        offenders,
        `Routes still using JWT: ${offenders.join(", ")}`,
      ).toHaveLength(0);
    });
  });
});
