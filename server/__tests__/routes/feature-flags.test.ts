/**
 * Tests R-B1-22, R-B1-23, R-B1-24: Feature Flags routes + mount
 *
 * Validates `server/routes/feature-flags.ts`:
 *  - GET /api/feature-flags returns merged flag map (env + DB) for tenant
 *  - PUT /api/feature-flags/:name requires admin role; non-admin → 403
 *  - server/index.ts mount line present (static fs.readFileSync + regex)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Hoisted mocks
const { mockQuery, mockResolveSqlPrincipalByFirebaseUid } = vi.hoisted(() => ({
  mockQuery: vi.fn(),
  mockResolveSqlPrincipalByFirebaseUid: vi.fn(),
}));

vi.mock("../../db", () => ({
  default: {
    query: mockQuery,
    getConnection: vi.fn(),
  },
}));

vi.mock("../../lib/logger", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    child: vi.fn().mockReturnThis(),
  },
  createChildLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
  createRequestLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}));

vi.mock("firebase-admin", () => {
  const mockAuth = {
    verifyIdToken: vi.fn().mockResolvedValue({
      uid: "firebase-uid-1",
      email_verified: true,
    }),
  };
  return {
    default: {
      app: vi.fn(),
      auth: () => mockAuth,
    },
  };
});

vi.mock("../../lib/token-revocation", () => ({
  isTokenRevoked: vi.fn().mockResolvedValue(false),
}));

vi.mock("../../lib/sql-auth", () => ({
  resolveSqlPrincipalByFirebaseUid: mockResolveSqlPrincipalByFirebaseUid,
}));

import * as fs from "fs";
import * as path from "path";
import express from "express";
import request from "supertest";
import featureFlagsRouter from "../../routes/feature-flags";
import { errorHandler } from "../../middleware/errorHandler";
import { DEFAULT_SQL_PRINCIPAL } from "../helpers/mock-sql-auth";

// Default: admin user
mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(DEFAULT_SQL_PRINCIPAL);

function createApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/feature-flags", featureFlagsRouter);
  app.use(errorHandler);
  return app;
}

describe("Feature Flags Routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(
      DEFAULT_SQL_PRINCIPAL,
    );
  });

  // ── R-B1-22: GET /api/feature-flags returns merged flag map ──────────

  describe("GET /api/feature-flags", () => {
    it("Tests R-B1-22 — returns merged env + DB flags for authenticated tenant", async () => {
      // DB returns one flag override for the tenant
      mockQuery.mockResolvedValueOnce([
        [
          {
            flag_name: "FEATURE_TRUCKER_MOBILE_BETA",
            flag_value: 1,
          },
        ],
      ]);

      const app = createApp();
      const res = await request(app)
        .get("/api/feature-flags")
        .set("Authorization", "Bearer valid-token")
        .expect(200);

      // The response is a flag map object
      expect(typeof res.body).toBe("object");
      // DB override should be true
      expect(res.body.FEATURE_TRUCKER_MOBILE_BETA).toBe(true);
      // Env-only flags default to false when env var is not set
      expect(res.body.FEATURE_ELD_INTEGRATION).toBe(false);
      expect(res.body.FEATURE_OFFLINE_SYNC).toBe(false);
      expect(res.body.FEATURE_AI_DOCUMENT_SCAN).toBe(false);
      expect(res.body.FEATURE_FREEMIUM_QUOTA).toBe(false);
      expect(res.body.FEATURE_FORCE_UPGRADE).toBe(false);

      // Verify DB was queried with the tenant's ID
      expect(mockQuery).toHaveBeenCalledWith(
        "SELECT flag_name, flag_value FROM feature_flags WHERE company_id = ?",
        ["company-aaa"],
      );
    });

    it("Tests R-B1-22 — returns all flags as false when DB has no overrides", async () => {
      mockQuery.mockResolvedValueOnce([[]]);

      const app = createApp();
      const res = await request(app)
        .get("/api/feature-flags")
        .set("Authorization", "Bearer valid-token")
        .expect(200);

      expect(res.body.FEATURE_TRUCKER_MOBILE_BETA).toBe(false);
      expect(res.body.FEATURE_ELD_INTEGRATION).toBe(false);
      expect(res.body.FEATURE_OFFLINE_SYNC).toBe(false);
      expect(res.body.FEATURE_AI_DOCUMENT_SCAN).toBe(false);
      expect(res.body.FEATURE_FREEMIUM_QUOTA).toBe(false);
      expect(res.body.FEATURE_FORCE_UPGRADE).toBe(false);
    });

    it("Tests R-B1-22 — returns 401 without auth token", async () => {
      const app = createApp();
      const res = await request(app).get("/api/feature-flags").expect(401);

      expect(res.body.error_code).toBe("AUTH_MISSING_001");
    });
  });

  // ── R-B1-23: PUT requires admin; non-admin → 403 ────────────────────

  describe("PUT /api/feature-flags/:name", () => {
    it("Tests R-B1-23 — non-admin user receives HTTP 403", async () => {
      // Override to non-admin role
      mockResolveSqlPrincipalByFirebaseUid.mockResolvedValueOnce({
        ...DEFAULT_SQL_PRINCIPAL,
        role: "driver",
      });

      const app = createApp();
      const res = await request(app)
        .put("/api/feature-flags/FEATURE_TRUCKER_MOBILE_BETA")
        .set("Authorization", "Bearer valid-token")
        .send({ value: true })
        .expect(403);

      expect(res.body.error_code).toBe("FEATURE_FLAG_ADMIN_ONLY");
      expect(res.body.message).toMatch(/admin/i);
    });

    it("Tests R-B1-23 — admin user can set a flag value", async () => {
      // Admin user (default fixture)
      mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }]);

      const app = createApp();
      const res = await request(app)
        .put("/api/feature-flags/FEATURE_TRUCKER_MOBILE_BETA")
        .set("Authorization", "Bearer valid-token")
        .send({ value: true })
        .expect(200);

      expect(res.body.flag_name).toBe("FEATURE_TRUCKER_MOBILE_BETA");
      expect(res.body.flag_value).toBe(true);
      expect(res.body.updated).toBe(true);

      // Verify the INSERT ... ON DUPLICATE KEY UPDATE was called
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO feature_flags"),
        ["company-aaa", "FEATURE_TRUCKER_MOBILE_BETA", 1, "test@test.com"],
      );
    });

    it("Tests R-B1-23 — dispatcher role also gets 403", async () => {
      mockResolveSqlPrincipalByFirebaseUid.mockResolvedValueOnce({
        ...DEFAULT_SQL_PRINCIPAL,
        role: "dispatcher",
      });

      const app = createApp();
      const res = await request(app)
        .put("/api/feature-flags/FEATURE_ELD_INTEGRATION")
        .set("Authorization", "Bearer valid-token")
        .send({ value: false })
        .expect(403);

      expect(res.status).toBe(403);
    });
  });

  // ── R-B1-24: server/index.ts mount line via fs.readFileSync + regex ──

  describe("server/index.ts mount line", () => {
    it("Tests R-B1-24 — index.ts contains featureFlagsRouter import", () => {
      const indexPath = path.resolve(__dirname, "../../index.ts");
      const source = fs.readFileSync(indexPath, "utf-8");
      expect(source).toMatch(
        /import\s+featureFlagsRouter\s+from\s+["']\.\/routes\/feature-flags["']/,
      );
    });

    it("Tests R-B1-24 — index.ts contains app.use('/api/feature-flags', featureFlagsRouter) mount", () => {
      const indexPath = path.resolve(__dirname, "../../index.ts");
      const source = fs.readFileSync(indexPath, "utf-8");
      expect(source).toMatch(
        /app\.use\(\s*["']\/api\/feature-flags["']\s*,\s*featureFlagsRouter\s*\)/,
      );
    });
  });
});
