import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Party Registry Route Tests — Canonical DTO Contract Verification
 *
 * Tests cover:
 * - Each entity class CRUD (Customer, Broker, Vendor, Facility, Contractor)
 * - Fallback returns 503, not silent degradation
 * - Alias normalization (Shipper->Customer, Carrier->Contractor, Vendor_*->Vendor)
 * - Contractor vendorProfile fields persist
 * - Tags persist as JSON (never silently dropped)
 * - Entity class validation rejects unknown types
 * - Consistent camelCase response fields
 */

// --- Mock setup (hoisted so vi.mock factory can reference them) ---
const {
  mockQuery,
  mockBeginTransaction,
  mockCommit,
  mockRollback,
  mockRelease,
  mockGetConnection,
  mockConnection,
  mockResolveSqlPrincipalByFirebaseUid,
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
  };

  return {
    mockQuery,
    mockBeginTransaction,
    mockCommit,
    mockRollback,
    mockRelease,
    mockGetConnection,
    mockConnection,
    mockResolveSqlPrincipalByFirebaseUid: vi.fn(),
  };
});

vi.mock("../../db", () => ({
  default: {
    query: mockQuery,
    getConnection: mockGetConnection,
  },
}));

vi.mock("../../firestore", () => ({
  default: {
    collection: vi.fn().mockReturnValue({
      doc: vi.fn().mockReturnValue({
        get: vi.fn().mockResolvedValue({ exists: false }),
        set: vi.fn().mockResolvedValue(undefined),
      }),
      where: vi.fn().mockReturnValue({
        get: vi.fn().mockResolvedValue({ docs: [] }),
      }),
    }),
  },
}));

vi.mock("../../helpers", () => ({
  redactData: (data: unknown) => data,
  getVisibilitySettings: vi.fn().mockResolvedValue({}),
  sendNotification: vi.fn(),
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
  ensureMySqlCompany: vi.fn(),
  findSqlCompanyById: vi.fn(),
  mapCompanyRowToApiCompany: vi.fn(),
}));

import express from "express";
import request from "supertest";
import clientsRouter from "../../routes/clients";
import { errorHandler } from "../../middleware/errorHandler";
import { DEFAULT_SQL_PRINCIPAL } from "../helpers/mock-sql-auth";

mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(DEFAULT_SQL_PRINCIPAL);

const COMPANY_A = "company-aaa";

function createApp() {
  const app = express();
  app.use(express.json());
  // Inject auth user before routes (bypass real Firebase auth)
  app.use((req: any, _res: any, next: any) => {
    req.user = {
      uid: "test-user-1",
      tenantId: COMPANY_A,
      companyId: COMPANY_A,
      role: "admin",
      email: "test@test.com",
      firebaseUid: "firebase-uid-1",
    };
    next();
  });
  app.use(clientsRouter);
  app.use(errorHandler);
  return app;
}

/** Build a minimal valid party body for POST /api/parties */
function makePartyBody(overrides: Record<string, unknown> = {}) {
  return {
    name: "Test Party",
    type: "Customer",
    status: "Draft",
    ...overrides,
  };
}

describe("Party Registry Routes — Canonical DTO Contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetConnection.mockResolvedValue(mockConnection);
    // Default: all connection.query calls succeed
    mockConnection.query.mockResolvedValue([{ affectedRows: 1 }]);
  });

  // =====================================================================
  // POST /api/parties — Entity Class CRUD
  // =====================================================================
  describe("POST /api/parties — entity class CRUD", () => {
    it("creates a Customer entity with correct canonical class", async () => {
      const app = createApp();
      const res = await request(app)
        .post("/api/parties")
        .set("Authorization", "Bearer valid-token")
        .send(makePartyBody({ type: "Customer", name: "Acme Shipping" }));

      expect(res.status).toBe(201);
      expect(res.body.entityClass).toBe("Customer");
      expect(res.body.id).toBeDefined();
      expect(mockConnection.beginTransaction).toHaveBeenCalledTimes(1);
      expect(mockConnection.commit).toHaveBeenCalledTimes(1);

      // Verify the REPLACE INTO parties query used "Customer" as the type
      const replaceCall = mockConnection.query.mock.calls[0];
      expect(replaceCall[0]).toContain("REPLACE INTO parties");
      // type and entity_class params (positions 3 and 4 in the array)
      expect(replaceCall[1][3]).toBe("Customer");
      expect(replaceCall[1][4]).toBe("Customer");
    });

    it("creates a Broker entity", async () => {
      const app = createApp();
      const res = await request(app)
        .post("/api/parties")
        .set("Authorization", "Bearer valid-token")
        .send(makePartyBody({ type: "Broker", name: "FreightCo Brokerage" }));

      expect(res.status).toBe(201);
      expect(res.body.entityClass).toBe("Broker");
    });

    it("creates a Vendor entity", async () => {
      const app = createApp();
      const res = await request(app)
        .post("/api/parties")
        .set("Authorization", "Bearer valid-token")
        .send(
          makePartyBody({
            type: "Vendor",
            name: "Parts Supply Co",
            tags: ["parts", "maintenance"],
          }),
        );

      expect(res.status).toBe(201);
      expect(res.body.entityClass).toBe("Vendor");
    });

    it("creates a Facility entity", async () => {
      const app = createApp();
      const res = await request(app)
        .post("/api/parties")
        .set("Authorization", "Bearer valid-token")
        .send(makePartyBody({ type: "Facility", name: "Chicago Terminal" }));

      expect(res.status).toBe(201);
      expect(res.body.entityClass).toBe("Facility");
    });

    it("creates a Contractor entity with vendorProfile fields", async () => {
      const app = createApp();
      const res = await request(app)
        .post("/api/parties")
        .set("Authorization", "Bearer valid-token")
        .send(
          makePartyBody({
            type: "Contractor",
            name: "John Smith O/O",
            tags: ["owner-operator", "hazmat-certified"],
            vendorProfile: {
              equipmentOwnership: "owner",
              insuranceProvider: "Progressive Commercial",
              insurancePolicyNumber: "POL-12345",
              cdlNumber: "CDL-99887766",
              cdlState: "TX",
              cdlExpiry: "2027-06-15",
            },
          }),
        );

      expect(res.status).toBe(201);
      expect(res.body.entityClass).toBe("Contractor");

      // Verify vendor_profile was persisted as JSON in the query
      const replaceCall = mockConnection.query.mock.calls[0];
      const vendorProfileParam = replaceCall[1][12]; // vendor_profile is the 13th param
      const parsed = JSON.parse(vendorProfileParam);
      expect(parsed.equipmentOwnership).toBe("owner");
      expect(parsed.insuranceProvider).toBe("Progressive Commercial");
      expect(parsed.cdlNumber).toBe("CDL-99887766");
      expect(parsed.cdlState).toBe("TX");
      expect(parsed.cdlExpiry).toBe("2027-06-15");
    });
  });

  // =====================================================================
  // POST /api/parties — Alias normalization
  // =====================================================================
  describe("POST /api/parties — alias normalization", () => {
    it('normalizes "Shipper" to "Customer" on write', async () => {
      const app = createApp();
      const res = await request(app)
        .post("/api/parties")
        .set("Authorization", "Bearer valid-token")
        .send(makePartyBody({ type: "Shipper", name: "Legacy Shipper Corp" }));

      expect(res.status).toBe(201);
      expect(res.body.entityClass).toBe("Customer");

      // Verify persisted type is "Customer", not "Shipper"
      const replaceCall = mockConnection.query.mock.calls[0];
      expect(replaceCall[1][3]).toBe("Customer");
      expect(replaceCall[1][4]).toBe("Customer");
    });

    it('normalizes "Carrier" to "Contractor" on write', async () => {
      const app = createApp();
      const res = await request(app)
        .post("/api/parties")
        .set("Authorization", "Bearer valid-token")
        .send(makePartyBody({ type: "Carrier", name: "Legacy Carrier LLC" }));

      expect(res.status).toBe(201);
      expect(res.body.entityClass).toBe("Contractor");

      const replaceCall = mockConnection.query.mock.calls[0];
      expect(replaceCall[1][3]).toBe("Contractor");
    });

    it('normalizes "Vendor_Service" to "Vendor" on write', async () => {
      const app = createApp();
      const res = await request(app)
        .post("/api/parties")
        .set("Authorization", "Bearer valid-token")
        .send(makePartyBody({ type: "Vendor_Service", name: "Repair Shop" }));

      expect(res.status).toBe(201);
      expect(res.body.entityClass).toBe("Vendor");
    });

    it('normalizes "Vendor_Equipment" to "Vendor" on write', async () => {
      const app = createApp();
      const res = await request(app)
        .post("/api/parties")
        .set("Authorization", "Bearer valid-token")
        .send(
          makePartyBody({ type: "Vendor_Equipment", name: "Trailer Lease Co" }),
        );

      expect(res.status).toBe(201);
      expect(res.body.entityClass).toBe("Vendor");
    });

    it('normalizes "Vendor_Product" to "Vendor" on write', async () => {
      const app = createApp();
      const res = await request(app)
        .post("/api/parties")
        .set("Authorization", "Bearer valid-token")
        .send(makePartyBody({ type: "Vendor_Product", name: "Tire Supplier" }));

      expect(res.status).toBe(201);
      expect(res.body.entityClass).toBe("Vendor");
    });

    it("prefers entityClass over type when both are provided", async () => {
      const app = createApp();
      const res = await request(app)
        .post("/api/parties")
        .set("Authorization", "Bearer valid-token")
        .send(
          makePartyBody({
            type: "Shipper",
            entityClass: "Broker",
            name: "Dual-field Party",
          }),
        );

      expect(res.status).toBe(201);
      expect(res.body.entityClass).toBe("Broker");
    });
  });

  // =====================================================================
  // POST /api/parties — Entity class validation
  // =====================================================================
  describe("POST /api/parties — entity class validation", () => {
    it("rejects unrecognized entity class with 400", async () => {
      const app = createApp();
      const res = await request(app)
        .post("/api/parties")
        .set("Authorization", "Bearer valid-token")
        .send(makePartyBody({ type: "UnknownType", name: "Bad Entity" }));

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Invalid entity class");
      expect(res.body.details).toContain("UnknownType");
      expect(res.body.details).toContain("Customer");
      expect(res.body.details).toContain("Contractor");
      // Must not have started a transaction
      expect(mockConnection.beginTransaction).not.toHaveBeenCalled();
    });
  });

  // =====================================================================
  // POST /api/parties — Tags persistence
  // =====================================================================
  describe("POST /api/parties — tags persistence", () => {
    it("persists tags as JSON in parties table", async () => {
      const app = createApp();
      const tags = ["fuel", "maintenance", "rental"];
      const res = await request(app)
        .post("/api/parties")
        .set("Authorization", "Bearer valid-token")
        .send(makePartyBody({ type: "Vendor", name: "Tagged Vendor", tags }));

      expect(res.status).toBe(201);

      // Verify tags were passed as JSON string to the query
      const replaceCall = mockConnection.query.mock.calls[0];
      const tagsParam = replaceCall[1][11]; // tags is the 12th param
      expect(tagsParam).toBe(JSON.stringify(tags));
    });

    it("persists empty tags array as JSON (not null)", async () => {
      const app = createApp();
      const res = await request(app)
        .post("/api/parties")
        .set("Authorization", "Bearer valid-token")
        .send(makePartyBody({ type: "Customer", name: "No Tags Customer" }));

      expect(res.status).toBe(201);

      const replaceCall = mockConnection.query.mock.calls[0];
      const tagsParam = replaceCall[1][11];
      expect(tagsParam).toBe("[]");
    });
  });

  // =====================================================================
  // POST /api/parties — Fallback returns 503
  // =====================================================================
  describe("POST /api/parties — fallback returns 503, not silent degradation", () => {
    it("returns 503 when parties table is missing (not silent fallback to customers)", async () => {
      // Simulate parties table missing error on connection.query
      const missingTableError = Object.assign(
        new Error("Table 'loadpilot.parties' doesn't exist"),
        { code: "ER_NO_SUCH_TABLE" },
      );
      mockConnection.query.mockRejectedValueOnce(missingTableError);

      const app = createApp();
      const res = await request(app)
        .post("/api/parties")
        .set("Authorization", "Bearer valid-token")
        .send(makePartyBody({ type: "Customer", name: "Should Fail" }));

      expect(res.status).toBe(503);
      expect(res.body.error).toBe("Party registry unavailable");
      expect(res.body.details).toContain("parties table");
      expect(res.body.details).toContain("migrations");

      // Verify rollback was called
      expect(mockConnection.rollback).toHaveBeenCalledTimes(1);

      // Verify NO query to customers table was attempted
      const allQueries = mockConnection.query.mock.calls.map(
        (c: unknown[]) => c[0],
      );
      const customerQueries = allQueries.filter(
        (q: unknown) => typeof q === "string" && q.includes("customers"),
      );
      expect(customerQueries.length).toBe(0);
    });
  });

  // =====================================================================
  // GET /api/parties — Fallback returns 503
  // =====================================================================
  describe("GET /api/parties — fallback returns 503, not silent degradation", () => {
    it("returns 503 when parties table is missing (not silent fallback to customers)", async () => {
      const missingTableError = Object.assign(
        new Error("Table 'loadpilot.parties' doesn't exist"),
        { code: "ER_NO_SUCH_TABLE" },
      );
      // pool.query (not connection.query) is used for GET
      mockQuery.mockRejectedValueOnce(missingTableError);

      const app = createApp();
      const res = await request(app)
        .get("/api/parties")
        .set("Authorization", "Bearer valid-token");

      expect(res.status).toBe(503);
      expect(res.body.error).toBe("Party registry unavailable");
      expect(res.body.details).toContain("parties table");
    });
  });

  // =====================================================================
  // GET /api/parties — Response format (camelCase)
  // =====================================================================
  describe("GET /api/parties — camelCase response format", () => {
    it("returns parties with camelCase fields and normalized entityClass", async () => {
      // Mock: parties query returns one row
      const partyRow = {
        id: "party-001",
        company_id: COMPANY_A,
        name: "Acme Shipping",
        type: "Customer",
        entity_class: "Customer",
        is_customer: 1,
        is_vendor: 0,
        status: "Approved",
        mc_number: "MC123456",
        dot_number: "DOT789",
        rating: 4.5,
        tags: '["preferred","high-volume"]',
        vendor_profile: null,
        created_at: "2026-03-01",
        updated_at: "2026-03-15",
      };
      mockQuery
        .mockResolvedValueOnce([[partyRow]]) // parties
        .mockResolvedValueOnce([[]]) // contacts (batch IN)
        .mockResolvedValueOnce([[]]) // documents (batch IN)
        .mockResolvedValueOnce([[]]) // rates (batch IN)
        .mockResolvedValueOnce([[]]) // constraint_sets (batch IN)
        .mockResolvedValueOnce([[]]) // constraint_rules (batch IN via JOIN)
        .mockResolvedValueOnce([[]]); // catalog_links (batch IN)

      const app = createApp();
      const res = await request(app)
        .get("/api/parties")
        .set("Authorization", "Bearer valid-token");

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(1);

      const party = res.body[0];
      // camelCase fields
      expect(party.id).toBe("party-001");
      expect(party.companyId).toBe(COMPANY_A);
      expect(party.name).toBe("Acme Shipping");
      expect(party.entityClass).toBe("Customer");
      expect(party.type).toBe("Customer");
      expect(party.isCustomer).toBe(true);
      expect(party.isVendor).toBe(false);
      expect(party.mcNumber).toBe("MC123456");
      expect(party.dotNumber).toBe("DOT789");
      expect(party.rating).toBe(4.5);
      expect(party.tags).toEqual(["preferred", "high-volume"]);
      expect(party.contacts).toEqual([]);
      expect(party.documents).toEqual([]);
      expect(party.rates).toEqual([]);
      expect(party.constraintSets).toEqual([]);
      expect(party.catalogLinks).toEqual([]);
    });

    it("normalizes legacy entity_class values in GET response", async () => {
      // Row with legacy type that was persisted before normalization
      const legacyRow = {
        id: "party-legacy",
        company_id: COMPANY_A,
        name: "Old Shipper",
        type: "Shipper",
        entity_class: null,
        is_customer: 1,
        is_vendor: 0,
        status: "Draft",
        mc_number: null,
        dot_number: null,
        rating: null,
        tags: null,
        vendor_profile: null,
        created_at: null,
        updated_at: null,
      };
      mockQuery
        .mockResolvedValueOnce([[legacyRow]])
        .mockResolvedValueOnce([[]]) // contacts (batch IN)
        .mockResolvedValueOnce([[]]) // documents (batch IN)
        .mockResolvedValueOnce([[]]) // rates (batch IN)
        .mockResolvedValueOnce([[]]) // constraint_sets (batch IN)
        .mockResolvedValueOnce([[]]) // constraint_rules (batch IN via JOIN)
        .mockResolvedValueOnce([[]]); // catalog_links (batch IN)

      const app = createApp();
      const res = await request(app)
        .get("/api/parties")
        .set("Authorization", "Bearer valid-token");

      expect(res.status).toBe(200);
      const party = res.body[0];
      // "Shipper" should be normalized to "Customer" in response
      expect(party.entityClass).toBe("Customer");
      expect(party.type).toBe("Customer");
      expect(party.tags).toEqual([]);
    });

    it("returns vendorProfile for Contractor entities", async () => {
      const contractorRow = {
        id: "party-contractor",
        company_id: COMPANY_A,
        name: "John Smith O/O",
        type: "Contractor",
        entity_class: "Contractor",
        is_customer: 0,
        is_vendor: 0,
        status: "Approved",
        mc_number: null,
        dot_number: null,
        rating: null,
        tags: '["owner-operator"]',
        vendor_profile: JSON.stringify({
          equipmentOwnership: "owner",
          cdlNumber: "CDL-99887766",
          cdlState: "TX",
          cdlExpiry: "2027-06-15",
          insuranceProvider: "Progressive",
        }),
        created_at: null,
        updated_at: null,
      };
      mockQuery
        .mockResolvedValueOnce([[contractorRow]])
        .mockResolvedValueOnce([[]]) // contacts (batch IN)
        .mockResolvedValueOnce([[]]) // documents (batch IN)
        .mockResolvedValueOnce([[]]) // rates (batch IN)
        .mockResolvedValueOnce([[]]) // constraint_sets (batch IN)
        .mockResolvedValueOnce([[]]) // constraint_rules (batch IN via JOIN)
        .mockResolvedValueOnce([[]]); // catalog_links (batch IN)

      const app = createApp();
      const res = await request(app)
        .get("/api/parties")
        .set("Authorization", "Bearer valid-token");

      expect(res.status).toBe(200);
      const party = res.body[0];
      expect(party.entityClass).toBe("Contractor");
      expect(party.vendorProfile).toBeDefined();
      expect(party.vendorProfile.equipmentOwnership).toBe("owner");
      expect(party.vendorProfile.cdlNumber).toBe("CDL-99887766");
      expect(party.vendorProfile.cdlState).toBe("TX");
      expect(party.vendorProfile.insuranceProvider).toBe("Progressive");
    });
  });

  // =====================================================================
  // POST /api/parties — Contractor vendorProfile persistence
  // =====================================================================
  describe("POST /api/parties — contractor vendorProfile persistence", () => {
    it("persists all contractor vendorProfile fields for Contractor entities", async () => {
      const vendorProfile = {
        equipmentOwnership: "lease",
        insuranceProvider: "State Farm",
        insurancePolicyNumber: "POL-ABCDEF",
        cdlNumber: "CDL-112233",
        cdlState: "CA",
        cdlExpiry: "2028-01-01",
        capabilities: ["hazmat-certified", "tanker-endorsed"],
        serviceArea: ["West Coast", "Southwest"],
      };

      const app = createApp();
      const res = await request(app)
        .post("/api/parties")
        .set("Authorization", "Bearer valid-token")
        .send(
          makePartyBody({
            type: "Contractor",
            name: "Jane Doe O/O",
            vendorProfile,
          }),
        );

      expect(res.status).toBe(201);

      // Parse the vendor_profile JSON that was persisted
      const replaceCall = mockConnection.query.mock.calls[0];
      const persistedProfile = JSON.parse(replaceCall[1][12]);
      expect(persistedProfile.equipmentOwnership).toBe("lease");
      expect(persistedProfile.insuranceProvider).toBe("State Farm");
      expect(persistedProfile.insurancePolicyNumber).toBe("POL-ABCDEF");
      expect(persistedProfile.cdlNumber).toBe("CDL-112233");
      expect(persistedProfile.cdlState).toBe("CA");
      expect(persistedProfile.cdlExpiry).toBe("2028-01-01");
    });

    it("persists vendorProfile as null for non-Contractor entities without vendorProfile", async () => {
      const app = createApp();
      const res = await request(app)
        .post("/api/parties")
        .set("Authorization", "Bearer valid-token")
        .send(makePartyBody({ type: "Customer", name: "No Profile Customer" }));

      expect(res.status).toBe(201);

      const replaceCall = mockConnection.query.mock.calls[0];
      const vendorProfileParam = replaceCall[1][12];
      expect(vendorProfileParam).toBeNull();
    });
  });

  // =====================================================================
  // PATCH /api/parties/:id/status
  // =====================================================================
  describe("PATCH /api/parties/:id/status", () => {
    it("updates party status", async () => {
      mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }]);

      const app = createApp();
      const res = await request(app)
        .patch("/api/parties/party-001/status")
        .set("Authorization", "Bearer valid-token")
        .send({ status: "Approved" });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe("Party status updated");
    });

    it("returns 400 when status is missing", async () => {
      const app = createApp();
      const res = await request(app)
        .patch("/api/parties/party-001/status")
        .set("Authorization", "Bearer valid-token")
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("status is required");
    });

    it("returns 404 when party is not found", async () => {
      mockQuery.mockResolvedValueOnce([{ affectedRows: 0 }]);

      const app = createApp();
      const res = await request(app)
        .patch("/api/parties/nonexistent/status")
        .set("Authorization", "Bearer valid-token")
        .send({ status: "Approved" });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe("Party not found");
    });
  });

  // =====================================================================
  // POST /api/parties — Transaction integrity
  // =====================================================================
  describe("POST /api/parties — transaction integrity", () => {
    it("rolls back on database error and returns 500", async () => {
      // First query (REPLACE INTO parties) fails with a generic error
      const dbError = new Error("Connection refused");
      mockConnection.query.mockRejectedValueOnce(dbError);

      const app = createApp();
      const res = await request(app)
        .post("/api/parties")
        .set("Authorization", "Bearer valid-token")
        .send(makePartyBody({ type: "Customer", name: "Failing Party" }));

      expect(res.status).toBe(500);
      expect(res.body.message).toBeDefined();
      expect(mockConnection.rollback).toHaveBeenCalledTimes(1);
      expect(mockConnection.release).toHaveBeenCalledTimes(1);
    });

    it("persists contacts within the transaction", async () => {
      const app = createApp();
      const res = await request(app)
        .post("/api/parties")
        .set("Authorization", "Bearer valid-token")
        .send(
          makePartyBody({
            type: "Customer",
            name: "With Contacts",
            contacts: [
              {
                name: "Jane Primary",
                role: "Primary",
                email: "jane@acme.com",
                phone: "555-0101",
                isPrimary: true,
              },
            ],
          }),
        );

      expect(res.status).toBe(201);

      // Find the INSERT INTO party_contacts query
      const contactInserts = mockConnection.query.mock.calls.filter(
        (c: unknown[]) =>
          typeof c[0] === "string" && c[0].includes("party_contacts"),
      );
      // Should have DELETE + INSERT
      expect(contactInserts.length).toBe(2);
      const insertCall = contactInserts[1];
      expect(insertCall[1][2]).toBe("Jane Primary"); // name
      expect(insertCall[1][4]).toBe("jane@acme.com"); // email
    });
  });
});


