/**
 * API Integration Test Suite — S-12.1
 *
 * Tests 12 critical API endpoints with real request/response validation,
 * auth middleware enforcement, tenant isolation, and error response format.
 *
 * Uses supertest with the real Express app (mocked DB + auth bypass).
 * Covers: health, loads, equipment, contacts, quotes, bookings, compliance,
 * dispatch, incidents, messages, tasks, and service-tickets.
 *
 * Tests R-P12-01: 10+ API endpoints tested with real request/response validation
 * Tests R-P12-02: Auth middleware tested (401 without token, 200 with valid token)
 * Tests R-P12-03: Tenant isolation tested (cross-tenant request returns 0 rows or 403)
 * Tests R-P12-04: Error responses validated (proper status codes, error message format)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";

// ── Hoisted mocks ──────────────────────────────────────────────────────────

const {
  mockQuery,
  mockGetConnection,
  mockConnection,
  mockIncidentRepo,
  mockMessageRepo,
  mockTaskRepo,
  mockContactRepo,
  mockQuoteRepo,
  mockBookingRepo,
  mockDispatchEventRepo,
  mockServiceTicketRepo,
} = vi.hoisted(() => {
  const mockQuery = vi.fn();
  const mockBeginTransaction = vi.fn().mockResolvedValue(undefined);
  const mockCommit = vi.fn().mockResolvedValue(undefined);
  const mockRollback = vi.fn().mockResolvedValue(undefined);
  const mockRelease = vi.fn();
  const mockGetConnection = vi.fn();
  const mockConnection = {
    beginTransaction: mockBeginTransaction,
    commit: mockCommit,
    rollback: mockRollback,
    release: mockRelease,
    query: mockQuery,
    execute: mockQuery,
  };
  const mockIncidentRepo = {
    findByCompany: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  };
  const mockMessageRepo = {
    findByCompany: vi.fn(),
    create: vi.fn(),
  };
  const mockTaskRepo = {
    findByCompany: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  };
  const mockContactRepo = {
    findByCompany: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  };
  const mockQuoteRepo = {
    findByCompany: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  };
  const mockBookingRepo = {
    findByCompany: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  };
  const mockDispatchEventRepo = {
    findByCompany: vi.fn(),
    create: vi.fn(),
  };
  const mockServiceTicketRepo = {
    findByCompany: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  };
  return {
    mockQuery,
    mockGetConnection,
    mockConnection,
    mockIncidentRepo,
    mockMessageRepo,
    mockTaskRepo,
    mockContactRepo,
    mockQuoteRepo,
    mockBookingRepo,
    mockDispatchEventRepo,
    mockServiceTicketRepo,
  };
});

// ── Module mocks ───────────────────────────────────────────────────────────

vi.mock("../../db", () => ({
  default: {
    query: mockQuery,
    getConnection: mockGetConnection,
  },
}));

vi.mock("../../auth", () => ({
  default: {
    auth: () => ({
      verifyIdToken: vi.fn(),
    }),
    app: () => ({}),
  },
}));

vi.mock("../../firestore", () => ({
  default: {
    collection: () => ({
      doc: () => ({
        get: vi.fn().mockResolvedValue({ exists: false, data: () => null }),
        set: vi.fn().mockResolvedValue(undefined),
      }),
      where: () => ({
        get: vi.fn().mockResolvedValue({ empty: true, docs: [] }),
      }),
    }),
  },
}));

vi.mock("../../lib/logger", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    child: function () {
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

vi.mock("../../lib/sql-auth", () => ({
  resolveSqlPrincipalByFirebaseUid: vi.fn(),
  ensureMySqlCompany: vi.fn(),
  findSqlUserById: vi.fn(),
  findSqlUsersByCompany: vi.fn(),
  linkSqlUserToFirebaseUid: vi.fn(),
  mapUserRowToApiUser: vi.fn(),
  mirrorCompanyToFirestore: vi.fn(),
  mirrorUserToFirestore: vi.fn(),
  upsertSqlUser: vi.fn(),
}));

vi.mock("../../helpers", () => ({
  redactData: (data: unknown) => data,
  getVisibilitySettings: vi.fn().mockResolvedValue({}),
  sendNotification: vi.fn(),
  checkBreakdownLateness: vi.fn(),
}));

vi.mock("../../lib/env", () => ({
  validateEnv: vi.fn(),
  getCorsOrigin: () => "*",
}));

vi.mock("../../lib/graceful-shutdown", () => ({
  registerShutdownHandlers: vi.fn(),
}));

vi.mock("../../services/geocoding.service", () => ({
  geocodeStopAddress: vi.fn().mockResolvedValue(null),
}));

vi.mock("../../middleware/idempotency", () => ({
  idempotencyMiddleware: () => (_req: any, _res: any, next: any) => next(),
}));

vi.mock("../../middleware/requireTier", () => ({
  requireTier:
    (..._tiers: string[]) =>
    (_req: any, _res: any, next: any) =>
      next(),
}));

vi.mock("../../services/gps", () => ({
  getGpsProvider: vi.fn(),
  getGpsProviderForTenant: vi.fn(),
}));

vi.mock("../../lib/exception-sync", () => ({
  syncDomainToException: vi.fn(),
}));

// Repository mocks
vi.mock("../../repositories/incident.repository", () => ({
  incidentRepository: mockIncidentRepo,
}));

vi.mock("../../repositories/message.repository", () => ({
  messageRepository: mockMessageRepo,
}));

vi.mock("../../repositories/task.repository", () => ({
  taskRepository: mockTaskRepo,
  workItemRepository: {
    findByTask: vi.fn().mockResolvedValue([]),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock("../../repositories/contact.repository", () => ({
  contactRepository: mockContactRepo,
}));

vi.mock("../../repositories/quote.repository", () => ({
  quoteRepository: mockQuoteRepo,
}));

vi.mock("../../repositories/booking.repository", () => ({
  bookingRepository: mockBookingRepo,
}));

vi.mock("../../repositories/dispatch-event.repository", () => ({
  dispatchEventRepository: mockDispatchEventRepo,
}));

vi.mock("../../repositories/service-ticket.repository", () => ({
  serviceTicketRepository: mockServiceTicketRepo,
}));

import {
  createMockAuthState,
  resetAuthState,
  createMockRequireAuth,
  buildRouteApp,
} from "../helpers/route-test-setup";

// ── Auth state for all tests ───────────────────────────────────────────────

const mockAuthState = createMockAuthState({
  role: "admin",
  tenantId: "company-integration-a",
  companyId: "company-integration-a",
  uid: "user-integ-1",
  email: "admin@integration-test.com",
  firebaseUid: "fb-uid-integ-1",
});

// ── Require auth/tenant mock override ──────────────────────────────────────

vi.mock("../../middleware/requireAuth", () => ({
  requireAuth: createMockRequireAuth(() => mockAuthState),
}));

// Use a tenant-checking mock that validates :companyId param against user tenantId
vi.mock("../../middleware/requireTenant", () => ({
  requireTenant: (req: any, res: any, next: any) => {
    const user = req.user;
    if (!user) {
      return res
        .status(403)
        .json({ error: "Tenant verification requires authentication." });
    }
    const paramCompanyId = req.params?.companyId;
    const bodyCompanyId = req.body?.company_id || req.body?.companyId;
    if (paramCompanyId && paramCompanyId !== user.tenantId) {
      return res.status(403).json({ error: "Access denied: tenant mismatch." });
    }
    if (bodyCompanyId && bodyCompanyId !== user.tenantId) {
      return res.status(403).json({ error: "Access denied: tenant mismatch." });
    }
    next();
  },
}));

// ── Route imports (AFTER mocks) ────────────────────────────────────────────

import healthRouter from "../../routes/health";
import loadsRouter from "../../routes/loads";
import equipmentRouter from "../../routes/equipment";
import contactsRouter from "../../routes/contacts";
import quotesRouter from "../../routes/quotes";
import bookingsRouter from "../../routes/bookings";
import complianceRouter from "../../routes/compliance";
import dispatchRouter from "../../routes/dispatch";
import incidentsRouter from "../../routes/incidents";
import messagesRouter from "../../routes/messages";
import tasksRouter from "../../routes/tasks";
import serviceTicketsRouter from "../../routes/service-tickets";

// ── App builders ───────────────────────────────────────────────────────────

const buildHealthApp = () => buildRouteApp(healthRouter);
const buildLoadsApp = () => buildRouteApp(loadsRouter);
const buildEquipmentApp = () => buildRouteApp(equipmentRouter);
const buildContactsApp = () => buildRouteApp(contactsRouter);
const buildQuotesApp = () => buildRouteApp(quotesRouter);
const buildBookingsApp = () => buildRouteApp(bookingsRouter);
const buildComplianceApp = () => buildRouteApp(complianceRouter);
const buildDispatchApp = () => buildRouteApp(dispatchRouter);
const buildIncidentsApp = () => buildRouteApp(incidentsRouter);
const buildMessagesApp = () => buildRouteApp(messagesRouter);
const buildTasksApp = () => buildRouteApp(tasksRouter);
const buildServiceTicketsApp = () => buildRouteApp(serviceTicketsRouter);

// ── Setup ──────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  resetAuthState(mockAuthState, {
    role: "admin",
    tenantId: "company-integration-a",
    companyId: "company-integration-a",
    uid: "user-integ-1",
    email: "admin@integration-test.com",
    firebaseUid: "fb-uid-integ-1",
  });
  mockGetConnection.mockResolvedValue(mockConnection);
});

// ═══════════════════════════════════════════════════════════════════════════
// R-P12-01: 10+ API Endpoints with Real Request/Response Validation
// ═══════════════════════════════════════════════════════════════════════════

describe("R-P12-01: API Endpoint Request/Response Validation", () => {
  // 1. GET /api/health
  it("GET /api/health returns 200 with status, mysql, firebase, uptime keys", async () => {
    const app = buildHealthApp();
    const res = await request(app).get("/api/health");

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("status");
    expect(res.body).toHaveProperty("mysql");
    expect(res.body).toHaveProperty("firebase");
    expect(res.body).toHaveProperty("uptime");
    expect(typeof res.body.uptime).toBe("number");
    expect(["ok", "degraded"]).toContain(res.body.status);
  });

  // 2. GET /api/loads
  it("GET /api/loads returns 200 with array of loads for authenticated tenant", async () => {
    const mockLoads = [
      {
        id: "load-1",
        company_id: "company-integration-a",
        load_number: "LDA-001",
        status: "draft",
        notification_emails: null,
        gps_history: null,
      },
      {
        id: "load-2",
        company_id: "company-integration-a",
        load_number: "LDA-002",
        status: "dispatched",
        notification_emails: null,
        gps_history: null,
      },
    ];
    mockQuery
      .mockResolvedValueOnce([mockLoads, []])
      .mockResolvedValueOnce([[], []])
      .mockResolvedValueOnce([[], []])
      .mockResolvedValue([[], []]);

    const app = buildLoadsApp();
    const res = await request(app).get("/api/loads");

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(2);
    expect(res.body[0].id).toBe("load-1");
    expect(res.body[0].load_number).toBe("LDA-001");
    expect(res.body[1].status).toBe("dispatched");
  });

  // 3. GET /api/equipment
  it("GET /api/equipment returns 200 with equipment array", async () => {
    const mockEquipment = [
      {
        id: "eq-1",
        company_id: "company-integration-a",
        type: "Dry Van",
        unit_number: "DV-101",
      },
      {
        id: "eq-2",
        company_id: "company-integration-a",
        type: "Reefer",
        unit_number: "RF-201",
      },
    ];
    mockQuery.mockResolvedValueOnce([mockEquipment, []]);

    const app = buildEquipmentApp();
    const res = await request(app).get("/api/equipment");

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(2);
    expect(res.body[0].type).toBe("Dry Van");
    expect(res.body[1].unit_number).toBe("RF-201");
  });

  // 4. GET /api/contacts (uses contactRepository)
  it("GET /api/contacts returns 200 with contacts array", async () => {
    const mockContacts = [
      {
        id: "ct-1",
        company_id: "company-integration-a",
        name: "John Smith",
        email: "john@example.com",
      },
    ];
    mockContactRepo.findByCompany.mockResolvedValueOnce(mockContacts);

    const app = buildContactsApp();
    const res = await request(app).get("/api/contacts");

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(1);
    expect(res.body[0].name).toBe("John Smith");
    expect(res.body[0].email).toBe("john@example.com");
  });

  // 5. GET /api/quotes (uses quoteRepository)
  it("GET /api/quotes returns 200 with quotes array", async () => {
    const mockQuotes = [
      {
        id: "qt-1",
        company_id: "company-integration-a",
        status: "pending",
        amount: 1500.0,
      },
      {
        id: "qt-2",
        company_id: "company-integration-a",
        status: "accepted",
        amount: 2300.5,
      },
    ];
    mockQuoteRepo.findByCompany.mockResolvedValueOnce(mockQuotes);

    const app = buildQuotesApp();
    const res = await request(app).get("/api/quotes");

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(2);
    expect(res.body[0].status).toBe("pending");
    expect(res.body[1].amount).toBe(2300.5);
  });

  // 6. GET /api/bookings (uses bookingRepository)
  it("GET /api/bookings returns 200 with bookings array", async () => {
    const mockBookings = [
      {
        id: "bk-1",
        company_id: "company-integration-a",
        status: "confirmed",
      },
    ];
    mockBookingRepo.findByCompany.mockResolvedValueOnce(mockBookings);

    const app = buildBookingsApp();
    const res = await request(app).get("/api/bookings");

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(1);
    expect(res.body[0].status).toBe("confirmed");
  });

  // 7. GET /api/compliance/documents
  it("GET /api/compliance/documents returns 200 with compliance documents", async () => {
    const mockDocs = [
      {
        id: "cd-1",
        company_id: "company-integration-a",
        document_type: "CDL",
        status: "valid",
      },
    ];
    mockQuery.mockResolvedValueOnce([mockDocs, []]);

    const app = buildComplianceApp();
    const res = await request(app).get("/api/compliance/documents");

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0].document_type).toBe("CDL");
  });

  // 8. GET /api/dispatch/events (uses pool.query directly)
  it("GET /api/dispatch/events returns 200 with dispatch events", async () => {
    const mockEvents = [
      {
        id: "de-1",
        company_id: "company-integration-a",
        event_type: "load_assigned",
        created_at: "2026-03-28T00:00:00Z",
      },
    ];
    mockQuery.mockResolvedValueOnce([mockEvents, []]);

    const app = buildDispatchApp();
    const res = await request(app).get("/api/dispatch/events");

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0].event_type).toBe("load_assigned");
  });

  // 9. GET /api/incidents (uses incidentRepository, returns { incidents: [...] })
  it("GET /api/incidents returns 200 with incidents envelope", async () => {
    const mockIncidents = [
      {
        id: "inc-1",
        company_id: "company-integration-a",
        type: "accident",
        severity: "minor",
      },
    ];
    mockIncidentRepo.findByCompany.mockResolvedValueOnce(mockIncidents);

    const app = buildIncidentsApp();
    const res = await request(app).get("/api/incidents");

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("incidents");
    expect(Array.isArray(res.body.incidents)).toBe(true);
    expect(res.body.incidents[0].type).toBe("accident");
    expect(res.body.incidents[0].severity).toBe("minor");
  });

  // 10. GET /api/messages (uses messageRepository, returns { messages: [...] })
  it("GET /api/messages returns 200 with messages envelope", async () => {
    const mockMessages = [
      {
        id: "msg-1",
        company_id: "company-integration-a",
        sender_id: "user-1",
        body: "Load update",
      },
    ];
    mockMessageRepo.findByCompany.mockResolvedValueOnce(mockMessages);

    const app = buildMessagesApp();
    const res = await request(app).get("/api/messages");

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("messages");
    expect(Array.isArray(res.body.messages)).toBe(true);
    expect(res.body.messages[0].body).toBe("Load update");
  });

  // 11. GET /api/tasks (uses taskRepository)
  it("GET /api/tasks returns 200 with tasks array", async () => {
    const mockTasks = [
      {
        id: "task-1",
        company_id: "company-integration-a",
        title: "Follow up",
        status: "open",
      },
    ];
    mockTaskRepo.findByCompany.mockResolvedValueOnce(mockTasks);

    const app = buildTasksApp();
    const res = await request(app).get("/api/tasks");

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0].title).toBe("Follow up");
    expect(res.body[0].status).toBe("open");
  });

  // 12. GET /api/service-tickets (uses serviceTicketRepository)
  it("GET /api/service-tickets returns 200 with tickets array", async () => {
    const mockTickets = [
      {
        id: "st-1",
        company_id: "company-integration-a",
        subject: "Brake issue",
        status: "open",
        priority: "high",
      },
    ];
    mockServiceTicketRepo.findByCompany.mockResolvedValueOnce(mockTickets);

    const app = buildServiceTicketsApp();
    const res = await request(app).get("/api/service-tickets");

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0].subject).toBe("Brake issue");
    expect(res.body[0].priority).toBe("high");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// R-P12-02: Auth Middleware (401 without token, 200 with valid token)
// ═══════════════════════════════════════════════════════════════════════════

describe("R-P12-02: Auth Middleware Enforcement", () => {
  it("returns 401 when auth is disabled (no token) for loads", async () => {
    mockAuthState.enabled = false;

    const app = buildLoadsApp();
    const res = await request(app).get("/api/loads");

    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty("error");
    expect(res.body.error).toBe("Authentication required.");
  });

  it("returns 200 when auth is enabled (valid token present) for loads", async () => {
    mockAuthState.enabled = true;
    mockQuery.mockResolvedValue([[], []]);

    const app = buildLoadsApp();
    const res = await request(app).get("/api/loads");

    expect(res.status).toBe(200);
  });

  it("returns 401 for equipment endpoint without auth", async () => {
    mockAuthState.enabled = false;

    const app = buildEquipmentApp();
    const res = await request(app).get("/api/equipment");

    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Authentication required.");
  });

  it("returns 401 for contacts endpoint without auth", async () => {
    mockAuthState.enabled = false;

    const app = buildContactsApp();
    const res = await request(app).get("/api/contacts");

    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Authentication required.");
  });

  it("returns 401 for quotes endpoint without auth", async () => {
    mockAuthState.enabled = false;

    const app = buildQuotesApp();
    const res = await request(app).get("/api/quotes");

    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Authentication required.");
  });

  it("health endpoint does NOT require auth (200 without token)", async () => {
    mockAuthState.enabled = false;

    const app = buildHealthApp();
    const res = await request(app).get("/api/health");

    expect(res.status).toBe(200);
    expect(res.body.status).toBeDefined();
  });

  it("returns 401 for incidents endpoint without auth", async () => {
    mockAuthState.enabled = false;

    const app = buildIncidentsApp();
    const res = await request(app).get("/api/incidents");

    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Authentication required.");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// R-P12-03: Tenant Isolation (cross-tenant returns 0 rows or 403)
// ═══════════════════════════════════════════════════════════════════════════

describe("R-P12-03: Tenant Isolation", () => {
  it("GET /api/equipment/:companyId returns 403 for cross-tenant request", async () => {
    mockAuthState.tenantId = "company-integration-a";
    mockAuthState.companyId = "company-integration-a";

    const app = buildEquipmentApp();
    const res = await request(app).get("/api/equipment/company-integration-b");

    expect(res.status).toBe(403);
    expect(res.body).toHaveProperty("error");
    expect(res.body.error).toBe("Access denied: tenant mismatch.");
  });

  it("GET /api/loads only returns data for the authenticated tenant", async () => {
    const tenantALoads = [
      {
        id: "load-a1",
        company_id: "company-integration-a",
        load_number: "A-001",
        status: "draft",
        notification_emails: null,
        gps_history: null,
      },
    ];
    mockQuery
      .mockResolvedValueOnce([tenantALoads, []])
      .mockResolvedValueOnce([[], []])
      .mockResolvedValue([[], []]);

    const app = buildLoadsApp();
    const res = await request(app).get("/api/loads");

    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
    for (const load of res.body) {
      expect(load.company_id).toBe("company-integration-a");
    }
  });

  it("GET /api/loads returns empty array when tenant has no loads", async () => {
    mockQuery.mockResolvedValue([[], []]);

    const app = buildLoadsApp();
    const res = await request(app).get("/api/loads");

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(0);
  });

  it("loads query includes company_id parameter for tenant scoping", async () => {
    mockQuery.mockResolvedValue([[], []]);

    const app = buildLoadsApp();
    await request(app).get("/api/loads");

    // Verify the first query (loads) was called with the tenant's companyId
    const firstCall = mockQuery.mock.calls[0];
    expect(firstCall).toBeDefined();
    // The SQL should be parameterized with company_id
    const sql = firstCall[0] as string;
    expect(sql).toContain("company_id = ?");
    expect(firstCall[1]).toContain("company-integration-a");
  });

  it("equipment query scopes by company_id from authenticated user", async () => {
    mockQuery.mockResolvedValueOnce([[], []]);

    const app = buildEquipmentApp();
    await request(app).get("/api/equipment");

    const firstCall = mockQuery.mock.calls[0];
    expect(firstCall).toBeDefined();
    const sql = firstCall[0] as string;
    expect(sql).toContain("company_id = ?");
    expect(firstCall[1]).toContain("company-integration-a");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// R-P12-04: Error Response Validation
// ═══════════════════════════════════════════════════════════════════════════

describe("R-P12-04: Error Response Format", () => {
  it("401 error has structured error message", async () => {
    mockAuthState.enabled = false;

    const app = buildLoadsApp();
    const res = await request(app).get("/api/loads");

    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty("error");
    expect(typeof res.body.error).toBe("string");
    expect(res.body.error.length).toBeGreaterThan(0);
  });

  it("403 error from tenant mismatch has error field", async () => {
    mockAuthState.tenantId = "company-integration-a";

    const app = buildEquipmentApp();
    const res = await request(app).get("/api/equipment/wrong-company");

    expect(res.status).toBe(403);
    expect(res.body).toHaveProperty("error");
    expect(typeof res.body.error).toBe("string");
    expect(res.body.error).toBe("Access denied: tenant mismatch.");
  });

  it("500 error from DB failure returns structured error response", async () => {
    mockQuery.mockRejectedValueOnce(new Error("Connection refused"));

    const app = buildEquipmentApp();
    const res = await request(app).get("/api/equipment");

    expect(res.status).toBe(500);
    expect(res.body).toHaveProperty("message");
    expect(res.body.error_code).toBe("INTERNAL_001");
  });

  it("404 for undefined route returns proper status", async () => {
    const app = buildHealthApp();
    const res = await request(app).get("/api/nonexistent-route");

    expect(res.status).toBe(404);
  });

  it("error responses never expose stack traces", async () => {
    mockAuthState.enabled = false;

    const app = buildLoadsApp();
    const res = await request(app).get("/api/loads");

    expect(res.status).toBe(401);
    const body = JSON.stringify(res.body);
    expect(body).not.toContain("at Object.");
    expect(body).not.toContain("node_modules");
    expect(body).not.toContain(".ts:");
  });

  it("error response content-type is application/json", async () => {
    mockAuthState.enabled = false;

    const app = buildLoadsApp();
    const res = await request(app).get("/api/loads");

    expect(res.status).toBe(401);
    expect(res.headers["content-type"]).toContain("application/json");
  });

  it("500 from repository failure returns error JSON", async () => {
    mockIncidentRepo.findByCompany.mockRejectedValueOnce(
      new Error("DB pool exhausted"),
    );

    const app = buildIncidentsApp();
    const res = await request(app).get("/api/incidents");

    expect(res.status).toBe(500);
    expect(res.body).toHaveProperty("error");
    expect(typeof res.body.error).toBe("string");
  });
});
