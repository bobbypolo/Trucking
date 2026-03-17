import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Mock setup (hoisted so vi.mock factory can reference them) ---
const { mockQuery, mockResolveSqlPrincipalByFirebaseUid } = vi.hoisted(() => {
  const mockQuery = vi.fn();
  return {
    mockQuery,
    mockResolveSqlPrincipalByFirebaseUid: vi.fn(),
  };
});

vi.mock("../../db", () => ({
  default: {
    query: mockQuery,
    getConnection: vi.fn(),
  },
}));

vi.mock("../../helpers", () => ({
  redactData: (data: unknown) => data,
  getVisibilitySettings: vi.fn().mockResolvedValue({}),
  sendNotification: vi.fn(),
  checkBreakdownLateness: vi
    .fn()
    .mockResolvedValue({ isLate: false, dist: 100, required: 2 }),
}));

vi.mock("../../lib/logger", () => ({
  createChildLogger: () => ({
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
                  role: "dispatcher",
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
import loadRoutes from "../../routes/loads";
import { errorHandler } from "../../middleware/errorHandler";
import { DEFAULT_SQL_PRINCIPAL } from "../helpers/mock-sql-auth";

mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(DEFAULT_SQL_PRINCIPAL);

// --- Test data ---
const COMPANY_A = "company-aaa";
const COMPANY_B = "company-bbb";

function createApp() {
  const app = express();
  app.use(express.json());
  app.use(loadRoutes);
  app.use(errorHandler);
  return app;
}

describe("DELETE /api/loads/:id — soft-delete with status guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(
      DEFAULT_SQL_PRINCIPAL,
    );
  });

  it("soft-deletes a load in 'draft' status and returns 200", async () => {
    // Mock: load lookup returns a draft load
    mockQuery.mockResolvedValueOnce([[{ id: "load-001", status: "draft" }]]);
    // Mock: UPDATE sets deleted_at
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }]);

    const app = createApp();
    const res = await request(app)
      .delete("/api/loads/load-001")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Load deleted");

    // Verify SELECT query includes company_id and deleted_at IS NULL
    const selectCall = mockQuery.mock.calls[0];
    expect(selectCall[0]).toContain("company_id = ?");
    expect(selectCall[0]).toContain("deleted_at IS NULL");
    expect(selectCall[1]).toEqual(["load-001", COMPANY_A]);

    // Verify UPDATE query sets deleted_at
    const updateCall = mockQuery.mock.calls[1];
    expect(updateCall[0]).toContain("deleted_at = NOW()");
    expect(updateCall[1]).toEqual(["load-001", COMPANY_A]);
  });

  it("soft-deletes a load in 'planned' status", async () => {
    mockQuery.mockResolvedValueOnce([[{ id: "load-002", status: "planned" }]]);
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }]);

    const app = createApp();
    const res = await request(app)
      .delete("/api/loads/load-002")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Load deleted");
  });

  it("soft-deletes a load in 'cancelled' status", async () => {
    mockQuery.mockResolvedValueOnce([
      [{ id: "load-003", status: "cancelled" }],
    ]);
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }]);

    const app = createApp();
    const res = await request(app)
      .delete("/api/loads/load-003")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Load deleted");
  });

  it("rejects deletion of load in 'in_transit' status with 422", async () => {
    mockQuery.mockResolvedValueOnce([
      [{ id: "load-004", status: "in_transit" }],
    ]);

    const app = createApp();
    const res = await request(app)
      .delete("/api/loads/load-004")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(422);
    expect(res.body.error).toContain("in_transit");
    expect(res.body.error).toContain("Cannot delete");

    // No UPDATE query should have been called
    expect(mockQuery).toHaveBeenCalledTimes(1);
  });

  it("rejects deletion of load in 'dispatched' status with 422", async () => {
    mockQuery.mockResolvedValueOnce([
      [{ id: "load-005", status: "dispatched" }],
    ]);

    const app = createApp();
    const res = await request(app)
      .delete("/api/loads/load-005")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(422);
    expect(res.body.error).toContain("dispatched");
  });

  it("rejects deletion of load in 'delivered' status with 422", async () => {
    mockQuery.mockResolvedValueOnce([
      [{ id: "load-006", status: "delivered" }],
    ]);

    const app = createApp();
    const res = await request(app)
      .delete("/api/loads/load-006")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(422);
    expect(res.body.error).toContain("delivered");
  });

  it("rejects deletion of load in 'completed' status with 422", async () => {
    mockQuery.mockResolvedValueOnce([
      [{ id: "load-007", status: "completed" }],
    ]);

    const app = createApp();
    const res = await request(app)
      .delete("/api/loads/load-007")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(422);
    expect(res.body.error).toContain("completed");
  });

  it("returns 404 when load does not exist", async () => {
    // Mock: no matching rows
    mockQuery.mockResolvedValueOnce([[]]);

    const app = createApp();
    const res = await request(app)
      .delete("/api/loads/nonexistent-load")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Load not found");
  });

  it("returns 404 when load belongs to a different tenant (tenant isolation)", async () => {
    // The SELECT query filters by company_id from auth context,
    // so a load from COMPANY_B will not be found when user is in COMPANY_A
    mockQuery.mockResolvedValueOnce([[]]);

    const app = createApp();
    const res = await request(app)
      .delete("/api/loads/load-from-other-tenant")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Load not found");

    // Verify the query was scoped to the authenticated tenant
    const selectCall = mockQuery.mock.calls[0];
    expect(selectCall[1]).toEqual(["load-from-other-tenant", COMPANY_A]);
  });

  it("returns 404 when load is already soft-deleted", async () => {
    // The SELECT query filters by deleted_at IS NULL,
    // so an already-deleted load won't be found
    mockQuery.mockResolvedValueOnce([[]]);

    const app = createApp();
    const res = await request(app)
      .delete("/api/loads/already-deleted-load")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Load not found");
  });

  it("GET /api/loads excludes soft-deleted loads", async () => {
    // The GET query now includes "deleted_at IS NULL"
    mockQuery.mockResolvedValueOnce([
      [
        {
          id: "load-active",
          company_id: COMPANY_A,
          status: "draft",
          notification_emails: "[]",
          gps_history: "[]",
          pod_urls: "[]",
          customer_user_id: null,
        },
      ],
    ]);
    // Mock legs query for the one active load
    mockQuery.mockResolvedValueOnce([[]]);

    const app = createApp();
    const res = await request(app)
      .get("/api/loads")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(200);

    // Verify the GET query includes the deleted_at filter
    const selectCall = mockQuery.mock.calls[0];
    expect(selectCall[0]).toContain("deleted_at IS NULL");
  });
});
