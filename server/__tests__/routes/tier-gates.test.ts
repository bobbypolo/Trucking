/**
 * tier-gates.test.ts — Integration tests for S-502 tier enforcement on routes.
 *
 * Tests R-P5-06, R-P5-07, R-P5-08
 *
 * Verifies that:
 * - AI endpoints require Automation Pro+ tier (R-P5-06)
 * - Base CRUD (loads, quotes, invoices) remain accessible to Records Vault (R-P5-07)
 * - GPS tracking requires Fleet Core+ tier (R-P5-08)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import express, { type Express, type Request, type Response, type NextFunction } from "express";
import request from "supertest";

// ---- Hoisted mocks (vi.hoisted runs before vi.mock factories) ----
const { mockExecute, mockQuery, getMockUser, setMockUser } = vi.hoisted(
  () => {
    let _mockUser: any = null;
    return {
      mockExecute: vi.fn(),
      mockQuery: vi.fn(),
      getMockUser: () => _mockUser,
      setMockUser: (u: any) => {
        _mockUser = u;
      },
    };
  },
);

// ---- Mock DB ----
vi.mock("../../db", () => ({
  default: { execute: mockExecute, query: mockQuery },
}));

// ---- Mock requireAuth to inject a fake user ----
vi.mock("../../middleware/requireAuth", () => ({
  requireAuth: (req: any, _res: any, next: any) => {
    const u = getMockUser();
    if (u) {
      req.user = u;
    }
    next();
  },
}));

// ---- Mock requireTenant ----
vi.mock("../../middleware/requireTenant", () => ({
  requireTenant: (_req: any, _res: any, next: any) => {
    next();
  },
}));

// ---- Mock Gemini service ----
vi.mock("../../services/gemini.service", () => ({
  extractLoadInfo: vi.fn().mockResolvedValue({ loadNumber: "L-001" }),
  extractBrokerFromImage: vi.fn().mockResolvedValue({ name: "Test Broker" }),
  extractEquipmentFromImage: vi.fn().mockResolvedValue({ type: "Flatbed" }),
  generateTrainingFromImage: vi.fn().mockResolvedValue({ questions: [] }),
  analyzeSafetyCompliance: vi.fn().mockResolvedValue({ score: 95 }),
}));

// ---- Mock GPS provider ----
vi.mock("../../services/gps", () => ({
  getGpsProvider: () => ({
    getVehicleLocations: vi.fn().mockResolvedValue([]),
  }),
}));

// ---- Mock logger ----
vi.mock("../../lib/logger", () => ({
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

// ---- Mock validate middleware ----
vi.mock("../../middleware/validate", () => ({
  validateBody: () => (_req: any, _res: any, next: any) => next(),
}));

// ---- Mock idempotency middleware (factory pattern: idempotencyMiddleware() returns middleware) ----
vi.mock("../../middleware/idempotency", () => ({
  idempotencyMiddleware: () => (_req: any, _res: any, next: any) => next(),
}));

// ---- Mock helpers ----
vi.mock("../../helpers", () => ({
  redactData: (d: any) => d,
  getVisibilitySettings: vi.fn().mockResolvedValue({}),
  sendNotification: vi.fn(),
  checkBreakdownLateness: vi.fn(),
}));

// ---- Mock load service ----
vi.mock("../../services/load.service", () => ({
  loadService: {
    transition: vi.fn().mockResolvedValue({}),
  },
}));

// ---- Mock load-state-machine ----
vi.mock("../../services/load-state-machine", () => ({
  LoadStatus: {
    PLANNED: "planned",
    DISPATCHED: "dispatched",
    IN_TRANSIT: "in_transit",
  },
}));

// ---- Mock geocoding service ----
vi.mock("../../services/geocoding.service", () => ({
  geocodeStopAddress: vi.fn().mockResolvedValue(null),
}));

// ---- Mock schemas ----
vi.mock("../../schemas/loads", () => ({
  createLoadSchema: { parse: (d: any) => d },
  updateLoadStatusSchema: { parse: (d: any) => d },
}));

import aiRouter from "../../routes/ai";
import trackingRouter from "../../routes/tracking";
import loadsRouter from "../../routes/loads";

function makeUser(tier: string = "Records Vault") {
  return {
    id: "user-1",
    uid: "user-1",
    tenantId: "company-1",
    companyId: "company-1",
    role: "dispatcher",
    email: "user@test.com",
    firebaseUid: "fb-uid-1",
  };
}

function setupTierResponse(tier: string, status: string = "active") {
  mockExecute.mockResolvedValue([
    [{ subscription_tier: tier, subscription_status: status }],
  ]);
}

// ---- Build an Express app with all three route groups ----
function createApp(): Express {
  const app = express();
  app.use(express.json());
  app.use("/api/ai", aiRouter);
  app.use(trackingRouter);
  app.use(loadsRouter);
  return app;
}

// ---- TESTS ----

describe("R-P5-06: AI endpoints return 403 for Records Vault, 200 for Automation Pro", () => {
  let app: Express;

  beforeEach(() => {
    vi.clearAllMocks();
    app = createApp();
  });

  it("returns 403 when Records Vault user hits /api/ai/extract-load", async () => {
    setMockUser(makeUser());
    setupTierResponse("Records Vault");

    const res = await request(app)
      .post("/api/ai/extract-load")
      .send({ imageBase64: "dGVzdA==" })
      .expect(403);

    expect(res.body).toHaveProperty("error_code", "TIER_INSUFFICIENT_001");
    expect(res.body).toHaveProperty("current_tier", "Records Vault");
    expect(res.body.required_tiers).toContain("Automation Pro");
  });

  it("returns 200 when Automation Pro user hits /api/ai/extract-load", async () => {
    setMockUser(makeUser());
    setupTierResponse("Automation Pro");

    const res = await request(app)
      .post("/api/ai/extract-load")
      .send({ imageBase64: "dGVzdA==" })
      .expect(200);

    expect(res.body).toHaveProperty("loadInfo");
  });

  it("returns 403 for Records Vault on /api/ai/extract-broker", async () => {
    setMockUser(makeUser());
    setupTierResponse("Records Vault");

    await request(app)
      .post("/api/ai/extract-broker")
      .send({ imageBase64: "dGVzdA==" })
      .expect(403);
  });

  it("returns 200 for Fleet Command on /api/ai/analyze-safety", async () => {
    setMockUser(makeUser());
    setupTierResponse("Fleet Command");

    const res = await request(app)
      .post("/api/ai/analyze-safety")
      .send({ data: { activityHistory: [], performance: {} } })
      .expect(200);

    expect(res.body).toHaveProperty("analysis");
  });
});

describe("R-P5-07: Base CRUD endpoints accessible by Records Vault tier (regression)", () => {
  let app: Express;

  beforeEach(() => {
    vi.clearAllMocks();
    app = createApp();
  });

  it("Records Vault user can GET /api/loads (no 403)", async () => {
    setMockUser(makeUser());
    setupTierResponse("Records Vault");
    // Mock the loads query to return empty
    mockQuery.mockResolvedValue([[]]);

    const res = await request(app).get("/api/loads");

    // Must NOT be 403 — base tier endpoints are ungated
    expect(res.status).not.toBe(403);
  });
});

describe("R-P5-08: GPS tracking returns 403 for Records Vault and Automation Pro, 200 for Fleet Core+", () => {
  let app: Express;

  beforeEach(() => {
    vi.clearAllMocks();
    app = createApp();
  });

  it("returns 403 when Records Vault user hits /api/tracking/live", async () => {
    setMockUser(makeUser());
    setupTierResponse("Records Vault");

    const res = await request(app).get("/api/tracking/live").expect(403);

    expect(res.body).toHaveProperty("error_code", "TIER_INSUFFICIENT_001");
    expect(res.body).toHaveProperty("current_tier", "Records Vault");
  });

  it("returns 403 when Automation Pro user hits /api/tracking/live", async () => {
    setMockUser(makeUser());
    setupTierResponse("Automation Pro");

    const res = await request(app).get("/api/tracking/live").expect(403);

    expect(res.body).toHaveProperty("error_code", "TIER_INSUFFICIENT_001");
    expect(res.body).toHaveProperty("current_tier", "Automation Pro");
  });

  it("returns 200 when Fleet Core user hits /api/tracking/live", async () => {
    setMockUser(makeUser());
    setupTierResponse("Fleet Core");

    const res = await request(app).get("/api/tracking/live").expect(200);

    expect(res.body).toHaveProperty("positions");
  });

  it("returns 200 when Fleet Command user hits /api/tracking/live", async () => {
    setMockUser(makeUser());
    setupTierResponse("Fleet Command");

    const res = await request(app).get("/api/tracking/live").expect(200);

    expect(res.body).toHaveProperty("positions");
  });

  it("returns 403 when Records Vault user hits /api/loads/tracking", async () => {
    setMockUser(makeUser());
    setupTierResponse("Records Vault");

    const res = await request(app).get("/api/loads/tracking").expect(403);

    expect(res.body).toHaveProperty("error_code", "TIER_INSUFFICIENT_001");
  });

  it("returns 200 when Fleet Core user hits /api/loads/tracking", async () => {
    setMockUser(makeUser());
    setupTierResponse("Fleet Core");
    mockQuery.mockResolvedValue([[]]);

    const res = await request(app).get("/api/loads/tracking").expect(200);

    expect(Array.isArray(res.body)).toBe(true);
  });
});
