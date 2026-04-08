/**
 * Tests R-P1-03, R-P1-04, R-P1-05, R-P1-07: Parties Entity Class + Schema Drift Surfacing
 *
 * Validates server/routes/clients.ts POST /api/parties and isMissingTableError helper:
 *  - R-P1-03: POST /api/parties with { type: "Contractor", entityClass: "Contractor",
 *             vendorProfile: { capabilities, cdlNumber } } returns 201 with
 *             { id, entityClass: "Contractor" }.
 *  - R-P1-04: POST /api/parties when mysql throws ER_BAD_FIELD_ERROR
 *             "Unknown column 'entity_class' in 'field list'" returns 503 with
 *             { error: "Party registry unavailable", details: <contains "migrations">,
 *               code: "SCHEMA_DRIFT" }.
 *  - R-P1-05: isMissingTableError(error, "parties") returns true for the
 *             ER_BAD_FIELD_ERROR above — proving the widened matcher (message
 *             does NOT contain the "parties" substring).
 *  - R-P1-07: End-to-end POST with all 8 contractor vendorProfile fields
 *             succeeds and persists the full JSON.
 */

// --- Hoisted mocks ---
const {
  mockQuery,
  mockExecute,
  mockBeginTransaction,
  mockCommit,
  mockRollback,
  mockRelease,
  mockGetConnection,
  mockConnection,
  mockResolveSqlPrincipalByFirebaseUid,
  mockIsTokenRevoked,
} = vi.hoisted(() => {
  const mockQuery = vi.fn();
  // pool.execute is used by lib/token-revocation.ts; return empty rows by default
  const mockExecute = vi.fn().mockResolvedValue([[], []]);
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
    mockExecute,
    mockBeginTransaction,
    mockCommit,
    mockRollback,
    mockRelease,
    mockGetConnection,
    mockConnection,
    mockResolveSqlPrincipalByFirebaseUid: vi.fn(),
    mockIsTokenRevoked: vi.fn().mockResolvedValue(false),
  };
});

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../db", () => ({
  default: {
    query: mockQuery,
    execute: mockExecute,
    getConnection: mockGetConnection,
  },
}));

vi.mock("../../lib/token-revocation", () => ({
  isTokenRevoked: mockIsTokenRevoked,
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
    child: vi.fn().mockReturnThis(),
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
const AUTH_HEADER = "Bearer valid-token";

function createApp() {
  const app = express();
  app.use(express.json());
  // Inject auth user before routes (bypass real Firebase auth).
  // requireAuth will overwrite this from the mocked SQL principal, but the
  // mocked principal has matching tenantId/companyId so downstream handlers
  // are unchanged. The injection exists to cover the rare paths that run
  // before requireAuth completes.
  app.use(
    (
      req: express.Request,
      _res: express.Response,
      next: express.NextFunction,
    ) => {
      (req as express.Request & { user: Record<string, unknown> }).user = {
        id: "test-user-1",
        uid: "test-user-1",
        tenantId: COMPANY_A,
        companyId: COMPANY_A,
        role: "admin",
        email: "test@test.com",
        firebaseUid: "firebase-uid-1",
      };
      next();
    },
  );
  app.use(clientsRouter);
  app.use(errorHandler);
  return app;
}

/** Build an ER_BAD_FIELD_ERROR matching a mysql "Unknown column" failure. */
function makeUnknownColumnError(column: string) {
  const err: Error & { code?: string } = Object.assign(
    new Error(`Unknown column '${column}' in 'field list'`),
    { code: "ER_BAD_FIELD_ERROR" },
  );
  return err;
}

describe("POST /api/parties — entity class + schema drift surfacing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(
      DEFAULT_SQL_PRINCIPAL,
    );
    mockGetConnection.mockResolvedValue(mockConnection);
    // Default: all connection.query calls succeed
    mockConnection.query.mockResolvedValue([{ affectedRows: 1 }]);
  });

  // ── R-P1-03: happy path — Contractor with vendorProfile ─────────────────
  it("Tests R-P1-03 — POST with Contractor + vendorProfile returns 201 and entityClass", async () => {
    const app = createApp();
    const res = await request(app)
      .post("/api/parties")
      .set("Authorization", AUTH_HEADER)
      .send({
        name: "Test Contractor",
        type: "Contractor",
        entityClass: "Contractor",
        company_id: COMPANY_A,
        vendorProfile: {
          capabilities: ["fuel"],
          cdlNumber: "X123",
        },
      });

    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.entityClass).toBe("Contractor");

    // Verify the REPLACE INTO parties query included the new columns
    const replaceCall = mockConnection.query.mock.calls[0];
    expect(replaceCall[0]).toContain("REPLACE INTO parties");
    // entity_class (position 4) must be "Contractor"
    expect(replaceCall[1][4]).toBe("Contractor");
    // vendor_profile (position 12) must be JSON with capabilities + cdlNumber
    const vendorProfileParam = replaceCall[1][12];
    expect(vendorProfileParam).not.toBeNull();
    const parsed = JSON.parse(vendorProfileParam);
    expect(parsed.capabilities).toEqual(["fuel"]);
    expect(parsed.cdlNumber).toBe("X123");
  });

  // ── R-P1-04: ER_BAD_FIELD_ERROR → 503 with SCHEMA_DRIFT code ─────────────
  it("Tests R-P1-04 — POST returns 503 SCHEMA_DRIFT when mysql raises Unknown column entity_class", async () => {
    // Simulate: REPLACE INTO parties fails with ER_BAD_FIELD_ERROR
    // because the entity_class column doesn't exist yet (migration not run).
    mockConnection.query.mockRejectedValueOnce(
      makeUnknownColumnError("entity_class"),
    );

    const app = createApp();
    const res = await request(app)
      .post("/api/parties")
      .set("Authorization", AUTH_HEADER)
      .send({
        name: "Schema Drift Party",
        type: "Contractor",
        entityClass: "Contractor",
        company_id: COMPANY_A,
        vendorProfile: { capabilities: ["fuel"], cdlNumber: "X123" },
      });

    expect(res.status).toBe(503);
    expect(res.body.error).toBe("Party registry unavailable");
    expect(typeof res.body.details).toBe("string");
    expect(res.body.details).toContain("migrations");
    expect(res.body.code).toBe("SCHEMA_DRIFT");

    // Rollback must have been called
    expect(mockConnection.rollback).toHaveBeenCalledTimes(1);

    // Must NOT have fallen back to a customers table query
    const allQueries = mockConnection.query.mock.calls.map(
      (c: unknown[]) => c[0],
    );
    const customerQueries = allQueries.filter(
      (q: unknown) => typeof q === "string" && q.includes("customers"),
    );
    expect(customerQueries.length).toBe(0);
  });

  // ── R-P1-05: isMissingTableError widened matcher (unit-level via route) ─
  // The helper is an internal const in clients.ts and not exported; we verify
  // the *behavior* it enables: a mysql error whose message does NOT contain
  // the table name "parties" but does have code ER_BAD_FIELD_ERROR and
  // "Unknown column ..." message must trigger the 503 SCHEMA_DRIFT branch.
  it("Tests R-P1-05 — isMissingTableError(err, 'parties') matches Unknown column error (message has no 'parties' substring)", async () => {
    const err = makeUnknownColumnError("entity_class");
    // Sanity: confirm the error message has NO "parties" substring — this is
    // the whole point of the widened matcher.
    expect(err.message.includes("parties")).toBe(false);
    expect(err.code).toBe("ER_BAD_FIELD_ERROR");

    // Now drive the route and confirm the widened matcher routes this to 503.
    mockConnection.query.mockRejectedValueOnce(err);

    const app = createApp();
    const res = await request(app)
      .post("/api/parties")
      .set("Authorization", AUTH_HEADER)
      .send({
        name: "Widened Matcher Probe",
        type: "Broker",
        company_id: COMPANY_A,
      });

    expect(res.status).toBe(503);
    expect(res.body.code).toBe("SCHEMA_DRIFT");
  });

  // Extra guard: ER_BAD_FIELD_ERROR with vendor_profile column also routes to 503.
  it("Tests R-P1-05 — widened matcher also handles Unknown column vendor_profile", async () => {
    mockConnection.query.mockRejectedValueOnce(
      makeUnknownColumnError("vendor_profile"),
    );

    const app = createApp();
    const res = await request(app)
      .post("/api/parties")
      .set("Authorization", AUTH_HEADER)
      .send({
        name: "Vendor Profile Probe",
        type: "Contractor",
        entityClass: "Contractor",
      });

    expect(res.status).toBe(503);
    expect(res.body.code).toBe("SCHEMA_DRIFT");
  });

  // Regression: ER_NO_SUCH_TABLE still routes to 503 (old behavior preserved).
  it("Tests R-P1-05 — ER_NO_SUCH_TABLE for parties still returns 503 (backward-compat)", async () => {
    const err: Error & { code?: string } = Object.assign(
      new Error("Table 'loadpilot.parties' doesn't exist"),
      { code: "ER_NO_SUCH_TABLE" },
    );
    mockConnection.query.mockRejectedValueOnce(err);

    const app = createApp();
    const res = await request(app)
      .post("/api/parties")
      .set("Authorization", AUTH_HEADER)
      .send({
        name: "No Such Table Probe",
        type: "Customer",
      });

    expect(res.status).toBe(503);
    expect(res.body.error).toBe("Party registry unavailable");
    expect(res.body.code).toBe("SCHEMA_DRIFT");
  });

  // ── R-P1-07: all 8 contractor vendorProfile fields persist end-to-end ────
  it("Tests R-P1-07 — POST with all 8 contractor vendorProfile fields persists full JSON", async () => {
    const fullProfile = {
      capabilities: ["fuel", "hazmat", "tanker"],
      serviceArea: ["TX", "OK", "NM"],
      equipmentOwnership: "owner",
      insuranceProvider: "Progressive Commercial",
      insurancePolicyNumber: "POL-FULL-8FIELDS",
      cdlNumber: "CDL-ALL-FIELDS",
      cdlState: "TX",
      cdlExpiry: "2029-12-31",
    };

    const app = createApp();
    const res = await request(app)
      .post("/api/parties")
      .set("Authorization", AUTH_HEADER)
      .send({
        name: "Eight-Field Contractor",
        type: "Contractor",
        entityClass: "Contractor",
        company_id: COMPANY_A,
        vendorProfile: fullProfile,
      });

    expect(res.status).toBe(201);
    expect(res.body.entityClass).toBe("Contractor");

    // Confirm every one of the 8 fields landed in the persisted vendor_profile JSON.
    const replaceCall = mockConnection.query.mock.calls[0];
    const vendorProfileParam = replaceCall[1][12];
    expect(vendorProfileParam).not.toBeNull();
    const parsed = JSON.parse(vendorProfileParam);
    expect(parsed.capabilities).toEqual(["fuel", "hazmat", "tanker"]);
    expect(parsed.serviceArea).toEqual(["TX", "OK", "NM"]);
    expect(parsed.equipmentOwnership).toBe("owner");
    expect(parsed.insuranceProvider).toBe("Progressive Commercial");
    expect(parsed.insurancePolicyNumber).toBe("POL-FULL-8FIELDS");
    expect(parsed.cdlNumber).toBe("CDL-ALL-FIELDS");
    expect(parsed.cdlState).toBe("TX");
    expect(parsed.cdlExpiry).toBe("2029-12-31");
  });
});

// ── R-P1-06: NetworkPortal toast surfaces real error message ───────────────
// Source grep assertion against components/NetworkPortal.tsx. The save-party
// handler (line 346) and save-contact handler must use
// `e instanceof Error ? e.message : "..."` so the user sees the real API error
// (including the 503 SCHEMA_DRIFT details) instead of a generic string.
describe("R-P1-06 — NetworkPortal toast surfaces real error message", () => {
  const fs = require("fs");
  const path = require("path");
  const NETWORK_PORTAL_PATH = path.resolve(
    __dirname,
    "../../../components/NetworkPortal.tsx",
  );

  it("Tests R-P1-06 — NetworkPortal.tsx file is present at expected path", () => {
    expect(fs.existsSync(NETWORK_PORTAL_PATH)).toBe(true);
  });

  it('Tests R-P1-06 — save-party catch uses `e instanceof Error ? e.message : "Failed to save entity"`', () => {
    const src: string = fs.readFileSync(NETWORK_PORTAL_PATH, "utf-8");
    // Must contain the literal canonical expression
    expect(src).toContain(
      'e instanceof Error ? e.message : "Failed to save entity"',
    );
  });

  it('Tests R-P1-06 — NetworkPortal.tsx no longer contains standalone "Failed to save entity" toast without instanceof Error guard', () => {
    const src: string = fs.readFileSync(NETWORK_PORTAL_PATH, "utf-8");
    // Legacy pattern: setToast({ message: "Failed to save entity", ... })
    // Must NOT appear anymore — the only occurrence of the string must be inside
    // the ternary guard.
    const legacyPattern =
      /setToast\(\s*\{\s*message:\s*"Failed to save entity"/;
    expect(
      legacyPattern.test(src),
      "NetworkPortal.tsx still contains a hardcoded 'Failed to save entity' toast — replace with `e instanceof Error ? e.message : ...` ternary.",
    ).toBe(false);
  });

  it("Tests R-P1-06 — save-contact catch also uses `err instanceof Error` or `e instanceof Error` guard (line 395)", () => {
    const src: string = fs.readFileSync(NETWORK_PORTAL_PATH, "utf-8");
    // The save-contact handler currently shows "Failed to add contact" — must
    // also be guarded by instanceof Error so real errors bubble up.
    const saveContactLegacy =
      /setToast\(\s*\{\s*message:\s*"Failed to add contact"/;
    expect(saveContactLegacy.test(src)).toBe(false);
    // And the file should contain the message guarded by instanceof Error
    expect(src).toMatch(
      /(err|e)\s+instanceof\s+Error\s*\?\s*(err|e)\.message\s*:\s*"Failed to add contact"/,
    );
  });
});
