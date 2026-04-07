import { describe, it, expect, vi, beforeEach } from "vitest";

// Tests R-FS-05-04, R-FS-05-07, R-S25-01, R-S25-02, R-S25-03, R-S25-04

// Hoisted mocks
const { mockQuery, mockResolveSqlPrincipalByFirebaseUid } = vi.hoisted(() => {
  const mockQuery = vi.fn();
  return { mockQuery, mockResolveSqlPrincipalByFirebaseUid: vi.fn() };
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
    child() {
      return this;
    },
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

vi.mock("../../helpers", () => ({
  redactData: vi.fn((data: any) => data),
  getVisibilitySettings: vi.fn().mockResolvedValue({}),
}));

// Mock firebase-admin for requireAuth
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
import equipmentRouter from "../../routes/equipment";
import { errorHandler } from "../../middleware/errorHandler";
import { DEFAULT_SQL_PRINCIPAL } from "../helpers/mock-sql-auth";

mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(DEFAULT_SQL_PRINCIPAL);

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(equipmentRouter);
  app.use(errorHandler);
  return app;
}

const COMPANY_ID = "company-aaa";
const AUTH_HEADER = "Bearer valid-firebase-token";

// ── Auth enforcement ──────────────────────────────────────────────────────────

describe("GET /api/equipment/:companyId — auth enforcement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(DEFAULT_SQL_PRINCIPAL);
  });

  it("returns 401 when auth middleware rejects (no token path)", async () => {
    const app = buildApp();
    const res = await request(app).get(`/api/equipment/${COMPANY_ID}`);
    expect(res.status).toBe(401);
  });
});

describe("POST /api/equipment — auth enforcement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(DEFAULT_SQL_PRINCIPAL);
  });

  it("returns 401 when auth middleware rejects (no token path)", async () => {
    const app = buildApp();
    const res = await request(app).post("/api/equipment").send({
      company_id: COMPANY_ID,
      unit_number: "T-001",
      type: "truck",
      status: "active",
    });
    expect(res.status).toBe(401);
  });
});

// ── Tenant enforcement ────────────────────────────────────────────────────────

describe("GET /api/equipment/:companyId — tenant enforcement", () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(DEFAULT_SQL_PRINCIPAL);
    app = buildApp();
  });

  it("returns 403 when companyId param does not match user tenant", async () => {
    const res = await request(app)
      .get("/api/equipment/company-zzz")
      .set("Authorization", AUTH_HEADER);

    expect(res.status).toBe(403);
  });
});

describe("POST /api/equipment — tenant enforcement", () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(DEFAULT_SQL_PRINCIPAL);
    app = buildApp();
  });

  it("returns 403 when company_id in body does not match user tenant", async () => {
    const res = await request(app)
      .post("/api/equipment")
      .set("Authorization", AUTH_HEADER)
      .send({
        company_id: "company-zzz",
        unit_number: "T-001",
        type: "truck",
        status: "active",
      });

    expect(res.status).toBe(403);
  });
});

// ── Validation errors ─────────────────────────────────────────────────────────

describe("POST /api/equipment — validation", () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(DEFAULT_SQL_PRINCIPAL);
    app = buildApp();
  });

  it("returns 400 when required fields are missing (company_id, unit_number, type, status)", async () => {
    const res = await request(app)
      .post("/api/equipment")
      .set("Authorization", AUTH_HEADER)
      .send({ company_id: COMPANY_ID }); // missing unit_number, type, status

    expect(res.status).toBe(400);
  });
});

// ── Success path ──────────────────────────────────────────────────────────────

describe("GET /api/equipment/:companyId — success", () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(DEFAULT_SQL_PRINCIPAL);
    app = buildApp();
  });

  it("returns equipment list with 200", async () => {
    const equipment = [
      {
        id: "eq-001",
        company_id: COMPANY_ID,
        unit_number: "T-001",
        type: "truck",
        status: "active",
      },
    ];
    mockQuery.mockResolvedValueOnce([equipment, []]);

    const res = await request(app)
      .get(`/api/equipment/${COMPANY_ID}`)
      .set("Authorization", AUTH_HEADER);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(1);
  });

  it("returns 500 on database error", async () => {
    mockQuery.mockRejectedValueOnce(new Error("DB error"));

    const res = await request(app)
      .get(`/api/equipment/${COMPANY_ID}`)
      .set("Authorization", AUTH_HEADER);

    expect(res.status).toBe(500);
  });
});

describe("POST /api/equipment — success", () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(DEFAULT_SQL_PRINCIPAL);
    app = buildApp();
  });

  it("creates equipment and returns 201", async () => {
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }, []]);

    const res = await request(app)
      .post("/api/equipment")
      .set("Authorization", AUTH_HEADER)
      .send({
        id: "eq-new",
        company_id: COMPANY_ID,
        unit_number: "T-002",
        type: "truck",
        status: "active",
      });

    expect(res.status).toBe(201);
    expect(res.body.message).toBe("Equipment added");
  });

  it("returns 500 on database error during creation", async () => {
    mockQuery.mockRejectedValueOnce(new Error("DB insert failed"));

    const res = await request(app)
      .post("/api/equipment")
      .set("Authorization", AUTH_HEADER)
      .send({
        company_id: COMPANY_ID,
        unit_number: "T-003",
        type: "trailer",
        status: "active",
      });

    expect(res.status).toBe(500);
  });
});

// ── PATCH /api/equipment/:id ──────────────────────────────────────────────────
// Tests R-S25-01, R-S25-02, R-S25-03, R-S25-04

const EQUIP_ROW = {
  id: "eq-001",
  company_id: COMPANY_ID,
  unit_number: "T-001",
  type: "truck",
  status: "active",
  version: 1,
  assigned_load_id: null,
};

describe("PATCH /api/equipment/:id — role enforcement (R-S25-03)", () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    vi.clearAllMocks();
    app = buildApp();
  });

  it("returns 403 when role is driver", async () => {
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue({
      ...DEFAULT_SQL_PRINCIPAL,
      role: "driver",
    });
    app = buildApp();

    const res = await request(app)
      .patch("/api/equipment/eq-001")
      .set("Authorization", AUTH_HEADER)
      .send({ status: "maintenance" });

    expect(res.status).toBe(403);
  });

  it("returns 403 when role is customer", async () => {
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue({
      ...DEFAULT_SQL_PRINCIPAL,
      role: "customer",
    });
    app = buildApp();

    const res = await request(app)
      .patch("/api/equipment/eq-001")
      .set("Authorization", AUTH_HEADER)
      .send({ status: "maintenance" });

    expect(res.status).toBe(403);
  });
});

describe("PATCH /api/equipment/:id — cross-tenant returns 404 (R-S25-02)", () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(DEFAULT_SQL_PRINCIPAL);
    app = buildApp();
  });

  it("returns 404 when equipment belongs to a different tenant", async () => {
    // findById with company-aaa finds nothing (cross-tenant)
    mockQuery.mockResolvedValueOnce([[], []]);

    const res = await request(app)
      .patch("/api/equipment/eq-other")
      .set("Authorization", AUTH_HEADER)
      .send({ status: "maintenance" });

    expect(res.status).toBe(404);
  });
});

describe("PATCH /api/equipment/:id — successful update (R-S25-01)", () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(DEFAULT_SQL_PRINCIPAL);
    app = buildApp();
  });

  it("updates status field and returns 200 with updated row", async () => {
    const updatedRow = { ...EQUIP_ROW, status: "maintenance" };
    // findById (pre-check)
    mockQuery.mockResolvedValueOnce([[EQUIP_ROW], []]);
    // UPDATE query
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }, []]);
    // findById (post-update)
    mockQuery.mockResolvedValueOnce([[updatedRow], []]);

    const res = await request(app)
      .patch(`/api/equipment/${EQUIP_ROW.id}`)
      .set("Authorization", AUTH_HEADER)
      .send({ status: "maintenance" });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("maintenance");
  });

  it("updates maintenance_date, mileage, and notes fields", async () => {
    const updatedRow = {
      ...EQUIP_ROW,
      maintenance_date: "2026-04-01",
      mileage: 120000,
      notes: "Oil change done",
    };
    mockQuery.mockResolvedValueOnce([[EQUIP_ROW], []]);
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }, []]);
    mockQuery.mockResolvedValueOnce([[updatedRow], []]);

    const res = await request(app)
      .patch(`/api/equipment/${EQUIP_ROW.id}`)
      .set("Authorization", AUTH_HEADER)
      .send({ maintenance_date: "2026-04-01", mileage: 120000, notes: "Oil change done" });

    expect(res.status).toBe(200);
    expect(res.body.maintenance_date).toBe("2026-04-01");
    expect(res.body.mileage).toBe(120000);
    expect(res.body.notes).toBe("Oil change done");
  });

  it("admin role can also update equipment", async () => {
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue({
      ...DEFAULT_SQL_PRINCIPAL,
      role: "admin",
    });
    app = buildApp();
    const updatedRow = { ...EQUIP_ROW, status: "inactive" };
    mockQuery.mockResolvedValueOnce([[EQUIP_ROW], []]);
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }, []]);
    mockQuery.mockResolvedValueOnce([[updatedRow], []]);

    const res = await request(app)
      .patch(`/api/equipment/${EQUIP_ROW.id}`)
      .set("Authorization", AUTH_HEADER)
      .send({ status: "inactive" });

    expect(res.status).toBe(200);
  });

  it("safety_manager role can update equipment", async () => {
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue({
      ...DEFAULT_SQL_PRINCIPAL,
      role: "safety_manager",
    });
    app = buildApp();
    const updatedRow = { ...EQUIP_ROW, notes: "Brake inspection" };
    mockQuery.mockResolvedValueOnce([[EQUIP_ROW], []]);
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }, []]);
    mockQuery.mockResolvedValueOnce([[updatedRow], []]);

    const res = await request(app)
      .patch(`/api/equipment/${EQUIP_ROW.id}`)
      .set("Authorization", AUTH_HEADER)
      .send({ notes: "Brake inspection" });

    expect(res.status).toBe(200);
  });

  it("returns 400 when body contains no patchable fields", async () => {
    mockQuery.mockResolvedValueOnce([[EQUIP_ROW], []]);

    const res = await request(app)
      .patch(`/api/equipment/${EQUIP_ROW.id}`)
      .set("Authorization", AUTH_HEADER)
      .send({ unknown_field: "value" });

    // Zod strips unknown fields; schema allows all-optional so empty body
    // passes validation — buildSafeUpdate returns null => 400
    expect(res.status).toBe(400);
  });

  it("returns 500 on database error during update", async () => {
    mockQuery.mockResolvedValueOnce([[EQUIP_ROW], []]);
    mockQuery.mockRejectedValueOnce(new Error("DB error"));

    const res = await request(app)
      .patch(`/api/equipment/${EQUIP_ROW.id}`)
      .set("Authorization", AUTH_HEADER)
      .send({ status: "maintenance" });

    expect(res.status).toBe(500);
  });
});

describe("PATCH /api/equipment/:id — existing GET tests unaffected (R-S25-04)", () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(DEFAULT_SQL_PRINCIPAL);
    app = buildApp();
  });

  it("GET /api/equipment/:companyId still returns 200 with equipment list", async () => {
    mockQuery.mockResolvedValueOnce([[EQUIP_ROW], []]);

    const res = await request(app)
      .get(`/api/equipment/${COMPANY_ID}`)
      .set("Authorization", AUTH_HEADER);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});
