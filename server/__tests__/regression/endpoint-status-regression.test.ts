/**
 * Endpoint status code regression tests — S-7.4
 *
 * Verifies that 14 endpoints return correct HTTP 200 status codes,
 * grouped by their previous failure mode:
 *   - 9 endpoints that previously returned 500 (R-P7-06)
 *   - 2 endpoints that previously returned 401 (R-P7-07)
 *   - 3 endpoints that previously returned 404 (R-P7-08)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Hoisted mocks ────────────────────────────────────────────────────────────

const {
  mockPoolQuery,
  mockResolveSqlPrincipalByFirebaseUid,
  mockFirestoreDocGet,
} = vi.hoisted(() => {
  return {
    mockPoolQuery: vi.fn(),
    mockResolveSqlPrincipalByFirebaseUid: vi.fn(),
    mockFirestoreDocGet: vi.fn(),
  };
});

// ── Module mocks ─────────────────────────────────────────────────────────────

vi.mock("../../db", () => ({
  default: {
    query: mockPoolQuery,
    getConnection: vi.fn(),
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

vi.mock("firebase-admin", () => {
  const mockAuth = {
    verifyIdToken: vi.fn().mockResolvedValue({ uid: "firebase-uid-1" }),
  };
  const mockFirestore = {
    collection: vi.fn().mockReturnValue({
      doc: vi.fn().mockReturnValue({
        get: mockFirestoreDocGet,
        set: vi.fn().mockResolvedValue(undefined),
      }),
      where: vi.fn().mockReturnValue({
        get: vi.fn().mockResolvedValue({ docs: [] }),
        limit: vi.fn().mockReturnValue({
          get: vi.fn().mockResolvedValue({
            empty: false,
            docs: [
              {
                id: "user-1",
                data: () => ({
                  id: "user-1",
                  company_id: "company-aaa",
                  role: "admin",
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
  findSqlCompanyById: vi.fn().mockResolvedValue({
    id: "company-aaa",
    name: "Test Company",
  }),
  mapCompanyRowToApiCompany: vi.fn((row: any) => row),
}));

// Firestore module used by clients.ts
vi.mock("../../firestore", () => ({
  default: {
    collection: vi.fn().mockReturnValue({
      doc: vi.fn().mockReturnValue({
        get: mockFirestoreDocGet,
        set: vi.fn().mockResolvedValue(undefined),
      }),
      where: vi.fn().mockReturnValue({
        get: vi.fn().mockResolvedValue({ docs: [] }),
        limit: vi.fn().mockReturnValue({
          get: vi.fn().mockResolvedValue({ empty: true, docs: [] }),
        }),
      }),
    }),
  },
}));

// Helpers used by clients.ts and equipment.ts
vi.mock("../../helpers", () => ({
  redactData: vi.fn((data: any) => data),
  getVisibilitySettings: vi.fn().mockResolvedValue({}),
}));

// GeoUtils used by accounting.ts
vi.mock("../../geoUtils", () => ({
  detectState: vi.fn().mockReturnValue("TX"),
  calculateDistance: vi.fn().mockReturnValue(50),
}));

// Services used by safety.ts
vi.mock("../../services/fmcsa.service", () => ({
  getSafetyScore: vi.fn().mockResolvedValue(null),
}));

vi.mock("../../services/cert-expiry-checker", () => ({
  checkExpiring: vi.fn().mockResolvedValue([]),
}));

// Schemas — pass-through validation
vi.mock("../../middleware/validate", () => ({
  validateBody:
    (_schema: unknown) => (_req: unknown, _res: unknown, next: Function) =>
      next(),
}));

vi.mock("../../schemas/quote", () => ({
  createQuoteSchema: {},
  updateQuoteSchema: {},
}));

vi.mock("../../schemas/lead", () => ({
  createLeadSchema: {},
  updateLeadSchema: {},
}));

vi.mock("../../schemas/booking", () => ({
  createBookingSchema: {},
  updateBookingSchema: {},
  convertBookingSchema: {},
}));

vi.mock("../../schemas/task", () => ({
  createTaskSchema: {},
  updateTaskSchema: {},
  createWorkItemSchema: {},
  updateWorkItemSchema: {},
}));

vi.mock("../../schemas/kci-request", () => ({
  createKciRequestSchema: {},
  updateKciRequestSchema: {},
}));

vi.mock("../../schemas/provider", () => ({
  createProviderSchema: {},
  updateProviderSchema: {},
}));

vi.mock("../../schemas/contact", () => ({
  createContactSchema: {},
  updateContactSchema: {},
}));

vi.mock("../../schemas/settlements", () => ({
  createSettlementSchema: {},
}));

vi.mock("../../schemas/accounting", () => ({
  createJournalEntrySchema: {},
  createInvoiceSchema: {},
  createBillSchema: {},
  createDocumentVaultSchema: {},
  batchImportSchema: {},
  batchUpdateSettlementsSchema: {},
}));

vi.mock("../../schemas/parties", () => ({
  createPartySchema: {},
}));

vi.mock("../../schemas/client", () => ({
  createClientSchema: {},
}));

vi.mock("../../schemas/equipment", () => ({
  createEquipmentSchema: {},
  patchEquipmentSchema: {},
}));

vi.mock("../../middleware/requireTier", () => ({
  requireTier: () => (_req: any, _res: any, next: any) => next(),
}));

vi.mock("../../errors/AppError", () => ({
  NotFoundError: class extends Error {
    statusCode = 404;
    constructor(msg: string) {
      super(msg);
    }
  },
  ForbiddenError: class extends Error {
    statusCode = 403;
    constructor(msg: string) {
      super(msg);
    }
  },
}));

// ── Imports (after mocks) ────────────────────────────────────────────────────

import express from "express";
import request from "supertest";
import { errorHandler } from "../../middleware/errorHandler";
import { DEFAULT_SQL_PRINCIPAL } from "../helpers/mock-sql-auth";

// Route imports
import quotesRouter from "../../routes/quotes";
import leadsRouter from "../../routes/leads";
import bookingsRouter from "../../routes/bookings";
import tasksRouter from "../../routes/tasks";
import kciRequestsRouter from "../../routes/kci-requests";
import dispatchRouter from "../../routes/dispatch";
import providersRouter from "../../routes/providers";
import contactsRouter from "../../routes/contacts";
import safetyRouter from "../../routes/safety";
import accountingRouter from "../../routes/accounting";
import clientsRouter from "../../routes/clients";
import equipmentRouter from "../../routes/equipment";

// ── Setup ────────────────────────────────────────────────────────────────────

const AUTH_HEADER = "Bearer valid-token";

mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(DEFAULT_SQL_PRINCIPAL);

function buildApp(router: any) {
  const app = express();
  app.use(express.json());
  app.use(router);
  app.use(errorHandler);
  return app;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(DEFAULT_SQL_PRINCIPAL);
  // Default pool.query returns empty result set [rows, fields]
  mockPoolQuery.mockResolvedValue([[], []]);
  // Default Firestore doc.get returns existing doc
  mockFirestoreDocGet.mockResolvedValue({
    exists: true,
    data: () => ({ id: "company-aaa", name: "Test Company" }),
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// R-P7-06: 9 endpoints that previously returned 500 now return 200
// ═════════════════════════════════════════════════════════════════════════════

describe("R-P7-06: Previously-500 endpoints now return 200", () => {
  it("GET /api/quotes returns 200", async () => {
    mockPoolQuery.mockResolvedValueOnce([[], []]);
    const app = buildApp(quotesRouter);
    const res = await request(app)
      .get("/api/quotes")
      .set("Authorization", AUTH_HEADER);
    expect(res.status).toBe(200);
  });

  it("GET /api/leads returns 200", async () => {
    mockPoolQuery.mockResolvedValueOnce([[], []]);
    const app = buildApp(leadsRouter);
    const res = await request(app)
      .get("/api/leads")
      .set("Authorization", AUTH_HEADER);
    expect(res.status).toBe(200);
  });

  it("GET /api/bookings returns 200", async () => {
    mockPoolQuery.mockResolvedValueOnce([[], []]);
    const app = buildApp(bookingsRouter);
    const res = await request(app)
      .get("/api/bookings")
      .set("Authorization", AUTH_HEADER);
    expect(res.status).toBe(200);
  });

  it("GET /api/work-items returns 200", async () => {
    mockPoolQuery.mockResolvedValueOnce([[], []]);
    const app = buildApp(tasksRouter);
    const res = await request(app)
      .get("/api/work-items")
      .set("Authorization", AUTH_HEADER);
    expect(res.status).toBe(200);
  });

  it("GET /api/kci-requests returns 200", async () => {
    mockPoolQuery.mockResolvedValueOnce([[], []]);
    const app = buildApp(kciRequestsRouter);
    const res = await request(app)
      .get("/api/kci-requests")
      .set("Authorization", AUTH_HEADER);
    expect(res.status).toBe(200);
  });

  it("GET /api/dashboard/cards returns 200", async () => {
    mockPoolQuery.mockResolvedValueOnce([[], []]);
    const app = buildApp(dispatchRouter);
    const res = await request(app)
      .get("/api/dashboard/cards")
      .set("Authorization", AUTH_HEADER);
    expect(res.status).toBe(200);
  });

  it("GET /api/providers returns 200", async () => {
    mockPoolQuery.mockResolvedValueOnce([[], []]);
    const app = buildApp(providersRouter);
    const res = await request(app)
      .get("/api/providers")
      .set("Authorization", AUTH_HEADER);
    expect(res.status).toBe(200);
  });

  it("GET /api/contacts returns 200", async () => {
    mockPoolQuery.mockResolvedValueOnce([[], []]);
    const app = buildApp(contactsRouter);
    const res = await request(app)
      .get("/api/contacts")
      .set("Authorization", AUTH_HEADER);
    expect(res.status).toBe(200);
  });

  it("GET /api/safety/vendors returns 200", async () => {
    mockPoolQuery.mockResolvedValueOnce([[], []]);
    const app = buildApp(safetyRouter);
    const res = await request(app)
      .get("/api/safety/vendors")
      .set("Authorization", AUTH_HEADER);
    expect(res.status).toBe(200);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// R-P7-07: 2 endpoints that previously returned 401 now return 200
// ═════════════════════════════════════════════════════════════════════════════

describe("R-P7-07: Previously-401 endpoints now return 200", () => {
  it("GET /api/accounting/accounts returns 200", async () => {
    mockPoolQuery.mockResolvedValueOnce([[], []]);
    const app = buildApp(accountingRouter);
    const res = await request(app)
      .get("/api/accounting/accounts")
      .set("Authorization", AUTH_HEADER);
    expect(res.status).toBe(200);
  });

  it("GET /api/accounting/invoices returns 200", async () => {
    mockPoolQuery.mockResolvedValueOnce([[], []]);
    const app = buildApp(accountingRouter);
    const res = await request(app)
      .get("/api/accounting/invoices")
      .set("Authorization", AUTH_HEADER);
    expect(res.status).toBe(200);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// R-P7-08: 3 endpoints that previously returned 404 now return 200
// ═════════════════════════════════════════════════════════════════════════════

describe("R-P7-08: Previously-404 endpoints now return 200", () => {
  it("GET /api/companies/:id returns 200", async () => {
    // Firestore returns existing company doc
    mockFirestoreDocGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({ id: "company-aaa", name: "Test Company" }),
    });
    const app = buildApp(clientsRouter);
    const res = await request(app)
      .get("/api/companies/company-aaa")
      .set("Authorization", AUTH_HEADER);
    expect(res.status).toBe(200);
  });

  it("GET /api/dispatch-events/:companyId returns 200", async () => {
    mockPoolQuery.mockResolvedValueOnce([[], []]);
    const app = buildApp(dispatchRouter);
    const res = await request(app)
      .get("/api/dispatch-events/company-aaa")
      .set("Authorization", AUTH_HEADER);
    expect(res.status).toBe(200);
  });

  it("GET /api/equipment/:companyId returns 200", async () => {
    mockPoolQuery.mockResolvedValueOnce([[], []]);
    const app = buildApp(equipmentRouter);
    const res = await request(app)
      .get("/api/equipment/company-aaa")
      .set("Authorization", AUTH_HEADER);
    expect(res.status).toBe(200);
  });
});
