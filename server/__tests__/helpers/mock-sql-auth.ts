/**
 * Shared fixture and utilities for the sql-auth mock used across route test files.
 *
 * USAGE IN EACH TEST FILE:
 *
 *   // 1. Hoist the mock function so the vi.mock factory can reference it:
 *   const { mockResolveSqlPrincipalByFirebaseUid } = vi.hoisted(() => ({
 *     mockResolveSqlPrincipalByFirebaseUid: vi.fn(),
 *   }));
 *
 *   // 2. Register the module mock (path must be a string literal — Vitest hoists this):
 *   vi.mock("../../lib/sql-auth", () => ({
 *     resolveSqlPrincipalByFirebaseUid: mockResolveSqlPrincipalByFirebaseUid,
 *   }));
 *
 *   // 3. Import the shared fixture (normal import, runs after vi.mock registration):
 *   import { DEFAULT_SQL_PRINCIPAL } from "../helpers/mock-sql-auth";
 *
 *   // 4. Set the default resolved value at module scope (or in beforeEach):
 *   mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(DEFAULT_SQL_PRINCIPAL);
 *
 * WHY NOT a single vi.mock call in a shared file:
 *   Vitest hoists vi.mock() calls and resolves module paths relative to the calling
 *   test file. A shared helper cannot call vi.mock on behalf of the test file —
 *   the mock path string must be a static literal in the test file itself.
 */

import type { SqlPrincipal } from "../../lib/sql-auth";

/**
 * Default SQL principal fixture returned by the mocked
 * resolveSqlPrincipalByFirebaseUid in route tests.
 */
export const DEFAULT_SQL_PRINCIPAL: SqlPrincipal = {
  id: "1",
  tenantId: "company-aaa",
  companyId: "company-aaa",
  role: "admin",
  email: "test@test.com",
  firebaseUid: "firebase-uid-1",
};
