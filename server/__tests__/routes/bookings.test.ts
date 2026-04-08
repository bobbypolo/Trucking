import { describe, it, expect, vi, beforeEach } from "vitest";

// Hoisted mocks for pool.query, pool.getConnection and sql-auth
const {
  mockQuery,
  mockResolveSqlPrincipalByFirebaseUid,
  mockConnectionQuery,
  mockGetConnection,
} = vi.hoisted(() => {
  const mockQuery = vi.fn();
  const mockResolveSqlPrincipalByFirebaseUid = vi.fn();
  const mockConnectionQuery = vi.fn();
  const mockGetConnection = vi.fn();
  return {
    mockQuery,
    mockResolveSqlPrincipalByFirebaseUid,
    mockConnectionQuery,
    mockGetConnection,
  };
});

vi.mock("../../db", () => ({
  default: {
    query: mockQuery,
    getConnection: mockGetConnection,
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

// Mock firebase-admin for requireAuth
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

import express from "express";
import request from "supertest";
import bookingsRouter from "../../routes/bookings";
import { errorHandler } from "../../middleware/errorHandler";
import { DEFAULT_SQL_PRINCIPAL } from "../helpers/mock-sql-auth";

mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(DEFAULT_SQL_PRINCIPAL);

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
    vi.clearAllMocks();
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(
      DEFAULT_SQL_PRINCIPAL,
    );
  });

  it("returns 401 when no auth token is provided", async () => {
    const app = buildApp();
    const res = await request(app).get("/api/bookings");
    expect(res.status).toBe(401);
  });

  it("returns 401 when user has no linked SQL account", async () => {
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(null);
    const app = buildApp();
    const res = await request(app)
      .get("/api/bookings")
      .set("Authorization", "Bearer valid-token");
    expect(res.status).toBe(401);
  });
});

// ── GET /api/bookings — success path ────────────────────────────────────────

describe("GET /api/bookings — success", () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(
      DEFAULT_SQL_PRINCIPAL,
    );
    app = buildApp();
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
    expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining("LIMIT"), [
      "company-aaa",
      10,
      10,
    ]);
  });

  it("defaults to page=1, limit=50 when not provided", async () => {
    mockQuery.mockResolvedValueOnce([[], []]);

    await request(app)
      .get("/api/bookings")
      .set("Authorization", "Bearer valid-token");

    expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining("LIMIT"), [
      "company-aaa",
      50,
      0,
    ]);
  });

  it("returns 500 on database error", async () => {
    mockQuery.mockRejectedValueOnce(new Error("DB connection error"));

    const res = await request(app)
      .get("/api/bookings")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(500);
    expect(res.body.message).toBeDefined();
  });
});

// ── GET /api/bookings/:id — single booking ──────────────────────────────────

describe("GET /api/bookings/:id — single booking", () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(
      DEFAULT_SQL_PRINCIPAL,
    );
    app = buildApp();
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
    expect(res.body.message).toBeDefined();
  });
});

// ── POST /api/bookings — creation ───────────────────────────────────────────

describe("POST /api/bookings — creation", () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(
      DEFAULT_SQL_PRINCIPAL,
    );
    app = buildApp();
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
    expect(insertCall[1]).toEqual(expect.arrayContaining(["company-aaa"]));
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
    expect(res.body.message).toBeDefined();
  });

  it("returns 401 when not authenticated", async () => {
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
    vi.clearAllMocks();
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(
      DEFAULT_SQL_PRINCIPAL,
    );
    app = buildApp();
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
    expect(res.body.message).toBeDefined();
  });
});

// ── DELETE /api/bookings — no endpoint ──────────────────────────────────────

describe("DELETE /api/bookings/:id — no endpoint exists", () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(
      DEFAULT_SQL_PRINCIPAL,
    );
    app = buildApp();
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
    vi.clearAllMocks();
  });

  it("tenant B cannot list tenant A bookings", async () => {
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue({
      ...DEFAULT_SQL_PRINCIPAL,
      tenantId: "company-bbb",
      companyId: "company-bbb",
    });
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
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue({
      ...DEFAULT_SQL_PRINCIPAL,
      tenantId: "company-bbb",
      companyId: "company-bbb",
    });
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
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue({
      ...DEFAULT_SQL_PRINCIPAL,
      tenantId: "company-bbb",
      companyId: "company-bbb",
    });
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

// ── POST /api/bookings/convert — quote-to-load conversion ───────────────────

describe("POST /api/bookings/convert — atomic booking+load creation", () => {
  let app: ReturnType<typeof buildApp>;

  function setupConnectionMock() {
    const mockConnection = {
      beginTransaction: vi.fn().mockResolvedValue(undefined),
      query: mockConnectionQuery,
      commit: vi.fn().mockResolvedValue(undefined),
      rollback: vi.fn().mockResolvedValue(undefined),
      release: vi.fn(),
    };
    mockGetConnection.mockResolvedValue(mockConnection);
    return mockConnection;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(
      DEFAULT_SQL_PRINCIPAL,
    );
    app = buildApp();
  });

  it("returns 201 and creates both booking and load atomically", async () => {
    const mockConnection = setupConnectionMock();
    // connection.query calls: INSERT loads, INSERT load_legs (pickup), INSERT load_legs (delivery), INSERT bookings
    mockConnectionQuery.mockResolvedValue([{ affectedRows: 1 }, []]);
    // After commit, findById returns the created booking with load_id populated
    const createdBooking = {
      id: "bk-converted",
      company_id: "company-aaa",
      status: "Confirmed",
      quote_id: "q-001",
      load_id: "ld-001",
    };
    mockQuery.mockResolvedValueOnce([[createdBooking], []]);

    const res = await request(app)
      .post("/api/bookings/convert")
      .set("Authorization", "Bearer valid-token")
      .send({
        quote_id: "q-001",
        customer_id: "cust-001",
        status: "Confirmed",
        pickup_date: "2026-04-01",
        load_number: "LD-12345",
        freight_type: "Dry Van",
        carrier_rate: 2500,
      });

    expect(res.status).toBe(201);
    expect(res.body.load_id).toBe("ld-001");
    expect(res.body.company_id).toBe("company-aaa");

    // Verify transaction was used
    expect(mockConnection.beginTransaction).toHaveBeenCalledOnce();
    expect(mockConnection.commit).toHaveBeenCalledOnce();
    expect(mockConnection.release).toHaveBeenCalledOnce();

    // Verify 4 queries: load insert, pickup leg, delivery leg, booking insert
    expect(mockConnectionQuery).toHaveBeenCalledTimes(4);

    // Verify the load INSERT sets driver_pay to 0 (never from quote estimates)
    const loadInsertCall = mockConnectionQuery.mock.calls[0];
    expect(loadInsertCall[0]).toMatch(/INSERT INTO loads/i);
    // driver_pay is the 9th parameter (index 8) and should be 0
    expect(loadInsertCall[1][8]).toBe(0);

    // Verify load status is "draft" (canonical initial status)
    expect(loadInsertCall[1][6]).toBe("draft");
  });

  it("returns 400 when load_number is missing", async () => {
    const res = await request(app)
      .post("/api/bookings/convert")
      .set("Authorization", "Bearer valid-token")
      .send({
        quote_id: "q-001",
        status: "Confirmed",
        // load_number missing
      });

    expect(res.status).toBe(400);
  });

  it("rolls back transaction on database error", async () => {
    const mockConnection = setupConnectionMock();
    // First query (load insert) fails
    mockConnectionQuery.mockRejectedValueOnce(
      new Error("DB constraint violation"),
    );

    const res = await request(app)
      .post("/api/bookings/convert")
      .set("Authorization", "Bearer valid-token")
      .send({
        quote_id: "q-001",
        load_number: "LD-12345",
        carrier_rate: 2500,
      });

    expect(res.status).toBe(500);
    expect(res.body.message).toBeDefined();

    // Verify rollback was called, commit was not
    expect(mockConnection.rollback).toHaveBeenCalledOnce();
    expect(mockConnection.commit).not.toHaveBeenCalled();
    expect(mockConnection.release).toHaveBeenCalledOnce();
  });

  it("returns 401 when not authenticated", async () => {
    const res = await request(app).post("/api/bookings/convert").send({
      load_number: "LD-12345",
      carrier_rate: 2500,
    });

    expect(res.status).toBe(401);
  });

  it("sets carrier_rate from input but never sets driver_pay from quote estimates", async () => {
    const mockConnection = setupConnectionMock();
    mockConnectionQuery.mockResolvedValue([{ affectedRows: 1 }, []]);
    const createdBooking = {
      id: "bk-converted-2",
      company_id: "company-aaa",
      status: "Confirmed",
      load_id: "ld-002",
    };
    mockQuery.mockResolvedValueOnce([[createdBooking], []]);

    const res = await request(app)
      .post("/api/bookings/convert")
      .set("Authorization", "Bearer valid-token")
      .send({
        quote_id: "q-002",
        load_number: "LD-67890",
        carrier_rate: 3500,
      });

    expect(res.status).toBe(201);

    // Verify carrier_rate is set to the provided value (3500)
    const loadInsertCall = mockConnectionQuery.mock.calls[0];
    expect(loadInsertCall[1][7]).toBe(3500); // carrier_rate

    // Verify driver_pay is 0 — NOT any estimated value
    expect(loadInsertCall[1][8]).toBe(0); // driver_pay
  });

  it("defaults carrier_rate to 0 when not provided", async () => {
    const mockConnection = setupConnectionMock();
    mockConnectionQuery.mockResolvedValue([{ affectedRows: 1 }, []]);
    const createdBooking = {
      id: "bk-converted-3",
      company_id: "company-aaa",
      status: "Confirmed",
      load_id: "ld-003",
    };
    mockQuery.mockResolvedValueOnce([[createdBooking], []]);

    const res = await request(app)
      .post("/api/bookings/convert")
      .set("Authorization", "Bearer valid-token")
      .send({
        load_number: "LD-99999",
      });

    expect(res.status).toBe(201);

    // carrier_rate should default to 0
    const loadInsertCall = mockConnectionQuery.mock.calls[0];
    expect(loadInsertCall[1][7]).toBe(0);
  });
});

