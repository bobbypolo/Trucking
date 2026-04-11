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
                  role: "driver",
                  email: "driver@test.com",
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
  status: "planned",
  carrier_rate: 2000,
  driver_pay: 1000,
  pickup_date: "2026-04-01",
  commodity: "Paper",
  weight: 18000,
  bol_number: "BOL-OLD",
  notification_emails: "[]",
  gps_history: "[]",
  pod_urls: "[]",
  customer_user_id: null,
  deleted_at: null,
};

describe("PATCH /api/loads/:id", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(
      DEFAULT_SQL_PRINCIPAL,
    );
  });

  it("updates scan-extracted fields on an existing tenant-scoped load", async () => {
    mockQuery
      .mockResolvedValueOnce([[{ id: "load-123" }]])
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([
        [
          {
            ...loadRow,
            weight: 22000,
            commodity: "Steel",
            bol_number: "BOL-NEW",
          },
        ],
      ])
      .mockResolvedValueOnce([[]]);

    const app = createApp();
    const res = await request(app)
      .patch("/api/loads/load-123")
      .set("Authorization", "Bearer valid-token")
      .send({
        weight: 22000,
        commodity: "Steel",
        bol_number: "BOL-NEW",
      });

    expect(res.status).toBe(200);
    expect(res.body.weight).toBe(22000);
    expect(res.body.commodity).toBe("Steel");
    expect(res.body.bol_number).toBe("BOL-NEW");

    expect(mockQuery.mock.calls[0][0]).toContain(
      "SELECT id, driver_id, load_number FROM loads WHERE id = ? AND company_id = ?",
    );
    expect(mockQuery.mock.calls[0][1]).toEqual(["load-123", "company-aaa"]);

    expect(mockQuery.mock.calls[1][0]).toContain(
      "UPDATE loads SET weight = ?, commodity = ?, bol_number = ?",
    );
    expect(mockQuery.mock.calls[1][1]).toEqual([
      22000,
      "Steel",
      "BOL-NEW",
      "load-123",
      "company-aaa",
    ]);
  });

  it("maps reference_number to bol_number when a dedicated reference column is unavailable", async () => {
    mockQuery
      .mockResolvedValueOnce([[{ id: "load-123" }]])
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([[{ ...loadRow, bol_number: "REF-7788" }]])
      .mockResolvedValueOnce([[]]);

    const app = createApp();
    const res = await request(app)
      .patch("/api/loads/load-123")
      .set("Authorization", "Bearer valid-token")
      .send({
        reference_number: "REF-7788",
      });

    expect(res.status).toBe(200);
    expect(mockQuery.mock.calls[1][0]).toContain("bol_number = ?");
    expect(mockQuery.mock.calls[1][1]).toEqual([
      "REF-7788",
      "load-123",
      "company-aaa",
    ]);
  });

  it("persists notes when the loads table exposes a notes-compatible column", async () => {
    mockQuery
      .mockResolvedValueOnce([[{ id: "load-123" }]])
      .mockResolvedValueOnce([[{ COLUMN_NAME: "notes" }]])
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([[loadRow]])
      .mockResolvedValueOnce([[]]);

    const app = createApp();
    const res = await request(app)
      .patch("/api/loads/load-123")
      .set("Authorization", "Bearer valid-token")
      .send({
        notes: "Seal verified at pickup",
      });

    expect(res.status).toBe(200);
    expect(mockQuery.mock.calls[1][0]).toContain("INFORMATION_SCHEMA.COLUMNS");
    expect(mockQuery.mock.calls[2][0]).toContain("UPDATE loads SET");
    expect(mockQuery.mock.calls[2][0]).toMatch(
      /dispatch_notes = \?|special_instructions = \?|notes = \?/,
    );
    expect(mockQuery.mock.calls[2][1]).toEqual([
      "Seal verified at pickup",
      "load-123",
      "company-aaa",
    ]);
  });
});
