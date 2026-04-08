import { describe, it, expect, vi, beforeEach } from "vitest";

// Tests R-P5-02-AC1, R-P5-02-AC2

// Hoisted mocks for pool.query and sql-auth
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

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(incidentsRouter);
  app.use(errorHandler);
  return app;
}

const AUTH_HEADER = "Bearer valid-firebase-token";

describe("GET /api/incidents — authentication", () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    app = buildApp();
    vi.clearAllMocks();
  });

  it("returns 401 without Authorization header", async () => {
    const res = await request(app).get("/api/incidents");
    expect(res.status).toBe(401);
  });
});

describe("GET /api/incidents", () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    app = buildApp();
    vi.clearAllMocks();
  });

  it("returns incidents list with 200", async () => {
    const incidents = [
      {
        id: "inc-001",
        company_id: "company-aaa",
        load_id: "load-001",
        type: "Breakdown",
        severity: "High",
        status: "Open",
        reported_at: "2026-03-08T00:00:00.000Z",
      },
    ];

    // findByCompany: SELECT * FROM incidents WHERE company_id = ? (C4 fix — tenant-scoped)
    mockQuery.mockResolvedValueOnce([incidents, []]);

    const res = await request(app)
      .get("/api/incidents")
      .set("Authorization", AUTH_HEADER);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(1);
  });

  it("returns 500 on database error", async () => {
    mockQuery.mockRejectedValueOnce(new Error("DB connection error"));

    const res = await request(app)
      .get("/api/incidents")
      .set("Authorization", AUTH_HEADER);

    expect(res.status).toBe(500);
  });
});

describe("POST /api/incidents", () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    app = buildApp();
    vi.clearAllMocks();
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(
      DEFAULT_SQL_PRINCIPAL,
    );
  });

  it("returns 401 without Authorization header", async () => {
    const res = await request(app).post("/api/incidents").send({
      load_id: "load-001",
      type: "Breakdown",
      severity: "High",
      description: "Test",
    });
    expect(res.status).toBe(401);
  });

  it("returns 400 when load_id does not exist", async () => {
    // SELECT to check load existence: returns empty
    mockQuery.mockResolvedValueOnce([[], []]);

    const res = await request(app)
      .post("/api/incidents")
      .set("Authorization", AUTH_HEADER)
      .send({
        load_id: "nonexistent",
        type: "Breakdown",
        severity: "High",
        description: "Test incident",
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/FK Violation/i);
  });

  it("creates incident and returns 201", async () => {
    const createdIncident = {
      id: "new-inc-uuid",
      company_id: "company-aaa",
      load_id: "load-001",
      type: "Breakdown",
      severity: "High",
      status: "Open",
      reported_at: "2026-03-08T00:00:00.000Z",
      sla_deadline: null,
      description: "Engine failure on I-90",
      location_lat: null,
      location_lng: null,
      recovery_plan: null,
    };

    // SELECT to check load existence: found
    mockQuery.mockResolvedValueOnce([[{ id: "load-001" }], []]);
    // incidentRepository.create -> INSERT
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }, []]);
    // incidentRepository.create -> SELECT (findById to return created record)
    mockQuery.mockResolvedValueOnce([[createdIncident], []]);

    const res = await request(app)
      .post("/api/incidents")
      .set("Authorization", AUTH_HEADER)
      .send({
        load_id: "load-001",
        type: "Breakdown",
        severity: "High",
        status: "Open",
        description: "Engine failure on I-90",
      });

    expect(res.status).toBe(201);
    expect(res.body.message).toBe("Incident created");
  });
});

// STORY-005: Cross-tenant charge tests
describe("POST /api/incidents/:id/charges — tenant isolation", () => {
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
      .post("/api/incidents/inc-001/charges")
      .send({ category: "Tow", amount: 500 });
    expect(res.status).toBe(401);
  });

  it("returns 404 when incident does not exist", async () => {
    // SELECT company_id FROM incidents WHERE id = ? → empty
    mockQuery.mockResolvedValueOnce([[], []]);

    const res = await request(app)
      .post("/api/incidents/nonexistent/charges")
      .set("Authorization", AUTH_HEADER)
      .send({ category: "Tow", amount: 500 });
    expect(res.status).toBe(404);
  });

  it("returns 404 for cross-tenant charge attempt (conceals existence)", async () => {
    // SELECT company_id FROM incidents WHERE id = ? → belongs to different tenant
    mockQuery.mockResolvedValueOnce([
      [{ company_id: "company-DIFFERENT" }],
      [],
    ]);

    const res = await request(app)
      .post("/api/incidents/inc-001/charges")
      .set("Authorization", AUTH_HEADER)
      .send({ category: "Tow", amount: 500 });
    expect(res.status).toBe(404);
    expect(res.body.message).toBe("Incident not found");
  });

  it("returns 201 for same-tenant charge", async () => {
    // SELECT company_id FROM incidents WHERE id = ? → same tenant
    mockQuery.mockResolvedValueOnce([[{ company_id: "company-aaa" }], []]);
    // INSERT INTO emergency_charges
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }, []]);

    const res = await request(app)
      .post("/api/incidents/inc-001/charges")
      .set("Authorization", AUTH_HEADER)
      .send({
        category: "Tow",
        amount: 500,
        provider_vendor: "AAA Towing",
        status: "approved",
      });
    expect(res.status).toBe(201);
    expect(res.body.message).toBe("Charge recorded");
  });
});
