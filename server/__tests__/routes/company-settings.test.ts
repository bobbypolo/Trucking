import { describe, it, expect, vi, beforeEach } from "vitest";

// Tests: Company settings admin enforcement and field persistence

const {
  mockQuery,
  mockResolveSqlPrincipalByFirebaseUid,
  mockChildLogger,
  mockFirestoreSet,
} = vi.hoisted(() => {
  const mockQuery = vi.fn();
  const mockResolveSqlPrincipalByFirebaseUid = vi.fn();
  const mockChildLogger = {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  };
  const mockFirestoreSet = vi.fn().mockResolvedValue(undefined);
  return {
    mockQuery,
    mockResolveSqlPrincipalByFirebaseUid,
    mockChildLogger,
    mockFirestoreSet,
  };
});

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
  createChildLogger: () => mockChildLogger,
}));

vi.mock("../../helpers", () => ({
  redactData: vi.fn((data: any) => data),
  getVisibilitySettings: vi.fn().mockResolvedValue({}),
}));

vi.mock("../../firestore", () => ({
  default: {
    collection: vi.fn().mockReturnValue({
      doc: vi.fn().mockReturnValue({
        get: vi.fn().mockResolvedValue({
          exists: true,
          data: () => ({ id: "company-aaa" }),
        }),
        set: mockFirestoreSet,
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
  ensureMySqlCompany: vi.fn().mockResolvedValue(undefined),
  findSqlCompanyById: vi.fn().mockResolvedValue(null),
  mapCompanyRowToApiCompany: vi.fn((row: any) => row),
}));

import express from "express";
import request from "supertest";
import clientsRouter from "../../routes/clients";
import { errorHandler } from "../../middleware/errorHandler";

const COMPANY_ID = "company-aaa";
const AUTH_HEADER = "Bearer valid-token";

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(clientsRouter);
  app.use(errorHandler);
  return app;
}

function makePrincipal(role: string) {
  return {
    id: "1",
    tenantId: COMPANY_ID,
    companyId: COMPANY_ID,
    role,
    email: "test@test.com",
    firebaseUid: "firebase-uid-1",
  };
}

// =============================================================================
// Admin enforcement on POST /api/companies
// =============================================================================
describe("POST /api/companies -- admin role enforcement", () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockQuery.mockResolvedValue([[], []]);
    app = buildApp();
  });

  it("returns 403 when called by a driver", async () => {
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(
      makePrincipal("driver"),
    );

    const res = await request(app)
      .post("/api/companies")
      .set("Authorization", AUTH_HEADER)
      .send({ id: COMPANY_ID, name: "Test Corp" });

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/admin role required/i);
  });

  it("returns 403 when called by a dispatcher", async () => {
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(
      makePrincipal("dispatcher"),
    );

    const res = await request(app)
      .post("/api/companies")
      .set("Authorization", AUTH_HEADER)
      .send({ id: COMPANY_ID, name: "Test Corp" });

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/admin role required/i);
  });

  it("returns 403 when called by a payroll_manager", async () => {
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(
      makePrincipal("payroll_manager"),
    );

    const res = await request(app)
      .post("/api/companies")
      .set("Authorization", AUTH_HEADER)
      .send({ id: COMPANY_ID, name: "Test Corp" });

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/admin role required/i);
  });

  it("allows admin role to save company settings", async () => {
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(
      makePrincipal("admin"),
    );

    const res = await request(app)
      .post("/api/companies")
      .set("Authorization", AUTH_HEADER)
      .send({ id: COMPANY_ID, name: "Admin Corp" });

    expect(res.status).toBe(201);
    expect(res.body.message).toBe("Company settings saved");
  });

  it("allows OWNER_ADMIN role to save company settings", async () => {
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(
      makePrincipal("OWNER_ADMIN"),
    );

    const res = await request(app)
      .post("/api/companies")
      .set("Authorization", AUTH_HEADER)
      .send({ id: COMPANY_ID, name: "Owner Corp" });

    expect(res.status).toBe(201);
    expect(res.body.message).toBe("Company settings saved");
  });

  it("allows ORG_OWNER_SUPER_ADMIN role to save company settings", async () => {
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(
      makePrincipal("ORG_OWNER_SUPER_ADMIN"),
    );

    const res = await request(app)
      .post("/api/companies")
      .set("Authorization", AUTH_HEADER)
      .send({ id: COMPANY_ID, name: "Super Corp" });

    expect(res.status).toBe(201);
    expect(res.body.message).toBe("Company settings saved");
  });
});

// =============================================================================
// Field persistence -- all settings fields are persisted
// =============================================================================
describe("POST /api/companies -- settings field persistence", () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockQuery.mockResolvedValue([[], []]);
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(
      makePrincipal("admin"),
    );
    app = buildApp();
  });

  it("persists operating_mode to MySQL via INSERT query", async () => {
    const res = await request(app)
      .post("/api/companies")
      .set("Authorization", AUTH_HEADER)
      .send({
        id: COMPANY_ID,
        name: "Test Corp",
        operatingMode: "Enterprise",
      });

    expect(res.status).toBe(201);

    // Verify the SQL INSERT included operating_mode
    const sqlCall = mockQuery.mock.calls[0];
    expect(sqlCall[0]).toContain("operating_mode");
    // operating_mode should be in the values array
    expect(sqlCall[1]).toContain("Enterprise");
  });

  it("persists driver_visibility_settings to MySQL as JSON", async () => {
    const visibility = {
      hideRates: true,
      hideBrokerContacts: false,
      maskCustomerName: true,
    };

    const res = await request(app)
      .post("/api/companies")
      .set("Authorization", AUTH_HEADER)
      .send({
        id: COMPANY_ID,
        name: "Test Corp",
        driverVisibilitySettings: visibility,
      });

    expect(res.status).toBe(201);

    const sqlCall = mockQuery.mock.calls[0];
    expect(sqlCall[0]).toContain("driver_visibility_settings");
    // Should be serialized as JSON string
    const jsonParam = sqlCall[1].find(
      (p: any) => typeof p === "string" && p.includes("hideRates"),
    );
    expect(jsonParam).toBeDefined();
    expect(JSON.parse(jsonParam)).toEqual(visibility);
  });

  it("persists governance settings to Firestore", async () => {
    const governance = {
      autoLockCompliance: true,
      requireQuizPass: true,
      requireMaintenancePass: false,
      maxLoadsPerDriverPerWeek: 7,
      preferredCurrency: "CAD",
    };

    const res = await request(app)
      .post("/api/companies")
      .set("Authorization", AUTH_HEADER)
      .send({
        id: COMPANY_ID,
        name: "Test Corp",
        governance,
      });

    expect(res.status).toBe(201);

    // Governance should be in the Firestore set call
    expect(mockFirestoreSet).toHaveBeenCalledWith(
      expect.objectContaining({
        governance,
      }),
      { merge: true },
    );
  });

  it("persists driverPermissions and dispatcherPermissions to Firestore", async () => {
    const driverPermissions = {
      viewSettlements: true,
      viewSafety: true,
      showRates: false,
    };
    const dispatcherPermissions = {
      manageSafety: true,
      createLoads: true,
      viewIntelligence: false,
    };

    const res = await request(app)
      .post("/api/companies")
      .set("Authorization", AUTH_HEADER)
      .send({
        id: COMPANY_ID,
        name: "Test Corp",
        driverPermissions,
        dispatcherPermissions,
      });

    expect(res.status).toBe(201);

    expect(mockFirestoreSet).toHaveBeenCalledWith(
      expect.objectContaining({
        driverPermissions,
        dispatcherPermissions,
      }),
      { merge: true },
    );
  });

  it("persists scoringConfig to Firestore", async () => {
    const scoringConfig = {
      enabled: true,
      minimumDispatchScore: 80,
      weights: { safety: 40, onTime: 30, paperwork: 30 },
    };

    const res = await request(app)
      .post("/api/companies")
      .set("Authorization", AUTH_HEADER)
      .send({
        id: COMPANY_ID,
        name: "Test Corp",
        scoringConfig,
      });

    expect(res.status).toBe(201);

    expect(mockFirestoreSet).toHaveBeenCalledWith(
      expect.objectContaining({
        scoringConfig,
      }),
      { merge: true },
    );
  });

  it("persists supportedFreightTypes to Firestore", async () => {
    const res = await request(app)
      .post("/api/companies")
      .set("Authorization", AUTH_HEADER)
      .send({
        id: COMPANY_ID,
        name: "Test Corp",
        supportedFreightTypes: ["Dry Van", "Reefer", "Flatbed"],
        defaultFreightType: "Dry Van",
      });

    expect(res.status).toBe(201);

    expect(mockFirestoreSet).toHaveBeenCalledWith(
      expect.objectContaining({
        supportedFreightTypes: ["Dry Van", "Reefer", "Flatbed"],
        defaultFreightType: "Dry Van",
      }),
      { merge: true },
    );
  });

  it("persists capabilityMatrix to Firestore", async () => {
    const capabilityMatrix = {
      admin: [{ capability: "QUOTE_CREATE", level: "Allow" }],
    };

    const res = await request(app)
      .post("/api/companies")
      .set("Authorization", AUTH_HEADER)
      .send({
        id: COMPANY_ID,
        name: "Test Corp",
        capabilityMatrix,
      });

    expect(res.status).toBe(201);

    expect(mockFirestoreSet).toHaveBeenCalledWith(
      expect.objectContaining({
        capabilityMatrix,
      }),
      { merge: true },
    );
  });

  it("accepts camelCase field names from frontend", async () => {
    const res = await request(app)
      .post("/api/companies")
      .set("Authorization", AUTH_HEADER)
      .send({
        id: COMPANY_ID,
        name: "Test Corp",
        accountType: "fleet",
        mcNumber: "MC-123",
        dotNumber: "DOT-456",
        loadNumberingConfig: { prefix: "LD", nextSequence: 100 },
        accessorialRates: { detentionPerHour: 75 },
      });

    expect(res.status).toBe(201);

    // Verify SQL received the values (snake_case mapped from camelCase)
    const sqlCall = mockQuery.mock.calls[0];
    const sqlValues = sqlCall[1];
    expect(sqlValues).toContain("fleet"); // account_type
    expect(sqlValues).toContain("MC-123"); // mc_number
    expect(sqlValues).toContain("DOT-456"); // dot_number
  });
});
