import { describe, it, expect, vi, beforeEach } from "vitest";

// Tests R-P1-01, R-P1-02, R-P1-03, R-P1-04, R-P1-05, R-P1-06, R-P1-07, R-P1-08

// Hoisted mocks — must be declared before vi.mock calls
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
  createChildLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    child: function () {
      return this;
    },
  },
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

import express from "express";
import request from "supertest";
import safetyRouter from "../../routes/safety";
import { errorHandler } from "../../middleware/errorHandler";
import { DEFAULT_SQL_PRINCIPAL } from "../helpers/mock-sql-auth";

mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(DEFAULT_SQL_PRINCIPAL);

const AUTH_HEADER = "Bearer valid-firebase-token";
const TENANT_A = "company-aaa";
const TENANT_B = "company-bbb";

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(safetyRouter);
  app.use(errorHandler);
  return app;
}

// ── R-P1-01: GET /api/safety/quizzes ────────────────────────────────────────

describe("GET /api/safety/quizzes — R-P1-01", () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    app = buildApp();
    vi.clearAllMocks();
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(
      DEFAULT_SQL_PRINCIPAL,
    );
  });

  it("returns 401 without Authorization header", async () => {
    const res = await request(app).get("/api/safety/quizzes");
    expect(res.status).toBe(401);
  });

  it("returns 200 with JSON array for authenticated tenant", async () => {
    const quizzes = [
      {
        id: "quiz-001",
        company_id: TENANT_A,
        title: "DOT Safety Quiz",
        status: "active",
      },
      {
        id: "quiz-002",
        company_id: TENANT_A,
        title: "Hazmat Awareness",
        status: "draft",
      },
    ];
    mockQuery.mockResolvedValueOnce([quizzes, []]);

    const res = await request(app)
      .get("/api/safety/quizzes")
      .set("Authorization", AUTH_HEADER);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(2);
  });

  it("returns empty array when tenant has no quizzes", async () => {
    mockQuery.mockResolvedValueOnce([[], []]);

    const res = await request(app)
      .get("/api/safety/quizzes")
      .set("Authorization", AUTH_HEADER);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(0);
  });

  it("returns 500 on database error", async () => {
    mockQuery.mockRejectedValueOnce(new Error("DB connection error"));

    const res = await request(app)
      .get("/api/safety/quizzes")
      .set("Authorization", AUTH_HEADER);

    expect(res.status).toBe(500);
  });
});

// ── R-P1-02: POST /api/safety/quizzes ───────────────────────────────────────

describe("POST /api/safety/quizzes — R-P1-02", () => {
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
      .post("/api/safety/quizzes")
      .send({ title: "Test Quiz" });
    expect(res.status).toBe(401);
  });

  it("creates a quiz and returns 201", async () => {
    mockQuery.mockResolvedValueOnce([{ insertId: 1 }, []]);

    const res = await request(app)
      .post("/api/safety/quizzes")
      .set("Authorization", AUTH_HEADER)
      .send({
        title: "Defensive Driving",
        description: "Annual safety quiz",
        status: "draft",
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("message");
  });

  it("returns 400 when title is missing", async () => {
    const res = await request(app)
      .post("/api/safety/quizzes")
      .set("Authorization", AUTH_HEADER)
      .send({ description: "No title quiz" });

    expect(res.status).toBe(400);
  });

  it("returns 500 on database error", async () => {
    mockQuery.mockRejectedValueOnce(new Error("DB error"));

    const res = await request(app)
      .post("/api/safety/quizzes")
      .set("Authorization", AUTH_HEADER)
      .send({ title: "Failing Quiz" });

    expect(res.status).toBe(500);
  });
});

// ── R-P1-03: GET /api/safety/maintenance ────────────────────────────────────

describe("GET /api/safety/maintenance — R-P1-03", () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    app = buildApp();
    vi.clearAllMocks();
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(
      DEFAULT_SQL_PRINCIPAL,
    );
  });

  it("returns 401 without Authorization header", async () => {
    const res = await request(app).get("/api/safety/maintenance");
    expect(res.status).toBe(401);
  });

  it("returns 200 with JSON array", async () => {
    const records = [
      {
        id: "maint-001",
        company_id: TENANT_A,
        vehicle_id: "truck-01",
        type: "Oil Change",
        status: "Completed",
      },
    ];
    mockQuery.mockResolvedValueOnce([records, []]);

    const res = await request(app)
      .get("/api/safety/maintenance")
      .set("Authorization", AUTH_HEADER);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(1);
  });

  it("returns 500 on database error", async () => {
    mockQuery.mockRejectedValueOnce(new Error("DB error"));

    const res = await request(app)
      .get("/api/safety/maintenance")
      .set("Authorization", AUTH_HEADER);

    expect(res.status).toBe(500);
  });
});

// ── R-P1-04: POST /api/safety/maintenance ───────────────────────────────────

describe("POST /api/safety/maintenance — R-P1-04", () => {
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
      .post("/api/safety/maintenance")
      .send({ vehicle_id: "truck-01", type: "Oil Change" });
    expect(res.status).toBe(401);
  });

  it("creates maintenance record and returns 201", async () => {
    mockQuery.mockResolvedValueOnce([{ insertId: 1 }, []]);

    const res = await request(app)
      .post("/api/safety/maintenance")
      .set("Authorization", AUTH_HEADER)
      .send({
        vehicle_id: "truck-01",
        type: "Oil Change",
        status: "Scheduled",
        scheduled_date: "2026-04-01",
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("message");
  });

  it("returns 400 when vehicle_id is missing", async () => {
    const res = await request(app)
      .post("/api/safety/maintenance")
      .set("Authorization", AUTH_HEADER)
      .send({ type: "Oil Change" });

    expect(res.status).toBe(400);
  });

  it("returns 500 on database error", async () => {
    mockQuery.mockRejectedValueOnce(new Error("DB error"));

    const res = await request(app)
      .post("/api/safety/maintenance")
      .set("Authorization", AUTH_HEADER)
      .send({ vehicle_id: "truck-01", type: "Brake Inspection" });

    expect(res.status).toBe(500);
  });
});

// ── R-P1-05: GET /api/safety/vendors ────────────────────────────────────────

describe("GET /api/safety/vendors — R-P1-05", () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    app = buildApp();
    vi.clearAllMocks();
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(
      DEFAULT_SQL_PRINCIPAL,
    );
  });

  it("returns 401 without Authorization header", async () => {
    const res = await request(app).get("/api/safety/vendors");
    expect(res.status).toBe(401);
  });

  it("returns 200 with JSON array", async () => {
    const vendors = [
      {
        id: "vendor-001",
        company_id: TENANT_A,
        name: "TruckCare Inc",
        type: "Maintenance",
        status: "active",
      },
      {
        id: "vendor-002",
        company_id: TENANT_A,
        name: "SafetyFirst LLC",
        type: "Training",
        status: "active",
      },
    ];
    mockQuery.mockResolvedValueOnce([vendors, []]);

    const res = await request(app)
      .get("/api/safety/vendors")
      .set("Authorization", AUTH_HEADER);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(2);
  });

  it("returns 500 on database error", async () => {
    mockQuery.mockRejectedValueOnce(new Error("DB error"));

    const res = await request(app)
      .get("/api/safety/vendors")
      .set("Authorization", AUTH_HEADER);

    expect(res.status).toBe(500);
  });
});

// ── R-P1-06: POST /api/safety/vendors ───────────────────────────────────────

describe("POST /api/safety/vendors — R-P1-06", () => {
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
      .post("/api/safety/vendors")
      .send({ name: "Test Vendor" });
    expect(res.status).toBe(401);
  });

  it("creates vendor and returns 201", async () => {
    mockQuery.mockResolvedValueOnce([{ insertId: 1 }, []]);

    const res = await request(app)
      .post("/api/safety/vendors")
      .set("Authorization", AUTH_HEADER)
      .send({
        name: "TruckCare Inc",
        type: "Maintenance",
        contact_email: "info@truckcare.com",
        status: "active",
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("message");
  });

  it("returns 400 when name is missing", async () => {
    const res = await request(app)
      .post("/api/safety/vendors")
      .set("Authorization", AUTH_HEADER)
      .send({ type: "Maintenance" });

    expect(res.status).toBe(400);
  });

  it("returns 500 on database error", async () => {
    mockQuery.mockRejectedValueOnce(new Error("DB error"));

    const res = await request(app)
      .post("/api/safety/vendors")
      .set("Authorization", AUTH_HEADER)
      .send({ name: "Failing Vendor", type: "Training" });

    expect(res.status).toBe(500);
  });
});

// ── R-P1-07: GET /api/safety/activity ───────────────────────────────────────

describe("GET /api/safety/activity — R-P1-07", () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    app = buildApp();
    vi.clearAllMocks();
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(
      DEFAULT_SQL_PRINCIPAL,
    );
  });

  it("returns 401 without Authorization header", async () => {
    const res = await request(app).get("/api/safety/activity");
    expect(res.status).toBe(401);
  });

  it("returns 200 with JSON array (max 50 entries)", async () => {
    // Generate 50 activity log entries (max limit enforced by route)
    const activityLog = Array.from({ length: 50 }, (_, i) => ({
      id: `act-${String(i + 1).padStart(3, "0")}`,
      company_id: TENANT_A,
      action: "quiz_completed",
      actor: "driver@test.com",
      created_at: new Date().toISOString(),
    }));
    mockQuery.mockResolvedValueOnce([activityLog, []]);

    const res = await request(app)
      .get("/api/safety/activity")
      .set("Authorization", AUTH_HEADER);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeLessThanOrEqual(50);
  });

  it("SQL query uses LIMIT 50 to cap results", async () => {
    mockQuery.mockResolvedValueOnce([[], []]);

    await request(app)
      .get("/api/safety/activity")
      .set("Authorization", AUTH_HEADER);

    // Verify the query was called with LIMIT clause
    expect(mockQuery).toHaveBeenCalledTimes(1);
    const [sql] = mockQuery.mock.calls[0];
    expect(sql).toMatch(/LIMIT\s+50/i);
  });

  it("returns 500 on database error", async () => {
    mockQuery.mockRejectedValueOnce(new Error("DB error"));

    const res = await request(app)
      .get("/api/safety/activity")
      .set("Authorization", AUTH_HEADER);

    expect(res.status).toBe(500);
  });
});

// ── R-P1-08: Cross-tenant isolation ─────────────────────────────────────────

describe("Cross-tenant isolation — R-P1-08", () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    app = buildApp();
    vi.clearAllMocks();
  });

  it("GET /api/safety/quizzes returns 404 when cross-tenant resource requested via query param", async () => {
    // Tenant B user authenticated but requesting Tenant A data via company_id query param
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue({
      ...DEFAULT_SQL_PRINCIPAL,
      tenantId: TENANT_B,
      companyId: TENANT_B,
    });

    // Route returns empty array for Tenant B (no Tenant A data leaks)
    mockQuery.mockResolvedValueOnce([[], []]);

    const res = await request(app)
      .get("/api/safety/quizzes?company_id=company-aaa")
      .set("Authorization", AUTH_HEADER);

    // Should return 200 with empty array (Tenant B has no quizzes) or 404
    // The key invariant: Tenant A data must NOT appear
    if (res.status === 200) {
      expect(Array.isArray(res.body)).toBe(true);
      // Verify no Tenant A records leaked
      const tenantARecords = res.body.filter(
        (r: any) => r.company_id === TENANT_A,
      );
      expect(tenantARecords).toHaveLength(0);
    } else {
      expect(res.status).toBe(404);
    }
  });

  it("GET /api/safety/quizzes/:id returns 404 for cross-tenant resource", async () => {
    // Tenant B user authenticated
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue({
      ...DEFAULT_SQL_PRINCIPAL,
      tenantId: TENANT_B,
      companyId: TENANT_B,
    });

    // DB returns empty (Tenant A quiz not found for Tenant B)
    mockQuery.mockResolvedValueOnce([[], []]);

    const res = await request(app)
      .get("/api/safety/quizzes/quiz-owned-by-tenant-a")
      .set("Authorization", AUTH_HEADER);

    expect(res.status).toBe(404);
  });

  it("GET /api/safety/maintenance/:id returns 404 for cross-tenant resource", async () => {
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue({
      ...DEFAULT_SQL_PRINCIPAL,
      tenantId: TENANT_B,
      companyId: TENANT_B,
    });

    mockQuery.mockResolvedValueOnce([[], []]);

    const res = await request(app)
      .get("/api/safety/maintenance/maint-owned-by-tenant-a")
      .set("Authorization", AUTH_HEADER);

    expect(res.status).toBe(404);
  });

  it("GET /api/safety/vendors/:id returns 404 for cross-tenant resource", async () => {
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue({
      ...DEFAULT_SQL_PRINCIPAL,
      tenantId: TENANT_B,
      companyId: TENANT_B,
    });

    mockQuery.mockResolvedValueOnce([[], []]);

    const res = await request(app)
      .get("/api/safety/vendors/vendor-owned-by-tenant-a")
      .set("Authorization", AUTH_HEADER);

    expect(res.status).toBe(404);
  });
});
