/**
 * Shared test app factory — creates a real Express app with all routes mounted.
 *
 * Usage:
 *   import { createTestApp } from "../helpers/test-app";
 *   const app = createTestApp();
 *   // Use with supertest: request(app).get("/api/health")...
 *
 * The app uses the real DB pool from db.ts (which reads from .env loaded by
 * setup.ts) and the real middleware stack. For integration tests that need
 * authenticated requests, use createTestApp({ authBypass: { ... } }) to
 * inject a user context without requiring Firebase.
 *
 * This factory does NOT call app.listen() — supertest handles that.
 */
import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import { errorHandler } from "../../middleware/errorHandler";
import { correlationId } from "../../middleware/correlationId";
import { metricsMiddleware } from "../../middleware/metrics";

// Route imports
import usersRouter from "../../routes/users";
import loadsRouter from "../../routes/loads";
import equipmentRouter from "../../routes/equipment";
import clientsRouter from "../../routes/clients";
import contractsRouter from "../../routes/contracts";
import dispatchRouter from "../../routes/dispatch";
import complianceRouter from "../../routes/compliance";
import incidentsRouter from "../../routes/incidents";
import accountingRouter from "../../routes/accounting";
import exceptionsRouter from "../../routes/exceptions";
import trackingRouter from "../../routes/tracking";
import weatherRouter from "../../routes/weather";
import metricsRouter from "../../routes/metrics";
import aiRouter from "../../routes/ai";
import messagesRouter from "../../routes/messages";
import callSessionsRouter from "../../routes/call-sessions";
import quotesRouter from "../../routes/quotes";
import leadsRouter from "../../routes/leads";
import bookingsRouter from "../../routes/bookings";
import contactsRouter from "../../routes/contacts";
import providersRouter from "../../routes/providers";
import tasksRouter from "../../routes/tasks";
import kciRequestsRouter from "../../routes/kci-requests";
import crisisActionsRouter from "../../routes/crisis-actions";
import serviceTicketsRouter from "../../routes/service-tickets";
import healthRouter from "../../routes/health";

/**
 * Auth bypass user context — injected into req.user when authBypass is provided.
 * This replaces Firebase token verification for integration tests that need
 * authenticated routes without a running Firebase instance.
 */
export interface TestAuthUser {
  id: string;
  uid: string;
  tenantId: string;
  companyId: string;
  role: string;
  email: string;
  firebaseUid: string;
}

export interface CreateTestAppOptions {
  /**
   * When provided, injects this user into req.user on every request,
   * bypassing the real requireAuth middleware's Firebase verification.
   * The rest of the middleware stack (requireTenant, rate limiting, etc.)
   * still runs normally.
   *
   * When omitted, the real requireAuth middleware runs (requires Firebase).
   */
  authBypass?: TestAuthUser;
}

/**
 * Default test user for authBypass — admin role in tenant "test-company".
 */
export const DEFAULT_TEST_USER: TestAuthUser = {
  id: "test-user-1",
  uid: "test-user-1",
  tenantId: "test-company",
  companyId: "test-company",
  role: "admin",
  email: "test@loadpilot.com",
  firebaseUid: "firebase-test-uid-1",
};

export function createTestApp(options: CreateTestAppOptions = {}): express.Express {
  const app = express();

  // Core middleware (same as production index.ts)
  app.use(helmet());
  app.use(compression());
  app.use(cors());
  app.use(express.json());
  app.use(correlationId);
  app.use(metricsMiddleware);

  // Auth bypass: inject user context before routes if specified.
  // This runs before requireAuth in each route, so when requireAuth checks
  // for an existing req.user, it finds one already set.
  // NOTE: requireAuth does NOT short-circuit on existing req.user — it always
  // verifies the Bearer token. So for true bypass, integration tests should
  // either: (a) have Firebase available, or (b) use this factory which
  // inserts the user just before the route handlers, and tests should
  // mock requireAuth at the module level.
  if (options.authBypass) {
    const user = options.authBypass;
    app.use((req: Request, _res: Response, next: NextFunction) => {
      (req as any).user = { ...user };
      next();
    });
  }

  // Health check (unauthenticated, before rate limiter)
  app.use(healthRouter);

  // Route mounting (same order as production index.ts)
  app.use(usersRouter);
  app.use(loadsRouter);
  app.use(equipmentRouter);
  app.use(clientsRouter);
  app.use(contractsRouter);
  app.use(dispatchRouter);
  app.use(complianceRouter);
  app.use(incidentsRouter);
  app.use(accountingRouter);
  app.use(exceptionsRouter);
  app.use(trackingRouter);
  app.use(weatherRouter);
  app.use(metricsRouter);
  app.use("/api/ai", express.json({ limit: "5mb" }), aiRouter);
  app.use(messagesRouter);
  app.use(callSessionsRouter);
  app.use(quotesRouter);
  app.use(leadsRouter);
  app.use(bookingsRouter);
  app.use(contactsRouter);
  app.use(providersRouter);
  app.use(tasksRouter);
  app.use(kciRequestsRouter);
  app.use(crisisActionsRouter);
  app.use(serviceTicketsRouter);

  // Error handler (must be last)
  app.use(errorHandler);

  return app;
}
