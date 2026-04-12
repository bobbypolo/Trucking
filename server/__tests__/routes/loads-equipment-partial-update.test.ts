/**
 * Tests R-P4-20, R-P4-21, R-P4-22: PATCH /api/loads/:id equipment_id partial update
 *
 * Verifies:
 *  - partialUpdateLoadSchema includes equipment_id as optional trimmed string
 *  - .refine() accepts a body containing ONLY equipment_id
 *  - PATCH with equipment_id executes UPDATE SQL with equipment_id = ?
 *  - PATCH with ONLY equipment_id succeeds (no 400 "No supported persisted fields")
 *  - PATCH with empty body still returns 400 (regression guard)
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockQuery, mockResolveSqlPrincipalByFirebaseUid } = vi.hoisted(() => ({
  mockQuery: vi.fn(),
  mockResolveSqlPrincipalByFirebaseUid: vi.fn(),
}));

vi.mock("../../db", () => ({
  default: {
    query: mockQuery,
    execute: mockQuery,
    getConnection: vi.fn(),
  },
}));

vi.mock("../../helpers", () => ({
  redactData: (data: unknown) => data,
  getVisibilitySettings: vi.fn().mockResolvedValue({}),
  sendNotification: vi.fn(),
  checkBreakdownLateness: vi
    .fn()
    .mockResolvedValue({ isLate: false, dist: 0, required: 0 }),
}));

vi.mock("../../lib/logger", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
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

vi.mock("../../services/geocoding.service", () => ({
  geocodeStopAddress: vi.fn().mockResolvedValue(null),
}));

vi.mock("../../services/detentionPipeline", () => ({
  recordGeofenceEntry: vi.fn(),
  recordBOLScan: vi.fn(),
}));

vi.mock("../../services/discrepancyPipeline", () => ({
  compareWeights: vi.fn(),
  recordLoadCompletion: vi.fn(),
}));

vi.mock("../../services/bigqueryPipeline", () => ({
  exportLoadToBigQuery: vi.fn(),
}));

vi.mock("firebase-admin", () => {
  const mockAuth = {
    verifyIdToken: vi
      .fn()
      .mockResolvedValue({ uid: "firebase-uid-1", email_verified: true }),
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
                  email: "dispatcher@test.com",
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
import loadRoutes from "../../routes/loads";
import { errorHandler } from "../../middleware/errorHandler";
import { DEFAULT_SQL_PRINCIPAL } from "../helpers/mock-sql-auth";
import { partialUpdateLoadSchema } from "../../schemas/loads";

mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(DEFAULT_SQL_PRINCIPAL);

function createApp() {
  const app = express();
  app.use(express.json());
  app.use(loadRoutes);
  app.use(errorHandler);
  return app;
}

const loadRow = {
  id: "load-123",
  company_id: "company-aaa",
  driver_id: "driver-1",
  load_number: "LD-123",
  status: "Draft",
  carrier_rate: 2000,
  driver_pay: 1000,
  pickup_date: "2026-04-01",
  commodity: "Paper",
  weight: 18000,
  bol_number: "BOL-OLD",
  equipment_id: null,
  notification_emails: "[]",
  gps_history: "[]",
  pod_urls: "[]",
  customer_user_id: null,
  deleted_at: null,
};

// ── R-P4-20: partialUpdateLoadSchema includes equipment_id ───────────────────

describe("R-P4-20 — partialUpdateLoadSchema includes equipment_id", () => {
  // Tests R-P4-20
  it("Tests R-P4-20 — schema accepts body with only equipment_id", () => {
    const result = partialUpdateLoadSchema.safeParse({
      equipment_id: "EQ-001",
    });
    expect(result.success).toBe(true);
  });

  // Tests R-P4-20
  it("Tests R-P4-20 — schema rejects body with no recognized fields", () => {
    const result = partialUpdateLoadSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  // Tests R-P4-20
  it("Tests R-P4-20 — schema accepts equipment_id alongside other fields", () => {
    const result = partialUpdateLoadSchema.safeParse({
      equipment_id: "EQ-001",
      commodity: "Steel",
    });
    expect(result.success).toBe(true);
  });

  // Tests R-P4-20
  it("Tests R-P4-20 — schema trims and validates equipment_id is non-empty string", () => {
    const result = partialUpdateLoadSchema.safeParse({ equipment_id: "  " });
    // min(1) after trim means whitespace-only fails
    expect(result.success).toBe(false);
  });
});

// ── R-P4-21: PATCH executes UPDATE SQL with equipment_id = ? ─────────────────

describe("R-P4-21 — PATCH /api/loads/:id with equipment_id executes UPDATE with equipment_id = ?", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(
      DEFAULT_SQL_PRINCIPAL,
    );
    // pool.execute used by isTokenRevoked — default: not revoked
    mockQuery.mockResolvedValue([[]]);
  });

  // Tests R-P4-21
  it("Tests R-P4-21 — UPDATE SQL contains equipment_id = ? with correct parameter", async () => {
    // Note: isTokenRevoked is globally mocked in __tests__/setup.ts and does
    // NOT hit pool.execute. resolveLoadNotesColumn() is only called when the
    // request body includes `notes` — not the case here. So the query sequence
    // is: SELECT id, UPDATE, SELECT *, SELECT load_legs (4 calls, not 5).
    mockQuery
      .mockResolvedValueOnce([[{ id: "load-123" }]]) // SELECT id to confirm load exists
      .mockResolvedValueOnce([{ affectedRows: 1 }]) // UPDATE
      .mockResolvedValueOnce([[{ ...loadRow, equipment_id: "EQ-001" }]]) // SELECT *
      .mockResolvedValueOnce([[]]); // SELECT load_legs

    const app = createApp();
    const res = await request(app)
      .patch("/api/loads/load-123")
      .set("Authorization", "Bearer valid-token")
      .send({ equipment_id: "EQ-001" });

    expect(res.status).toBe(200);

    // Find the UPDATE call
    const updateCall = mockQuery.mock.calls.find(
      (c: unknown[]) =>
        typeof c[0] === "string" && c[0].includes("UPDATE loads SET"),
    );
    expect(updateCall).toBeDefined();
    expect(updateCall![0]).toContain("equipment_id = ?");
    expect(updateCall![1]).toContain("EQ-001");
  });
});

// ── R-P4-22: PATCH with ONLY equipment_id succeeds ───────────────────────────

describe("R-P4-22 — PATCH with only equipment_id succeeds (no 400)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(
      DEFAULT_SQL_PRINCIPAL,
    );
    // pool.execute used by isTokenRevoked — default: not revoked
    mockQuery.mockResolvedValue([[]]);
  });

  // Tests R-P4-22
  it("Tests R-P4-22 — PATCH { equipment_id: 'EQ-001' } returns 200 not 400", async () => {
    // See R-P4-21 note — 4 queries, not 5 (isTokenRevoked is globally mocked,
    // and resolveLoadNotesColumn is only called when `notes` is in the body).
    mockQuery
      .mockResolvedValueOnce([[{ id: "load-123" }]])
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([[{ ...loadRow, equipment_id: "EQ-001" }]])
      .mockResolvedValueOnce([[]]);

    const app = createApp();
    const res = await request(app)
      .patch("/api/loads/load-123")
      .set("Authorization", "Bearer valid-token")
      .send({ equipment_id: "EQ-001" });

    expect(res.status).toBe(200);
    expect(res.body).not.toHaveProperty("error");
  });

  // Regression guard: empty body still returns 400
  it("Tests R-P4-22 — PATCH {} still returns 400 No supported persisted fields", async () => {
    const app = createApp();
    const res = await request(app)
      .patch("/api/loads/load-123")
      .set("Authorization", "Bearer valid-token")
      .send({});

    expect(res.status).toBe(400);
    // ValidationError envelope: top-level message="Validation failed",
    // refine() message lives in details.fields[].message
    const fields = res.body?.details?.fields ?? [];
    const refineMsgs = fields
      .map((f: { message: string }) => f.message)
      .join(" ");
    const errText = `${res.body?.message ?? ""} ${refineMsgs}`;
    expect(errText).toMatch(/At least one supported partial-update field/i);
  });
});
