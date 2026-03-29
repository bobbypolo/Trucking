import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

/**
 * Tests R-P3-05: Webhook with missing companyId returns 400
 * Tests R-P3-06: Webhook with unknown companyId returns 400
 * Tests R-P3-07: No rows in tracking tables have company_id = 'unresolved'
 * Tests R-P3-08: Rejected webhook logs contain only redacted fields
 * Tests R-P3-09: Metrics counter incremented on rejection
 */

const { mockQuery } = vi.hoisted(() => {
  const mockQuery = vi.fn();
  return { mockQuery };
});

vi.mock("../../db", () => ({
  default: {
    query: mockQuery,
  },
}));

// Mock firebase-admin (webhook route doesn't use Firebase auth, but the router imports it)
vi.mock("firebase-admin", () => {
  const mockAuth = {
    verifyIdToken: vi.fn().mockResolvedValue({ uid: "firebase-uid-1" }),
  };
  const mockFirestore = {
    collection: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockReturnValue({
          get: vi.fn().mockResolvedValue({
            empty: false,
            docs: [
              {
                id: "user-1",
                data: () => ({
                  id: "user-1",
                  company_id: "company-aaa",
                  role: "admin",
                  email: "test@test.com",
                }),
              },
            ],
          }),
        }),
      }),
    }),
  };
  return {
    default: {
      app: vi.fn(),
      auth: () => mockAuth,
      firestore: () => mockFirestore,
    },
  };
});

vi.mock("../../lib/sql-auth", () => ({
  resolveSqlPrincipalByFirebaseUid: vi.fn().mockResolvedValue({
    id: "1",
    tenantId: "company-aaa",
    companyId: "company-aaa",
    role: "admin",
    email: "test@test.com",
    firebaseUid: "firebase-uid-1",
  }),
}));

// Mock requireTier to pass-through
vi.mock("../../middleware/requireTier", () => ({
  requireTier:
    () => (_req: any, _res: any, next: any) =>
      next(),
}));

// Capture log output for redaction verification
const logWarnCalls: Array<{ args: Record<string, any>; msg: string }> = [];
vi.mock("../../lib/logger", () => ({
  createChildLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn((...warnArgs: any[]) => {
      // pino-style: first arg is object, second is message string
      logWarnCalls.push({
        args: warnArgs[0] as Record<string, any>,
        msg: typeof warnArgs[1] === "string" ? warnArgs[1] : "",
      });
    }),
    debug: vi.fn(),
  }),
}));

import trackingRouter, {
  getWebhookRejectionCount,
  resetWebhookRejectionMetrics,
} from "../../routes/tracking";

const GPS_API_KEY = "test-webhook-secret-key";

function createApp() {
  const app = express();
  app.use(express.json());
  app.use(trackingRouter);
  return app;
}

describe("S-3.2: Webhook Tenant Resolution Hardening", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    logWarnCalls.length = 0;
    resetWebhookRejectionMetrics();
    process.env.GPS_WEBHOOK_SECRET = GPS_API_KEY;
  });

  // Tests R-P3-05
  describe("R-P3-05: Webhook with missing companyId returns 400", () => {
    it("returns 400 with error 'company_id required' when companyId is omitted", async () => {
      const app = createApp();
      const res = await request(app)
        .post("/api/tracking/webhook")
        .set("X-GPS-API-Key", GPS_API_KEY)
        .send({
          vehicleId: "V-001",
          latitude: 40.7128,
          longitude: -74.006,
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("company_id required");
    });

    it("returns 400 when companyId is empty string", async () => {
      const app = createApp();
      const res = await request(app)
        .post("/api/tracking/webhook")
        .set("X-GPS-API-Key", GPS_API_KEY)
        .send({
          vehicleId: "V-002",
          latitude: 41.0,
          longitude: -87.0,
          companyId: "",
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("company_id required");
    });

    it("does not insert any row into gps_positions when companyId is missing", async () => {
      const app = createApp();
      await request(app)
        .post("/api/tracking/webhook")
        .set("X-GPS-API-Key", GPS_API_KEY)
        .send({
          vehicleId: "V-003",
          latitude: 33.45,
          longitude: -112.07,
        });

      // mockQuery should NOT have been called for INSERT
      const insertCalls = mockQuery.mock.calls.filter(
        (call: any[]) =>
          typeof call[0] === "string" &&
          call[0].includes("INSERT INTO gps_positions"),
      );
      expect(insertCalls).toHaveLength(0);
    });
  });

  // Tests R-P3-06
  describe("R-P3-06: Webhook with unknown companyId returns 400", () => {
    it("returns 400 with error 'unknown company_id' when companyId does not match any tenant", async () => {
      // Company lookup returns empty result set
      mockQuery.mockResolvedValueOnce([[], []]);

      const app = createApp();
      const res = await request(app)
        .post("/api/tracking/webhook")
        .set("X-GPS-API-Key", GPS_API_KEY)
        .send({
          vehicleId: "V-004",
          latitude: 34.0522,
          longitude: -118.2437,
          companyId: "nonexistent-tenant-xyz",
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("unknown company_id");
    });

    it("returns 400 when company lookup throws a database error", async () => {
      // Simulate DB error during company validation
      mockQuery.mockRejectedValueOnce(new Error("Connection lost"));

      const app = createApp();
      const res = await request(app)
        .post("/api/tracking/webhook")
        .set("X-GPS-API-Key", GPS_API_KEY)
        .send({
          vehicleId: "V-005",
          latitude: 29.7604,
          longitude: -95.3698,
          companyId: "tenant-with-db-error",
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("unknown company_id");
    });

    it("does not insert any row into gps_positions when companyId is unknown", async () => {
      mockQuery.mockResolvedValueOnce([[], []]);

      const app = createApp();
      await request(app)
        .post("/api/tracking/webhook")
        .set("X-GPS-API-Key", GPS_API_KEY)
        .send({
          vehicleId: "V-006",
          latitude: 37.7749,
          longitude: -122.4194,
          companyId: "ghost-company",
        });

      // Only 1 call should have been made (the company lookup), no INSERT
      const insertCalls = mockQuery.mock.calls.filter(
        (call: any[]) =>
          typeof call[0] === "string" &&
          call[0].includes("INSERT INTO gps_positions"),
      );
      expect(insertCalls).toHaveLength(0);
    });
  });

  // Tests R-P3-07
  describe("R-P3-07: No rows have company_id = 'unresolved'", () => {
    it("successful webhook stores the validated companyId, not 'unresolved'", async () => {
      // Company lookup succeeds
      mockQuery.mockResolvedValueOnce([[{ id: "company-aaa" }], []]);
      // INSERT succeeds
      mockQuery.mockResolvedValueOnce([{ insertId: 1 }, []]);

      const app = createApp();
      const res = await request(app)
        .post("/api/tracking/webhook")
        .set("X-GPS-API-Key", GPS_API_KEY)
        .send({
          vehicleId: "V-010",
          latitude: 41.8781,
          longitude: -87.6298,
          companyId: "company-aaa",
        });

      expect(res.status).toBe(201);

      // Verify the INSERT was called with the real companyId, not "unresolved"
      const insertCalls = mockQuery.mock.calls.filter(
        (call: any[]) =>
          typeof call[0] === "string" &&
          call[0].includes("INSERT INTO gps_positions"),
      );
      expect(insertCalls).toHaveLength(1);

      const insertParams = insertCalls[0][1] as any[];
      // company_id is the 2nd parameter (index 1) in the VALUES list
      expect(insertParams[1]).toBe("company-aaa");
      expect(insertParams[1]).not.toBe("unresolved");
    });

    it("source code does not use 'unresolved' as a company_id value", async () => {
      // Static analysis: read the tracking.ts source and verify
      // no assignment of "unresolved" to resolvedCompanyId or company_id
      const fs = await import("fs");
      const path = await import("path");
      const trackingSource = fs.readFileSync(
        path.resolve(__dirname, "../../routes/tracking.ts"),
        "utf8",
      );

      // Check there's no assignment like: = "unresolved" or = 'unresolved'
      const unresolvedAssignments = trackingSource.match(
        /=\s*["']unresolved["']/g,
      );
      expect(unresolvedAssignments).toBeNull();
    });
  });

  // Tests R-P3-08
  describe("R-P3-08: Rejected webhook logs contain only redacted fields", () => {
    it("log for missing companyId contains truncated coordinates (2 decimal places)", async () => {
      const app = createApp();
      await request(app)
        .post("/api/tracking/webhook")
        .set("X-GPS-API-Key", GPS_API_KEY)
        .send({
          vehicleId: "V-020",
          latitude: 40.712776,
          longitude: -74.005974,
        });

      // Find the rejection log entry
      const rejectionLog = logWarnCalls.find((l) =>
        l.msg.includes("missing company_id"),
      );
      expect(rejectionLog).toBeDefined();

      // Verify coordinates are truncated to 2 decimal places
      expect(rejectionLog!.args.lat).toBe("40.71");
      expect(rejectionLog!.args.lng).toBe("-74.01");

      // Verify no raw high-precision coordinates in the log
      expect(JSON.stringify(rejectionLog!.args)).not.toContain("40.712776");
      expect(JSON.stringify(rejectionLog!.args)).not.toContain("-74.005974");
    });

    it("log for unknown companyId does not contain api_token or webhook_secret", async () => {
      mockQuery.mockResolvedValueOnce([[], []]);

      const app = createApp();
      await request(app)
        .post("/api/tracking/webhook")
        .set("X-GPS-API-Key", GPS_API_KEY)
        .send({
          vehicleId: "V-021",
          latitude: 34.052235,
          longitude: -118.243683,
          companyId: "unknown-tenant",
        });

      const rejectionLog = logWarnCalls.find((l) =>
        l.msg.includes("unknown company_id"),
      );
      expect(rejectionLog).toBeDefined();

      const logStr = JSON.stringify(rejectionLog!.args);
      // Must NOT contain API key or any secret
      expect(logStr).not.toContain(GPS_API_KEY);
      expect(logStr).not.toContain("api_token");
      expect(logStr).not.toContain("webhook_secret");

      // Must contain only redacted (truncated) coordinates
      expect(rejectionLog!.args.lat).toBe("34.05");
      expect(rejectionLog!.args.lng).toBe("-118.24");
      expect(logStr).not.toContain("34.052235");
      expect(logStr).not.toContain("-118.243683");
    });

    it("log contains vehicleId and provider name for debugging", async () => {
      const app = createApp();
      await request(app)
        .post("/api/tracking/webhook")
        .set("X-GPS-API-Key", GPS_API_KEY)
        .send({
          vehicleId: "V-022",
          latitude: 29.760427,
          longitude: -95.369804,
        });

      const rejectionLog = logWarnCalls.find((l) =>
        l.msg.includes("missing company_id"),
      );
      expect(rejectionLog).toBeDefined();
      expect(rejectionLog!.args.vehicleId).toBe("V-022");
      expect(rejectionLog!.args.provider).toBe("webhook");
    });
  });

  // Tests R-P3-09
  describe("R-P3-09: Metrics counter incremented on rejection", () => {
    it("increments missing_company_id counter when companyId is missing", async () => {
      const app = createApp();

      const countBefore = getWebhookRejectionCount("missing_company_id");
      expect(countBefore).toBe(0);

      await request(app)
        .post("/api/tracking/webhook")
        .set("X-GPS-API-Key", GPS_API_KEY)
        .send({
          vehicleId: "V-030",
          latitude: 40.0,
          longitude: -74.0,
        });

      const countAfter = getWebhookRejectionCount("missing_company_id");
      expect(countAfter).toBe(1);
    });

    it("increments unknown_company_id counter when companyId is not found", async () => {
      mockQuery.mockResolvedValueOnce([[], []]);

      const app = createApp();

      const countBefore = getWebhookRejectionCount("unknown_company_id");
      expect(countBefore).toBe(0);

      await request(app)
        .post("/api/tracking/webhook")
        .set("X-GPS-API-Key", GPS_API_KEY)
        .send({
          vehicleId: "V-031",
          latitude: 41.0,
          longitude: -87.0,
          companyId: "no-such-tenant",
        });

      const countAfter = getWebhookRejectionCount("unknown_company_id");
      expect(countAfter).toBe(1);
    });

    it("increments counter on each subsequent rejection", async () => {
      const app = createApp();

      // Send 3 requests with missing companyId
      for (let i = 0; i < 3; i++) {
        await request(app)
          .post("/api/tracking/webhook")
          .set("X-GPS-API-Key", GPS_API_KEY)
          .send({
            vehicleId: `V-${32 + i}`,
            latitude: 40.0,
            longitude: -74.0,
          });
      }

      const count = getWebhookRejectionCount("missing_company_id");
      expect(count).toBe(3);
    });

    it("tracks different rejection reasons independently", async () => {
      const app = createApp();

      // 2 missing companyId rejections
      await request(app)
        .post("/api/tracking/webhook")
        .set("X-GPS-API-Key", GPS_API_KEY)
        .send({ vehicleId: "V-40", latitude: 40.0, longitude: -74.0 });
      await request(app)
        .post("/api/tracking/webhook")
        .set("X-GPS-API-Key", GPS_API_KEY)
        .send({ vehicleId: "V-41", latitude: 41.0, longitude: -73.0 });

      // 1 unknown companyId rejection
      mockQuery.mockResolvedValueOnce([[], []]);
      await request(app)
        .post("/api/tracking/webhook")
        .set("X-GPS-API-Key", GPS_API_KEY)
        .send({
          vehicleId: "V-42",
          latitude: 42.0,
          longitude: -72.0,
          companyId: "unknown",
        });

      expect(getWebhookRejectionCount("missing_company_id")).toBe(2);
      expect(getWebhookRejectionCount("unknown_company_id")).toBe(1);
    });

    it("does not increment counter for successful webhook", async () => {
      // Company lookup succeeds
      mockQuery.mockResolvedValueOnce([[{ id: "company-aaa" }], []]);
      // INSERT succeeds
      mockQuery.mockResolvedValueOnce([{ insertId: 1 }, []]);

      const app = createApp();
      await request(app)
        .post("/api/tracking/webhook")
        .set("X-GPS-API-Key", GPS_API_KEY)
        .send({
          vehicleId: "V-50",
          latitude: 40.0,
          longitude: -74.0,
          companyId: "company-aaa",
        });

      expect(getWebhookRejectionCount("missing_company_id")).toBe(0);
      expect(getWebhookRejectionCount("unknown_company_id")).toBe(0);
    });
  });
});
