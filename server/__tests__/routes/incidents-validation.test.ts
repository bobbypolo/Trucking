import { describe, it, expect, vi, beforeEach } from "vitest";

// Hoisted mocks for pool.query, sql-auth, and incident repository
const {
  mockQuery,
  mockResolveSqlPrincipalByFirebaseUid,
  mockFindByCompany,
  mockFindById,
  mockCreate,
  mockUpdate,
} = vi.hoisted(() => ({
  mockQuery: vi.fn(),
  mockResolveSqlPrincipalByFirebaseUid: vi.fn(),
  mockFindByCompany: vi.fn(),
  mockFindById: vi.fn(),
  mockCreate: vi.fn(),
  mockUpdate: vi.fn(),
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
    verifyIdToken: vi.fn().mockResolvedValue({ uid: "firebase-uid-1" }),
  };
  return {
    default: {
      app: vi.fn(),
      auth: () => mockAuth,
    },
  };
});

vi.mock("../../lib/sql-auth", () => ({
  resolveSqlPrincipalByFirebaseUid: mockResolveSqlPrincipalByFirebaseUid,
}));

vi.mock("../../lib/token-revocation", () => ({
  isTokenRevoked: vi.fn().mockResolvedValue(false),
}));

vi.mock("../../repositories/incident.repository", () => ({
  incidentRepository: {
    findByCompany: mockFindByCompany,
    findById: mockFindById,
    create: mockCreate,
    update: mockUpdate,
  },
}));

vi.mock("../../lib/exception-sync", () => ({
  syncDomainToException: vi.fn().mockResolvedValue(undefined),
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

// Tests R-SEC-15, R-SEC-16, R-SEC-19, R-SEC-20
describe("R-SEC-15, R-SEC-16: incidents.ts validateBody wiring", () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(
      DEFAULT_SQL_PRINCIPAL,
    );
    app = buildApp();
  });

  // Tests R-SEC-19
  it("R-SEC-19: POST /api/incidents with empty body returns 400 VALIDATION error", async () => {
    const res = await request(app)
      .post("/api/incidents")
      .set("Authorization", "Bearer valid-token")
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.error_class).toBe("VALIDATION");
  });

  it("POST /api/incidents with valid body proceeds (not blocked by validation)", async () => {
    mockQuery.mockResolvedValueOnce([[{ id: "load-001" }]]);
    mockCreate.mockResolvedValueOnce({ id: "inc-001" });
    const res = await request(app)
      .post("/api/incidents")
      .set("Authorization", "Bearer valid-token")
      .send({
        load_id: "load-001",
        type: "Safety",
        severity: "High",
        description: "Cargo damage",
      });
    expect(res.status).toBe(201);
  });

  it("POST /api/incidents with missing type returns 400", async () => {
    const res = await request(app)
      .post("/api/incidents")
      .set("Authorization", "Bearer valid-token")
      .send({
        load_id: "load-001",
        severity: "High",
        description: "Missing type",
      });
    expect(res.status).toBe(400);
    expect(res.body.error_class).toBe("VALIDATION");
  });

  it("POST /api/incidents/:id/actions with empty body returns 400", async () => {
    const res = await request(app)
      .post("/api/incidents/inc-001/actions")
      .set("Authorization", "Bearer valid-token")
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.error_class).toBe("VALIDATION");
  });

  it("POST /api/incidents/:id/actions with valid body proceeds", async () => {
    mockFindById.mockResolvedValueOnce({ id: "inc-001" });
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }]);
    const res = await request(app)
      .post("/api/incidents/inc-001/actions")
      .set("Authorization", "Bearer valid-token")
      .send({
        action: "Dispatched road service",
        actor_name: "John Doe",
      });
    expect(res.status).toBe(201);
  });

  it("PATCH /api/incidents/:id with non-number location_lat returns 400", async () => {
    const res = await request(app)
      .patch("/api/incidents/inc-001")
      .set("Authorization", "Bearer valid-token")
      .send({ location_lat: "not-a-number" });
    expect(res.status).toBe(400);
    expect(res.body.error_class).toBe("VALIDATION");
  });

  it("PATCH /api/incidents/:id with valid partial body proceeds", async () => {
    mockFindById.mockResolvedValueOnce({ id: "inc-001", status: "Open" });
    mockUpdate.mockResolvedValueOnce({ id: "inc-001", severity: "Critical" });
    const res = await request(app)
      .patch("/api/incidents/inc-001")
      .set("Authorization", "Bearer valid-token")
      .send({ severity: "Critical" });
    expect(res.status).toBe(200);
  });

  // Tests R-SEC-20
  it("R-SEC-20: POST /api/incidents/:id/charges with amount:-5 returns 400", async () => {
    const res = await request(app)
      .post("/api/incidents/inc-001/charges")
      .set("Authorization", "Bearer valid-token")
      .send({ category: "Towing", amount: -5 });
    expect(res.status).toBe(400);
    expect(res.body.error_class).toBe("VALIDATION");
  });

  it("POST /api/incidents/:id/charges with missing category returns 400", async () => {
    const res = await request(app)
      .post("/api/incidents/inc-001/charges")
      .set("Authorization", "Bearer valid-token")
      .send({ amount: 100 });
    expect(res.status).toBe(400);
    expect(res.body.error_class).toBe("VALIDATION");
  });

  it("POST /api/incidents/:id/charges with valid body proceeds", async () => {
    mockQuery
      .mockResolvedValueOnce([[{ company_id: "company-aaa" }]])
      .mockResolvedValueOnce([{ affectedRows: 1 }]);
    const res = await request(app)
      .post("/api/incidents/inc-001/charges")
      .set("Authorization", "Bearer valid-token")
      .send({ category: "Towing", amount: 250 });
    expect(res.status).toBe(201);
  });
});
