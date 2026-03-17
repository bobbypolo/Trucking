import { Router, Request, Response } from "express";
import pool from "../db";
import admin from "../auth";

const router = Router();

/**
 * GET /api/health
 *
 * Enhanced health check endpoint — used by load balancers and ops monitoring.
 * This endpoint is intentionally UNAUTHENTICATED.
 *
 * Returns:
 *   - status: "ok" | "degraded"
 *   - uptime: process uptime in seconds
 *   - dependencies.db: { status: "connected" | "disconnected", error? }
 *   - dependencies.firebase: { status: "available" | "unavailable", error? }
 */
router.get("/api/health", async (_req: Request, res: Response) => {
  const [dbResult, firebaseResult] = await Promise.all([
    checkDatabase(),
    checkFirebase(),
  ]);

  const allHealthy =
    dbResult.status === "connected" && firebaseResult.status === "available";

  res.json({
    status: allHealthy ? "ok" : "degraded",
    message: "LoadPilot API",
    uptime: process.uptime(),
    dependencies: {
      db: dbResult,
      firebase: firebaseResult,
    },
  });
});

async function checkDatabase(): Promise<{
  status: "connected" | "disconnected";
  error?: string;
}> {
  try {
    const queryWithTimeout = new Promise<void>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error("DB health check timed out")),
        2000,
      );
      pool
        .query("SELECT 1")
        .then(() => {
          clearTimeout(timer);
          resolve();
        })
        .catch((err: unknown) => {
          clearTimeout(timer);
          reject(err);
        });
    });
    await queryWithTimeout;
    return { status: "connected" };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { status: "disconnected", error: message };
  }
}

function checkFirebase(): Promise<{
  status: "available" | "unavailable";
  error?: string;
}> {
  try {
    const auth = admin.auth();
    if (!auth) {
      return Promise.resolve({ status: "unavailable", error: "auth() returned null" });
    }
    return Promise.resolve({ status: "available" });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return Promise.resolve({ status: "unavailable", error: message });
  }
}

export default router;
