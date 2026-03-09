import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

// Tests R-FS-01-01, R-FS-01-02, R-FS-01-03

const ROUTES_DIR = path.resolve(__dirname, "../../routes");
const INDEX_PATH = path.resolve(__dirname, "../../index.ts");
const AUDIT_DOC_PATH = path.resolve(
  __dirname,
  "../../..",
  "ROUTE_OWNERSHIP_AUDIT.md",
);

/** All route modules in the release scope */
const RELEASE_SCOPED_MODULES = [
  "loads",
  "users",
  "equipment",
  "dispatch",
  "accounting",
  "incidents",
  "clients",
  "exceptions",
  "contracts",
  "compliance",
  "messages",
  "call-sessions",
  "tracking",
  "ai",
  "metrics",
  "weather",
];

/** Extract all route definitions from a file's content */
function extractRoutes(
  content: string,
  sourceName: string,
): Array<{ method: string; path: string; source: string }> {
  const routeRegex =
    /router\.(get|post|put|patch|delete)\s*\(\s*['"`]([^'"`]+)['"`]/g;
  const routes: Array<{ method: string; path: string; source: string }> = [];
  let match;
  while ((match = routeRegex.exec(content)) !== null) {
    routes.push({
      method: match[1].toUpperCase(),
      path: match[2],
      source: sourceName,
    });
  }
  return routes;
}

describe("R-FS-01: Route Ownership Audit", () => {
  describe("R-FS-01-01: ROUTE_OWNERSHIP_AUDIT.md exists", () => {
    it("ROUTE_OWNERSHIP_AUDIT.md artifact exists at project root", () => {
      expect(
        fs.existsSync(AUDIT_DOC_PATH),
        `ROUTE_OWNERSHIP_AUDIT.md must exist at ${AUDIT_DOC_PATH}`,
      ).toBe(true);
    });

    it("ROUTE_OWNERSHIP_AUDIT.md contains route ownership matrix", () => {
      const content = fs.readFileSync(AUDIT_DOC_PATH, "utf-8");
      expect(content).toContain("Route Ownership");
      expect(content.length).toBeGreaterThan(500);
    });
  });

  describe("R-FS-01-02: POST /api/messages exists in exactly one module", () => {
    it("POST /api/messages is NOT present in dispatch.ts", () => {
      const dispatchPath = path.join(ROUTES_DIR, "dispatch.ts");
      const content = fs.readFileSync(dispatchPath, "utf-8");
      const hasPostMessages =
        /router\.post\s*\(\s*['"`]\/api\/messages['"`]/.test(content);
      expect(
        hasPostMessages,
        "dispatch.ts must NOT define POST /api/messages — duplicate removed",
      ).toBe(false);
    });

    it("POST /api/messages IS present in messages.ts (canonical owner)", () => {
      const messagesPath = path.join(ROUTES_DIR, "messages.ts");
      const content = fs.readFileSync(messagesPath, "utf-8");
      const hasPostMessages =
        /router\.post\s*\(\s*['"`]\/api\/messages['"`]/.test(content);
      expect(
        hasPostMessages,
        "messages.ts must define POST /api/messages as the canonical owner",
      ).toBe(true);
    });

    it("POST /api/messages appears in exactly one module across all route files", () => {
      const owners: string[] = [];
      for (const mod of RELEASE_SCOPED_MODULES) {
        const filePath = path.join(ROUTES_DIR, `${mod}.ts`);
        if (!fs.existsSync(filePath)) continue;
        const content = fs.readFileSync(filePath, "utf-8");
        if (/router\.post\s*\(\s*['"`]\/api\/messages['"`]/.test(content)) {
          owners.push(mod);
        }
      }
      expect(
        owners,
        `POST /api/messages should have exactly 1 owner, found: ${owners.join(", ")}`,
      ).toHaveLength(1);
      expect(owners[0]).toBe("messages");
    });
  });

  describe("R-FS-01-03: No duplicate route registrations across release-scoped modules", () => {
    it("no duplicate route definitions exist across all release-scoped route modules", () => {
      const allRoutes: Array<{ method: string; path: string; source: string }> =
        [];

      for (const mod of RELEASE_SCOPED_MODULES) {
        const filePath = path.join(ROUTES_DIR, `${mod}.ts`);
        if (!fs.existsSync(filePath)) continue;
        const content = fs.readFileSync(filePath, "utf-8");
        const routes = extractRoutes(content, `${mod}.ts`);
        allRoutes.push(...routes);
      }

      // Group by method+path key
      const routeMap = new Map<string, string[]>();
      for (const { method, path: routePath, source } of allRoutes) {
        const key = `${method} ${routePath}`;
        const existing = routeMap.get(key) || [];
        existing.push(source);
        routeMap.set(key, existing);
      }

      const duplicates: string[] = [];
      for (const [route, files] of routeMap) {
        if (files.length > 1) {
          duplicates.push(`  ${route} — defined in: ${files.join(", ")}`);
        }
      }

      expect(
        duplicates,
        `Duplicate routes found across release-scoped modules:\n${duplicates.join("\n")}`,
      ).toHaveLength(0);
    });

    it("dispatch.ts contains no /api/messages route definitions", () => {
      const dispatchPath = path.join(ROUTES_DIR, "dispatch.ts");
      const content = fs.readFileSync(dispatchPath, "utf-8");
      const messagesRoutes = extractRoutes(content, "dispatch.ts").filter(
        (r) =>
          r.path === "/api/messages" ||
          r.path === "/api/messages/:id" ||
          r.path.startsWith("/api/messages/"),
      );
      expect(
        messagesRoutes,
        `dispatch.ts must not define any /api/messages routes — found: ${JSON.stringify(messagesRoutes)}`,
      ).toHaveLength(0);
    });
  });
});
