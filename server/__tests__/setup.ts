/**
 * Vitest global setup file for the server test suite.
 *
 * Responsibilities:
 * - Loads .env from the project root so DB/Firebase credentials are available
 * - Sets NODE_ENV=test to enable test-mode behavior in env validation
 * - Configures global test timeout
 */
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { vi } from "vitest";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "../../");

// Load .env before anything else touches process.env
dotenv.config({ path: path.join(projectRoot, ".env") });

// Ensure test environment
process.env.NODE_ENV = "test";

// Enable auto-provisioning in tests (production defaults to false for safety)
if (!process.env.ALLOW_AUTO_PROVISION) {
  process.env.ALLOW_AUTO_PROVISION = "true";
}

// Suppress noisy pino logs during tests (unless DEBUG_TESTS is set)
if (!process.env.DEBUG_TESTS) {
  process.env.LOG_LEVEL = "silent";
}

vi.mock("../db", () => ({
  default: {
    query: vi.fn().mockResolvedValue([[], []]),
    execute: vi.fn().mockResolvedValue([[], []]),
    getConnection: vi.fn().mockResolvedValue({
      query: vi.fn().mockResolvedValue([[], []]),
      execute: vi.fn().mockResolvedValue([[], []]),
      beginTransaction: vi.fn().mockResolvedValue(undefined),
      commit: vi.fn().mockResolvedValue(undefined),
      rollback: vi.fn().mockResolvedValue(undefined),
      release: vi.fn(),
    }),
  },
}));

vi.mock("../lib/token-revocation", () => ({
  isTokenRevoked: vi.fn().mockResolvedValue(false),
  revokeUserTokens: vi.fn().mockResolvedValue(undefined),
}));
