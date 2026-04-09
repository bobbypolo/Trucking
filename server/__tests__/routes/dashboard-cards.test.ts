import { describe, it, expect, vi, beforeEach } from "vitest";

// Tests R-P2-10

// Hoisted mocks
const { mockQuery, mockResolveSqlPrincipalByFirebaseUid } = vi.hoisted(() => {
  const mockQuery = vi.fn();
  return { mockQuery, mockResolveSqlPrincipalByFirebaseUid: vi.fn() };
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
}));

import express from "express";
import request from "supertest";
import dispatchRouter from "../../routes/dispatch";
import { errorHandler } from "../../middleware/errorHandler";
import { DEFAULT_SQL_PRINCIPAL } from "../helpers/mock-sql-auth";

mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(DEFAULT_SQL_PRINCIPAL);

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(dispatchRouter);
  app.use(errorHandler);
  return app;
}

const AUTH_HEADER = "Bearer valid-firebase-token";

describe("GET /api/dashboard/cards (R-P2-10)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(
      DEFAULT_SQL_PRINCIPAL,
    );
  });

  it("returns 200 with dashboard cards — no company_id filter needed", async () => {
    const mockCards = [
      {
        card_code: "DELAY_ENTRY",
        display_name: "Delay Entry",
        sort_order: 10,
        icon_key: "clock",
        route: "/exceptions?view=delay-entry",
        filter_json: "{}",
      },
      {
        card_code: "CARRIER_DELAY",
        display_name: "Carrier Delay",
        sort_order: 20,
        icon_key: "alert",
        route: "/exceptions?view=carrier-delay",
        filter_json: "{}",
      },
    ];
    mockQuery.mockResolvedValueOnce([mockCards]);

    const app = buildApp();
    const res = await request(app)
      .get("/api/dashboard/cards")
      .set("Authorization", AUTH_HEADER);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].card_code).toBe("DELAY_ENTRY");
  });

  it("query does NOT reference company_id (table has no such column)", async () => {
    mockQuery.mockResolvedValueOnce([[]]);

    const app = buildApp();
    await request(app)
      .get("/api/dashboard/cards")
      .set("Authorization", AUTH_HEADER);

    // The SQL query passed to pool.query must NOT contain company_id
    expect(mockQuery).toHaveBeenCalled();
    const sql = mockQuery.mock.calls[0][0] as string;
    expect(sql.toLowerCase()).not.toContain("company_id");
  });

  it("returns 401 without auth", async () => {
    const app = buildApp();
    const res = await request(app).get("/api/dashboard/cards");
    expect([401, 403]).toContain(res.status);
  });
});
