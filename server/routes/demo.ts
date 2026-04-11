/**
 * Sales demo reset route — triple-locked (plus requireAuth for the 401
 * layer). POST /api/demo/reset is only mounted in server/index.ts when
 * process.env.ALLOW_DEMO_RESET === "1", so production never registers
 * the route at all. The handler then re-verifies the env flag so a
 * mistaken mount in a non-sales tenant still refuses to run.
 *
 * The 4 gates (in order) are:
 *   1. requireAuth middleware — returns 401 on missing/invalid token
 *   2. user.role === "admin"
 *   3. user.tenantId === SALES_DEMO_COMPANY_ID ("SALES-DEMO-001")
 *   4. process.env.ALLOW_DEMO_RESET === "1"
 *
 * Any gate failure after auth returns 403 with an error code so tests
 * can distinguish the four branches.
 */

import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import mysql from "mysql2/promise";
import { requireAuth } from "../middleware/requireAuth";
import type { AuthenticatedRequest } from "../middleware/requireAuth";
import { requireTenant } from "../middleware/requireTenant";
import { logger } from "../lib/logger";
import { SALES_DEMO_COMPANY_ID } from "../scripts/seed-sales-demo";

const router = Router();

/**
 * Tiny adapter so mysql2 connections satisfy the SqlExecutor structural
 * type that resetSalesDemo expects (execute(sql, params) that returns
 * a rowset-like tuple). We do not import SqlExecutor because that
 * would couple the route bundle to the seed script types at load time.
 */
interface SqlExecutorLike {
  execute(
    sql: string,
    params?: readonly unknown[],
  ): Promise<[unknown, unknown]>;
}

/**
 * Lazy loader for resetSalesDemo. Dynamically imported inside the
 * handler so a misconfigured prod tenant that still somehow mounts
 * the router does not pull the reset script into memory at boot.
 */
async function loadResetSalesDemo(): Promise<
  (conn: SqlExecutorLike, env?: NodeJS.ProcessEnv) => Promise<void>
> {
  const mod = (await import("../scripts/reset-sales-demo")) as {
    resetSalesDemo: (
      conn: SqlExecutorLike,
      env?: NodeJS.ProcessEnv,
    ) => Promise<void>;
  };
  return mod.resetSalesDemo;
}

/**
 * Connection factory seam — tests override this via module-level
 * assignment so the handler runs without a real database. The default
 * opens a short-lived mysql2 connection using the same env vars the
 * seed script uses.
 */
export let createConnection: () => Promise<SqlExecutorLike> = async () => {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    multipleStatements: false,
  });
  return conn as unknown as SqlExecutorLike;
};

/**
 * Test-only hook to override the connection factory. Kept as an
 * exported setter so the handler closure always reads the current
 * value.
 */
export function setCreateConnectionForTests(
  factory: () => Promise<SqlExecutorLike>,
): void {
  createConnection = factory;
}

router.post(
  "/reset",
  requireAuth,
  requireTenant,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = (req as AuthenticatedRequest).user;
      if (!user) {
        // Defensive — requireAuth should have handled this already.
        res.status(401).json({ error: "unauthenticated" });
        return;
      }

      if (user.role !== "admin") {
        res.status(403).json({ error: "forbidden:not_admin" });
        return;
      }

      if (user.tenantId !== SALES_DEMO_COMPANY_ID) {
        res.status(403).json({ error: "forbidden:not_sales_demo_tenant" });
        return;
      }

      if (process.env.ALLOW_DEMO_RESET !== "1") {
        res.status(403).json({ error: "forbidden:reset_disabled" });
        return;
      }

      const resetSalesDemo = await loadResetSalesDemo();
      const conn = await createConnection();
      try {
        await resetSalesDemo(conn);
      } finally {
        const maybeEnd = (conn as unknown as { end?: () => Promise<void> }).end;
        if (typeof maybeEnd === "function") await maybeEnd.call(conn);
      }

      logger.info(
        { userId: user.id, tenantId: user.tenantId },
        "Sales demo reset completed",
      );
      res.status(200).json({ ok: true });
    } catch (err) {
      logger.error({ err }, "Sales demo reset failed");
      next(err);
    }
  },
);

export default router;
