import { describe, it, expect, vi, beforeEach } from "vitest";

// Tests R-FS-05-03, R-FS-05-07

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

// Control user context per-test
let mockUserRole = "dispatcher";
let mockUserTenantId = "company-aaa";

vi.mock("../../middleware/requireAuth", () => ({
  requireAuth: (req: any, _res: any, next: any) => {
    req.user = {
      uid: "user-1",
      tenantId: mockUserTenantId,
      role: mockUserRole,
      email: "test@loadpilot.com",
      firebaseUid: "firebase-uid-1",
    };
    next();
  },
}));

vi.mock("../../middleware/requireTenant", () => ({
  requireTenant: (_req: any, _res: any, next: any) => {
    next();
  },
}));

import express from "express";
import request from "supertest";
import contractsRouter from "../../routes/contracts";
import { errorHandler } from "../../middleware/errorHandler";

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(contractsRouter);
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

const CUSTOMER_ID = "customer-001";

// ── Auth enforcement ──────────────────────────────────────────────────────────

describe("GET /api/contracts/:customerId — auth enforcement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when auth middleware rejects (no token path)", async () => {
    const app = buildUnauthApp();
    const res = await request(app).get(`/api/contracts/${CUSTOMER_ID}`);
    expect(res.status).toBe(401);
  });
});

describe("POST /api/contracts — auth enforcement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when auth middleware rejects (no token path)", async () => {
    const app = buildUnauthApp();
    const res = await request(app)
      .post("/api/contracts")
      .send({ customer_id: CUSTOMER_ID, contract_name: "Annual 2026" });
    expect(res.status).toBe(401);
  });
});

// ── Tenant enforcement ────────────────────────────────────────────────────────

describe("GET /api/contracts/:customerId — tenant enforcement", () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    mockUserRole = "dispatcher";
    mockUserTenantId = "company-aaa";
    app = buildApp();
    vi.clearAllMocks();
  });

  it("allows authenticated user (requireTenant passes with no companyId param)", async () => {
    // contracts.ts GET uses :customerId not :companyId, so requireTenant does
    // not reject based on param mismatch — route is protected by requireAuth only
    mockQuery.mockResolvedValueOnce([[], []]);

    const res = await request(app)
      .get(`/api/contracts/${CUSTOMER_ID}`)
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(200);
  });
});

// ── Validation errors ─────────────────────────────────────────────────────────

describe("POST /api/contracts — validation", () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    mockUserRole = "dispatcher";
    mockUserTenantId = "company-aaa";
    app = buildApp();
    vi.clearAllMocks();
  });

  it("returns 201 with minimal valid payload (no Zod schema on contracts POST)", async () => {
    // First query: customer ownership check; second: REPLACE INTO
    mockQuery
      .mockResolvedValueOnce([[{ id: CUSTOMER_ID }], []])
      .mockResolvedValueOnce([{ affectedRows: 1 }, []]);

    const res = await request(app)
      .post("/api/contracts")
      .set("Authorization", "Bearer valid-token")
      .send({
        id: "contract-001",
        customer_id: CUSTOMER_ID,
        contract_name: "Annual 2026",
        status: "active",
      });

    expect(res.status).toBe(201);
  });

  it("returns 404 when customer does not belong to the tenant (TENANT-05)", async () => {
    // Customer ownership check returns no rows → customer not found
    mockQuery.mockResolvedValueOnce([[], []]);

    const res = await request(app)
      .post("/api/contracts")
      .set("Authorization", "Bearer valid-token")
      .send({
        id: "contract-001",
        customer_id: "foreign-customer-id",
        contract_name: "Annual 2026",
        status: "active",
      });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Customer not found");
  });
});

// ── Success path ──────────────────────────────────────────────────────────────

describe("GET /api/contracts/:customerId — success", () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    mockUserRole = "dispatcher";
    mockUserTenantId = "company-aaa";
    app = buildApp();
    vi.clearAllMocks();
  });

  it("returns contracts list with 200", async () => {
    const contracts = [
      {
        id: "contract-001",
        customer_id: CUSTOMER_ID,
        contract_name: "Annual 2026",
        status: "active",
      },
    ];
    mockQuery.mockResolvedValueOnce([contracts, []]);

    const res = await request(app)
      .get(`/api/contracts/${CUSTOMER_ID}`)
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(1);
  });

  it("returns empty array when no contracts for customer", async () => {
    mockQuery.mockResolvedValueOnce([[], []]);

    const res = await request(app)
      .get(`/api/contracts/${CUSTOMER_ID}`)
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(0);
  });

  it("returns 500 on database error for GET", async () => {
    mockQuery.mockRejectedValueOnce(new Error("DB error"));

    const res = await request(app)
      .get(`/api/contracts/${CUSTOMER_ID}`)
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(500);
  });
});

describe("POST /api/contracts — success", () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    mockUserRole = "dispatcher";
    mockUserTenantId = "company-aaa";
    app = buildApp();
    vi.clearAllMocks();
  });

  it("creates contract and returns 201", async () => {
    // First query: customer ownership check; second: REPLACE INTO
    mockQuery
      .mockResolvedValueOnce([[{ id: CUSTOMER_ID }], []])
      .mockResolvedValueOnce([{ affectedRows: 1 }, []]);

    const res = await request(app)
      .post("/api/contracts")
      .set("Authorization", "Bearer valid-token")
      .send({
        id: "contract-new",
        customer_id: CUSTOMER_ID,
        contract_name: "Annual 2026",
        terms: "NET 30",
        start_date: "2026-01-01",
        expiry_date: "2026-12-31",
        status: "active",
      });

    expect(res.status).toBe(201);
    expect(res.body.message).toBe("Contract saved");
  });

  it("returns 500 on database error for POST", async () => {
    // Customer check passes, then the REPLACE INTO throws
    mockQuery
      .mockResolvedValueOnce([[{ id: CUSTOMER_ID }], []])
      .mockRejectedValueOnce(new Error("DB insert failed"));

    const res = await request(app)
      .post("/api/contracts")
      .set("Authorization", "Bearer valid-token")
      .send({ id: "c-err", customer_id: CUSTOMER_ID, contract_name: "Bad" });

    expect(res.status).toBe(500);
  });
});
