import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Incidents Route Hardening Tests
 *
 * Covers previously uncovered lines in incidents.ts:
 * - POST /api/incidents: DB error on load check, DB error on insert
 * - POST /api/incidents/:id/actions: incident not found, success, DB error
 * - POST /api/incidents/:id/charges: DB error path
 * - GET /api/incidents: empty list, DB error
 */

const { mockQuery, mockResolveSqlPrincipalByFirebaseUid } = vi.hoisted(() => {
  const mockQuery = vi.fn();
  const mockResolveSqlPrincipalByFirebaseUid = vi.fn();
  return { mockQuery, mockResolveSqlPrincipalByFirebaseUid };
});

vi.mock("../../db", () => ({
  default: {
    query: mockQuery,
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
                  role: "dispatcher",
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
  resolveSqlPrincipalByFirebaseUid: mockResolveSqlPrincipalByFirebaseUid,
}));
vi.mock("../../lib/token-revocation", () => ({
  isTokenRevoked: vi.fn().mockResolvedValue(false),
}));

import express from "express";
import request from "supertest";
import incidentsRouter from "../../routes/incidents";
import { errorHandler } from "../../middleware/errorHandler";
import { DEFAULT_SQL_PRINCIPAL } from "../helpers/mock-sql-auth";

mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(DEFAULT_SQL_PRINCIPAL);

const AUTH_HEADER = "Bearer valid-firebase-token";

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(incidentsRouter);
  app.use(errorHandler);
  return app;
}

// ── GET /api/incidents — additional edge cases ──────────────────────

describe("GET /api/incidents — hardening", () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    app = buildApp();
    vi.clearAllMocks();
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(
      DEFAULT_SQL_PRINCIPAL,
    );
  });

  it("returns empty incidents array when none exist", async () => {
    mockQuery.mockResolvedValueOnce([[], []]);

    const res = await request(app)
      .get("/api/incidents")
      .set("Authorization", AUTH_HEADER);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(0);
  });
});

// ── POST /api/incidents — DB error paths ────────────────────────────

describe("POST /api/incidents — error paths", () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    app = buildApp();
    vi.clearAllMocks();
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(
      DEFAULT_SQL_PRINCIPAL,
    );
  });

  it("returns 500 when load existence check throws DB error", async () => {
    mockQuery.mockRejectedValueOnce(new Error("DB read error"));

    const res = await request(app)
      .post("/api/incidents")
      .set("Authorization", AUTH_HEADER)
      .send({
        load_id: "load-001",
        type: "Breakdown",
        severity: "High",
        description: "Test DB error",
      });

    expect(res.status).toBe(500);
    expect(res.body.message).toBeDefined();
  });

  it("returns 500 when incident INSERT throws DB error", async () => {
    // Load exists
    mockQuery.mockResolvedValueOnce([[{ id: "load-001" }], []]);
    // INSERT fails
    mockQuery.mockRejectedValueOnce(new Error("DB insert failed"));

    const res = await request(app)
      .post("/api/incidents")
      .set("Authorization", AUTH_HEADER)
      .send({
        load_id: "load-001",
        type: "Breakdown",
        severity: "High",
        description: "Engine failure",
      });

    expect(res.status).toBe(500);
    expect(res.body.message).toBeDefined();
  });

  it("creates incident with optional fields", async () => {
    const createdIncident = {
      id: "inc-new",
      company_id: "company-aaa",
      load_id: "load-001",
      type: "Delay",
      severity: "Medium",
      status: "Open",
      sla_deadline: "2026-03-20T12:00:00Z",
      description: "Weather delay",
      location_lat: 41.8781,
      location_lng: -87.6298,
      recovery_plan: "Wait for conditions to improve",
    };

    mockQuery.mockResolvedValueOnce([[{ id: "load-001" }], []]);
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }, []]);
    mockQuery.mockResolvedValueOnce([[createdIncident], []]);

    const res = await request(app)
      .post("/api/incidents")
      .set("Authorization", AUTH_HEADER)
      .send({
        load_id: "load-001",
        type: "Delay",
        severity: "Medium",
        status: "Open",
        sla_deadline: "2026-03-20T12:00:00Z",
        description: "Weather delay",
        location_lat: 41.8781,
        location_lng: -87.6298,
        recovery_plan: "Wait for conditions to improve",
      });

    expect(res.status).toBe(201);
    expect(res.body.message).toBe("Incident created");
  });
});

// ── POST /api/incidents/:id/actions — full coverage ─────────────────

describe("POST /api/incidents/:id/actions — full coverage", () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    app = buildApp();
    vi.clearAllMocks();
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(
      DEFAULT_SQL_PRINCIPAL,
    );
  });

  it("returns 401 without Authorization header", async () => {
    const res = await request(app)
      .post("/api/incidents/inc-001/actions")
      .send({ actor_name: "Test", action: "Contacted driver" });
    expect(res.status).toBe(401);
  });

  it("returns 404 when incident does not exist (null from findById)", async () => {
    // incidentRepository.findById → SELECT returns empty
    mockQuery.mockResolvedValueOnce([[], []]);

    const res = await request(app)
      .post("/api/incidents/nonexistent/actions")
      .set("Authorization", AUTH_HEADER)
      .send({
        actor_name: "Dispatcher",
        action: "Contacted driver",
        notes: "Called driver at scene",
      });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Not Found");
  });

  it("returns 404 when incident belongs to different tenant", async () => {
    // findById with companyId filter → no match for cross-tenant
    mockQuery.mockResolvedValueOnce([[], []]);

    const res = await request(app)
      .post("/api/incidents/inc-cross-tenant/actions")
      .set("Authorization", AUTH_HEADER)
      .send({
        actor_name: "Dispatcher",
        action: "Contacted driver",
      });

    expect(res.status).toBe(404);
  });

  it("logs action successfully and returns 201", async () => {
    // findById returns the incident
    mockQuery.mockResolvedValueOnce([
      [
        {
          id: "inc-001",
          company_id: "company-aaa",
          type: "Breakdown",
          status: "Open",
        },
      ],
      [],
    ]);
    // INSERT into incident_actions
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }, []]);

    const res = await request(app)
      .post("/api/incidents/inc-001/actions")
      .set("Authorization", AUTH_HEADER)
      .send({
        actor_name: "John Dispatcher",
        action: "Contacted tow service",
        notes: "ETA 45 minutes",
        attachments: [{ url: "https://example.com/photo.jpg", type: "image" }],
      });

    expect(res.status).toBe(201);
    expect(res.body.message).toBe("Action logged");
  });

  it("returns 500 on DB error during action INSERT", async () => {
    // findById returns the incident
    mockQuery.mockResolvedValueOnce([
      [{ id: "inc-001", company_id: "company-aaa" }],
      [],
    ]);
    // INSERT fails
    mockQuery.mockRejectedValueOnce(new Error("DB insert failed"));

    const res = await request(app)
      .post("/api/incidents/inc-001/actions")
      .set("Authorization", AUTH_HEADER)
      .send({
        actor_name: "Test",
        action: "Test action",
      });

    expect(res.status).toBe(500);
    expect(res.body.message).toBeDefined();
  });
});

// ── POST /api/incidents/:id/charges — additional coverage ───────────

describe("POST /api/incidents/:id/charges — hardening", () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    app = buildApp();
    vi.clearAllMocks();
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(
      DEFAULT_SQL_PRINCIPAL,
    );
  });

  it("returns 500 on DB error during charge INSERT", async () => {
    // SELECT company_id → same tenant
    mockQuery.mockResolvedValueOnce([[{ company_id: "company-aaa" }], []]);
    // INSERT fails
    mockQuery.mockRejectedValueOnce(new Error("DB insert failed"));

    const res = await request(app)
      .post("/api/incidents/inc-001/charges")
      .set("Authorization", AUTH_HEADER)
      .send({
        category: "Tow",
        amount: 500,
        provider_vendor: "AAA Towing",
        status: "pending",
      });

    expect(res.status).toBe(500);
    expect(res.body.message).toBeDefined();
  });

  it("returns 500 on DB error during ownership check", async () => {
    mockQuery.mockRejectedValueOnce(new Error("DB read error"));

    const res = await request(app)
      .post("/api/incidents/inc-001/charges")
      .set("Authorization", AUTH_HEADER)
      .send({ category: "Tow", amount: 500 });

    expect(res.status).toBe(500);
  });

  it("creates charge with all optional fields", async () => {
    mockQuery.mockResolvedValueOnce([[{ company_id: "company-aaa" }], []]);
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }, []]);

    const res = await request(app)
      .post("/api/incidents/inc-001/charges")
      .set("Authorization", AUTH_HEADER)
      .send({
        category: "Tow",
        amount: 750,
        provider_vendor: "Quick Tow LLC",
        status: "approved",
        approved_by: "manager-001",
        receipt_url: "https://example.com/receipt.pdf",
      });

    expect(res.status).toBe(201);
    expect(res.body.message).toBe("Charge recorded");
  });
});
