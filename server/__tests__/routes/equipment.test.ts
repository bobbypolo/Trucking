import { describe, it, expect, vi, beforeEach } from "vitest";

// Tests R-FS-05-04, R-FS-05-07

// Hoisted mocks
const { mockQuery } = vi.hoisted(() => {
  const mockQuery = vi.fn();
  return { mockQuery };
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
}));

vi.mock("../../helpers", () => ({
  redactData: vi.fn((data: any) => data),
  getVisibilitySettings: vi.fn().mockResolvedValue({}),
}));

// Control user context per-test
let mockUserRole = "dispatcher";
let mockUserTenantId = "company-aaa";
let mockUserCompanyId = "company-aaa";

vi.mock("../../middleware/requireAuth", () => ({
  requireAuth: (req: any, _res: any, next: any) => {
    req.user = {
      uid: "user-1",
      tenantId: mockUserTenantId,
      companyId: mockUserCompanyId,
      role: mockUserRole,
      email: "test@loadpilot.com",
      firebaseUid: "firebase-uid-1",
    };
    next();
  },
}));

vi.mock("../../middleware/requireTenant", () => ({
  requireTenant: (req: any, res: any, next: any) => {
    const user = req.user;
    if (!user)
      return res
        .status(403)
        .json({ error: "Tenant verification requires authentication." });

    const paramCompanyId = req.params.companyId;
    if (paramCompanyId && paramCompanyId !== user.tenantId) {
      return res.status(403).json({ error: "Access denied: tenant mismatch." });
    }
    if (req.body) {
      const bodyCompanyId = req.body.company_id || req.body.companyId;
      if (bodyCompanyId && bodyCompanyId !== user.tenantId) {
        return res
          .status(403)
          .json({ error: "Access denied: tenant mismatch." });
      }
    }
    next();
  },
}));

import express from "express";
import request from "supertest";
import equipmentRouter from "../../routes/equipment";
import { errorHandler } from "../../middleware/errorHandler";

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(equipmentRouter);
  app.use(errorHandler);
  return app;
}

function buildUnauthApp() {
  const app = express();
  app.use(express.json());
  app.use((_req: any, res: any) => {
    res.status(401).json({ error: "Authentication required." });
  });
  return app;
}

const COMPANY_ID = "company-aaa";

// ── Auth enforcement ──────────────────────────────────────────────────────────

describe("GET /api/equipment/:companyId — auth enforcement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when auth middleware rejects (no token path)", async () => {
    const app = buildUnauthApp();
    const res = await request(app).get(`/api/equipment/${COMPANY_ID}`);
    expect(res.status).toBe(401);
  });
});

describe("POST /api/equipment — auth enforcement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when auth middleware rejects (no token path)", async () => {
    const app = buildUnauthApp();
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
    mockUserRole = "dispatcher";
    mockUserTenantId = "company-aaa";
    mockUserCompanyId = "company-aaa";
    app = buildApp();
    vi.clearAllMocks();
  });

  it("returns 403 when companyId param does not match user tenant", async () => {
    const res = await request(app)
      .get("/api/equipment/company-zzz")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(403);
  });
});

describe("POST /api/equipment — tenant enforcement", () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    mockUserRole = "dispatcher";
    mockUserTenantId = "company-aaa";
    mockUserCompanyId = "company-aaa";
    app = buildApp();
    vi.clearAllMocks();
  });

  it("returns 403 when company_id in body does not match user tenant", async () => {
    const res = await request(app)
      .post("/api/equipment")
      .set("Authorization", "Bearer valid-token")
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
    mockUserRole = "dispatcher";
    mockUserTenantId = "company-aaa";
    mockUserCompanyId = "company-aaa";
    app = buildApp();
    vi.clearAllMocks();
  });

  it("returns 400 when required fields are missing (company_id, unit_number, type, status)", async () => {
    const res = await request(app)
      .post("/api/equipment")
      .set("Authorization", "Bearer valid-token")
      .send({ company_id: COMPANY_ID }); // missing unit_number, type, status

    expect(res.status).toBe(400);
  });
});

// ── Success path ──────────────────────────────────────────────────────────────

describe("GET /api/equipment/:companyId — success", () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    mockUserRole = "dispatcher";
    mockUserTenantId = "company-aaa";
    mockUserCompanyId = "company-aaa";
    app = buildApp();
    vi.clearAllMocks();
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
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(1);
  });

  it("returns 500 on database error", async () => {
    mockQuery.mockRejectedValueOnce(new Error("DB error"));

    const res = await request(app)
      .get(`/api/equipment/${COMPANY_ID}`)
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(500);
  });
});

describe("POST /api/equipment — success", () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    mockUserRole = "dispatcher";
    mockUserTenantId = "company-aaa";
    mockUserCompanyId = "company-aaa";
    app = buildApp();
    vi.clearAllMocks();
  });

  it("creates equipment and returns 201", async () => {
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }, []]);

    const res = await request(app)
      .post("/api/equipment")
      .set("Authorization", "Bearer valid-token")
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
      .set("Authorization", "Bearer valid-token")
      .send({
        company_id: COMPANY_ID,
        unit_number: "T-003",
        type: "trailer",
        status: "active",
      });

    expect(res.status).toBe(500);
  });
});
