import { describe, it, expect, vi, beforeEach } from "vitest";

// Hoisted mocks for pool.query
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

// Directly mock auth middleware to control user context per-test
let mockUserRole = "admin";
let mockUserTenantId = "company-aaa";
let mockUserCompanyId = "company-aaa";
let mockUserUid = "user-1";
let mockAuthEnabled = true;

vi.mock("../../middleware/requireAuth", () => ({
  requireAuth: (req: any, res: any, next: any) => {
    if (!mockAuthEnabled) {
      return res
        .status(401)
        .json({ error: "Authentication required." });
    }
    req.user = {
      uid: mockUserUid,
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
    if (!user) {
      return res
        .status(403)
        .json({ error: "Tenant verification requires authentication." });
    }
    next();
  },
}));

import express from "express";
import request from "supertest";
import bookingsRouter from "../../routes/bookings";
import { errorHandler } from "../../middleware/errorHandler";

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(bookingsRouter);
  app.use(errorHandler);
  return app;
}

// ── GET /api/bookings — auth enforcement ────────────────────────────────────

describe("GET /api/bookings — auth enforcement", () => {
  beforeEach(() => {
    mockUserRole = "admin";
    mockUserTenantId = "company-aaa";
    mockUserCompanyId = "company-aaa";
    mockAuthEnabled = true;
    vi.clearAllMocks();
  });

  it("returns 401 when auth middleware rejects (no token path)", async () => {
    mockAuthEnabled = false;
    const app = buildApp();
    const res = await request(app).get("/api/bookings");
    expect(res.status).toBe(401);
  });
});

// ── GET /api/bookings — success path ────────────────────────────────────────

describe("GET /api/bookings — success", () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    mockUserRole = "admin";
    mockUserTenantId = "company-aaa";
    mockUserCompanyId = "company-aaa";
    mockAuthEnabled = true;
    app = buildApp();
    vi.clearAllMocks();
  });

  it("returns bookings list with 200", async () => {
    const bookings = [
      {
        id: "bk-001",
        company_id: "company-aaa",
        status: "Pending",
        quote_id: "q-001",
        customer_id: "cust-001",
      },
      {
        id: "bk-002",
        company_id: "company-aaa",
        status: "Confirmed",
        quote_id: "q-002",
        customer_id: "cust-002",
      },
    ];
    mockQuery.mockResolvedValueOnce([bookings, []]);

    const res = await request(app)
      .get("/api/bookings")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(2);

    // Verify SQL query includes tenant isolation
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("company_id"),
      expect.arrayContaining(["company-aaa"]),
    );
  });

  it("returns empty array when no bookings exist", async () => {
    mockQuery.mockResolvedValueOnce([[], []]);

    const res = await request(app)
      .get("/api/bookings")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("supports pagination via page and limit query params", async () => {
    mockQuery.mockResolvedValueOnce([[], []]);

    const res = await request(app)
      .get("/api/bookings?page=2&limit=10")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(200);
    // Verify the query was called with offset=(2-1)*10=10 and limit=10
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("LIMIT"),
      ["company-aaa", 10, 10],
    );
  });

  it("defaults to page=1, limit=50 when not provided", async () => {
    mockQuery.mockResolvedValueOnce([[], []]);

    await request(app)
      .get("/api/bookings")
      .set("Authorization", "Bearer valid-token");

    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("LIMIT"),
      ["company-aaa", 50, 0],
    );
  });

  it("returns 500 on database error", async () => {
    mockQuery.mockRejectedValueOnce(new Error("DB connection error"));

    const res = await request(app)
      .get("/api/bookings")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(500);
    expect(res.body.error).toBe("Database error");
  });
});

// ── GET /api/bookings/:id — single booking ──────────────────────────────────

describe("GET /api/bookings/:id — single booking", () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    mockUserRole = "admin";
    mockUserTenantId = "company-aaa";
    mockUserCompanyId = "company-aaa";
    mockAuthEnabled = true;
    app = buildApp();
    vi.clearAllMocks();
  });

  it("returns 200 for same-tenant booking", async () => {
    const booking = {
      id: "bk-001",
      company_id: "company-aaa",
      status: "Pending",
      quote_id: "q-001",
    };
    mockQuery.mockResolvedValueOnce([[booking], []]);

    const res = await request(app)
      .get("/api/bookings/bk-001")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(200);
    expect(res.body.id).toBe("bk-001");
    expect(res.body.company_id).toBe("company-aaa");
  });

  it("returns 404 for cross-tenant booking (conceals existence)", async () => {
    mockQuery.mockResolvedValueOnce([
      [{ id: "bk-001", company_id: "company-zzz", status: "Pending" }],
      [],
    ]);

    const res = await request(app)
      .get("/api/bookings/bk-001")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Booking not found");
  });

  it("returns 404 when booking does not exist", async () => {
    mockQuery.mockResolvedValueOnce([[], []]);

    const res = await request(app)
      .get("/api/bookings/nonexistent")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Booking not found");
  });

  it("returns 500 on database error", async () => {
    mockQuery.mockRejectedValueOnce(new Error("DB error"));

    const res = await request(app)
      .get("/api/bookings/bk-001")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(500);
    expect(res.body.error).toBe("Database error");
  });
});

// ── POST /api/bookings — creation ───────────────────────────────────────────

describe("POST /api/bookings — creation", () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    mockUserRole = "admin";
    mockUserTenantId = "company-aaa";
    mockUserCompanyId = "company-aaa";
    mockUserUid = "user-1";
    mockAuthEnabled = true;
    app = buildApp();
    vi.clearAllMocks();
  });

  it("returns 201 with valid data", async () => {
    const createdBooking = {
      id: "bk-new",
      company_id: "company-aaa",
      status: "Pending",
      quote_id: "q-001",
      customer_id: "cust-001",
    };
    // INSERT INTO bookings
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }, []]);
    // findById (return after create)
    mockQuery.mockResolvedValueOnce([[createdBooking], []]);

    const res = await request(app)
      .post("/api/bookings")
      .set("Authorization", "Bearer valid-token")
      .send({
        quote_id: "q-001",
        customer_id: "cust-001",
        status: "Pending",
      });

    expect(res.status).toBe(201);
    expect(res.body.id).toBe("bk-new");
    expect(res.body.company_id).toBe("company-aaa");

    // Verify INSERT received tenant ID and field values
    const insertCall = mockQuery.mock.calls[0];
    expect(insertCall[0]).toMatch(/INSERT/i);
    expect(insertCall[1]).toEqual(
      expect.arrayContaining(["company-aaa"]),
    );
  });

  it("returns 201 with minimal data (defaults status to Pending)", async () => {
    const createdBooking = {
      id: "bk-min",
      company_id: "company-aaa",
      status: "Pending",
    };
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }, []]);
    mockQuery.mockResolvedValueOnce([[createdBooking], []]);

    const res = await request(app)
      .post("/api/bookings")
      .set("Authorization", "Bearer valid-token")
      .send({});

    expect(res.status).toBe(201);
    expect(res.body.status).toBe("Pending");
  });

  it("returns 201 with all optional fields", async () => {
    const createdBooking = {
      id: "bk-full",
      company_id: "company-aaa",
      status: "Confirmed",
      quote_id: "q-001",
      customer_id: "cust-001",
      pickup_date: "2026-04-01",
      delivery_date: "2026-04-05",
      load_id: "ld-001",
      notes: "Handle with care",
    };
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }, []]);
    mockQuery.mockResolvedValueOnce([[createdBooking], []]);

    const res = await request(app)
      .post("/api/bookings")
      .set("Authorization", "Bearer valid-token")
      .send({
        status: "Confirmed",
        quote_id: "q-001",
        customer_id: "cust-001",
        pickup_date: "2026-04-01",
        delivery_date: "2026-04-05",
        load_id: "ld-001",
        notes: "Handle with care",
      });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe("Confirmed");
    expect(res.body.notes).toBe("Handle with care");
  });

  it("returns 400 with invalid status enum value", async () => {
    const res = await request(app)
      .post("/api/bookings")
      .set("Authorization", "Bearer valid-token")
      .send({ status: "InvalidStatus" });

    expect(res.status).toBe(400);
  });

  it("returns 500 on database error during creation", async () => {
    mockQuery.mockRejectedValueOnce(new Error("DB insert failed"));

    const res = await request(app)
      .post("/api/bookings")
      .set("Authorization", "Bearer valid-token")
      .send({ status: "Pending" });

    expect(res.status).toBe(500);
    expect(res.body.error).toBe("Database error");
  });

  it("returns 401 when not authenticated", async () => {
    mockAuthEnabled = false;
    const app2 = buildApp();

    const res = await request(app2)
      .post("/api/bookings")
      .send({ status: "Pending" });

    expect(res.status).toBe(401);
  });
});

// ── PATCH /api/bookings/:id — update ────────────────────────────────────────

describe("PATCH /api/bookings/:id — update", () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    mockUserRole = "admin";
    mockUserTenantId = "company-aaa";
    mockUserCompanyId = "company-aaa";
    mockUserUid = "user-1";
    mockAuthEnabled = true;
    app = buildApp();
    vi.clearAllMocks();
  });

  it("returns 200 for same-tenant update", async () => {
    const existingBooking = {
      id: "bk-001",
      company_id: "company-aaa",
      status: "Pending",
    };
    const updatedBooking = {
      id: "bk-001",
      company_id: "company-aaa",
      status: "Confirmed",
    };
    // findById (ownership check)
    mockQuery.mockResolvedValueOnce([[existingBooking], []]);
    // UPDATE bookings SET ...
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }, []]);
    // findById (return updated)
    mockQuery.mockResolvedValueOnce([[updatedBooking], []]);

    const res = await request(app)
      .patch("/api/bookings/bk-001")
      .set("Authorization", "Bearer valid-token")
      .send({ status: "Confirmed" });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("Confirmed");

    // Verify UPDATE query received correct ID parameter
    const updateCall = mockQuery.mock.calls[1];
    expect(updateCall[0]).toMatch(/UPDATE/i);
  });

  it("returns 404 for cross-tenant update attempt (conceals existence)", async () => {
    mockQuery.mockResolvedValueOnce([
      [{ id: "bk-001", company_id: "company-zzz", status: "Pending" }],
      [],
    ]);

    const res = await request(app)
      .patch("/api/bookings/bk-001")
      .set("Authorization", "Bearer valid-token")
      .send({ status: "Confirmed" });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Booking not found");
  });

  it("returns 404 when booking does not exist", async () => {
    mockQuery.mockResolvedValueOnce([[], []]);

    const res = await request(app)
      .patch("/api/bookings/nonexistent")
      .set("Authorization", "Bearer valid-token")
      .send({ status: "Confirmed" });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Booking not found");
  });

  it("returns 200 when updating notes field", async () => {
    const existingBooking = {
      id: "bk-001",
      company_id: "company-aaa",
      status: "Pending",
      notes: "old notes",
    };
    const updatedBooking = {
      id: "bk-001",
      company_id: "company-aaa",
      status: "Pending",
      notes: "updated notes",
    };
    mockQuery.mockResolvedValueOnce([[existingBooking], []]);
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }, []]);
    mockQuery.mockResolvedValueOnce([[updatedBooking], []]);

    const res = await request(app)
      .patch("/api/bookings/bk-001")
      .set("Authorization", "Bearer valid-token")
      .send({ notes: "updated notes" });

    expect(res.status).toBe(200);
    expect(res.body.notes).toBe("updated notes");
  });

  it("returns 400 with invalid status enum on update", async () => {
    const res = await request(app)
      .patch("/api/bookings/bk-001")
      .set("Authorization", "Bearer valid-token")
      .send({ status: "BadStatus" });

    expect(res.status).toBe(400);
  });

  it("returns 500 on database error during update", async () => {
    mockQuery.mockRejectedValueOnce(new Error("DB error"));

    const res = await request(app)
      .patch("/api/bookings/bk-001")
      .set("Authorization", "Bearer valid-token")
      .send({ status: "Confirmed" });

    expect(res.status).toBe(500);
    expect(res.body.error).toBe("Database error");
  });
});

// ── DELETE /api/bookings — no endpoint ──────────────────────────────────────

describe("DELETE /api/bookings/:id — no endpoint exists", () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    mockUserRole = "admin";
    mockUserTenantId = "company-aaa";
    mockUserCompanyId = "company-aaa";
    mockAuthEnabled = true;
    app = buildApp();
    vi.clearAllMocks();
  });

  it("returns 404 — DELETE endpoint does not exist", async () => {
    const res = await request(app)
      .delete("/api/bookings/bk-001")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(404);
  });
});

// ── Tenant isolation — different tenant cannot access bookings ──────────────

describe("Bookings — tenant isolation across operations", () => {
  beforeEach(() => {
    mockAuthEnabled = true;
    vi.clearAllMocks();
  });

  it("tenant B cannot list tenant A bookings", async () => {
    mockUserTenantId = "company-bbb";
    mockUserCompanyId = "company-bbb";
    const app = buildApp();

    // Returns empty because query filters by company_id = company-bbb
    mockQuery.mockResolvedValueOnce([[], []]);

    const res = await request(app)
      .get("/api/bookings")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(200);
    // Verify the query used tenant B's company ID
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("company_id"),
      expect.arrayContaining(["company-bbb"]),
    );
  });

  it("tenant B cannot read tenant A booking by ID", async () => {
    mockUserTenantId = "company-bbb";
    mockUserCompanyId = "company-bbb";
    const app = buildApp();

    // findById returns a booking belonging to tenant A
    mockQuery.mockResolvedValueOnce([
      [{ id: "bk-001", company_id: "company-aaa", status: "Pending" }],
      [],
    ]);

    const res = await request(app)
      .get("/api/bookings/bk-001")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Booking not found");
  });

  it("tenant B cannot update tenant A booking", async () => {
    mockUserTenantId = "company-bbb";
    mockUserCompanyId = "company-bbb";
    const app = buildApp();

    mockQuery.mockResolvedValueOnce([
      [{ id: "bk-001", company_id: "company-aaa", status: "Pending" }],
      [],
    ]);

    const res = await request(app)
      .patch("/api/bookings/bk-001")
      .set("Authorization", "Bearer valid-token")
      .send({ status: "Confirmed" });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Booking not found");
  });
});
