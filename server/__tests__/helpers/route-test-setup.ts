/**
 * Shared route test setup — centralizes mock implementations and constants
 * used across all route test files.
 *
 * IMPORTANT: Due to Vitest's module hoisting requirements, vi.mock() calls
 * MUST remain in each test file — they cannot be delegated to a helper.
 * This module provides the mock IMPLEMENTATIONS and shared constants only.
 *
 * ## Usage (simple routes — quotes, contacts, bookings, etc.)
 *
 * ```ts
 * import { describe, it, expect, vi, beforeEach } from "vitest";
 *
 * // 1. Hoist mockQuery
 * const { mockQuery } = vi.hoisted(() => ({
 *   mockQuery: vi.fn(),
 * }));
 *
 * // 2. vi.mock calls (must be in the test file — Vitest hoists these)
 * vi.mock("../../db", () => ({ default: { query: mockQuery } }));
 * vi.mock("../../lib/logger", () => MOCK_LOGGER_FACTORY());
 * vi.mock("../../middleware/requireAuth", () => ({
 *   requireAuth: createMockRequireAuth(() => mockAuthState),
 * }));
 * vi.mock("../../middleware/requireTenant", () => ({
 *   requireTenant: MOCK_REQUIRE_TENANT,
 * }));
 *
 * // 3. Import helpers
 * import { createMockAuthState, buildRouteApp, MOCK_LOGGER_FACTORY, createMockRequireAuth, MOCK_REQUIRE_TENANT } from "../helpers/route-test-setup";
 * import myRouter from "../../routes/my-route";
 *
 * // 4. Create mutable auth state
 * const mockAuthState = createMockAuthState();
 *
 * // 5. Build app
 * const buildApp = () => buildRouteApp(myRouter);
 * ```
 *
 * ## Usage (SQL-auth routes — loads, dispatch, incidents, etc.)
 *
 * ```ts
 * // Additional hoisted mock:
 * const { mockQuery, mockResolveSqlPrincipalByFirebaseUid } = vi.hoisted(() => ({
 *   mockQuery: vi.fn(),
 *   mockResolveSqlPrincipalByFirebaseUid: vi.fn(),
 * }));
 *
 * // Additional vi.mock:
 * vi.mock("../../lib/sql-auth", () => ({
 *   resolveSqlPrincipalByFirebaseUid: mockResolveSqlPrincipalByFirebaseUid,
 * }));
 *
 * // Import DEFAULT_SQL_PRINCIPAL from existing helper:
 * import { DEFAULT_SQL_PRINCIPAL } from "../helpers/mock-sql-auth";
 * ```
 */

import express, { Router } from "express";
import { errorHandler } from "../../middleware/errorHandler";

// Re-export from existing helper for convenience
export { DEFAULT_SQL_PRINCIPAL } from "./mock-sql-auth";

// ── Auth State ──────────────────────────────────────────────────────────────

/**
 * Mutable auth state object. Tests can modify these fields to control
 * the mock requireAuth behavior per-test.
 */
export interface MockAuthState {
  role: string;
  tenantId: string;
  companyId: string;
  uid: string;
  email: string;
  firebaseUid: string;
  /** When false, requireAuth returns 401. */
  enabled: boolean;
}

/**
 * Creates a fresh mutable auth state with sensible defaults.
 * Mutate the returned object in beforeEach to change per-test behavior.
 */
export function createMockAuthState(
  overrides: Partial<MockAuthState> = {},
): MockAuthState {
  return {
    role: "dispatcher",
    tenantId: "company-aaa",
    companyId: "company-aaa",
    uid: "user-1",
    email: "test@loadpilot.com",
    firebaseUid: "firebase-uid-1",
    enabled: true,
    ...overrides,
  };
}

/**
 * Resets the auth state to default values. Call in beforeEach.
 */
export function resetAuthState(
  state: MockAuthState,
  overrides: Partial<MockAuthState> = {},
): void {
  Object.assign(state, {
    role: "dispatcher",
    tenantId: "company-aaa",
    companyId: "company-aaa",
    uid: "user-1",
    email: "test@loadpilot.com",
    firebaseUid: "firebase-uid-1",
    enabled: true,
    ...overrides,
  });
}

// ── Mock Factories ──────────────────────────────────────────────────────────

/**
 * Returns the logger mock factory object suitable for vi.mock("../../lib/logger").
 * Must be called as a function because vi.mock factories must return fresh objects.
 */
export function MOCK_LOGGER_FACTORY() {
  return {
    logger: {
      info: () => {},
      error: () => {},
      warn: () => {},
      debug: () => {},
      child: function () {
        return this;
      },
    },
    createChildLogger: () => ({
      info: () => {},
      error: () => {},
      warn: () => {},
      debug: () => {},
    }),
  };
}

/**
 * Creates a mock requireAuth middleware function that reads from
 * the provided auth state getter. The getter must return a MockAuthState
 * reference (use a closure over a module-level variable).
 *
 * @param getState - Function returning the current MockAuthState
 */
export function createMockRequireAuth(getState: () => MockAuthState) {
  return (req: any, res: any, next: any) => {
    const state = getState();
    if (!state.enabled) {
      return res.status(401).json({ error: "Authentication required." });
    }
    req.user = {
      uid: state.uid,
      tenantId: state.tenantId,
      companyId: state.companyId,
      role: state.role,
      email: state.email,
      firebaseUid: state.firebaseUid,
    };
    next();
  };
}

/**
 * Standard mock for requireTenant middleware.
 * Passes through if req.user exists, returns 403 otherwise.
 */
export const MOCK_REQUIRE_TENANT = (req: any, res: any, next: any) => {
  const user = req.user;
  if (!user) {
    return res
      .status(403)
      .json({ error: "Tenant verification requires authentication." });
  }
  next();
};

// ── App Builder ─────────────────────────────────────────────────────────────

/**
 * Builds a minimal Express app with the given router mounted.
 * Includes JSON body parsing and the standard error handler.
 */
export function buildRouteApp(router: Router): express.Express {
  const app = express();
  app.use(express.json());
  app.use(router);
  app.use(errorHandler);
  return app;
}

/**
 * Builds a minimal Express app that always returns 401.
 * Used to test auth enforcement paths.
 */
export function buildUnauthApp(): express.Express {
  const app = express();
  app.use(express.json());
  app.use((_req: any, res: any) => {
    res.status(401).json({ error: "Authentication required." });
  });
  return app;
}

// ── Transaction Mock Helpers ────────────────────────────────────────────────

/**
 * Creates the standard set of transaction mock functions used by routes
 * that use pool.getConnection() for transactions (loads, dispatch, etc.).
 *
 * Returns an object with all mock functions and a mockConnection object.
 * Must be called inside vi.hoisted() in the test file.
 *
 * NOTE: This is a factory function that returns plain objects and vi.fn() calls.
 * It is meant to be called inside vi.hoisted() where vi is available.
 */
export function createTransactionMocks(vi: any) {
  const mockQuery = vi.fn();
  const mockExecute = vi.fn();
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
    execute: mockExecute,
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
  };
}
