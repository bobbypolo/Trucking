/**
 * Tests R-P6-05 + R-P6-06: POST /api/demo/reset 4-gate authorization.
 *
 * The demo-reset endpoint is mounted only when ALLOW_DEMO_RESET=1 in
 * server/index.ts. Once mounted, the handler enforces 4 gates in order:
 *
 *   1. requireAuth (401 on missing user)
 *   2. user.role === "admin" (403 otherwise)
 *   3. user.tenantId === "SALES-DEMO-001" (403 otherwise)
 *   4. process.env.ALLOW_DEMO_RESET === "1" (403 otherwise — defense
 *      against a misconfigured prod tenant somehow mounting the route)
 *
 * Strategy: build a minimal Express app, mount the live router, and
 * exercise the real handler against fake `req.user` shapes via a tiny
 * stub of `requireAuth` that injects whatever user the test wants.
 * Override the connection factory so the inner reset script can run
 * against an in-memory SqlExecutor stub.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import express from "express";
import request from "supertest";

// Mock requireAuth so we can inject the user shape under test.
let injectedUser: { id: string; role: string; tenantId: string } | null = null;
vi.mock("../../middleware/requireAuth", () => ({
  requireAuth: (
    req: express.Request,
    _res: express.Response,
    next: express.NextFunction,
  ) => {
    if (injectedUser) {
      (req as unknown as { user: typeof injectedUser }).user = injectedUser;
    }
    next();
  },
}));

// Pass-through mock so the route-level requireTenant middleware does not
// short-circuit the handler's own unauthenticated / not_admin / tenant
// checks that the 4-gate tests (R-P6-05) exercise directly.
vi.mock("../../middleware/requireTenant", () => ({
  requireTenant: (
    _req: express.Request,
    _res: express.Response,
    next: express.NextFunction,
  ) => next(),
}));

// Mock the reset script so the test never touches a real database.
const resetMock = vi.fn().mockResolvedValue(undefined);
vi.mock("../../scripts/reset-sales-demo", () => ({
  resetSalesDemo: (...args: unknown[]) => resetMock(...args),
}));

import demoRouter, { setCreateConnectionForTests } from "../../routes/demo";

const buildApp = () => {
  const app = express();
  app.use(express.json());
  app.use("/api/demo", demoRouter);
  return app;
};

const ADMIN_USER = {
  id: "SALES-DEMO-ADMIN-001",
  role: "admin",
  tenantId: "SALES-DEMO-001",
};

describe("POST /api/demo/reset — 4-gate authorization (R-P6-05, R-P6-06)", () => {
  beforeEach(() => {
    injectedUser = null;
    resetMock.mockClear();
    process.env.ALLOW_DEMO_RESET = "1";
    setCreateConnectionForTests(async () => ({
      execute: async () => [[], []] as [unknown, unknown],
    }));
  });

  afterEach(() => {
    delete process.env.ALLOW_DEMO_RESET;
  });

  // Tests R-P6-05 (gate 1)
  it("R-P6-05: returns 401 when no authenticated user is present", async () => {
    injectedUser = null;
    const app = buildApp();
    const res = await request(app).post("/api/demo/reset");
    expect(res.status).toBe(401);
    expect(res.body.error).toBe("unauthenticated");
    expect(resetMock).not.toHaveBeenCalled();
  });

  // Tests R-P6-05 (gate 2)
  it("R-P6-05: returns 403 forbidden:not_admin for a non-admin user", async () => {
    injectedUser = { ...ADMIN_USER, role: "driver" };
    const app = buildApp();
    const res = await request(app).post("/api/demo/reset");
    expect(res.status).toBe(403);
    expect(res.body.error).toBe("forbidden:not_admin");
    expect(resetMock).not.toHaveBeenCalled();
  });

  // Tests R-P6-05 (gate 3)
  it("R-P6-05: returns 403 forbidden:not_sales_demo_tenant for an admin from a non-sales tenant", async () => {
    injectedUser = { ...ADMIN_USER, tenantId: "REAL-CUSTOMER-001" };
    const app = buildApp();
    const res = await request(app).post("/api/demo/reset");
    expect(res.status).toBe(403);
    expect(res.body.error).toBe("forbidden:not_sales_demo_tenant");
    expect(resetMock).not.toHaveBeenCalled();
  });

  // Tests R-P6-05 (gate 4)
  it("R-P6-05: returns 403 forbidden:reset_disabled when ALLOW_DEMO_RESET is not '1'", async () => {
    injectedUser = ADMIN_USER;
    process.env.ALLOW_DEMO_RESET = "0";
    const app = buildApp();
    const res = await request(app).post("/api/demo/reset");
    expect(res.status).toBe(403);
    expect(res.body.error).toBe("forbidden:reset_disabled");
    expect(resetMock).not.toHaveBeenCalled();
  });

  // Tests R-P6-06 (happy path — all 4 gates pass)
  it("R-P6-06: returns 200 { ok: true } when all 4 gates pass and the reset script runs", async () => {
    injectedUser = ADMIN_USER;
    process.env.ALLOW_DEMO_RESET = "1";
    const app = buildApp();
    const res = await request(app).post("/api/demo/reset");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
    expect(resetMock).toHaveBeenCalledTimes(1);
  });
});
